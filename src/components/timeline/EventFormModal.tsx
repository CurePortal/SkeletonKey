import React, { useCallback } from "react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import { EventType, ID } from "../../types";
import EventForm from "./EventForm";
import { useTimelineBranching } from "./TimelineBranchHandler";
import { eventIcons } from "./IconSelector"; // Import the icon definitions

interface EventFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  event?: EventType;
  timelineId: ID;
  onSave: (event: Omit<EventType, "id"> | EventType) => void;
  onCancel: () => void;
  isLoading: boolean;
  initialValues?: Partial<EventType>;
  onDeleteClick?: (event: EventType) => void;
}

const EventFormModal: React.FC<EventFormModalProps> = ({
  isOpen,
  onClose,
  event,
  timelineId,
  onSave,
  onCancel,
  isLoading,
  initialValues,
  onDeleteClick,
}) => {
  const isEditing = !!event;
  const { openBranchModal, BranchingModal } = useTimelineBranching();

  const handleBranchClick = useCallback(() => {
    if (event) {
      // First close the modal
      onClose();
      // Then open the branch modal
      openBranchModal(event, (newTimelineId) => {
        // Optional: Do something after branch is created,
        // e.g. navigate to the new timeline
        console.log(`Branch timeline created: ${newTimelineId}`);
      });
    }
  }, [event, openBranchModal, onClose]);

  const renderHeaderActions = () => {
    if (isEditing && event) {
      return (
        <>
          <Button
            variant="success"
            size="sm"
            onClick={handleBranchClick}
            disabled={isLoading}
            leftIcon={
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            }
          >
            Create Branch
          </Button>
        </>
      );
    }
    return null;
  };

  // Function to get the icon element for the event
  const getEventIcon = () => {
    if (!event || !event.iconId || event.iconId === "default") {
      return null;
    }

    const iconData = eventIcons.find((icon) => icon.id === event.iconId);
    if (iconData && iconData.svg) {
      return React.cloneElement(iconData.svg, {
        className: "w-5 h-5 text-gray-600 dark:text-gray-400",
      });
    }
    return null;
  };

  // Build the title with icon if applicable
  const buildModalTitle = () => {
    if (isEditing && event) {
      const icon = getEventIcon();
      if (icon) {
        return (
          <div className="flex items-center gap-2">
            <span className="flex-shrink-0">{icon}</span>
            <span>Edit Event: {event.title}</span>
          </div>
        );
      }
      return `Edit Event: ${event.title}`;
    }
    return "Add New Event";
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={buildModalTitle()}
        size="xl"
        headerActions={renderHeaderActions()}
      >
        <EventForm
          event={event}
          timelineId={timelineId}
          onSubmit={onSave}
          onCancel={onCancel}
          initialValues={initialValues}
        />
        {isEditing && onDeleteClick && event && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="danger"
              size="sm"
              onClick={() => onDeleteClick(event)}
              disabled={isLoading}
              leftIcon={
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              }
            >
              Delete Event
            </Button>
          </div>
        )}
      </Modal>
      <BranchingModal />
    </>
  );
};

export default EventFormModal;
