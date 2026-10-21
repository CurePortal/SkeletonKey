// ModalRoot.tsx
import React, { useState, useEffect } from "react";
import { useAppState } from "../contexts/AppStateContext";
import { useNotification } from "../contexts/NotificationContext";
import { useProjectData } from "../contexts/ProjectDataContext";
import Button from "./common/Button";
import InputField from "./common/InputField";
import Modal from "./common/Modal";
import { ProjectThumbnailUpload } from "./project/ProjectThumbnailUpload";

// Import all your form components
import CharacterForm from "../pages/CharacterForm";
import CultureForm from "../pages/CultureForm";
import LocationForm from "../pages/LocationForm";
import TechnologyForm from "../pages/TechnologyForm";
import SourceDocumentForm from "../pages/SourceDocumentForm";
import { createMainProject } from "../services/mainProjectService";

const ModalRoot: React.FC = () => {
  const { modalState, closeModal } = useAppState();
  const { showSuccess, showError } = useNotification();
  const { project, updateProjectDetails } = useProjectData();

  // State for "new-project" modal
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [newProjectThumbnail, setNewProjectThumbnail] = useState<string | null>(
    null,
  );
  const [newProjectIsLoading, setNewProjectIsLoading] = useState(false);
  const [newProjectErrors, setNewProjectErrors] = useState<
    Record<string, string>
  >({});

  // State for "edit-project" modal
  const [editProjectName, setEditProjectName] = useState("");
  const [editProjectDescription, setEditProjectDescription] = useState("");
  const [editProjectThumbnail, setEditProjectThumbnail] = useState<
    string | null
  >(null);
  const [editProjectIsLoading, setEditProjectIsLoading] = useState(false);
  const [editProjectErrors, setEditProjectErrors] = useState<
    Record<string, string>
  >({});

  // Reset form values when "new-project" modal opens
  useEffect(() => {
    if (modalState.isOpen && modalState.type === "new-project") {
      setNewProjectName("");
      setNewProjectDescription("");
      setNewProjectThumbnail(null);
      setNewProjectErrors({});
      setNewProjectIsLoading(false);
    }
  }, [modalState.isOpen, modalState.type]);

  // Initialize and reset form values when "edit-project" modal opens/closes or project changes
  useEffect(() => {
    if (modalState.isOpen && modalState.type === "edit_project" && project) {
      setEditProjectName(project.name);
      setEditProjectDescription(project.description || "");
      setEditProjectThumbnail(project.thumbnailUrl || null);
      setEditProjectErrors({});
      setEditProjectIsLoading(false);
    } else if (!modalState.isOpen && modalState.type === "edit_project") {
      // Optionally clear when modal is closed, or rely on re-initialization
      setEditProjectName("");
      setEditProjectDescription("");
      setEditProjectThumbnail(null);
      setEditProjectErrors({});
    }
  }, [modalState.isOpen, modalState.type, project]);

  // Validation function for the new project form
  const validateNewProjectForm = () => {
    const newErrors: Record<string, string> = {};
    if (!newProjectName.trim()) {
      newErrors.name = "Project name is required";
    } else if (newProjectName.trim().length < 3) {
      newErrors.name = "Project name must be at least 3 characters";
    }
    setNewProjectErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Validation function for the edit project form
  const validateEditProjectForm = () => {
    const newErrors: Record<string, string> = {};
    if (!editProjectName.trim()) {
      newErrors.name = "Project name is required";
    } else if (editProjectName.trim().length < 3) {
      newErrors.name = "Project name must be at least 3 characters";
    }
    setEditProjectErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle create project form submission
  const handleCreateProject = async () => {
    if (!validateNewProjectForm()) return;
    setNewProjectIsLoading(true);

    try {
      await createMainProject(
        newProjectName,
        newProjectDescription,
        newProjectThumbnail || undefined,
      );
      closeModal();
      showSuccess(`Main project "${newProjectName}" created.`);
    } catch (error) {
      showError(
        `Error creating project: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setNewProjectIsLoading(false);
    }
  };

  // Handle update project details form submission
  const handleUpdateProjectDetails = async () => {
    if (!validateEditProjectForm() || !project) return;
    setEditProjectIsLoading(true);

    try {
      // Call the updateProjectDetails function from ProjectDataContext
      updateProjectDetails({
        name: editProjectName,
        description: editProjectDescription,
        thumbnailUrl: editProjectThumbnail || undefined,
      });
      // The updateProjectDetails itself handles auto-save and updates the 'project' state.
      // hasUnsavedChanges will become false after auto-save if successful.

      showSuccess(`Project "${editProjectName}" updated successfully!`);
      closeModal();
    } catch (error) {
      // This catch might not be strictly necessary if updateProjectDetails doesn't throw
      // and errors are handled within its auto-save mechanism.
      // However, it's good practice if any synchronous error could occur.
      showError(
        `Error updating project: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setEditProjectIsLoading(false);
    }
  };

  // Generic handlers for entity forms (simplified, as they are placeholders)
  const handleSaveCharacter = async (data: any) => {
    console.log("Saving character:", data);
    closeModal();
    showSuccess(
      `Character ${data.id ? "updated" : "created"} successfully (mock).`,
    );
  };
  const handleSaveCulture = async (data: any) => {
    console.log("Saving culture:", data);
    closeModal();
    showSuccess(
      `Culture ${data.id ? "updated" : "created"} successfully (mock).`,
    );
  };
  const handleSaveLocation = async (data: any) => {
    console.log("Saving location:", data);
    closeModal();
    showSuccess(
      `Location ${data.id ? "updated" : "created"} successfully (mock).`,
    );
  };
  const handleSaveTechnology = async (data: any) => {
    console.log("Saving technology:", data);
    closeModal();
    showSuccess(
      `Technology ${data.id ? "updated" : "created"} successfully (mock).`,
    );
  };
  const handleSaveSourceDocument = async (data: any, file?: File | null) => {
    console.log("Saving source document:", data, file);
    closeModal();
    showSuccess(
      `Source Document ${data.id ? "updated" : "created"} successfully (mock).`,
    );
  };

  if (!modalState.isOpen) return null;

  // Render the appropriate modal based on the type
  switch (modalState.type) {
    case "new-project":
      return (
        <Modal
          isOpen={true}
          onClose={closeModal}
          title="Create New Project"
          size="md"
        >
          <div className="space-y-4">
            <InputField
              label="Project Name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Enter a name for your project"
              error={newProjectErrors.name}
              required
            />
            <InputField
              label="Description"
              value={newProjectDescription}
              onChange={(e) => setNewProjectDescription(e.target.value)}
              placeholder="Describe what this project is about"
              as="textarea"
              rows={3}
            />

            <ProjectThumbnailUpload
              currentThumbnail={newProjectThumbnail}
              onThumbnailChange={setNewProjectThumbnail}
              disabled={newProjectIsLoading}
            />

            <div className="pt-5 flex justify-end space-x-3 border-t dark:border-gray-700">
              <Button
                variant="outline"
                onClick={closeModal}
                disabled={newProjectIsLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleCreateProject}
                isLoading={newProjectIsLoading}
              >
                Create Project
              </Button>
            </div>
          </div>
        </Modal>
      );

    case "edit_project":
      if (!project) {
        // This case should ideally not be reached if no project is loaded,
        // as the button to open this modal might be disabled.
        // However, handle it defensively.
        showError("No project loaded to edit.");
        closeModal(); // Close modal if no project context
        return null;
      }
      return (
        <Modal
          isOpen={true}
          onClose={closeModal}
          title="Edit Project Details"
          size="md"
        >
          <div className="space-y-4">
            <InputField
              label="Project Name"
              value={editProjectName}
              onChange={(e) => setEditProjectName(e.target.value)}
              placeholder="Enter a name for your project"
              error={editProjectErrors.name}
              required
            />
            <InputField
              label="Description"
              value={editProjectDescription}
              onChange={(e) => setEditProjectDescription(e.target.value)}
              placeholder="Describe what this project is about"
              as="textarea"
              rows={3}
            />

            <ProjectThumbnailUpload
              currentThumbnail={editProjectThumbnail}
              onThumbnailChange={setEditProjectThumbnail}
              disabled={editProjectIsLoading}
            />

            <div className="pt-5 flex justify-end space-x-3 border-t dark:border-gray-700">
              <Button
                variant="outline"
                onClick={closeModal}
                disabled={editProjectIsLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleUpdateProjectDetails}
                isLoading={editProjectIsLoading}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </Modal>
      );

    // Character modals
    case "edit_character":
      const characterEditData = modalState.data;
      return (
        <Modal
          isOpen={true}
          onClose={closeModal}
          title={`Edit Character: ${characterEditData?.name || "Unknown"}`}
          size="xl"
        >
          <CharacterForm
            initialData={characterEditData}
            onSubmit={handleSaveCharacter}
            onCancel={closeModal}
          />
        </Modal>
      );

    // Culture modals
    case "edit_culture":
      const cultureEditData = modalState.data;
      return (
        <Modal
          isOpen={true}
          onClose={closeModal}
          title={`Edit Culture: ${cultureEditData?.name || "Unknown"}`}
          size="xl"
        >
          <CultureForm
            initialData={cultureEditData}
            onSubmit={handleSaveCulture}
            onCancel={closeModal}
          />
        </Modal>
      );

    // Location modals
    case "edit_location":
      const locationEditData = modalState.data;
      return (
        <Modal
          isOpen={true}
          onClose={closeModal}
          title={`Edit Location: ${locationEditData?.name || "Unknown"}`}
          size="xl"
        >
          <LocationForm
            initialData={locationEditData}
            onSubmit={handleSaveLocation}
            onCancel={closeModal}
          />
        </Modal>
      );

    // Technology modals
    case "edit_technology":
      const technologyEditData = modalState.data;
      return (
        <Modal
          isOpen={true}
          onClose={closeModal}
          title={`Edit Technology: ${technologyEditData?.name || "Unknown"}`}
          size="xl"
        >
          <TechnologyForm
            initialData={technologyEditData}
            onSubmit={handleSaveTechnology}
            onCancel={closeModal}
          />
        </Modal>
      );

    // Source document modals
    case "edit_source":
      const sourceEditData = modalState.data;
      return (
        <Modal
          isOpen={true}
          onClose={closeModal}
          title={`Edit Source Document: ${sourceEditData?.title || "Unknown"}`}
          size="xl"
        >
          <SourceDocumentForm
            initialData={sourceEditData}
            onSubmit={handleSaveSourceDocument}
            onCancel={closeModal}
          />
        </Modal>
      );

    case "confirm_delete":
      const { entityType, entityName, onConfirm } = modalState.data || {};
      return (
        <Modal
          isOpen={true}
          onClose={closeModal}
          title={`Delete ${entityType || "Item"}`} // Fallback title
        >
          <div className="space-y-6">
            <p className="text-gray-700 dark:text-gray-300">
              Are you sure you want to delete{" "}
              <span className="font-semibold">{entityName || "this item"}</span>
              ? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <Button variant="outline" onClick={closeModal}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  if (onConfirm && typeof onConfirm === "function") onConfirm();
                  closeModal();
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </Modal>
      );

    default:
      return null;
  }
};

export default ModalRoot;
