import React, { useState, useEffect } from "react";
import {
  FaCheck,
  FaChevronDown,
  FaChevronRight,
  FaUnlink,
} from "react-icons/fa";
import Button from "./common/Button"; // Assuming Button is in a common components folder
import InputField from "./common/InputField"; // Assuming InputField is in a common components folder

// --- TYPE DEFINITIONS (interfaces remain the same) ---

interface SourceDocumentType {
  id: string;
  title: string;
  sourceType: "api" | "file" | "url" | "stream";
  cachedData?: any;
  description?: string;
  authors?: string[] | string;
  publicationDate?: string;
  type?: string;
  url?: string;
  filePath?: string;
  fileName?: string;
  notes?: string;
  tags?: string[] | string;
  apiEndpoint?: string;
  httpMethod?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  authType?: "none" | "basic" | "bearer" | "api_key" | "oauth";
  apiKey?: string;
  bearerToken?: string;
  basicAuthUsername?: string;
  basicAuthPassword?: string;
  requestHeaders?: Record<string, string> | string;
  requestBody?: string;
  responseFormat?: "json" | "xml" | "text" | "csv";
  streamType?: "websocket" | "sse" | "polling" | "webhook";
  streamUrl?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  dataPath?: string;
  pollingInterval?: number;
  lastPolled?: string;
  webhookSecret?: string;
  webhookPath?: string;
  dataMapping?: DataMapping;
  connectionStatus?: "connected" | "disconnected" | "error" | "connecting";
  lastConnected?: string;
  connectionError?: string;
  createdAt: string;
  updatedAt: string;
}

interface ApiDataMapperProps {
  source: SourceDocumentType;
  onUpdateMapping: (mapping: DataMapping) => void;
  onTestConnection: () => Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }>;
  className?: string;
}

interface DataMapping {
  rootPath?: string;
  fieldMappings: FieldMapping[];
  extractionRules: ExtractionRule[];
}

interface FieldMapping {
  id: string;
  sourcePath: string;
  sourceType: "string" | "number" | "boolean" | "object" | "array";
  targetCategory: KnowledgeBaseCategory;
  targetField: string;
  transform?:
    | "none"
    | "lowercase"
    | "uppercase"
    | "trim"
    | "split"
    | "join"
    | "date";
  enabled: boolean;
  preview?: string;
}

interface ExtractionRule {
  id: string;
  name: string;
  condition: string; // Simple condition like "status === 'active'"
  mappings: FieldMapping[];
}

type KnowledgeBaseCategory =
  | "characters"
  | "locations"
  | "technologies"
  | "cultures"
  | "events"
  | "general";

const CATEGORY_FIELDS: Record<KnowledgeBaseCategory, string[]> = {
  characters: [
    "name",
    "description",
    "birthDate",
    "deathDate",
    "traits",
    "background",
    "notes",
  ],
  locations: [
    "name",
    "description",
    "coordinates",
    "foundedDate",
    "destroyedDate",
    "population",
    "type",
    "notes",
  ],
  technologies: [
    "name",
    "description",
    "discoveryDate",
    "developmentLevel",
    "impact",
    "fields",
    "notes",
  ],
  cultures: [
    "name",
    "description",
    "foundedDate",
    "endDate",
    "values",
    "practices",
    "languages",
    "beliefs",
    "notes",
  ],
  events: ["title", "description", "date", "endDate", "importance", "notes"],
  general: ["title", "description", "content", "tags", "notes"],
};

// --- API DATA MAPPER COMPONENT ---

const ApiDataMapper: React.FC<ApiDataMapperProps> = ({
  source,
  onUpdateMapping,
  onTestConnection,
  className = "",
}) => {
  const [testResult, setTestResult] = useState<{
    success: boolean;
    data?: any;
    error?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [rootPath, setRootPath] = useState<string>("");

  if (source.sourceType !== "api") {
    return null;
  }

  useEffect(() => {
    if (source.cachedData && !testResult) {
      setTestResult({
        success: true,
        data: source.cachedData,
      });
      const suggestions = generateMappingSuggestions(source.cachedData);
      setMappings(suggestions);
    }
  }, [source.cachedData, testResult]);

  const handleTestConnection = async () => {
    setIsLoading(true);
    // Clear old results and expansions to prevent stale interactions
    setTestResult(null);
    setExpandedPaths(new Set());
    try {
      const result = await onTestConnection();
      setTestResult(result);

      if (result.success && result.data) {
        const suggestions = generateMappingSuggestions(result.data);
        setMappings(suggestions);
      }
    } catch (error) {
      setTestResult({ success: false, error: "Connection failed" });
    } finally {
      setIsLoading(false);
    }
  };

  const generateMappingSuggestions = (data: any): FieldMapping[] => {
    const suggestions: FieldMapping[] = [];
    const template = Array.isArray(data) ? data[0] : data;
    if (!template || typeof template !== "object") return suggestions;
    const fieldSuggestions = [
      {
        keys: ["name", "title", "label"],
        category: "general" as KnowledgeBaseCategory,
        field: "title",
      },
      {
        keys: ["description", "desc", "summary", "content", "body"],
        category: "general" as KnowledgeBaseCategory,
        field: "description",
      },
      {
        keys: ["date", "created", "timestamp"],
        category: "events" as KnowledgeBaseCategory,
        field: "date",
      },
      {
        keys: ["location", "place", "city", "country"],
        category: "locations" as KnowledgeBaseCategory,
        field: "name",
      },
      {
        keys: ["author", "creator", "user"],
        category: "characters" as KnowledgeBaseCategory,
        field: "name",
      },
      {
        keys: ["technology", "tech", "tool"],
        category: "technologies" as KnowledgeBaseCategory,
        field: "name",
      },
      {
        keys: ["id", "userid", "identifier"],
        category: "general" as KnowledgeBaseCategory,
        field: "content",
      },
    ];

    Object.keys(template).forEach((key) => {
      const value = template[key];
      const suggestion = fieldSuggestions.find((s) =>
        s.keys.some((k) => key.toLowerCase().includes(k.toLowerCase())),
      );
      suggestions.push({
        id: `mapping_${key}`,
        sourcePath: key,
        sourceType: typeof value as any,
        targetCategory: suggestion?.category || "general",
        targetField: suggestion?.field || "content",
        transform: "none",
        enabled: true,
        preview: String(value).substring(0, 50),
      });
    });

    return suggestions;
  };

  const renderDataTree = (data: any, path = "", level = 0): React.ReactNode => {
    if (data === null || data === undefined) {
      return <span className="text-gray-400">null</span>;
    }

    if (typeof data !== "object") {
      return (
        <span className="text-blue-600 dark:text-blue-400">
          {String(data).substring(0, 100)}
          {String(data).length > 100 ? "..." : ""}
        </span>
      );
    }

    if (Array.isArray(data)) {
      return (
        <div className="ml-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleExpanded(path)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              {expandedPaths.has(path) ? (
                <FaChevronDown className="w-3 h-3" />
              ) : (
                <FaChevronRight className="w-3 h-3" />
              )}
            </button>
            <span className="text-purple-600 dark:text-purple-400">
              Array ({data.length} items)
            </span>
            {level > 0 && (
              <button
                onClick={() => setRootPath(path)}
                className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded hover:bg-blue-200 dark:hover:bg-blue-800"
              >
                Select Array
              </button>
            )}
          </div>
          {expandedPaths.has(path) && data.length > 0 && (
            <div className="ml-4 mt-2">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Item [0]:
              </div>
              {renderDataTree(data[0], `${path}[0]`, level + 1)}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="ml-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleExpanded(path)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            {expandedPaths.has(path) ? (
              <FaChevronDown className="w-3 h-3" />
            ) : (
              <FaChevronRight className="w-3 h-3" />
            )}
          </button>
          <span className="text-green-600 dark:text-green-400">
            Object ({Object.keys(data).length} properties)
          </span>
          {level > 0 && (
            <button
              onClick={() => setRootPath(path)}
              className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded hover:bg-green-200 dark:hover:bg-green-800"
            >
              Select Object
            </button>
          )}
        </div>
        {expandedPaths.has(path) && (
          <div className="ml-4 mt-2 space-y-2">
            {Object.entries(data).map(([key, value]) => {
              const fieldPath = path ? `${path}.${key}` : key;
              return (
                // --- CHANGE: The link button has been removed from here ---
                <div key={key} className="flex items-start gap-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-0 flex-shrink-0">
                    {key}:
                  </span>
                  <div className="flex-1 min-w-0">
                    {renderDataTree(value, fieldPath, level + 1)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const toggleExpanded = (path: string) => {
    const newExpanded = new Set(expandedPaths);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedPaths(newExpanded);
  };

  const updateMapping = (id: string, updates: Partial<FieldMapping>) => {
    setMappings(mappings.map((m) => (m.id === id ? { ...m, ...updates } : m)));
  };

  const handleSaveMapping = () => {
    const mapping: DataMapping = {
      rootPath: rootPath || undefined,
      fieldMappings: mappings,
      extractionRules: [],
    };
    onUpdateMapping(mapping);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* --- CHANGE: This block is now disabled during loading --- */}
      {testResult?.success && testResult.data && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              API Response Structure
            </h3>
          </div>
          <div className="mb-4">
            <InputField
              label="Root Data Path (Optional)"
              name="rootPath"
              value={rootPath}
              onChange={(e) => setRootPath(e.target.value)}
              placeholder="e.g., data.items (leave empty to use root)"
              helpText="If your data is nested, specify the path to the array/object you want to extract from"
            />
          </div>
          {/* This wrapper div handles the disabled state */}
          <div
            className={`max-h-96 overflow-auto transition-opacity duration-300 ${
              isLoading ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            {renderDataTree(testResult.data)}
          </div>
        </div>
      )}

      {mappings.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Field Mappings ({mappings.length})
            </h3>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSaveMapping}
              leftIcon={<FaCheck />}
            >
              Save Mappings
            </Button>
          </div>
          <div className="space-y-4">
            {mappings.map((mapping) => (
              <div
                key={mapping.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <InputField
                      label="Source Field"
                      name={`sourcePath_${mapping.id}`}
                      value={mapping.sourcePath}
                      onChange={(e) =>
                        updateMapping(mapping.id, {
                          sourcePath: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Target Category
                    </label>
                    <select
                      value={mapping.targetCategory}
                      onChange={(e) =>
                        updateMapping(mapping.id, {
                          targetCategory: e.target
                            .value as KnowledgeBaseCategory,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                    >
                      <option value="general">General</option>
                      <option value="characters">Characters</option>
                      <option value="locations">Locations</option>
                      <option value="technologies">Technologies</option>
                      <option value="cultures">Cultures</option>
                      <option value="events">Events</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Target Field
                    </label>
                    <select
                      value={mapping.targetField}
                      onChange={(e) =>
                        updateMapping(mapping.id, {
                          targetField: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                    >
                      {CATEGORY_FIELDS[mapping.targetCategory].map((field) => (
                        <option key={field} value={field}>
                          {field}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Transform
                      </label>
                      <select
                        value={mapping.transform}
                        onChange={(e) =>
                          updateMapping(mapping.id, {
                            transform: e.target.value as any,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                      >
                        <option value="none">None</option>
                        <option value="lowercase">Lowercase</option>
                        <option value="uppercase">Uppercase</option>
                        <option value="trim">Trim</option>
                        <option value="date">Parse Date</option>
                      </select>
                    </div>
                    {/* The remove button was here, but seems you didn't include `removeMapping` in the original code, so I've left it out to match */}
                  </div>
                </div>
                {mapping.preview && (
                  <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-900 rounded text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      Preview:{" "}
                    </span>
                    <span className="font-mono">{mapping.preview}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ApiDataMapper;
