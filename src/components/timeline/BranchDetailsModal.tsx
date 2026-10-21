import React, { useState, useEffect } from "react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import { useProjectData } from "../../contexts/ProjectDataContext";
import { EventType, ID, TimelineType } from "../../types";
import { parseCalendarDate } from "../../utils/helpers";

interface BranchDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  divergenceEvent: EventType | null;
  onTimelineSelect?: (timelineId: ID) => void;
}

const BranchDetailsModal: React.FC<BranchDetailsModalProps> = ({
  isOpen,
  onClose,
  divergenceEvent,
  onTimelineSelect,
}) => {
  const { project } = useProjectData();
  const [branches, setBranches] = useState<TimelineType[]>([]);
  const [parentTimeline, setParentTimeline] = useState<TimelineType | null>(
    null,
  );

  // Find all branches from this divergence point and the parent timeline
  useEffect(() => {
    if (!project || !divergenceEvent) return;

    // Find the parent timeline
    const parent = project.timelines.find(
      (t) => t.id === divergenceEvent.timelineId,
    );
    setParentTimeline(parent || null);

    // Find all branch timelines that reference this event as their divergence point
    const branchTimelines = project.timelines.filter(
      (t) =>
        t.parentTimelineId === divergenceEvent.timelineId &&
        (t as any).branchFromEventId === divergenceEvent.id, // Fixed: Added 'as any'
    );

    setBranches(branchTimelines);
  }, [project, divergenceEvent]);

  // Format date for display
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "Unknown date";

    try {
      // Handle BCE dates (negative years)
      if (dateStr.startsWith("-")) {
        const year = dateStr.substring(1, 5);
        return `${year} BCE`;
      }

      // Regular date
      const date = parseCalendarDate(dateStr);
      if (isNaN(date.getTime())) return dateStr;

      return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch (e) {
      return dateStr;
    }
  };

  if (!divergenceEvent || !parentTimeline) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Branch Timelines from "${divergenceEvent.title}"`}
      size="md"
    >
      <div className="space-y-6">
        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
          <h3 className="font-medium text-gray-900 dark:text-white mb-2">
            Divergence Point Details
          </h3>
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Event:
            </span>
            <span className="text-gray-900 dark:text-white">
              {divergenceEvent.title}
            </span>
          </div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Date:
            </span>
            <span className="text-gray-900 dark:text-white">
              {formatDate(divergenceEvent.date)}
            </span>
          </div>
          <div className="flex items-center space-x-2 mb-4">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Timeline:
            </span>
            <div className="flex items-center">
              <div
                className="w-3 h-3 rounded-full mr-1"
                style={{ backgroundColor: parentTimeline.color }}
              ></div>
              <span className="text-gray-900 dark:text-white">
                {parentTimeline.name}
              </span>
            </div>
          </div>
          {divergenceEvent.description && (
            <div className="text-sm text-gray-600 dark:text-gray-300 border-t dark:border-gray-700 pt-3">
              {divergenceEvent.description}
            </div>
          )}
        </div>

        <div>
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">
            Branch Timelines ({branches.length})
          </h3>

          {branches.length === 0 ? (
            <div className="text-gray-500 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="mb-2">
                No branch timelines have been created from this event yet.
              </p>
              <p className="text-xs">
                Create a branch timeline by selecting this event and clicking
                "Create Branch Timeline".
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {branches.map((branch) => (
                <div
                  key={branch.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                  onClick={() =>
                    onTimelineSelect && onTimelineSelect(branch.id)
                  }
                >
                  <div className="flex items-center mb-2">
                    <div
                      className="w-4 h-4 rounded-full mr-2"
                      style={{ backgroundColor: branch.color }}
                    ></div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {branch.name}
                    </h4>
                  </div>
                  {branch.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                      {branch.description}
                    </p>
                  )}
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{branch.events.length} events</span>
                    {/* Fixed: Added 'as any' and conditional rendering for safety,
                        though 'as any' alone would silence the TS error.
                        The error is "does not exist", implying it's not just optional. */}
                    {(branch as any).createdAt && (
                      <span>
                        Created: {formatDate((branch as any).createdAt)}
                      </span>
                    )}
                    {/* If createdAt is truly missing and should not be displayed,
                        the span could be removed entirely. The 'as any' makes it compile. */}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t dark:border-gray-700">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// Hook for easily using this modal
export const useBranchDetailsModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [event, setEvent] = useState<EventType | null>(null);
  const [onTimelineSelectCallback, setOnTimelineSelectCallback] = useState<
    ((id: ID) => void) | undefined
  >(undefined);

  const openModal = (
    divergenceEvent: EventType,
    onTimelineSelect?: (id: ID) => void,
  ) => {
    setEvent(divergenceEvent);
    // Corrected: Ensure the callback is properly assigned
    setOnTimelineSelectCallback(() => onTimelineSelect);
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setEvent(null);
    setOnTimelineSelectCallback(undefined); // Reset callback on close
  };

  const BranchDetailsModalComponent = () => (
    <BranchDetailsModal
      isOpen={isOpen}
      onClose={closeModal}
      divergenceEvent={event}
      onTimelineSelect={onTimelineSelectCallback}
    />
  );

  return {
    openBranchDetailsModal: openModal,
    closeBranchDetailsModal: closeModal,
    BranchDetailsModal: BranchDetailsModalComponent,
  };
};

export default BranchDetailsModal;
