import React, { useState, useEffect, ChangeEvent } from "react";
import Modal from "./common/Modal";
import InputField from "./common/InputField"; // Assuming InputFieldProps is defined in this component
import Button from "./common/Button";
import { TimelineType } from "../types"; // Only TimelineType is used

interface TimelineFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (timeline: Omit<TimelineType, "id"> | TimelineType) => void;
  onDelete?: (timelineId: string) => void; // Add delete handler
  timeline?: TimelineType;
  isLoading?: boolean;
  isDeleting?: boolean; // Add separate loading state for delete
  // Optional props to indicate if this is being created as a branch from an event
  isBranchFromEvent?: boolean;
  parentTimelineId?: string;
}

const TimelineFormModal: React.FC<TimelineFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  timeline,
  isLoading = false,
  isDeleting = false,
  isBranchFromEvent = false,
  parentTimelineId,
}) => {
  const isEditing = !!timeline;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#3B82F6");
  const [isMainTimeline, setIsMainTimeline] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const getRandomColor = (): string => {
    // Defined inside or imported
    const colors = [
      "#EF4444",
      "#10B981",
      "#F59E0B",
      "#8B5CF6",
      "#EC4899",
      "#14B8A6",
      "#F97316",
      "#6366F1",
      "#D946EF",
    ];
    return colors[Math.floor(Math.random() * colors.length)] || "#3B82F6";
  };

  useEffect(() => {
    if (isOpen) {
      setName(timeline?.name || "");
      setDescription(timeline?.description || "");
      setColor(timeline?.color || getRandomColor());
      // Set timeline type based on context
      if (timeline) {
        // Editing existing timeline - use existing value
        setIsMainTimeline(timeline.isMainTimeline ?? false);
      } else if (isBranchFromEvent) {
        // Creating from an event divergence - force to be branch
        setIsMainTimeline(false);
      } else {
        // Creating new timeline - default to main timeline
        setIsMainTimeline(true);
      }
      setErrors({});
      setShowDeleteConfirm(false); // Reset delete confirmation state
    }
  }, [timeline, isOpen, isBranchFromEvent]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = "Timeline name is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;
    const timelineData: Omit<TimelineType, "id"> | TimelineType = {
      ...(timeline ? { id: timeline.id } : {}), // Preserves ID if editing
      name,
      description,
      color,
      startDate: timeline?.startDate || new Date().toISOString(),
      endDate: timeline?.endDate || new Date().toISOString(),
      events: timeline?.events || [],
      pointsOfDivergence: timeline?.pointsOfDivergence || [],
      isMainTimeline: isMainTimeline,
      parentTimelineId: isBranchFromEvent
        ? parentTimelineId || null
        : timeline?.parentTimelineId || null,
      tags: timeline?.tags || [],
    };
    onSave(timelineData);
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    if (timeline && onDelete) {
      onDelete(timeline.id);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };

  // Determine if timeline type selection should be disabled
  const isTimelineTypeDisabled = isEditing || isBranchFromEvent;

  // Check if there are events or points of divergence that would be lost
  const hasContent =
    timeline &&
    ((timeline.events && timeline.events.length > 0) ||
      (timeline.pointsOfDivergence && timeline.pointsOfDivergence.length > 0));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Timeline" : "Create New Timeline"}
      size="md"
    >
      <div className="space-y-5">
        <InputField
          label="Timeline Name"
          value={name}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setName(e.target.value)
          }
          placeholder="E.g., The Great War Era"
          error={errors.name}
          required
        />
        <InputField
          label="Description"
          value={description}
          onChange={(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            setDescription(e.target.value)
          }
          placeholder="A brief overview of this timeline"
          type="textarea"
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Display Color
          </label>
          <div className="flex items-center space-x-3">
            <input
              type="color"
              value={color}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setColor(e.target.value)
              }
              className="h-10 w-10 rounded-md border border-gray-300 dark:border-gray-600 cursor-pointer"
            />
            <input
              type="text"
              value={color}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setColor(e.target.value)
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
              placeholder="#RRGGBB"
            />
          </div>
        </div>
        {/* Timeline Type Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Timeline Type
          </label>
          {isTimelineTypeDisabled ? (
            // Show as read-only when editing or creating from event
            <div
              className={`px-3 py-2 rounded-md text-sm ${
                isMainTimeline
                  ? "bg-green-100 text-green-700 dark:bg-green-700 dark:text-green-100"
                  : "bg-purple-100 text-purple-700 dark:bg-purple-700 dark:text-purple-100"
              }`}
            >
              {isMainTimeline ? "Main Timeline" : "Branch timeline"}
            </div>
          ) : (
            // Show as selectable radio buttons when creating new timeline
            <div className="space-y-3">
              <div className="flex items-center">
                <input
                  id="main-timeline"
                  name="timeline-type"
                  type="radio"
                  checked={isMainTimeline}
                  onChange={() => setIsMainTimeline(true)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                />
                <label
                  htmlFor="main-timeline"
                  className="ml-3 block text-sm text-gray-700 dark:text-gray-300"
                >
                  <span className="font-medium">Main Timeline</span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    A main timeline for your record or the root of a story
                  </span>
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="branch-timeline"
                  name="timeline-type"
                  type="radio"
                  checked={!isMainTimeline}
                  onChange={() => setIsMainTimeline(false)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                />
                <label
                  htmlFor="branch-timeline"
                  className="ml-3 block text-sm text-gray-700 dark:text-gray-300"
                >
                  <span className="font-medium">Branch timeline</span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    An alternative version or deviation from another timeline
                  </span>
                </label>
              </div>
            </div>
          )}
          {/* Show explanation based on context */}
          {isTimelineTypeDisabled && (
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              {isEditing
                ? "Timeline type cannot be changed after creation."
                : "Timeline type is automatically set to branch when created from an event divergence."}
            </p>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Delete Timeline
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Are you sure you want to delete "{name}"? This action cannot be
                undone.
                {hasContent && (
                  <span className="block mt-2 text-red-600 dark:text-red-400 font-medium">
                    Warning: This timeline contains events or points of
                    divergence that will be permanently lost.
                  </span>
                )}
              </p>
              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={handleDeleteCancel}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={handleDeleteConfirm}
                  isLoading={isDeleting}
                >
                  Delete Timeline
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="pt-5 flex justify-between border-t dark:border-gray-700 mt-6">
          {/* Left side - Delete button (only when editing) */}
          <div>
            {isEditing && onDelete && (
              <Button
                variant="danger"
                onClick={handleDeleteClick}
                disabled={isLoading || isDeleting}
              >
                Delete Timeline
              </Button>
            )}
          </div>

          {/* Right side - Cancel and Save buttons */}
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading || isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              isLoading={isLoading}
              disabled={isDeleting}
            >
              {isEditing ? "Update Timeline" : "Create Timeline"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default TimelineFormModal;
