import React, { useState, useCallback } from "react";
import { useProjectData } from "../contexts/ProjectDataContext";
import { useNotification } from "../contexts/NotificationContext";
import MainContentArea from "../components/layout/MainContentArea";
import Button from "../components/common/Button";
import LoadingSpinner from "../components/common/LoadingSpinner";
import MessageBox from "../components/common/MessageBox";
import TimelineFlowView from "../components/timeline/TimelineFlowView";
import EventFormModal from "../components/timeline/EventFormModal";
import TimelineFormModal from "../components/timeline/TimelineFormModal";
import ImportTimelineModal from "../components/timeline/ImportTimelineModal";
import PointOfDivergenceModal from "../components/timeline/PointOfDivergenceModal";
import Modal from "../components/common/Modal";

import { useBranchDetailsModal } from "../components/timeline/BranchDetailsModal";
import { useTimelineEditor } from "../hooks/useTimelineEditor";
import { TimelineType, EventType, ID } from "../types";
import { v4 as uuidv4 } from "uuid";

// Import the forms for editing entities
import CharacterForm from "../pages/CharacterForm";
import LocationForm from "../pages/LocationForm";
import TechnologyForm from "../pages/TechnologyForm";
import CultureForm from "../pages/CultureForm";

type InternalEventType = any;

interface ImportedKnowledgeBase {
  characters: any[];
  locations: any[];
  technologies: any[];
  cultures: any[];
  sourceDocuments: any[];
}

const TimelineEditorPage: React.FC = () => {
  const {
    project,
    deleteTimeline,
    batchImportTimelines,
    // Add getters and updaters for entities
    getCharacterById,
    updateCharacter,
    getLocationById,
    updateLocation,
    getTechnologyById,
    updateTechnology,
    getCultureById,
    updateCulture,
  } = useProjectData();
  const { showSuccess, showError } = useNotification();

  const {
    currentTimeline,
    currentTimelineId,
    isLoading,
    isEventModalOpen,
    setIsEventModalOpen,
    selectedEvent,
    setSelectedEvent,
    isDeleteModalOpen,
    setIsDeleteModalOpen,
    isTimelineModalOpen,
    setIsTimelineModalOpen,
    selectedTimelineForEditing,
    isPoDModalOpen,
    setIsPoDModalOpen,
    newEventTemplate,
    handleTimelineSelect,
    handleAddTimelineClick,
    handleEditTimelineClick,
    handleSaveTimeline,
    handleAddEventClick,
    handleSaveEvent,
    handleDeleteEventClick,
    handleConfirmDeleteEvent,
    handleCreateBranchFromEvent,
  } = useTimelineEditor();

  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [showConsistencyAnalysis, setShowConsistencyAnalysis] =
    useState<boolean>(false);

  // State to track the currently editing entity
  const [editingEntity, setEditingEntity] = useState<{
    type: string;
    id: ID;
  } | null>(null);

  const handleDelete = async (timelineId: string): Promise<void> => {
    console.log("Attempting to delete timeline:", timelineId);
    setIsDeleting(true);
    try {
      deleteTimeline(timelineId);
      console.log("Timeline deleted successfully");
      setIsTimelineModalOpen(false);
      if (currentTimelineId === timelineId) {
        const remainingTimelines: TimelineType[] =
          project?.timelines?.filter(
            (t: TimelineType) => t.id !== timelineId,
          ) || [];
        if (remainingTimelines.length > 0) {
          handleTimelineSelect(remainingTimelines[0].id);
        } else {
          handleTimelineSelect("");
        }
      }
      showSuccess("Timeline deleted successfully");
    } catch (error) {
      console.error("Error deleting timeline:", error);
      showError("Failed to delete timeline");
    } finally {
      setIsDeleting(false);
    }
  };

  const { openBranchDetailsModal, BranchDetailsModal } =
    useBranchDetailsModal();

  // Updated handler to set the editing state
  const handleEntityClick = useCallback(
    (entityType: string, entityId: ID): void => {
      setEditingEntity({ type: entityType, id: entityId });
    },
    [],
  );

  // Handlers for the entity forms
  const handleFormCancel = (): void => {
    setEditingEntity(null);
  };

  const handleFormSubmit = async (
    data: any,
    imageFile?: File | null,
  ): Promise<void> => {
    if (!editingEntity) return;

    try {
      let entityName: string =
        editingEntity.type.charAt(0).toUpperCase() +
        editingEntity.type.slice(1);

      switch (editingEntity.type) {
        case "character":
          // Combine id, data, and imageFile into a single object
          await updateCharacter({
            ...data,
            id: editingEntity.id,
            imageFile: imageFile || undefined,
          });
          break;
        case "location":
          // Combine id and data into a single object
          await updateLocation({
            ...data,
            id: editingEntity.id,
          });
          break;
        case "technology":
          // Combine id and data into a single object
          await updateTechnology({
            ...data,
            id: editingEntity.id,
          });
          break;
        case "culture":
          // Combine id, data, and imageFile into a single object
          await updateCulture({
            ...data,
            id: editingEntity.id,
            imageFile: imageFile || undefined,
          });
          break;
        default:
          throw new Error(`Unknown entity type: ${editingEntity.type}`);
      }

      showSuccess(`${entityName} updated successfully!`);
      setEditingEntity(null);
    } catch (error) {
      console.error(`Error updating ${editingEntity.type}:`, error);
      showError(`Failed to update ${editingEntity.type}.`);
    }
  };

  const handleImportTimelines = (): void => {
    setIsImportModalOpen(true);
  };

  const handleTimelineImport = async (
    timelines: TimelineType[],
    knowledgeBase?: ImportedKnowledgeBase,
  ): Promise<void> => {
    if (!project) {
      showError("No project loaded");
      return;
    }
    setIsImporting(true);
    try {
      const processedData: {
        timelines: TimelineType[];
        knowledgeBase?: ImportedKnowledgeBase;
      } = await processImportData(timelines, knowledgeBase);
      await (batchImportTimelines as any)(
        processedData.timelines,
        processedData.knowledgeBase,
      );
      const timelineCount: number = timelines.length;
      const kbItemCount: number = knowledgeBase
        ? knowledgeBase.characters.length +
          knowledgeBase.locations.length +
          knowledgeBase.technologies.length +
          knowledgeBase.cultures.length +
          knowledgeBase.sourceDocuments.length
        : 0;
      showSuccess(
        `Successfully imported ${timelineCount} timeline${
          timelineCount !== 1 ? "s" : ""
        }${kbItemCount > 0 ? ` and ${kbItemCount} knowledge base items` : ""}`,
        { title: "Import Successful", duration: 5000 },
      );
      const mainTimelines: TimelineType[] = processedData.timelines.filter(
        (t: TimelineType) => t.isMainTimeline,
      );
      if (mainTimelines.length === 1) {
        handleTimelineSelect(mainTimelines[0].id);
      } else if (processedData.timelines.length === 1) {
        handleTimelineSelect(processedData.timelines[0].id);
      }
      setIsImportModalOpen(false);
    } catch (error) {
      console.error("Error importing timelines:", error);
      showError(
        `Failed to import timelines: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        { title: "Import Failed", duration: 8000 },
      );
    } finally {
      setIsImporting(false);
    }
  };

  const processImportData = async (
    timelines: TimelineType[],
    knowledgeBase?: ImportedKnowledgeBase,
  ): Promise<{
    timelines: TimelineType[];
    knowledgeBase?: ImportedKnowledgeBase;
  }> => {
    const kbIdMappings: Map<string, string> = new Map<string, string>();
    if (knowledgeBase) {
      const allKbItems: any[] = [
        ...knowledgeBase.characters,
        ...knowledgeBase.locations,
        ...knowledgeBase.technologies,
        ...knowledgeBase.cultures,
        ...knowledgeBase.sourceDocuments,
      ];
      allKbItems.forEach((item: any) => {
        const originalId: string = item.originalId || item.id;
        const newId: string = item.id || uuidv4();
        if (originalId) {
          kbIdMappings.set(originalId, newId);
        }
      });
    }
    const timelineIdMappings: Map<string, string> = new Map<string, string>();
    timelines.forEach((timeline: TimelineType) => {
      const newId: string = uuidv4();
      timelineIdMappings.set(timeline.id, newId);
    });
    const processedTimelines: TimelineType[] = timelines.map(
      (timeline: TimelineType) => {
        const newTimelineId: string = timelineIdMappings.get(timeline.id)!;
        const updatedEvents: EventType[] = timeline.events.map(
          (event: EventType) => {
            const updatedEvent: EventType = {
              ...event,
              id: uuidv4(),
              timelineId: newTimelineId,
              causes: [],
              effects: [],
            };
            if (event.linkedCharacterIds) {
              updatedEvent.linkedCharacterIds = event.linkedCharacterIds
                .map((id: string) => kbIdMappings.get(id) || id)
                .filter((id: string) => id);
            }
            if (event.linkedLocationIds) {
              updatedEvent.linkedLocationIds = event.linkedLocationIds
                .map((id: string) => kbIdMappings.get(id) || id)
                .filter((id: string) => id);
            }
            if (event.linkedTechnologyIds) {
              updatedEvent.linkedTechnologyIds = event.linkedTechnologyIds
                .map((id: string) => kbIdMappings.get(id) || id)
                .filter((id: string) => id);
            }
            if (event.linkedCultureIds) {
              updatedEvent.linkedCultureIds = event.linkedCultureIds
                .map((id: string) => kbIdMappings.get(id) || id)
                .filter((id: string) => id);
            }
            if (event.linkedSourceDocumentIds) {
              updatedEvent.linkedSourceDocumentIds =
                event.linkedSourceDocumentIds
                  .map((id: string) => kbIdMappings.get(id) || id)
                  .filter((id: string) => id);
            }
            return updatedEvent;
          },
        );
        const updatedPoDs: any[] =
          timeline.pointsOfDivergence?.map((pod: any) => ({
            ...pod,
            id: uuidv4(),
            timelineId: newTimelineId,
            eventIds:
              pod.eventIds?.map((eventId: string) => {
                const originalEvent: EventType | undefined =
                  timeline.events.find((e: EventType) => e.id === eventId);
                if (originalEvent) {
                  const newEvent: EventType | undefined = updatedEvents.find(
                    (e: EventType) =>
                      e.title === originalEvent.title &&
                      e.date === originalEvent.date,
                  );
                  return newEvent ? newEvent.id : eventId;
                }
                return eventId;
              }) || [],
            resultingTimelineIds: [],
          })) || [];
        let parentTimelineId: string | null = null;
        let branchFromEventId: string | undefined = undefined;
        if (timeline.parentTimelineId) {
          if (timelineIdMappings.has(timeline.parentTimelineId)) {
            parentTimelineId = timelineIdMappings.get(
              timeline.parentTimelineId,
            )!;
          } else if (
            project?.timelines.some(
              (t: TimelineType) => t.id === timeline.parentTimelineId,
            )
          ) {
            parentTimelineId = timeline.parentTimelineId;
          }
        }
        if (timeline.branchFromEventId && parentTimelineId) {
          branchFromEventId = undefined;
        }
        return {
          ...timeline,
          id: newTimelineId,
          events: updatedEvents,
          pointsOfDivergence: updatedPoDs,
          parentTimelineId,
          branchFromEventId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      },
    );
    let processedKnowledgeBase: ImportedKnowledgeBase | undefined;
    if (knowledgeBase) {
      processedKnowledgeBase = {
        characters: knowledgeBase.characters.map((item: any) => ({
          ...item,
          id:
            kbIdMappings.get(item.originalId || item.id) || item.id || uuidv4(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })),
        locations: knowledgeBase.locations.map((item: any) => ({
          ...item,
          id:
            kbIdMappings.get(item.originalId || item.id) || item.id || uuidv4(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })),
        technologies: knowledgeBase.technologies.map((item: any) => ({
          ...item,
          id:
            kbIdMappings.get(item.originalId || item.id) || item.id || uuidv4(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })),
        cultures: knowledgeBase.cultures.map((item: any) => ({
          ...item,
          id:
            kbIdMappings.get(item.originalId || item.id) || item.id || uuidv4(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })),
        sourceDocuments: knowledgeBase.sourceDocuments.map((item: any) => ({
          ...item,
          id:
            kbIdMappings.get(item.originalId || item.id) || item.id || uuidv4(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })),
      };
    }
    return {
      timelines: processedTimelines,
      knowledgeBase: processedKnowledgeBase,
    };
  };

  const handleEventRightClick = (
    internalEvent: InternalEventType,
    e: React.MouseEvent,
  ): void => {
    e.preventDefault();
    const eventId: string = internalEvent?.id || internalEvent?.data?.id;
    if (!eventId) {
      console.error(
        "handleEventRightClick: Could not determine event ID from internalEvent:",
        internalEvent,
      );
      showError("Could not process event right-click.");
      return;
    }
    const divergentEvent: EventType | undefined = project?.timelines
      .flatMap((t: TimelineType) => t.events)
      .find((ev: EventType) => ev.id === eventId && ev.isPointOfDivergence);
    if (divergentEvent) {
      openBranchDetailsModal(divergentEvent, handleTimelineSelect);
    }
  };

  // Helper to render the correct edit form
  const renderEditForm = (): React.ReactNode => {
    if (!editingEntity) return null;

    const { type, id } = editingEntity;
    let initialData: any;
    let entityName: string = type.charAt(0).toUpperCase() + type.slice(1);

    const formWrapper = (form: React.ReactNode): React.ReactNode => (
      <div className="p-4 md:p-8 overflow-y-auto h-full" key={`${type}-${id}`}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
            Edit {entityName}
          </h2>
          <Button variant="outline" onClick={handleFormCancel}>
            Back to Timeline
          </Button>
        </div>
        {form}
      </div>
    );

    switch (type) {
      case "character":
        initialData = getCharacterById(id);
        if (!initialData) return null;
        return formWrapper(
          <CharacterForm
            initialData={initialData}
            onSubmit={handleFormSubmit}
            onCancel={handleFormCancel}
          />,
        );
      case "location":
        initialData = getLocationById(id);
        if (!initialData) return null;
        return formWrapper(
          <LocationForm
            initialData={initialData}
            onSubmit={handleFormSubmit}
            onCancel={handleFormCancel}
          />,
        );
      case "technology":
        initialData = getTechnologyById(id);
        if (!initialData) return null;
        return formWrapper(
          <TechnologyForm
            initialData={initialData}
            onSubmit={handleFormSubmit}
            onCancel={handleFormCancel}
          />,
        );
      case "culture":
        initialData = getCultureById(id);
        if (!initialData) return null;
        return formWrapper(
          <CultureForm
            initialData={initialData}
            onSubmit={handleFormSubmit}
            onCancel={handleFormCancel}
          />,
        );
      default:
        return (
          <MessageBox
            type="error"
            title="Error"
            message={`Unknown entity type "${type}" for editing.`}
            actions={[{ label: "Go Back", onClick: handleFormCancel }]}
          />
        );
    }
  };

  if (!project) {
    return (
      <MainContentArea title="Timeline Editor">
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <LoadingSpinner size="lg" label="Loading project data..." showLabel />
        </div>
      </MainContentArea>
    );
  }

  if (!project.timelines || project.timelines.length === 0) {
    return (
      <MainContentArea title="Timeline Editor">
        <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] max-w-lg mx-auto">
          <MessageBox
            type="info"
            title="No Timelines Yet"
            message="Your story's journey begins here. Create your first timeline to map out events and possibilities."
            actions={[
              {
                label: "Create First Timeline",
                onClick: handleAddTimelineClick,
              },
              { label: "Import Timelines", onClick: handleImportTimelines },
            ]}
          />
          <TimelineFormModal
            isOpen={isTimelineModalOpen}
            onClose={() => setIsTimelineModalOpen(false)}
            onSave={handleSaveTimeline}
            onDelete={handleDelete}
            isDeleting={isDeleting}
            isLoading={isLoading}
            timeline={selectedTimelineForEditing || undefined}
          />
          <ImportTimelineModal
            isOpen={isImportModalOpen}
            onClose={() => setIsImportModalOpen(false)}
            onImportTimelines={handleTimelineImport as any}
            currentProject={project}
            isLoading={isImporting}
          />
        </div>
      </MainContentArea>
    );
  }
  return (
    <MainContentArea
      title={editingEntity ? "Editing Entity" : "Timeline Editor"}
      actions={
        !editingEntity ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConsistencyAnalysis(true)}
              leftIcon={
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v11a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                  />
                </svg>
              }
              title="Run consistency analysis on timeline data"
            >
              Analyze
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleImportTimelines}
              leftIcon={
                <svg
                  className="h-4 w-4"
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
              Import
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleEditTimelineClick}
              disabled={!currentTimeline}
              leftIcon={
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              }
            >
              Edit Timeline
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleAddEventClick()}
              disabled={!currentTimelineId}
              leftIcon={
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              }
            >
              Add Event
            </Button>
          </>
        ) : null
      }
    >
      <div className="h-full flex flex-col">
        <div
          style={{
            height: "calc(100vh - 160px)",
            width: "calc(100% + 3rem)",
            marginLeft: "-1.5rem",
            marginRight: "-1.5rem",
            marginTop: "-1.5rem",
            marginBottom: "-1.5rem",
          }}
          className="relative flex-1 min-h-0"
        >
          {editingEntity ? (
            renderEditForm()
          ) : !currentTimelineId ? (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400 p-10 text-center bg-white dark:bg-gray-900">
              <div className="max-w-md">
                <h3 className="text-lg font-medium mb-2">Select a Timeline</h3>
                <p className="mb-4">
                  Click on a timeline from the dropdown above to view its
                  events, or create a new timeline to get started.
                </p>
                <Button variant="primary" onClick={handleAddTimelineClick}>
                  Create New Timeline
                </Button>
              </div>
            </div>
          ) : (
            <TimelineFlowView
              timelines={project.timelines}
              currentTimelineId={currentTimelineId}
              showConsistencyAnalysis={showConsistencyAnalysis}
              onCloseConsistencyAnalysis={() =>
                setShowConsistencyAnalysis(false)
              }
              onEventClick={(internalEvent: InternalEventType) => {
                const eventId: string =
                  internalEvent?.id || internalEvent?.data?.id;

                if (!eventId) {
                  console.error(
                    "TimelineFlowView onEventClick: Could not determine event ID from internalEvent:",
                    internalEvent,
                  );
                  showError("Could not process event click.");
                  return;
                }
                const fullEvent: EventType | undefined = project?.timelines
                  .flatMap((t: TimelineType) => t.events)
                  .find((e: EventType) => e.id === eventId);

                if (fullEvent) {
                  setSelectedEvent(fullEvent);
                  setIsEventModalOpen(true);
                } else {
                  console.error(
                    `TimelineFlowView onEventClick: Full event not found for ID: ${eventId}`,
                  );
                  showError("Clicked event details could not be loaded.");
                }
              }}
              onEventRightClick={handleEventRightClick}
              onAddEvent={() => handleAddEventClick(currentTimelineId)}
              onTimelineSelect={handleTimelineSelect}
              onAddTimelineClick={handleAddTimelineClick}
              onDeleteEvent={(eventId: ID, timelineId: ID) => {
                const event: EventType | undefined = project.timelines
                  .find((t: TimelineType) => t.id === timelineId)
                  ?.events.find((e: EventType) => e.id === eventId);
                if (event) handleDeleteEventClick(event);
              }}
              onDeleteTimeline={(timelineId: ID) => {
                if (
                  window.confirm(
                    "Are you sure you want to delete this timeline? This action cannot be undone.",
                  )
                ) {
                  console.log("Delete timeline:", timelineId);
                }
              }}
              onEditTimeline={(timelineId: ID) => {
                const timelineToSelect: TimelineType | undefined =
                  project.timelines.find(
                    (t: TimelineType) => t.id === timelineId,
                  );

                if (timelineToSelect) {
                  handleTimelineSelect(timelineId);
                  handleEditTimelineClick();
                } else {
                  console.warn(
                    `Timeline with ID ${timelineId} not found, cannot initiate edit.`,
                  );
                  showError(`Timeline with ID ${timelineId} not found.`);
                }
              }}
              onCreateBranch={(sourceEventId: ID, sourceTimelineId: ID) => {
                const sourceEvent: EventType | undefined = project.timelines
                  .find((t: TimelineType) => t.id === sourceTimelineId)
                  ?.events.find((e: EventType) => e.id === sourceEventId);
                if (sourceEvent) {
                  openBranchDetailsModal(sourceEvent, handleTimelineSelect);
                }
              }}
            />
          )}
        </div>

        <TimelineFormModal
          isOpen={isTimelineModalOpen}
          onClose={() => setIsTimelineModalOpen(false)}
          onSave={handleSaveTimeline}
          timeline={selectedTimelineForEditing || undefined}
          isLoading={isLoading}
          onDelete={handleDelete}
          isDeleting={isDeleting}
        />

        <EventFormModal
          isOpen={isEventModalOpen}
          onClose={() => {
            setIsEventModalOpen(false);
            setSelectedEvent(null);
          }}
          event={selectedEvent || undefined}
          timelineId={selectedEvent?.timelineId || currentTimelineId || ""}
          onSave={handleSaveEvent}
          onCancel={() => {
            setIsEventModalOpen(false);
            setSelectedEvent(null);
          }}
          isLoading={isLoading}
          initialValues={newEventTemplate || undefined}
          onDeleteClick={handleDeleteEventClick}
        />

        <ImportTimelineModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImportTimelines={handleTimelineImport as any}
          currentProject={project}
          isLoading={isImporting}
        />

        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          title="Confirm Event Deletion"
          size="sm"
        >
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Are you sure you want to permanently delete the event "
            <strong>{selectedEvent?.title || "this event"}</strong>"? This
            action cannot be undone.
          </p>
          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmDeleteEvent}
              isLoading={isLoading}
            >
              Delete Event
            </Button>
          </div>
        </Modal>

        <PointOfDivergenceModal
          isOpen={isPoDModalOpen}
          onClose={() => setIsPoDModalOpen(false)}
          onCreateBranch={handleCreateBranchFromEvent}
          sourceEvent={selectedEvent || undefined}
          isLoading={isLoading}
        />
        <BranchDetailsModal />
      </div>
    </MainContentArea>
  );
};

export default TimelineEditorPage;
