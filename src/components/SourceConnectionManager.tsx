import React, { useState, useEffect } from "react";
import {
  FaPlay,
  FaPause,
  FaStop,
  FaWifi,
  FaExclamationTriangle,
  FaSync,
  FaChartLine,
  FaDatabase,
} from "react-icons/fa";
import Button from "../components/common/Button";
import { SourceDocumentType } from "../types/project";

interface SourceConnectionManagerProps {
  source: SourceDocumentType;
  onUpdateSource: (source: SourceDocumentType) => void;
  onTestConnection: () => Promise<boolean>;
  className?: string;
}

const SourceConnectionManager: React.FC<SourceConnectionManagerProps> = ({
  source,
  onUpdateSource,
  onTestConnection,
  className = "",
}) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionData, setConnectionData] = useState({
    status: source.connectionStatus || "disconnected",
    lastConnected: source.lastConnected,
    error: source.connectionError,
    dataCount: source.dataCount || 0,
    lastDataUpdate: source.lastDataUpdate,
  });

  // Only show this component for API and Stream sources
  if (!source.sourceType || !["api", "stream"].includes(source.sourceType)) {
    return null;
  }

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const success = await onTestConnection();
      const newStatus = success ? "connected" : "error";
      const updatedSource = {
        ...source,
        connectionStatus: newStatus as "connected" | "error", // Add type assertion here
        lastConnected: success
          ? new Date().toISOString()
          : source.lastConnected,
        connectionError: success ? undefined : "Connection failed",
      };

      setConnectionData({
        status: newStatus,
        lastConnected: updatedSource.lastConnected,
        error: updatedSource.connectionError,
        dataCount: connectionData.dataCount,
        lastDataUpdate: connectionData.lastDataUpdate,
      });

      onUpdateSource(updatedSource);
    } catch (error) {
      const updatedSource = {
        ...source,
        connectionStatus: "error" as const, // Already has 'as const'
        connectionError: `Connection failed: ${error}`,
      };

      setConnectionData({
        ...connectionData,
        status: "error",
        error: updatedSource.connectionError,
      });

      onUpdateSource(updatedSource);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    const updatedSource = {
      ...source,
      connectionStatus: "disconnected" as const,
      connectionError: undefined,
    };

    setConnectionData({
      ...connectionData,
      status: "disconnected",
      error: undefined,
    });

    onUpdateSource(updatedSource);
  };

  const getStatusIcon = () => {
    switch (connectionData.status) {
      case "connected":
        return <FaWifi className="text-green-500" />;
      case "connecting":
        return <FaSync className="text-blue-500 animate-spin" />;
      case "error":
        return <FaExclamationTriangle className="text-red-500" />;
      case "disconnected":
      default:
        return <FaWifi className="text-gray-400" />;
    }
  };

  const getStatusColor = () => {
    switch (connectionData.status) {
      case "connected":
        return "text-green-600 dark:text-green-400";
      case "connecting":
        return "text-blue-600 dark:text-blue-400";
      case "error":
        return "text-red-600 dark:text-red-400";
      case "disconnected":
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleString();
  };

  const renderConnectionControls = () => {
    if (source.sourceType === "api") {
      return (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleConnect}
            disabled={isConnecting}
            leftIcon={
              isConnecting ? <FaSync className="animate-spin" /> : <FaPlay />
            }
          >
            {isConnecting ? "Testing..." : "Test Connection"}
          </Button>
        </div>
      );
    }

    // Stream controls
    const isActive = connectionData.status === "connected";

    return (
      <div className="flex items-center gap-2">
        {!isActive ? (
          <Button
            variant="primary"
            size="sm"
            onClick={handleConnect}
            disabled={isConnecting}
            leftIcon={
              isConnecting ? <FaSync className="animate-spin" /> : <FaPlay />
            }
          >
            {isConnecting ? "Connecting..." : "Connect"}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDisconnect}
            leftIcon={<FaStop />}
          >
            Disconnect
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={handleConnect}
          disabled={isConnecting}
          leftIcon={<FaSync />}
        >
          Reconnect
        </Button>
      </div>
    );
  };

  const renderDataStatistics = () => {
    if (source.sourceType === "api") {
      return (
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <FaDatabase className="text-blue-500" />
            <span className="text-gray-600 dark:text-gray-400">
              Last Fetched:
            </span>
            <span className="font-medium">
              {formatDate(connectionData.lastDataUpdate)}
            </span>
          </div>
          {source.metadata?.rateLimit && (
            <div className="flex items-center gap-2">
              <FaChartLine className="text-purple-500" />
              <span className="text-gray-600 dark:text-gray-400">
                Rate Limit:
              </span>
              <span className="font-medium">
                {source.metadata.rateLimit.remaining}/
                {source.metadata.rateLimit.limit}
              </span>
            </div>
          )}
        </div>
      );
    }

    // Stream statistics
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
        <div className="flex items-center gap-2">
          <FaDatabase className="text-blue-500" />
          <span className="text-gray-600 dark:text-gray-400">Messages:</span>
          <span className="font-medium">{connectionData.dataCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <FaChartLine className="text-green-500" />
          <span className="text-gray-600 dark:text-gray-400">Last Update:</span>
          <span className="font-medium">
            {formatDate(connectionData.lastDataUpdate)}
          </span>
        </div>
        {source.metadata?.streamHealth && (
          <>
            <div className="flex items-center gap-2">
              <FaWifi className="text-purple-500" />
              <span className="text-gray-600 dark:text-gray-400">Uptime:</span>
              <span className="font-medium">
                {Math.round(source.metadata.streamHealth.uptime)}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <FaSync className="text-orange-500" />
              <span className="text-gray-600 dark:text-gray-400">Latency:</span>
              <span className="font-medium">
                {source.metadata.streamHealth.averageLatency}ms
              </span>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <h3 className="font-medium text-gray-900 dark:text-gray-100">
              {source.sourceType === "api"
                ? "API Connection"
                : "Stream Connection"}
            </h3>
          </div>
          <span className={`text-sm font-medium ${getStatusColor()}`}>
            {connectionData.status.charAt(0).toUpperCase() +
              connectionData.status.slice(1)}
          </span>
        </div>
        {renderConnectionControls()}
      </div>

      {/* Connection Details */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-600 dark:text-gray-400">Endpoint:</span>
          <span className="font-mono text-blue-600 dark:text-blue-400 break-all">
            {source.apiEndpoint || source.streamUrl}
          </span>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            Last Connected:
          </span>
          <span className="font-medium">
            {formatDate(connectionData.lastConnected)}
          </span>
        </div>

        {connectionData.error && (
          <div className="flex items-start gap-2 text-sm p-3 bg-red-50 dark:bg-red-900/20 rounded-md">
            <FaExclamationTriangle className="text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-medium text-red-800 dark:text-red-200">
                Connection Error:
              </span>
              <p className="text-red-700 dark:text-red-300 mt-1">
                {connectionData.error}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Data Statistics */}
      {(connectionData.dataCount > 0 || connectionData.lastDataUpdate) && (
        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Data Statistics
          </h4>
          {renderDataStatistics()}
        </div>
      )}

      {/* Configuration Summary */}
      <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Configuration
        </h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {source.sourceType === "api" && (
            <>
              <div>
                <span className="text-gray-600 dark:text-gray-400">
                  Method:
                </span>
                <span className="ml-2 font-medium">
                  {source.httpMethod || "GET"}
                </span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Auth:</span>
                <span className="ml-2 font-medium">
                  {source.authType || "None"}
                </span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">
                  Format:
                </span>
                <span className="ml-2 font-medium">
                  {source.responseFormat || "JSON"}
                </span>
              </div>
              {source.dataPath && (
                <div>
                  <span className="text-gray-600 dark:text-gray-400">
                    Data Path:
                  </span>
                  <span className="ml-2 font-mono text-sm">
                    {source.dataPath}
                  </span>
                </div>
              )}
            </>
          )}

          {source.sourceType === "stream" && (
            <>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Type:</span>
                <span className="ml-2 font-medium">
                  {source.streamType || "WebSocket"}
                </span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">
                  Reconnect:
                </span>
                <span className="ml-2 font-medium">
                  {source.reconnectInterval || 30}s
                </span>
              </div>
              {source.streamType === "polling" && (
                <div>
                  <span className="text-gray-600 dark:text-gray-400">
                    Interval:
                  </span>
                  <span className="ml-2 font-medium">
                    {source.pollingInterval || 60}s
                  </span>
                </div>
              )}
              {source.dataPath && (
                <div className="col-span-2">
                  <span className="text-gray-600 dark:text-gray-400">
                    Data Path:
                  </span>
                  <span className="ml-2 font-mono text-sm">
                    {source.dataPath}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SourceConnectionManager;
