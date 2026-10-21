import React, { useState, useCallback, useEffect, useRef } from "react";
import { useProjectData } from "../contexts/ProjectDataContext";
// Fix: Removed ButtonSize import and will use the string literal directly.
import Button from "./common/Button";
import Modal from "./common/Modal";
import { useNotification } from "../contexts/NotificationContext";

interface KnowledgeBaseIssue {
  id: string;
  type:
    | "duplicate_entity"
    | "conflicting_details"
    | "missing_references"
    | "inconsistent_tags"
    | "orphaned_references";
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  affectedEntities: Array<{
    entityId: string;
    entityType: "character" | "location" | "technology" | "culture" | "source";
    entityName: string;
    conflictingValue?: string;
    details?: string;
  }>;
  suggestions?: string[];
  autoFixable?: boolean;
}

const KnowledgeBaseConsistencyChecker: React.FC = () => {
  const { project } = useProjectData();
  const { showError, showInfo } = useNotification();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [issues, setIssues] = useState<KnowledgeBaseIssue[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<KnowledgeBaseIssue | null>(
    null,
  );
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [ignoredIssues, setIgnoredIssues] = useState<Set<string>>(new Set());

  const analysisInProgressRef = useRef(false);
  const initialAnalysisDoneRef = useRef(false);

  const showErrorRef = useRef(showError);
  const showInfoRef = useRef(showInfo);

  useEffect(() => {
    showErrorRef.current = showError;
    showInfoRef.current = showInfo;
  }, [showError, showInfo]);

  const calculateSimilarity = (str1: string, str2: string): number => {
    if (!str1 || !str2) return 0;
    const words1 = str1
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 2);
    const words2 = str2
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 2);
    if (words1.length === 0 || words2.length === 0) return 0;
    const commonWords = words1.filter((word) => words2.includes(word));
    return commonWords.length / Math.max(words1.length, words2.length);
  };

  const analyzeConsistency = useCallback(() => {
    if (!project || analysisInProgressRef.current) {
      return;
    }

    analysisInProgressRef.current = true;
    setIsAnalyzing(true);

    try {
      const foundIssues: KnowledgeBaseIssue[] = [];

      const allEntities = [
        ...(project.characters || []).map((c) => ({
          ...c,
          type: "character" as const,
        })),
        ...(project.locations || []).map((l) => ({
          ...l,
          type: "location" as const,
        })),
        ...(project.technologies || []).map((t) => ({
          ...t,
          type: "technology" as const,
        })),
        ...(project.cultures || []).map((c) => ({
          ...c,
          type: "culture" as const,
        })),
        ...(project.sources || []).map((s) => ({
          ...s,
          type: "source" as const,
          name: s.title,
        })),
      ];

      const nameGroups = new Map<string, typeof allEntities>();
      allEntities.forEach((entity) => {
        const entityName = entity.name || (entity as any).title || "";
        if (!entityName) return;
        const normalizedName = entityName.toLowerCase().trim();

        const similarNames = Array.from(nameGroups.keys()).filter(
          (existingName) => {
            const similarity = calculateSimilarity(
              normalizedName,
              existingName,
            );
            return similarity > 0.8 && similarity < 1.0;
          },
        );

        if (similarNames.length > 0) {
          const existingGroup = nameGroups.get(similarNames[0]);
          if (existingGroup) existingGroup.push(entity);
        } else {
          nameGroups.set(normalizedName, [entity]);
        }
      });

      const entityTypes = [
        "characters",
        "locations",
        "technologies",
        "cultures",
        "sources",
      ] as const;
      entityTypes.forEach((entityTypeKey) => {
        const entitiesOfType = (project as any)[entityTypeKey] || [];
        const nameMap = new Map<string, any[]>();

        entitiesOfType.forEach((entity: any) => {
          const name =
            entityTypeKey === "sources" ? entity.title : entity.name;
          if (!name) return;
          const normalizedName = name.toLowerCase().trim();
          nameMap.set(
            normalizedName,
            (nameMap.get(normalizedName) || []).concat(entity),
          );
        });

        nameMap.forEach((duplicates, nameKey) => {
          if (duplicates.length > 1) {
            const singularType = entityTypeKey.slice(
              0,
              -1,
            ) as KnowledgeBaseIssue["affectedEntities"][0]["entityType"];
            foundIssues.push({
              id: `duplicate_${entityTypeKey}_${nameKey.replace(/\s+/g, "_")}`,
              type: "duplicate_entity",
              severity: "high",
              title: `Duplicate ${singularType}: ${duplicates[0].name || duplicates[0].title}`,
              description: `Multiple ${singularType} entities have the same or very similar names.`,
              affectedEntities: duplicates.map((dupEntity) => ({
                entityId: dupEntity.id,
                entityType: singularType,
                entityName: dupEntity.name || dupEntity.title,
                details:
                  dupEntity.description?.substring(0, 100) + "..." ||
                  "No description",
              })),
              suggestions: [
                "Review if these are truly different entities.",
                "Consider merging or differentiating them.",
              ],
              autoFixable: false,
            });
          }
        });
      });

      const filteredIssues = foundIssues.filter(
        (issue) => !ignoredIssues.has(issue.id),
      );
      setIssues(filteredIssues);

      if (filteredIssues.length === 0 && initialAnalysisDoneRef.current) {
        showInfoRef.current("No new consistency issues found.");
      }
      initialAnalysisDoneRef.current = true;
    } catch (error) {
      console.error("Error analyzing knowledge base consistency:", error);
      showErrorRef.current(
        "Failed to analyze: " +
          (error instanceof Error ? error.message : "Unknown error"),
      );
    } finally {
      setIsAnalyzing(false);
      analysisInProgressRef.current = false;
    }
  }, [project, ignoredIssues]);

  useEffect(() => {
    if (project && !analysisInProgressRef.current) {
      analyzeConsistency();
    }
  }, [analyzeConsistency, project]);

  const handleIgnoreIssue = (issueId: string) => {
    setIgnoredIssues((prev) => {
      const newSet = new Set(prev);
      newSet.add(issueId);
      return newSet;
    });
    setIssues((prevIssues) =>
      prevIssues.filter((issue) => issue.id !== issueId),
    );
    setShowIssueModal(false);
    setSelectedIssue(null);
    showInfo("Issue marked as resolved.");
  };

  const handleClearAllIssues = () => {
    const allCurrentIssueIds = issues.map((issue) => issue.id);
    setIgnoredIssues((prev) => new Set([...prev, ...allCurrentIssueIds]));
    setIssues([]);
    setShowIssueModal(false);
    setSelectedIssue(null);
    showInfo(
      "All current issues marked as resolved. Re-analyze to find new ones.",
    );
  };

  const handleViewIssue = (issue: KnowledgeBaseIssue) => {
    setSelectedIssue(issue);
    setShowIssueModal(true);
  };

  const getSeverityColor = (severity: KnowledgeBaseIssue["severity"]) => {
    switch (severity) {
      case "high":
        return "text-red-600 dark:text-red-400";
      case "medium":
        return "text-yellow-600 dark:text-yellow-400";
      case "low":
        return "text-blue-600 dark:text-blue-400";
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };
  const getSeverityBg = (severity: KnowledgeBaseIssue["severity"]) => {
    switch (severity) {
      case "high":
        return "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";
      case "medium":
        return "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800";
      case "low":
        return "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800";
      default:
        return "bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800";
    }
  };
  const getIssueTypeIcon = (type: KnowledgeBaseIssue["type"]) => {
    switch (type) {
      case "duplicate_entity":
        return (
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" />
            <path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h8a2 2 0 00-2-2H5z" />
          </svg>
        );
      case "conflicting_details":
        return (
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        );
      case "missing_references":
        return (
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z"
              clipRule="evenodd"
            />
          </svg>
        );
      case "inconsistent_tags":
        return (
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
        );
      default:
        return (
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
        );
    }
  };

  if (
    !project ||
    (!isAnalyzing && issues.length === 0 && !initialAnalysisDoneRef.current)
  ) {
    return null;
  }

  // Fix: Removed the const 'buttonSize'
  // Fix: Directly using "sm" as the size prop.

  return (
    <>
      <div
        className={`border rounded-lg p-4 mb-6 ${getSeverityBg(issues.length > 0 ? issues[0].severity : "low")}`}
      >
        <div className="flex items-start">
          <div className="flex-shrink-0">
            {issues.length > 0 ? (
              <svg
                className="h-5 w-5 text-amber-500"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                className="h-5 w-5 text-green-500"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200">
              {issues.length > 0
                ? `Knowledge Base Consistency Issues Found (${issues.length})`
                : "Knowledge Base Consistency Check"}
            </h3>
            <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
              {issues.length > 0 ? (
                <>
                  <p className="mb-3">
                    Found potential inconsistencies that may need attention.
                  </p>
                  <div className="space-y-2">
                    {issues.slice(0, 3).map((issue) => (
                      <div
                        key={issue.id}
                        className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border"
                      >
                        <div className="flex items-center flex-1">
                          <div
                            className={`mr-2 ${getSeverityColor(issue.severity)}`}
                          >
                            {getIssueTypeIcon(issue.type)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(issue.severity)}`}
                              >
                                {issue.severity.toUpperCase()}
                              </span>
                              <span className="font-medium">{issue.title}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {issue.affectedEntities.length} entities affected
                            </p>
                          </div>
                        </div>
                        {/* Fix: Changed size to "sm" directly */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewIssue(issue)}
                        >
                          Review
                        </Button>
                      </div>
                    ))}
                    {issues.length > 3 && (
                      <p className="text-xs text-gray-500 mt-2">
                        ...and {issues.length - 3} more issues
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <p>No consistency issues found in the knowledge base.</p>
              )}
            </div>
            <div className="mt-4 flex space-x-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => issues.length > 0 && handleViewIssue(issues[0])}
                disabled={isAnalyzing || issues.length === 0}
              >
                Review Issues
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={analyzeConsistency}
                disabled={isAnalyzing}
                isLoading={isAnalyzing}
              >
                Re-analyze
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAllIssues}
                disabled={isAnalyzing || issues.length === 0}
              >
                Mark All Resolved
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showIssueModal}
        onClose={() => {
          setShowIssueModal(false);
          setSelectedIssue(null);
        }}
        title="Knowledge Base Consistency Issue"
        size="lg"
      >
        {selectedIssue && (
          <div className="p-4 space-y-6">
            <div>
              <div className="flex items-center mb-2">
                <div
                  className={`mr-2 ${getSeverityColor(selectedIssue.severity)}`}
                >
                  {getIssueTypeIcon(selectedIssue.type)}
                </div>
                <span
                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mr-2 ${getSeverityColor(selectedIssue.severity)}`}
                >
                  {selectedIssue.severity.toUpperCase()} PRIORITY
                </span>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                  {selectedIssue.title}
                </h4>
              </div>
              <p className="text-gray-700 dark:text-gray-300">
                {selectedIssue.description}
              </p>
            </div>
            <div>
              <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
                Affected Entities:
              </h5>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {selectedIssue.affectedEntities.map((entity, index) => (
                  <div
                    key={`${entity.entityId}-${index}`}
                    className="p-3 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-sm capitalize">
                        {entity.entityName}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${entity.entityType === "character" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200" : entity.entityType === "location" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200" : entity.entityType === "technology" ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200" : entity.entityType === "culture" ? "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-200" : "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-200"}`}
                      >
                        {entity.entityType}
                      </span>
                    </div>
                    {entity.conflictingValue && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <strong>Issue:</strong> {entity.conflictingValue}
                      </p>
                    )}
                    {entity.details && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <strong>Details:</strong> {entity.details}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {selectedIssue.suggestions && (
              <div>
                <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Research Suggestions:
                </h5>
                <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700 dark:text-gray-300">
                  {selectedIssue.suggestions.map((suggestion, index) => (
                    <li key={index}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="outline"
                onClick={() => handleIgnoreIssue(selectedIssue.id)}
              >
                Mark as Resolved
              </Button>
              <div className="space-x-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowIssueModal(false);
                    setSelectedIssue(null);
                  }}
                >
                  Close
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    showInfo(
                      "Navigate to the Knowledge Base to review and edit entities.",
                    );
                    setShowIssueModal(false);
                  }}
                >
                  Edit Entities
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};

export default KnowledgeBaseConsistencyChecker;
