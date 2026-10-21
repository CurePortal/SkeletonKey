import React, { useState } from "react";
import { useProjectData } from "../contexts/ProjectDataContext";
import { useAppState } from "../contexts/AppStateContext";
import MainContentArea from "../components/layout/MainContentArea";
import EventRelationshipSankey from "../components/timeline/EventRelationshipSankey";
import TimelineSelector from "../components/timeline/TimelineSelector";
import Button from "../components/common/Button";
import EventFormModal from "../components/timeline/EventFormModal";
import MessageBox from "../components/common/MessageBox";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { EventType, ID } from "../types";

/**
 * Timeline Relationship View page that shows event relationships
 * in a Sankey diagram visualizing how events connect to entities
 */
const RelationshipViewPage: React.FC = () => {
  const { project, getTimelineById } = useProjectData();
  const { appState, setCurrentTimelineId } = useAppState();

  // State for timeline selector dropdown
  const [isTimelineSelectorOpen, setIsTimelineSelectorOpen] = useState(false);

  // State for event modal
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventType | null>(null);

  // Current timeline ID from app state
  const currentTimelineId = appState.currentTimelineId;
  const currentTimeline = currentTimelineId
    ? getTimelineById(currentTimelineId)
    : undefined;

  // View mode option - could expand with other visualization types
  const [viewMode, setViewMode] = useState<"sankey" | "force">("sankey");

  // Handler for timeline selection
  const handleTimelineSelect = (timelineId: ID) => {
    setCurrentTimelineId(timelineId);
    setIsTimelineSelectorOpen(false);
  };

  // Handler for adding new timeline
  const handleAddTimelineClick = () => {
    // This could open your existing timeline creation modal
    alert("This would open the timeline creation modal");
  };

  // Handler for event click
  const handleEventClick = (event: EventType) => {
    setSelectedEvent(event);
    setIsEventModalOpen(true);
  };

  // Handler for entity click
  const handleEntityClick = (entityType: string, entityId: ID) => {
    // Navigate to the appropriate knowledge base page and select the entity
    // You could implement this using your AppState context
    console.log(`Clicked on ${entityType} with ID ${entityId}`);

    // Example of how you might navigate to entity:
    // history.push(`/knowledge-base/${entityType}/${entityId}`);

    // For now, just show an example alert
    alert(
      `Clicked on ${entityType} with ID ${entityId}. This would navigate to the entity's details page.`,
    );
  };

  // Handler for event save
  const handleSaveEvent = (eventData: Omit<EventType, "id"> | EventType) => {
    // This could call your existing event save function
    console.log("Save event:", eventData);
    setIsEventModalOpen(false);
    setSelectedEvent(null);
  };

  // If no project is loaded
  if (!project) {
    return (
      <MainContentArea title="Relationship View">
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <LoadingSpinner size="lg" label="Loading project data..." showLabel />
        </div>
      </MainContentArea>
    );
  }

  // If no timelines exist
  if (!project.timelines || project.timelines.length === 0) {
    return (
      <MainContentArea title="Relationship View">
        <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] max-w-lg mx-auto">
          <MessageBox
            type="info"
            title="No Timelines Available"
            message="You need to create at least one timeline before you can view event relationships. Head to the Timeline Editor to create your first timeline."
            actions={[
              {
                label: "Go to Timeline Editor",
                onClick: () => {
                  // Navigate to timeline editor
                  // This would use your routing system
                  console.log("Navigate to timeline editor");
                },
              },
            ]}
          />
        </div>
      </MainContentArea>
    );
  }

  return (
    <MainContentArea
      title="Relationship View"
      subtitle="Visualize connections between timeline events and entities"
      actions={
        <>
          <TimelineSelector
            timelines={project.timelines}
            currentTimelineId={currentTimelineId}
            onTimelineSelect={(id) => id && handleTimelineSelect(id)}
            onAddTimelineClick={handleAddTimelineClick}
            isOpen={isTimelineSelectorOpen}
            onToggle={() => setIsTimelineSelectorOpen(!isTimelineSelectorOpen)}
          />

          <div className="ml-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setViewMode(viewMode === "sankey" ? "force" : "sankey")
              }
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
                    d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                  />
                </svg>
              }
              disabled={!currentTimeline}
              title={!currentTimeline ? "Select a timeline first" : undefined}
            >
              View Mode: {viewMode === "sankey" ? "Sankey" : "Force Layout"}
            </Button>
          </div>
        </>
      }
    >
      <div className="h-full flex flex-col">
        {/* Timeline information header */}
        {currentTimeline && (
          <div className="bg-gray-50 dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <div
                className="w-4 h-4 rounded-full mr-2"
                style={{ backgroundColor: currentTimeline.color }}
              ></div>
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                {currentTimeline.name}
              </h2>
            </div>
            {currentTimeline.description && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {currentTimeline.description}
              </p>
            )}
            <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              <span className="mr-4">
                Events: {currentTimeline.events.length}
              </span>
              {currentTimeline.isMainTimeline ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  Main Timeline
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                  Branch timeline
                </span>
              )}
            </div>
          </div>
        )}

        {/* Main visualization area */}
        <div className="flex-1 overflow-hidden">
          {!currentTimelineId ? (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400 p-10 text-center bg-white dark:bg-gray-900">
              <div className="max-w-md">
                <h3 className="text-lg font-medium mb-2">Select a Timeline</h3>
                <p className="mb-4">
                  Choose a timeline from the dropdown above to visualize the
                  relationships between its events and entities.
                </p>
                <Button
                  variant="primary"
                  onClick={() => setIsTimelineSelectorOpen(true)}
                >
                  Select Timeline
                </Button>
              </div>
            </div>
          ) : !currentTimeline?.events.length ? (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400 p-10 text-center bg-white dark:bg-gray-900">
              <div className="max-w-md">
                <h3 className="text-lg font-medium mb-2">
                  No Events in Timeline
                </h3>
                <p className="mb-4">
                  The selected timeline "{currentTimeline?.name}" doesn't have
                  any events yet. Add some events to see their relationships.
                </p>
                <Button
                  variant="primary"
                  onClick={() => {
                    // Navigate to timeline editor for this timeline
                    console.log(
                      "Navigate to timeline editor for",
                      currentTimelineId,
                    );
                  }}
                >
                  Add Events
                </Button>
              </div>
            </div>
          ) : viewMode === "sankey" ? (
            <EventRelationshipSankey
              timelineId={currentTimelineId}
              height={600}
              width={1200}
              onEventClick={handleEventClick}
              onEntityClick={handleEntityClick}
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-white dark:bg-gray-800">
              <div className="text-center">
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Force layout view is not yet implemented. This could be
                  developed as another visualization option.
                </p>
                <Button variant="outline" onClick={() => setViewMode("sankey")}>
                  Switch to Sankey View
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Event modal for editing/viewing events */}
      {selectedEvent && (
        <EventFormModal
          isOpen={isEventModalOpen}
          onClose={() => {
            setIsEventModalOpen(false);
            setSelectedEvent(null);
          }}
          event={selectedEvent}
          timelineId={selectedEvent.timelineId || currentTimelineId || ""}
          onSave={handleSaveEvent}
          onCancel={() => {
            setIsEventModalOpen(false);
            setSelectedEvent(null);
          }}
          isLoading={false}
        />
      )}
    </MainContentArea>
  );
};

export default RelationshipViewPage;
