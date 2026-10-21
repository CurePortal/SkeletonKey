import React, { useState, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { useProjectData } from "../../contexts/ProjectDataContext";
import { TimelineType, EventType, ID } from "../../types";
import Modal from "../common/Modal";
import Button from "../common/Button";
import InputField from "../common/InputField";
import ColorPicker from "../common/ColorPicker";

interface BranchTimelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceEvent: EventType | null;
  onBranchCreated: (newTimelineId: ID) => void;
}

const BranchTimelineModal: React.FC<BranchTimelineModalProps> = ({
  isOpen,
  onClose,
  sourceEvent,
  onBranchCreated,
}) => {
  const { updateEvent, addTimeline } = useProjectData();

  const [branchName, setBranchName] = useState<string>("");
  const [branchDescription, setBranchDescription] = useState<string>("");
  const [branchColor, setBranchColor] = useState<string>("#6d28d9"); // Default purple
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Generate a random color for new branches
  const generateRandomColor = useCallback(() => {
    const colors = [
      "#3b82f6", // blue
      "#10b981", // green
      "#f59e0b", // amber
      "#ef4444", // red
      "#8b5cf6", // purple
      "#ec4899", // pink
      "#06b6d4", // cyan
      "#14b8a6", // teal
      "#f97316", // orange
      "#84cc16", // lime
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }, []);

  // Set default values when modal opens
  React.useEffect(() => {
    if (isOpen && sourceEvent) {
      setBranchName(`Branch from "${sourceEvent.title}"`);
      setBranchDescription(
        `Timeline branch created from the event "${sourceEvent.title}"`,
      );
      setBranchColor(generateRandomColor());
      setError(null);
    }
  }, [isOpen, sourceEvent, generateRandomColor]);

  const handleSubmit = async () => {
    if (!sourceEvent) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. First ensure the source event is marked as a point of divergence
      if (!sourceEvent.isPointOfDivergence) {
        const updatedEvent: EventType = {
          ...sourceEvent,
          isPointOfDivergence: true,
        };

        // Update the source event to mark it as point of divergence
        updateEvent(sourceEvent.timelineId, updatedEvent);
      }

      // 2. Generate IDs for the new timeline and copied event
      const newTimelineId = uuidv4();
      const copiedEventId = uuidv4();
      const podId = uuidv4();

      // 3. Create a copy of the source event for the new timeline
      const copiedEvent: EventType = {
        ...sourceEvent,
        id: copiedEventId,
        timelineId: newTimelineId,
        isPointOfDivergence: false, // Reset this for the copied event
        position: undefined, // Reset position to allow proper positioning in the new timeline
      };

      // 4. Create the new timeline with the copied event
      const newTimeline: Omit<TimelineType, "id"> = {
        name: branchName.trim() || `Branch from "${sourceEvent.title}"`,
        description: branchDescription.trim(),
        color: branchColor,
        parentTimelineId: sourceEvent.timelineId,
        branchFromEventId: sourceEvent.id, // This is the critical connection
        isMainTimeline: false,
        events: [copiedEvent], // Include the copied event
        pointsOfDivergence: [
          {
            id: podId,
            timelineId: newTimelineId,
            name: `Branch from "${sourceEvent.title}"`,
            description: `Diverges from the event "${sourceEvent.title}"`,
            date: sourceEvent.date,
            parentTimelineId: sourceEvent.timelineId,
            eventIds: [sourceEvent.id],
            resultingTimelineIds: [newTimelineId],
            plausibilityRating: 7,
            notes: "",
            tags: sourceEvent.tags || [],
          },
        ],
        startDate: sourceEvent.date,
        endDate: sourceEvent.endDate || sourceEvent.date,
        tags: ["branch"],
      };

      // 5. Add the new timeline to the project
      addTimeline(newTimeline);

      // 6. Notify parent component and close modal
      onBranchCreated(newTimelineId);
      onClose();
    } catch (error) {
      setError(
        typeof error === "string" ? error : "Failed to create branch timeline",
      );
      console.error("Error creating branch timeline:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Branch Timeline"
      size="md"
    >
      <div className="space-y-6">
        <p className="text-gray-600 dark:text-gray-300">
          Create a new timeline branch from the event "
          {sourceEvent?.title || ""}". This will mark the source event as a
          point of divergence.
        </p>

        <InputField
          label="Timeline Name"
          value={branchName}
          onChange={(e) => setBranchName(e.target.value)}
          placeholder="Enter a name for this branch timeline"
          required
        />

        <InputField
          label="Description"
          value={branchDescription}
          onChange={(e) => setBranchDescription(e.target.value)}
          placeholder="Describe the purpose of this branch timeline"
          as="textarea"
          rows={3}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Timeline Color
          </label>
          <ColorPicker
            color={branchColor}
            onChange={setBranchColor}
            presetColors={[
              "#3b82f6",
              "#10b981",
              "#f59e0b",
              "#ef4444",
              "#8b5cf6",
              "#ec4899",
              "#06b6d4",
              "#14b8a6",
              "#f97316",
              "#84cc16",
            ]}
          />
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-700 rounded-md border border-red-200 dark:bg-red-900 dark:bg-opacity-20 dark:text-red-300 dark:border-red-800">
            {error}
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-4 border-t dark:border-gray-700">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={isSubmitting}
            isLoading={isSubmitting}
          >
            Create Branch Timeline
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export const useTimelineBranching = () => {
  const [branchModalOpen, setBranchModalOpen] = useState<boolean>(false);
  const [sourceEvent, setSourceEvent] = useState<EventType | null>(null);
  const [branchCreatedCallback, setBranchCreatedCallback] = useState<
    ((timelineId: ID) => void) | null
  >(null);

  const openBranchModal = useCallback(
    (event: EventType, onBranchCreated?: (timelineId: ID) => void) => {
      setSourceEvent(event);
      setBranchModalOpen(true);
      if (onBranchCreated) {
        setBranchCreatedCallback(() => onBranchCreated);
      }
    },
    [],
  );

  const closeBranchModal = useCallback(() => {
    setBranchModalOpen(false);
    setSourceEvent(null);
  }, []);

  const handleBranchCreated = useCallback(
    (newTimelineId: ID) => {
      if (branchCreatedCallback) {
        branchCreatedCallback(newTimelineId);
      }
      setBranchCreatedCallback(null);
    },
    [branchCreatedCallback],
  );

  const BranchingModal = useCallback(
    () => (
      <BranchTimelineModal
        isOpen={branchModalOpen}
        onClose={closeBranchModal}
        sourceEvent={sourceEvent}
        onBranchCreated={handleBranchCreated}
      />
    ),
    [branchModalOpen, closeBranchModal, sourceEvent, handleBranchCreated],
  );

  return {
    openBranchModal,
    closeBranchModal,
    BranchingModal,
  };
};

export default useTimelineBranching;
