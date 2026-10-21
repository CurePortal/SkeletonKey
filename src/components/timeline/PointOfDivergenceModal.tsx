import React, { useState } from "react";
import Button from "../common/Button";
import InputField from "../common/InputField";
import Modal from "../common/Modal";
import { EventType } from "../../types";
import { parseCalendarDate } from "../../utils/helpers";

interface PointOfDivergenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateBranch: (
    newTimelineName: string,
    newTimelineDescription: string,
  ) => void;
  sourceEvent?: EventType;
  isLoading?: boolean;
}

const PointOfDivergenceModal: React.FC<PointOfDivergenceModalProps> = ({
  isOpen,
  onClose,
  onCreateBranch,
  sourceEvent,
  isLoading = false,
}) => {
  const [timelineName, setTimelineName] = useState("");
  const [timelineDescription, setTimelineDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  React.useEffect(() => {
    if (isOpen && sourceEvent) {
      setTimelineName(`Alternate from: ${sourceEvent.title}`);
      setTimelineDescription(
        `A new timeline branching off from the event "${sourceEvent.title}".`,
      );
      setErrors({});
    }
  }, [isOpen, sourceEvent]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!timelineName.trim())
      newErrors.timelineName = "New timeline name is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateBranch = () => {
    if (!validateForm()) return;
    onCreateBranch(timelineName, timelineDescription);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Timeline Branch"
      size="md"
    >
      <div className="space-y-5">
        {sourceEvent && (
          <div className="mb-3 p-3 rounded-md bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700">
            <p className="text-sm text-blue-700 dark:text-blue-200">
              You are creating a new timeline that diverges from the event:{" "}
              <strong className="font-semibold">{sourceEvent.title}</strong>{" "}
              (dated {parseCalendarDate(sourceEvent.date).toLocaleDateString()}).
            </p>
          </div>
        )}
        <InputField
          label="New Timeline Name"
          value={timelineName}
          onChange={(e) => setTimelineName(e.target.value)}
          placeholder="E.g., The Uprising Timeline"
          error={errors.timelineName}
          required
        />
        <InputField
          label="Description for New Timeline"
          value={timelineDescription}
          onChange={(e) => setTimelineDescription(e.target.value)}
          placeholder="Briefly describe what makes this timeline different"
          type="textarea"
        />
        <div className="pt-5 flex justify-end space-x-3 border-t dark:border-gray-700 mt-6">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreateBranch}
            isLoading={isLoading}
          >
            Create Branch
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default PointOfDivergenceModal;
