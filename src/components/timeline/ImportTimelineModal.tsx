import React, { useState, useRef } from "react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import MessageBox from "../common/MessageBox";
// --- FIX: Ensure all necessary types from project.ts are imported ---
import {
  ProjectType,
  TimelineType,
  EventType,
  PointOfDivergenceType,
  ID,
} from "../../types/project";
import { v4 as uuidv4 } from "uuid";

interface ImportTimelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportTimelines: (
    timelines: TimelineType[],
    knowledgeBaseItems?: ImportedKnowledgeBase,
  ) => void;
  currentProject: ProjectType | null;
  isLoading?: boolean;
}

interface ImportedKnowledgeBase {
  characters: any[];
  locations: any[];
  technologies: any[];
  cultures: any[];
  sources: any[];
}

interface ConflictSummary {
  duplicateTimelines: Array<{ imported: string; existing: string }>;
  duplicateKnowledgeBase: Array<{
    type: string;
    imported: string;
    existing: string;
  }>;
  totalConflicts: number;
}

const ImportTimelineModal: React.FC<ImportTimelineModalProps> = ({
  isOpen,
  onClose,
  onImportTimelines,
  currentProject,
  isLoading = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importedProject, setImportedProject] = useState<ProjectType | null>(
    null,
  );
  const [conflictSummary, setConflictSummary] =
    useState<ConflictSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"select-file" | "preview-import">(
    "select-file",
  );
  const [importStrategy, setImportStrategy] = useState<
    "smart-merge" | "keep-separate"
  >("smart-merge");

  // --- FIX: Added handleFileSelect function ---
  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const analyzeImportConflicts = (
    importedPrj: ProjectType,
  ): ConflictSummary => {
    const conflicts: ConflictSummary = {
      duplicateTimelines: [],
      duplicateKnowledgeBase: [],
      totalConflicts: 0,
    };
    if (!currentProject) return conflicts;
    importedPrj.timelines.forEach((importedTimeline) => {
      const existingTimeline = currentProject.timelines.find(
        (t) =>
          t.name.toLowerCase().trim() ===
          importedTimeline.name.toLowerCase().trim(),
      );
      if (existingTimeline) {
        conflicts.duplicateTimelines.push({
          imported: importedTimeline.name,
          existing: existingTimeline.name,
        });
      }
    });
    const checkKBConflicts = (
      importedItems: any[],
      existingItems: any[],
      type: string,
      nameField: string = "name",
    ) => {
      importedItems?.forEach((importedItem) => {
        const existingItem = existingItems?.find(
          (item) =>
            item[nameField]?.toLowerCase().trim() ===
            importedItem[nameField]?.toLowerCase().trim(),
        );
        if (existingItem) {
          conflicts.duplicateKnowledgeBase.push({
            type,
            imported: importedItem[nameField],
            existing: existingItem[nameField],
          });
        }
      });
    };
    checkKBConflicts(
      importedPrj.characters,
      currentProject.characters,
      "character",
    );
    checkKBConflicts(
      importedPrj.locations,
      currentProject.locations,
      "location",
    );
    checkKBConflicts(
      importedPrj.technologies,
      currentProject.technologies,
      "technology",
    );
    checkKBConflicts(importedPrj.cultures, currentProject.cultures, "culture");
    checkKBConflicts(
      importedPrj.sources,
      currentProject.sources,
      "source document",
      "title",
    );
    conflicts.totalConflicts =
      conflicts.duplicateTimelines.length +
      conflicts.duplicateKnowledgeBase.length;
    return conflicts;
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const text = await file.text();
      const projectData = JSON.parse(text) as ProjectType;
      if (
        !projectData.id ||
        !projectData.name ||
        !Array.isArray(projectData.timelines)
      ) {
        throw new Error(
          "Invalid ARK file format - missing required project structure",
        );
      }
      setImportedProject(projectData);
      const conflicts = analyzeImportConflicts(projectData);
      setConflictSummary(conflicts);
      setStep("preview-import");
      if (conflicts.totalConflicts === 0) {
        setImportStrategy("smart-merge");
      } else if (conflicts.totalConflicts > 5) {
        setImportStrategy("keep-separate");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to parse project file",
      );
      setImportedProject(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const processImportData = (): {
    timelines: TimelineType[];
    knowledgeBase: ImportedKnowledgeBase;
  } => {
    if (!importedProject) throw new Error("No project data to import");

    const kbIdMapping = new Map<string, string>();
    const timelineIdMapping = new Map<string, string>();
    const processedKB: ImportedKnowledgeBase = {
      characters: [],
      locations: [],
      technologies: [],
      cultures: [],
      sources: [],
    };

    const processKBItems = (
      importedItems: any[],
      existingItems: any[],
      type: keyof ImportedKnowledgeBase,
      nameField: string = "name",
    ) => {
      if (!importedItems || !Array.isArray(importedItems)) return;
      importedItems.forEach((item) => {
        if (!item || !item.id) return;
        const existingItem = existingItems?.find(
          (existing) =>
            existing &&
            existing[nameField] &&
            item[nameField] &&
            existing[nameField].toLowerCase().trim() ===
              item[nameField].toLowerCase().trim(),
        );
        if (existingItem && importStrategy === "smart-merge") {
          kbIdMapping.set(item.id, existingItem.id);
        } else {
          const newId = uuidv4();
          kbIdMapping.set(item.id, newId);
          const newItem = {
            ...item,
            id: newId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          if (existingItem && importStrategy === "keep-separate") {
            const projectName =
              importedProject.name && importedProject.name.length > 20
                ? importedProject.name.substring(0, 20) + "..."
                : importedProject.name || "Imported Project";
            if (nameField === "title") {
              newItem.title = `${item.title || "Untitled"} (from ${projectName})`;
            } else {
              newItem.name = `${item.name || "Unnamed"} (from ${projectName})`;
            }
          }
          processedKB[type].push(newItem);
        }
      });
    };

    if (currentProject) {
      processKBItems(
        importedProject.characters || [],
        currentProject.characters || [],
        "characters",
      );
      processKBItems(
        importedProject.locations || [],
        currentProject.locations || [],
        "locations",
      );
      processKBItems(
        importedProject.technologies || [],
        currentProject.technologies || [],
        "technologies",
      );
      processKBItems(
        importedProject.cultures || [],
        currentProject.cultures || [],
        "cultures",
      );
      processKBItems(
        importedProject.sources || [],
        currentProject.sources || [],
        "sources",
        "title",
      );
    } else {
      processKBItems(importedProject.characters || [], [], "characters");
      processKBItems(importedProject.locations || [], [], "locations");
      processKBItems(importedProject.technologies || [], [], "technologies");
      processKBItems(importedProject.cultures || [], [], "cultures");
      processKBItems(
        importedProject.sources || [],
        [],
        "sources",
        "title",
      );
    }

    if (
      !importedProject.timelines ||
      !Array.isArray(importedProject.timelines)
    ) {
      throw new Error("No valid timelines found in project");
    }

    importedProject.timelines.forEach((timeline) => {
      if (timeline && timeline.id) {
        timelineIdMapping.set(timeline.id, uuidv4());
      }
    });

    const processedTimelines: TimelineType[] = [];

    importedProject.timelines.forEach((timeline) => {
      if (!timeline || !timeline.id) return;
      const newTimelineId = timelineIdMapping.get(timeline.id);
      if (!newTimelineId) return;

      let timelineName = timeline.name || "Untitled Timeline";
      if (currentProject && importStrategy === "keep-separate") {
        const existingTimeline = currentProject.timelines?.find(
          (t) =>
            t &&
            t.name &&
            t.name.toLowerCase().trim() === timelineName.toLowerCase().trim(),
        );
        if (existingTimeline) {
          const projectName =
            importedProject.name && importedProject.name.length > 15
              ? importedProject.name.substring(0, 15) + "..."
              : importedProject.name || "Imported Project";
          timelineName = `${timelineName} (from ${projectName})`;
        }
      }

      const updatedEvents = (timeline.events || []).map((event) => {
        if (!event) return null;
        return {
          ...event,
          id: uuidv4(),
          timelineId: newTimelineId,
          causes: [],
          effects: [],
          linkedCharacterIds: (event.linkedCharacterIds || [])
            .map((id) => kbIdMapping.get(id) || id)
            .filter(Boolean) as ID[],
          linkedLocationIds: (event.linkedLocationIds || [])
            .map((id) => kbIdMapping.get(id) || id)
            .filter(Boolean) as ID[],
          linkedTechnologyIds: (event.linkedTechnologyIds || [])
            .map((id) => kbIdMapping.get(id) || id)
            .filter(Boolean) as ID[],
          linkedCultureIds: (event.linkedCultureIds || [])
            .map((id) => kbIdMapping.get(id) || id)
            .filter(Boolean) as ID[],
          linkedSourceDocumentIds: (event.linkedSourceDocumentIds || [])
            .map((id) => kbIdMapping.get(id) || id)
            .filter(Boolean) as ID[],
        };
      });

      const updatedPoDs = (timeline.pointsOfDivergence || []).map((pod) => {
        if (!pod) return null;
        return {
          ...pod,
          id: uuidv4(),
          timelineId: newTimelineId,
          eventIds: (pod.eventIds || [])
            .map((eventId) => {
              const originalEvent = (timeline.events || []).find(
                (e) => e && e.id === eventId,
              );
              if (originalEvent) {
                const newEvent = updatedEvents
                  .filter(Boolean)
                  .find(
                    (e) =>
                      e &&
                      e.title === originalEvent.title &&
                      e.date === originalEvent.date,
                  );
                return newEvent ? newEvent.id : eventId;
              }
              return eventId;
            })
            .filter(Boolean) as ID[],
          resultingTimelineIds: [],
        };
      });

      let parentTimelineId: ID | null = null;
      let branchFromEventId: ID | null | undefined = undefined;

      if (timeline.parentTimelineId) {
        if (timelineIdMapping.has(timeline.parentTimelineId)) {
          parentTimelineId =
            timelineIdMapping.get(timeline.parentTimelineId) || null;
          if (timeline.branchFromEventId) {
            branchFromEventId = timeline.branchFromEventId;
          }
        } else if (
          currentProject?.timelines?.some(
            (t) => t && t.id === timeline.parentTimelineId,
          )
        ) {
          parentTimelineId = timeline.parentTimelineId;
          branchFromEventId = timeline.branchFromEventId;
        }
      }

      // --- FIX: Removed 'createdAt' and 'updatedAt' to resolve TS2353 ---
      const processedTimelineData: TimelineType = {
        ...timeline,
        id: newTimelineId,
        name: timelineName,
        events: updatedEvents.filter(Boolean) as EventType[],
        pointsOfDivergence: updatedPoDs.filter(
          Boolean,
        ) as PointOfDivergenceType[],
        parentTimelineId,
        branchFromEventId,
        // createdAt: new Date().toISOString(), // Removed due to TS2353
        // updatedAt: new Date().toISOString(), // Removed for consistency
      };
      processedTimelines.push(processedTimelineData);
    });

    const eventIdMappings = new Map<string, string>();
    processedTimelines.forEach((timeline) => {
      const originalTimelineId = Array.from(timelineIdMapping.entries()).find(
        ([, newId]) => newId === timeline.id,
      )?.[0];
      if (originalTimelineId) {
        const originalTimeline = importedProject.timelines.find(
          (t) => t && t.id === originalTimelineId,
        );
        if (originalTimeline) {
          originalTimeline.events.forEach((originalEvent) => {
            if (originalEvent && originalEvent.id) {
              const newEvent = timeline.events.find(
                (e) =>
                  e &&
                  e.title === originalEvent.title &&
                  e.date === originalEvent.date,
              );
              if (newEvent) {
                eventIdMappings.set(originalEvent.id, newEvent.id);
              }
            }
          });
        }
      }
    });
    processedTimelines.forEach((timeline) => {
      if (timeline.branchFromEventId && timeline.parentTimelineId) {
        const newEventId = eventIdMappings.get(timeline.branchFromEventId);
        if (newEventId) {
          timeline.branchFromEventId = newEventId;
        } else {
          const parentTimeline = processedTimelines.find(
            (t) => t.id === timeline.parentTimelineId,
          );
          if (parentTimeline) {
            const originalTimelineId = Array.from(
              timelineIdMapping.entries(),
            ).find(([, newId]) => newId === timeline.parentTimelineId)?.[0];
            if (originalTimelineId) {
              const originalParent = importedProject.timelines.find(
                (t) => t && t.id === originalTimelineId,
              );
              const originalBranchEvent = originalParent?.events?.find(
                (e) => e && e.id === timeline.branchFromEventId,
              );
              if (originalBranchEvent) {
                const newBranchEvent = parentTimeline.events?.find(
                  (e) =>
                    e &&
                    e.title === originalBranchEvent.title &&
                    e.date === originalBranchEvent.date,
                );
                if (newBranchEvent) {
                  timeline.branchFromEventId = newBranchEvent.id;
                } else {
                  timeline.branchFromEventId = undefined;
                }
              } else {
                timeline.branchFromEventId = undefined;
              }
            }
          } else {
            timeline.branchFromEventId = undefined;
          }
        }
      }
    });
    return { timelines: processedTimelines, knowledgeBase: processedKB };
  };

  const handleImport = () => {
    try {
      const { timelines, knowledgeBase } = processImportData();
      onImportTimelines(timelines, knowledgeBase);
      handleClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Import failed");
    }
  };

  const handleReset = () => {
    setImportedProject(null);
    setConflictSummary(null);
    setError(null);
    setStep("select-file");
    setImportStrategy("smart-merge");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  if (!importedProject || !conflictSummary) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title="Import Timeline Project"
        size="md"
      >
        <div className="space-y-6">
          <input
            type="file"
            ref={fileInputRef}
            accept=".ark,.ahp,.json"
            onChange={handleFileChange}
            className="hidden"
          />
          {error && (
            <MessageBox type="error" title="Import Error" message={error} />
          )}
          {step === "select-file" && (
            <div className="text-center py-12">
              <div className="mb-6">
                <svg
                  className="mx-auto h-20 w-20 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-3">
                Import Timeline Project
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto">
                Select an ARK project file to import timelines and their
                associated knowledge base items
              </p>
              <Button
                variant="primary"
                size="lg"
                onClick={handleFileSelect} // --- FIX: Corrected onClick handler name ---
                leftIcon={
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                }
              >
                Choose Project File
              </Button>
            </div>
          )}
        </div>
      </Modal>
    );
  }

  const totalItems =
    importedProject.timelines.length +
    (importedProject.characters?.length || 0) +
    (importedProject.locations?.length || 0) +
    (importedProject.technologies?.length || 0) +
    (importedProject.cultures?.length || 0) +
    (importedProject.sources?.length || 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import Timeline Project"
      size="lg"
    >
      <div className="space-y-6">
        {error && (
          <MessageBox type="error" title="Import Error" message={error} />
        )}
        <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-blue-600 dark:text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {importedProject.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {importedProject.description || "No description provided"}
              </p>
              <div className="flex items-center space-x-4 mt-3 text-sm text-gray-600 dark:text-gray-300">
                <span>
                  {importedProject.timelines.length} timeline
                  {importedProject.timelines.length !== 1 ? "s" : ""}
                </span>
                <span>•</span>
                <span>
                  {totalItems - importedProject.timelines.length} knowledge base
                  items
                </span>
              </div>
            </div>
          </div>
        </div>
        <div>
          <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">
            Import Strategy
          </h4>
          {conflictSummary.totalConflicts > 0 && (
            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
              <div className="flex items-start">
                <svg
                  className="h-5 w-5 text-amber-400 mt-0.5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  <p className="font-medium">
                    Found {conflictSummary.totalConflicts} naming conflict
                    {conflictSummary.totalConflicts !== 1 ? "s" : ""}
                  </p>
                  <p className="mt-1">
                    Items with the same names as existing ones in your project.
                  </p>
                </div>
              </div>
            </div>
          )}
          <div className="space-y-3">
            <label className="flex items-start space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
              <input
                type="radio"
                name="importStrategy"
                value="smart-merge"
                checked={importStrategy === "smart-merge"}
                onChange={(e) => setImportStrategy(e.target.value as any)}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900 dark:text-white">
                  Smart Merge (Recommended)
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Automatically merge duplicate items and preserve all
                  relationships. Timeline branches and knowledge base
                  connections will be maintained.
                </div>
              </div>
            </label>
            <label className="flex items-start space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
              <input
                type="radio"
                name="importStrategy"
                value="keep-separate"
                checked={importStrategy === "keep-separate"}
                onChange={(e) => setImportStrategy(e.target.value as any)}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900 dark:text-white">
                  Keep Separate
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Import as new items with distinct names (adds project name
                  suffix). Use this to preserve both versions when items are
                  genuinely different.
                </div>
              </div>
            </label>
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">
            Import Summary
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-600 dark:text-gray-400">Timelines</div>
              <div className="font-medium">
                {importedProject.timelines.length}
              </div>
            </div>
            <div>
              <div className="text-gray-600 dark:text-gray-400">
                Knowledge Base
              </div>
              <div className="font-medium">
                {totalItems - importedProject.timelines.length}
              </div>
            </div>
            {conflictSummary.totalConflicts > 0 && (
              <>
                <div>
                  <div className="text-gray-600 dark:text-gray-400">
                    Conflicts
                  </div>
                  <div className="font-medium text-amber-600">
                    {conflictSummary.totalConflicts}
                  </div>
                </div>
                <div>
                  <div className="text-gray-600 dark:text-gray-400">
                    Resolution
                  </div>
                  <div className="font-medium">
                    {importStrategy === "smart-merge" ? "Merge" : "Rename"}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="outline" onClick={handleReset}>
            Choose Different File
          </Button>
          <div className="space-x-3">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleImport}
              isLoading={isLoading}
              disabled={isLoading}
            >
              Import Project
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
export default ImportTimelineModal;
