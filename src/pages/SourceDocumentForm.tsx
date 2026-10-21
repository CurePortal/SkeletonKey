// @ts-nocheck
import React, { useState, useEffect, useRef } from "react";
import InputField from "../components/common/InputField";
import Button from "../components/common/Button";
import ApiDataMapper from "../components/ApiDataMapper";
// import SourceConnectionManager from "../components/SourceConnectionManager"; // Temporarily disabled due to FaWifiSlash icon issue
import { SourceDocumentType } from "../types/project";
import { sourceConnectionService } from "../services/sourceConnectionService";
import { useNotification } from "../contexts/NotificationContext"; // Import the notification hook

interface SourceDocumentFormProps {
  initialData?: Partial<SourceDocumentType>;
  onSubmit: (data: any, file?: File | null) => void;
  onCancel: () => void;
}

// Document type options
const DOCUMENT_TYPES = [
  "Book",
  "Article",
  "Journal",
  "Newspaper",
  "Website",
  "Letter",
  "Manuscript",
  "Video",
  "Audio",
  "Interview",
  "Map",
  "Photograph",
  "Painting",
  "Legal Document",
  "Government Record",
  "Research Paper",
  "Report",
  "API Data Source",
  "Live Data Stream",
  "Other",
];

// Source types for different input methods
const SOURCE_TYPES = [
  {
    value: "file",
    label: "File Upload",
    description: "Upload a document file",
  },
  { value: "url", label: "URL/Website", description: "Link to online content" },
  {
    value: "api",
    label: "API Source",
    description: "Connect to an API endpoint",
  },
  {
    value: "stream",
    label: "Live Data Stream",
    description: "Real-time data feed",
  },
];

// Common HTTP methods for API sources
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH"];

// Common authentication types
const AUTH_TYPES = [
  { value: "none", label: "No Authentication" },
  { value: "basic", label: "Basic Auth" },
  { value: "bearer", label: "Bearer Token" },
  { value: "api_key", label: "API Key" },
  { value: "oauth", label: "OAuth 2.0" },
];

// Stream types for live data
const STREAM_TYPES = [
  { value: "websocket", label: "WebSocket" },
  { value: "sse", label: "Server-Sent Events" },
  { value: "polling", label: "HTTP Polling" },
  { value: "webhook", label: "Webhook" },
];

const SourceDocumentForm: React.FC<SourceDocumentFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
}) => {
  const { showSuccess, showError } = useNotification(); // Use the notification hook
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    authors: "",
    publicationDate: "",
    documentType: "book",
    sourceType: "file", // New field for source type
    url: "",
    filePath: "",
    notes: "",
    tags: "",
    // API-specific fields
    apiEndpoint: "",
    httpMethod: "GET",
    authType: "none",
    apiKey: "",
    bearerToken: "",
    basicAuthUsername: "",
    basicAuthPassword: "",
    requestHeaders: "",
    requestBody: "",
    responseFormat: "json",
    // Stream-specific fields
    streamType: "websocket",
    streamUrl: "",
    reconnectInterval: "30",
    maxReconnectAttempts: "5",
    dataPath: "", // JSON path to extract data
    // Polling-specific fields
    pollingInterval: "60",
    lastPolled: "",
    // Webhook-specific fields
    webhookSecret: "",
    webhookPath: "",
    // Data mapping fields
    dataMapping: undefined,
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [testingConnection, setTestingConnection] = useState(false);
  const [showDataMapper, setShowDataMapper] = useState(false);
  const [showConnectionManager, setShowConnectionManager] = useState(false);
  const [currentSource, setCurrentSource] = useState<SourceDocumentType | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title || "",
        description: initialData.description || "",
        authors: Array.isArray(initialData.authors)
          ? initialData.authors.join(", ")
          : initialData.authors || "",
        publicationDate: initialData.publicationDate || "",
        documentType: initialData.type || "book",
        sourceType: initialData.sourceType || "file",
        url: initialData.url || "",
        filePath: initialData.filePath || "",
        notes: initialData.notes || "",
        tags: Array.isArray(initialData.tags)
          ? initialData.tags.join(", ")
          : initialData.tags || "",
        // API fields
        apiEndpoint: initialData.apiEndpoint || "",
        httpMethod: initialData.httpMethod || "GET",
        authType: initialData.authType || "none",
        apiKey: initialData.apiKey || "",
        bearerToken: initialData.bearerToken || "",
        basicAuthUsername: initialData.basicAuthUsername || "",
        basicAuthPassword: initialData.basicAuthPassword || "",
        requestHeaders: (() => {
          if (!initialData.requestHeaders) return "";
          if (typeof initialData.requestHeaders === "string") {
            return initialData.requestHeaders;
          }
          return JSON.stringify(initialData.requestHeaders);
        })(),
        requestBody: initialData.requestBody || "",
        responseFormat: initialData.responseFormat || "json",
        // Stream fields
        streamType: initialData.streamType || "websocket",
        streamUrl: initialData.streamUrl || "",
        reconnectInterval: initialData.reconnectInterval?.toString() || "30",
        maxReconnectAttempts:
          initialData.maxReconnectAttempts?.toString() || "5",
        dataPath: initialData.dataPath || "",
        pollingInterval: initialData.pollingInterval?.toString() || "60",
        lastPolled: initialData.lastPolled || "",
        webhookSecret: initialData.webhookSecret || "",
        webhookPath: initialData.webhookPath || "",
        // Data mapping
        dataMapping: initialData.dataMapping,
      });

      // Set up current source for connection manager and data mapper
      if (initialData.id) {
        // Create a complete SourceDocumentType from the partial
        const completeSource: SourceDocumentType = {
          id: initialData.id,
          title: initialData.title || "",
          sourceType: initialData.sourceType || "file",
          type: initialData.type || "book",
          description: initialData.description,
          authors: initialData.authors,
          publicationDate: initialData.publicationDate,
          url: initialData.url,
          filePath: initialData.filePath,
          fileName: initialData.fileName,
          notes: initialData.notes,
          tags: initialData.tags,
          citations: initialData.citations || {},
          apiEndpoint: initialData.apiEndpoint,
          httpMethod: initialData.httpMethod,
          authType: initialData.authType,
          apiKey: initialData.apiKey,
          bearerToken: initialData.bearerToken,
          basicAuthUsername: initialData.basicAuthUsername,
          basicAuthPassword: initialData.basicAuthPassword,
          requestHeaders: initialData.requestHeaders,
          requestBody: initialData.requestBody,
          responseFormat: initialData.responseFormat,
          streamType: initialData.streamType,
          streamUrl: initialData.streamUrl,
          reconnectInterval: initialData.reconnectInterval,
          maxReconnectAttempts: initialData.maxReconnectAttempts,
          dataPath: initialData.dataPath,
          pollingInterval: initialData.pollingInterval,
          lastPolled: initialData.lastPolled,
          webhookSecret: initialData.webhookSecret,
          webhookPath: initialData.webhookPath,
          dataMapping: initialData.dataMapping,
          connectionStatus: initialData.connectionStatus,
          lastConnected: initialData.lastConnected,
          connectionError: initialData.connectionError,
          cachedData: initialData.cachedData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setCurrentSource(completeSource);
      }

      if (initialData.filePath && !initialData.fileName) {
        const pathParts = initialData.filePath.split(/[\\/]/);
        setFileName(pathParts[pathParts.length - 1]);
      } else if (initialData.fileName) {
        setFileName(initialData.fileName as string);
      }
    }
  }, [initialData]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setFileName(file.name);
      setFormData((prev) => ({
        ...prev,
        filePath: file.name,
      }));
    }
  };

  const handleFileUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Test API connection
  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      // Create a temporary source object for testing
      const tempSource: SourceDocumentType = {
        id: currentSource?.id || "temp-id",
        title: formData.title || "Test Connection",
        sourceType: formData.sourceType as any,
        apiEndpoint: formData.apiEndpoint,
        httpMethod: formData.httpMethod as any,
        authType: formData.authType as any,
        apiKey: formData.apiKey,
        bearerToken: formData.bearerToken,
        basicAuthUsername: formData.basicAuthUsername,
        basicAuthPassword: formData.basicAuthPassword,
        requestHeaders: (() => {
          if (!formData.requestHeaders) return {};
          if (typeof formData.requestHeaders === "string") {
            try {
              return JSON.parse(formData.requestHeaders);
            } catch (e) {
              console.warn("Invalid JSON in requestHeaders:", e);
              return {};
            }
          }
          return formData.requestHeaders;
        })(),
        requestBody: formData.requestBody,
        responseFormat: formData.responseFormat as any,
        streamUrl: formData.streamUrl,
        streamType: formData.streamType as any,
        dataPath: formData.dataPath,
        pollingInterval: parseInt(formData.pollingInterval) || 60,
        reconnectInterval: parseInt(formData.reconnectInterval) || 30,
        maxReconnectAttempts: parseInt(formData.maxReconnectAttempts) || 5,
        webhookSecret: formData.webhookSecret,
        webhookPath: formData.webhookPath,
        type: formData.documentType,
        // Add these missing properties:
        authors: formData.authors
          .split(",")
          .map((a) => a.trim())
          .filter((a) => a),
        publicationDate: formData.publicationDate || "",
        url: formData.url || "",
        filePath: formData.filePath || "",
        fileName: fileName || "",
        notes: formData.notes || "",
        tags: formData.tags
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t),
        citations: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result =
        await sourceConnectionService.testApiConnection(tempSource);

      if (result.success) {
        // Store the successful connection data
        setCurrentSource({
          ...tempSource,
          connectionStatus: "connected",
          lastConnected: new Date().toISOString(),
          cachedData: result.data,
        });

        // Show success message using the notification context
        showSuccess(
          "Connection test successful! Data mapper is now available.",
        );

        // Automatically show the data mapper if we have data
        if (result.data) {
          setShowDataMapper(true);
        }
      } else {
        showError(`Connection test failed: ${result.error}`);
        setCurrentSource(null);
        setShowDataMapper(false);
      }
    } catch (error) {
      showError(
        `Connection test failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      setCurrentSource(null);
      setShowDataMapper(false);
    } finally {
      setTestingConnection(false);
    }
  };

  // Handle connection test for data mapper
  const handleDataMapperTest = async () => {
    if (!currentSource)
      return { success: false, error: "No source configured" };

    // If we already have cached data, return it
    if (currentSource.cachedData) {
      return {
        success: true,
        data: currentSource.cachedData,
      };
    }

    // Otherwise, test the connection again
    const result =
      await sourceConnectionService.testApiConnection(currentSource);

    // Update the cached data if successful
    if (result.success && result.data) {
      setCurrentSource((prev) =>
        prev
          ? {
              ...prev,
              cachedData: result.data,
              lastConnected: new Date().toISOString(),
            }
          : null,
      );
    }

    return result;
  };

  // Handle data mapping updates
  const handleDataMappingUpdate = (mapping: any) => {
    setFormData((prev) => ({
      ...prev,
      dataMapping: mapping,
    }));
  };

  // Handle source updates from connection manager
  const handleSourceUpdate = (updatedSource: SourceDocumentType) => {
    setCurrentSource(updatedSource);
    // Update form data with connection status
    setFormData((prev) => ({
      ...prev,
      connectionStatus: updatedSource.connectionStatus,
      connectionError: updatedSource.connectionError,
      lastConnected: updatedSource.lastConnected,
    }));
  };

  // Validate the form
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = "Title is required";
    }

    // Validate based on source type
    if (formData.sourceType === "url" && !formData.url.trim()) {
      newErrors.url = "URL is required for URL sources";
    }

    if (formData.sourceType === "api") {
      if (!formData.apiEndpoint.trim()) {
        newErrors.apiEndpoint = "API endpoint is required";
      }
      if (
        formData.authType === "basic" &&
        (!formData.basicAuthUsername || !formData.basicAuthPassword)
      ) {
        newErrors.basicAuth =
          "Username and password are required for basic auth";
      }
      if (formData.authType === "bearer" && !formData.bearerToken) {
        newErrors.bearerToken = "Bearer token is required";
      }
      if (formData.authType === "api_key" && !formData.apiKey) {
        newErrors.apiKey = "API key is required";
      }
    }

    if (formData.sourceType === "stream") {
      if (!formData.streamUrl.trim()) {
        newErrors.streamUrl = "Stream URL is required";
      }
      if (
        formData.streamType === "polling" &&
        (!formData.pollingInterval || parseInt(formData.pollingInterval) < 1)
      ) {
        newErrors.pollingInterval =
          "Polling interval must be at least 1 second";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const processedData = {
      ...formData,
      authors: formData.authors
        .split(",")
        .map((author) => author.trim())
        .filter((author) => author.length > 0),
      tags: formData.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
      citations: initialData?.citations || {},
      type: formData.documentType,
      // Convert string numbers back to numbers
      reconnectInterval: parseInt(formData.reconnectInterval) || 30,
      maxReconnectAttempts: parseInt(formData.maxReconnectAttempts) || 5,
      pollingInterval: parseInt(formData.pollingInterval) || 60,
      // Parse request headers if provided
      requestHeaders: (() => {
        if (!formData.requestHeaders) return {};
        if (typeof formData.requestHeaders === "string") {
          try {
            return JSON.parse(formData.requestHeaders);
          } catch (e) {
            console.warn("Invalid JSON in requestHeaders:", e);
            return {};
          }
        }
        return formData.requestHeaders;
      })(),
      // Include data mapping if configured
      dataMapping: formData.dataMapping,
    };

    onSubmit(processedData, selectedFile);
  };

  const renderSourceTypeSelector = () => (
    <div className="md:col-span-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        Source Type
      </label>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {SOURCE_TYPES.map((type) => (
          <label
            key={type.value}
            className={`relative flex flex-col p-3 border rounded-lg cursor-pointer transition-all ${
              formData.sourceType === type.value
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                : "border-gray-300 dark:border-gray-600 hover:border-gray-400"
            }`}
          >
            <input
              type="radio"
              name="sourceType"
              value={type.value}
              checked={formData.sourceType === type.value}
              onChange={handleChange}
              className="sr-only"
            />
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {type.label}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {type.description}
            </span>
          </label>
        ))}
      </div>
    </div>
  );

  const renderFileUploadSection = () => (
    <div className="md:col-span-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Document File
      </label>
      <div
        className="mt-1 flex items-center justify-between p-3 cursor-pointer border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
        onClick={handleFileUploadClick}
      >
        <span
          className={
            fileName
              ? "text-gray-900 dark:text-white"
              : "text-gray-500 dark:text-gray-400"
          }
        >
          {fileName || "Click to upload a file (e.g., PDF, DOCX)"}
        </span>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept=".pdf,.doc,.docx,.txt,.md"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleFileUploadClick();
          }}
          className="ml-3 whitespace-nowrap"
        >
          Browse
        </Button>
      </div>
      {formData.filePath && !selectedFile && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Current file: {formData.filePath}
        </p>
      )}
    </div>
  );

  const renderUrlSection = () => (
    <div className="md:col-span-2">
      <InputField
        label="URL"
        name="url"
        value={formData.url}
        onChange={handleChange}
        placeholder="https://example.com/document"
        type="url"
        required
        error={errors.url}
        helpText="Link to the online document or resource"
      />
    </div>
  );

  const renderApiSection = () => (
    <>
      <div className="md:col-span-2">
        <InputField
          label="API Endpoint"
          name="apiEndpoint"
          value={formData.apiEndpoint}
          onChange={handleChange}
          placeholder="https://api.example.com/v1/data"
          type="url"
          required
          error={errors.apiEndpoint}
          helpText="Full URL of the API endpoint"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          HTTP Method
        </label>
        <select
          name="httpMethod"
          value={formData.httpMethod}
          onChange={handleChange}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        >
          {HTTP_METHODS.map((method) => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Authentication
        </label>
        <select
          name="authType"
          value={formData.authType}
          onChange={handleChange}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        >
          {AUTH_TYPES.map((auth) => (
            <option key={auth.value} value={auth.value}>
              {auth.label}
            </option>
          ))}
        </select>
      </div>

      {formData.authType === "basic" && (
        <>
          <div>
            <InputField
              label="Username"
              name="basicAuthUsername"
              value={formData.basicAuthUsername}
              onChange={handleChange}
              placeholder="Username"
              error={errors.basicAuth}
            />
          </div>
          <div>
            <InputField
              label="Password"
              name="basicAuthPassword"
              value={formData.basicAuthPassword}
              onChange={handleChange}
              placeholder="Password"
              type="password"
              error={errors.basicAuth}
            />
          </div>
        </>
      )}

      {formData.authType === "bearer" && (
        <div className="md:col-span-2">
          <InputField
            label="Bearer Token"
            name="bearerToken"
            value={formData.bearerToken}
            onChange={handleChange}
            placeholder="your-bearer-token"
            type="password"
            error={errors.bearerToken}
          />
        </div>
      )}

      {formData.authType === "api_key" && (
        <div className="md:col-span-2">
          <InputField
            label="API Key"
            name="apiKey"
            value={formData.apiKey}
            onChange={handleChange}
            placeholder="your-api-key"
            type="password"
            error={errors.apiKey}
          />
        </div>
      )}

      <div className="md:col-span-2">
        <InputField
          label="Request Headers (JSON)"
          name="requestHeaders"
          value={formData.requestHeaders}
          onChange={handleChange}
          placeholder='{"Content-Type": "application/json"}'
          helpText="Additional headers as JSON object"
        />
      </div>

      {["POST", "PUT", "PATCH"].includes(formData.httpMethod || "GET") && (
        <div className="md:col-span-2">
          <InputField
            label="Request Body"
            name="requestBody"
            value={formData.requestBody}
            onChange={handleChange}
            placeholder="Request body data"
            as="textarea"
            rows={3}
            helpText="Request body for POST/PUT/PATCH requests"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Response Format
        </label>
        <select
          name="responseFormat"
          value={formData.responseFormat}
          onChange={handleChange}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        >
          <option value="json">JSON</option>
          <option value="xml">XML</option>
          <option value="text">Plain Text</option>
          <option value="csv">CSV</option>
        </select>
      </div>

      <div>
        <InputField
          label="Data Path"
          name="dataPath"
          value={formData.dataPath}
          onChange={handleChange}
          placeholder="data.items"
          helpText="JSON path to extract specific data (e.g., 'data.items')"
        />
      </div>

      <div className="md:col-span-2 flex justify-end space-x-3">
        <Button
          type="button"
          variant="outline"
          onClick={handleTestConnection}
          disabled={testingConnection}
        >
          {testingConnection ? "Testing..." : "Test Connection"}
        </Button>
        {currentSource && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowDataMapper(!showDataMapper)}
          >
            {showDataMapper ? "Hide" : "Show"} Data Mapping
            {currentSource.cachedData && " ✓"}
          </Button>
        )}
      </div>
    </>
  );

  const renderStreamSection = () => (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Stream Type
        </label>
        <select
          name="streamType"
          value={formData.streamType}
          onChange={handleChange}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        >
          {STREAM_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <InputField
          label="Stream URL"
          name="streamUrl"
          value={formData.streamUrl}
          onChange={handleChange}
          placeholder="wss://api.example.com/stream"
          type="url"
          required
          error={errors.streamUrl}
          helpText="WebSocket, SSE, or polling endpoint URL"
        />
      </div>

      {formData.streamType === "polling" && (
        <div>
          <InputField
            label="Polling Interval (seconds)"
            name="pollingInterval"
            value={formData.pollingInterval}
            onChange={handleChange}
            placeholder="60"
            type="number"
            min="1"
            error={errors.pollingInterval}
            helpText="How often to poll for new data"
          />
        </div>
      )}

      {formData.streamType === "webhook" && (
        <>
          <div>
            <InputField
              label="Webhook Path"
              name="webhookPath"
              value={formData.webhookPath}
              onChange={handleChange}
              placeholder="/webhook/source-data"
              helpText="Path where webhook will receive data"
            />
          </div>
          <div>
            <InputField
              label="Webhook Secret"
              name="webhookSecret"
              value={formData.webhookSecret}
              onChange={handleChange}
              placeholder="your-webhook-secret"
              type="password"
              helpText="Secret for webhook validation"
            />
          </div>
        </>
      )}

      <div>
        <InputField
          label="Reconnect Interval (seconds)"
          name="reconnectInterval"
          value={formData.reconnectInterval}
          onChange={handleChange}
          placeholder="30"
          type="number"
          min="1"
          helpText="Time between reconnection attempts"
        />
      </div>

      <div>
        <InputField
          label="Max Reconnect Attempts"
          name="maxReconnectAttempts"
          value={formData.maxReconnectAttempts}
          onChange={handleChange}
          placeholder="5"
          type="number"
          min="1"
          helpText="Maximum number of reconnection attempts"
        />
      </div>

      <div className="md:col-span-2">
        <InputField
          label="Data Path"
          name="dataPath"
          value={formData.dataPath}
          onChange={handleChange}
          placeholder="data.message"
          helpText="JSON path to extract specific data from stream messages"
        />
      </div>

      <div className="md:col-span-2 flex justify-end space-x-3">
        <Button
          type="button"
          variant="outline"
          onClick={handleTestConnection}
          disabled={testingConnection}
        >
          {testingConnection ? "Testing..." : "Test Connection"}
        </Button>
      </div>
    </>
  );

  const renderSourceSpecificFields = () => {
    switch (formData.sourceType) {
      case "file":
        return renderFileUploadSection();
      case "url":
        return renderUrlSection();
      case "api":
        return renderApiSection();
      case "stream":
        return renderStreamSection();
      default:
        return null;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Section 1: Basic Information */}
      <div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <div className="md:col-span-2">
            <InputField
              label="Title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Enter source title"
              required
              error={errors.title}
            />
          </div>

          <div>
            <InputField
              label="Authors"
              name="authors"
              value={formData.authors}
              onChange={handleChange}
              placeholder="John Doe, Jane Smith"
              helpText="Separate authors with commas"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Document Type
            </label>
            <select
              name="documentType"
              value={formData.documentType}
              onChange={handleChange}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:[color-scheme:dark]"
              required
            >
              {DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type.toLowerCase()}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <InputField
              label="Publication Date"
              name="publicationDate"
              value={formData.publicationDate}
              onChange={handleChange}
              placeholder="YYYY-MM-DD"
              type="date"
              className="dark:[color-scheme:dark]"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Source Configuration */}
      <div className="pt-6 mt-6 border-t dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Source Configuration
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          {renderSourceTypeSelector()}
          {renderSourceSpecificFields()}
        </div>
      </div>

      {/* Section 3: Connection Manager */}
      {showConnectionManager && currentSource && (
        <div className="pt-6 mt-6 border-t dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Connection Management
          </h3>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-yellow-800 dark:text-yellow-200">
              Connection Manager temporarily disabled due to icon dependency
              issue.
              <br />
              Please fix the FaWifiSlash import in SourceConnectionManager
              component.
            </p>
          </div>
          {/* <SourceConnectionManager
            source={currentSource}
            onUpdateSource={handleSourceUpdate}
            onTestConnection={handleDataMapperTest}
          /> */}
        </div>
      )}

      {/* Section 4: Data Mapping */}
      {showDataMapper && currentSource && (
        <div className="pt-6 mt-6 border-t dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Data Mapping Configuration
          </h3>
          {currentSource.cachedData ? (
            <ApiDataMapper
              source={currentSource}
              onUpdateMapping={handleDataMappingUpdate}
              onTestConnection={handleDataMapperTest}
            />
          ) : (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-yellow-800 dark:text-yellow-200">
                No connection data available. Please test the connection first
                to enable data mapping.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Section 4: Content & Additional Information */}
      <div className="pt-6 mt-6 border-t dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Additional Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <div className="md:col-span-2">
            <InputField
              label="Description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe the source document..."
              as="textarea"
              rows={4}
            />
          </div>

          <div className="md:col-span-2">
            <InputField
              label="Notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Research notes or additional information..."
              as="textarea"
              rows={4}
            />
          </div>

          <div className="md:col-span-2">
            <InputField
              label="Tags"
              name="tags"
              value={formData.tags}
              onChange={handleChange}
              placeholder="tag1, tag2, tag3"
              helpText="Separate tags with commas"
            />
          </div>
        </div>
      </div>

      {/* Data Mapping Summary */}
      {formData.dataMapping && (
        <div className="pt-6 mt-6 border-t dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
            API Data Mapping Summary
          </h3>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  Mapped Fields:
                </span>
                <span className="ml-2 text-gray-600 dark:text-gray-400">
                  {formData.dataMapping.fieldMappings?.length || 0}
                </span>
              </div>
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  Root Path:
                </span>
                <span className="ml-2 text-gray-600 dark:text-gray-400 font-mono">
                  {formData.dataMapping.rootPath || "/"}
                </span>
              </div>
              {formData.dataMapping.fieldMappings?.length > 0 && (
                <div className="md:col-span-2">
                  <span className="font-medium text-gray-700 dark:text-gray-300 block mb-2">
                    Field Mappings:
                  </span>
                  <div className="space-y-1">
                    {formData.dataMapping.fieldMappings
                      .slice(0, 3)
                      .map((mapping: any, index: number) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 text-xs"
                        >
                          <span className="font-mono bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                            {mapping.sourcePath}
                          </span>
                          <span className="text-gray-500">→</span>
                          <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                            {mapping.targetCategory}.{mapping.targetField}
                          </span>
                        </div>
                      ))}
                    {formData.dataMapping.fieldMappings.length > 3 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        +{formData.dataMapping.fieldMappings.length - 3} more
                        mappings
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="pt-8 flex justify-end space-x-3 border-t dark:border-gray-700 mt-8">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" type="submit">
          {initialData ? "Update Source" : "Create Source"}
        </Button>
      </div>
    </form>
  );
};

export default SourceDocumentForm;
