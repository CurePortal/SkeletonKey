import { SourceDocumentType } from "../types/project";
export interface ConnectionResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    statusCode?: number;
    headers?: Record<string, string>;
    responseTime?: number;
    dataSize?: number;
  };
}
export interface StreamConnection {
  id: string;
  source: SourceDocumentType;
  connection: WebSocket | EventSource | null;
  isConnected: boolean;
  lastMessage?: string;
  messageCount: number;
  startTime: number;
  onMessage: (data: any) => void;
  onError: (error: string) => void;
  onStatusChange: (status: SourceDocumentType["connectionStatus"]) => void;
}
class SourceConnectionService {
  private activeConnections: Map<string, StreamConnection> = new Map();
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();

  async testApiConnection(
    source: SourceDocumentType,
  ): Promise<ConnectionResult> {
    if (!source.apiEndpoint) {
      return { success: false, error: "API endpoint is required" };
    }
    const startTime = Date.now();
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...source.requestHeaders,
      };

      if (source.authType === "bearer" && source.bearerToken) {
        headers["Authorization"] = `Bearer ${source.bearerToken}`;
      } else if (source.authType === "api_key" && source.apiKey) {
        headers["X-API-Key"] = source.apiKey;
      } else if (
        source.authType === "basic" &&
        source.basicAuthUsername &&
        source.basicAuthPassword
      ) {
        const credentials = btoa(
          `${source.basicAuthUsername}:${source.basicAuthPassword}`,
        );
        headers["Authorization"] = `Basic ${credentials}`;
      }
      const options: RequestInit = {
        method: source.httpMethod || "GET",
        headers,
        signal: AbortSignal.timeout(30000),
      };
      if (
        source.requestBody &&
        ["POST", "PUT", "PATCH"].includes(source.httpMethod || "GET")
      ) {
        options.body = source.requestBody;
      }
      const response = await fetch(source.apiEndpoint, options);
      const responseTime = Date.now() - startTime;
      let data: any;
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        data = await response.json();
      } else if (
        contentType?.includes("text/xml") ||
        contentType?.includes("application/xml")
      ) {
        data = await response.text();
      } else {
        data = await response.text();
      }

      if (source.dataPath && typeof data === "object") {
        data = this.extractDataByPath(data, source.dataPath);
      }
      return {
        success: response.ok,
        data,
        error: response.ok
          ? undefined
          : `HTTP ${response.status}: ${response.statusText}`,
        metadata: {
          statusCode: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          responseTime,
          dataSize: JSON.stringify(data).length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        metadata: {
          responseTime: Date.now() - startTime,
        },
      };
    }
  }

  async startStreamConnection(
    source: SourceDocumentType,
    onMessage: (data: any) => void,
    onError: (error: string) => void,
    onStatusChange: (status: SourceDocumentType["connectionStatus"]) => void,
  ): Promise<boolean> {
    if (!source.streamUrl) {
      onError("Stream URL is required");
      return false;
    }

    this.stopStreamConnection(source.id);
    const connection: StreamConnection = {
      id: source.id,
      source,
      connection: null,
      isConnected: false,
      messageCount: 0,
      startTime: Date.now(),
      onMessage,
      onError,
      onStatusChange,
    };
    try {
      onStatusChange("connecting");
      switch (source.streamType) {
        case "websocket":
          await this.createWebSocketConnection(connection);
          break;
        case "sse":
          await this.createServerSentEventsConnection(connection);
          break;
        case "polling":
          await this.createPollingConnection(connection);
          break;
        default:
          throw new Error(`Unsupported stream type: ${source.streamType}`);
      }
      this.activeConnections.set(source.id, connection);
      return true;
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "Failed to start stream connection",
      );
      onStatusChange("error");
      return false;
    }
  }

  stopStreamConnection(sourceId: string): void {
    const connection = this.activeConnections.get(sourceId);
    if (!connection) return;

    const timer = this.reconnectTimers.get(sourceId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(sourceId);
    }

    if (connection.connection) {
      if (connection.connection instanceof WebSocket) {
        connection.connection.close();
      } else if (connection.connection instanceof EventSource) {
        connection.connection.close();
      }
    }
    connection.isConnected = false;
    connection.onStatusChange("disconnected");
    this.activeConnections.delete(sourceId);
  }

  getConnectionStatus(
    sourceId: string,
  ): SourceDocumentType["connectionStatus"] {
    const connection = this.activeConnections.get(sourceId);
    if (!connection) return "disconnected";
    return connection.isConnected ? "connected" : "disconnected";
  }

  private async createWebSocketConnection(
    connection: StreamConnection,
  ): Promise<void> {
    const { source } = connection;
    const ws = new WebSocket(source.streamUrl!);
    ws.onopen = () => {
      connection.isConnected = true;
      connection.onStatusChange("connected");
    };
    ws.onmessage = (event) => {
      connection.messageCount++;
      let data = event.data;
      try {
        if (typeof data === "string") {
          data = JSON.parse(data);
        }
        if (source.dataPath) {
          data = this.extractDataByPath(data, source.dataPath);
        }
        connection.onMessage(data);
      } catch (error) {
        connection.onError(`Failed to parse message: ${error}`);
      }
    };
    ws.onerror = (error) => {
      connection.onError(`WebSocket error: ${error}`);
      connection.onStatusChange("error");
    };
    ws.onclose = () => {
      connection.isConnected = false;
      connection.onStatusChange("disconnected");
      this.scheduleReconnect(connection);
    };
    connection.connection = ws;
  }

  private async createServerSentEventsConnection(
    connection: StreamConnection,
  ): Promise<void> {
    const { source } = connection;
    const eventSource = new EventSource(source.streamUrl!);
    eventSource.onopen = () => {
      connection.isConnected = true;
      connection.onStatusChange("connected");
    };
    eventSource.onmessage = (event) => {
      connection.messageCount++;
      let data = event.data;
      try {
        if (typeof data === "string") {
          data = JSON.parse(data);
        }
        if (source.dataPath) {
          data = this.extractDataByPath(data, source.dataPath);
        }
        connection.onMessage(data);
      } catch (error) {
        connection.onError(`Failed to parse message: ${error}`);
      }
    };
    eventSource.onerror = (error) => {
      connection.onError(`SSE error: ${error}`);
      connection.onStatusChange("error");
      eventSource.close();
      this.scheduleReconnect(connection);
    };
    connection.connection = eventSource;
  }

  private async createPollingConnection(
    connection: StreamConnection,
  ): Promise<void> {
    const { source } = connection;
    const interval = (source.pollingInterval || 60) * 1000;
    const poll = async () => {
      try {
        const result = await this.testApiConnection(source);
        if (result.success) {
          connection.messageCount++;
          connection.onMessage(result.data);
          if (!connection.isConnected) {
            connection.isConnected = true;
            connection.onStatusChange("connected");
          }
        } else {
          connection.onError(result.error || "Polling failed");
          connection.onStatusChange("error");
        }
      } catch (error) {
        connection.onError(`Polling error: ${error}`);
        connection.onStatusChange("error");
      }
    };

    await poll();

    const timer = setInterval(poll, interval);
    this.reconnectTimers.set(connection.id, timer as any);
  }

  private scheduleReconnect(connection: StreamConnection): void {
    const { source } = connection;
    const reconnectInterval = (source.reconnectInterval || 30) * 1000;
    const maxAttempts = source.maxReconnectAttempts || 5;
    if (connection.messageCount < maxAttempts) {
      const timer = setTimeout(() => {
        this.startStreamConnection(
          source,
          connection.onMessage,
          connection.onError,
          connection.onStatusChange,
        );
      }, reconnectInterval);
      this.reconnectTimers.set(connection.id, timer);
    }
  }

  private extractDataByPath(data: any, path: string): any {
    if (!path || typeof data !== "object") return data;
    const keys = path.split(".");
    let result = data;
    for (const key of keys) {
      if (result === null || result === undefined) {
        return undefined;
      }

      if (key.includes("[") && key.includes("]")) {
        const arrayKey = key.substring(0, key.indexOf("["));
        const indexMatch = key.match(/\[(\d+)\]/);
        if (indexMatch) {
          const index = parseInt(indexMatch[1]);
          result = result[arrayKey];
          if (Array.isArray(result) && index < result.length) {
            result = result[index];
          } else {
            return undefined;
          }
        }
      } else {
        result = result[key];
      }
    }
    return result;
  }

  getActiveConnections(): StreamConnection[] {
    return Array.from(this.activeConnections.values());
  }

  getConnectionStats(sourceId: string): {
    isConnected: boolean;
    messageCount: number;
    uptime: number;
    averageLatency: number;
  } | null {
    const connection = this.activeConnections.get(sourceId);
    if (!connection) return null;
    const uptime = connection.isConnected
      ? Date.now() - connection.startTime
      : 0;
    return {
      isConnected: connection.isConnected,
      messageCount: connection.messageCount,
      uptime,
      averageLatency:
        connection.messageCount > 0 ? uptime / connection.messageCount : 0,
    };
  }

  cleanup(): void {
    for (const sourceId of this.activeConnections.keys()) {
      this.stopStreamConnection(sourceId);
    }
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.activeConnections.clear();
    this.reconnectTimers.clear();
  }

  async fetchApiData(source: SourceDocumentType): Promise<ConnectionResult> {
    const result = await this.testApiConnection(source);
    if (result.success) {
      const updatedSource: Partial<SourceDocumentType> = {
        lastDataUpdate: new Date().toISOString(),
        cachedData: result.data,
        connectionStatus: "connected",
        connectionError: undefined,
      };
      if (result.metadata) {
        updatedSource.metadata = {
          ...source.metadata,
          apiVersion: result.metadata.headers?.["api-version"],
          rateLimit: this.parseRateLimitHeaders(result.metadata.headers || {}),
        };
      }
    }
    return result;
  }

  private parseRateLimitHeaders(
    headers: Record<string, string>,
  ): NonNullable<SourceDocumentType["metadata"]>["rateLimit"] {
    const limit = headers["x-ratelimit-limit"] || headers["x-rate-limit-limit"];
    const remaining =
      headers["x-ratelimit-remaining"] || headers["x-rate-limit-remaining"];
    const reset = headers["x-ratelimit-reset"] || headers["x-rate-limit-reset"];
    if (limit && remaining && reset) {
      return {
        limit: parseInt(limit),
        remaining: parseInt(remaining),
        reset: new Date(parseInt(reset) * 1000).toISOString(),
      };
    }
    return undefined;
  }

  validateSource(source: SourceDocumentType): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    if (!source.sourceType) {
      errors.push("Source type is required");
      return { isValid: false, errors };
    }
    switch (source.sourceType) {
      case "api":
        if (!source.apiEndpoint) {
          errors.push("API endpoint is required");
        }
        if (
          source.authType === "basic" &&
          (!source.basicAuthUsername || !source.basicAuthPassword)
        ) {
          errors.push(
            "Username and password are required for basic authentication",
          );
        }
        if (source.authType === "bearer" && !source.bearerToken) {
          errors.push("Bearer token is required for bearer authentication");
        }
        if (source.authType === "api_key" && !source.apiKey) {
          errors.push("API key is required for API key authentication");
        }
        if (source.requestHeaders) {
          try {
            if (typeof source.requestHeaders === "string") {
              JSON.parse(source.requestHeaders);
            }
          } catch {
            errors.push("Request headers must be valid JSON");
          }
        }
        break;
      case "stream":
        if (!source.streamUrl) {
          errors.push("Stream URL is required");
        }
        if (
          source.streamType === "polling" &&
          (!source.pollingInterval || source.pollingInterval < 1)
        ) {
          errors.push("Polling interval must be at least 1 second");
        }
        if (source.streamType === "webhook" && !source.webhookPath) {
          errors.push("Webhook path is required for webhook streams");
        }
        break;
      case "url":
        if (!source.url) {
          errors.push("URL is required");
        }
        break;
      case "file":
        if (!source.filePath) {
          errors.push("File path is required");
        }
        break;
    }
    return { isValid: errors.length === 0, errors };
  }
}

export const sourceConnectionService = new SourceConnectionService();
export default sourceConnectionService;
