// components/modals/DomainPresetSelectionModal.tsx
import React, { useState } from "react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import InputField from "../common/InputField";
import { ProjectThumbnailUpload } from "../project/ProjectThumbnailUpload";
import { useProjectData } from "../../contexts/ProjectDataContext";
import { useNotification } from "../../contexts/NotificationContext";
import { useAppState } from "../../contexts/AppStateContext";
import { DOMAIN_PRESETS, DomainPreset } from "../../types/dynamicEntity";
import { createProject } from "../../services/projectService";
import {
  FaUser,
  FaMapMarkerAlt,
  FaMicrochip,
  FaGlobe,
  FaPen,
  FaCog,
  FaLightbulb,
  FaGavel,
  FaCode,
  FaBriefcase,
  FaMicroscope,
  FaPlus,
} from "react-icons/fa";

interface DomainPresetSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Icon mapping for categories
const getCategoryIcon = (category: string) => {
  switch (category) {
    case "research":
      return FaMicroscope;
    case "creative":
      return FaPen;
    case "business":
      return FaBriefcase;
    case "technical":
      return FaCode;
    case "legal":
      return FaGavel;
    default:
      return FaCog;
  }
};

// Icon mapping for entity types
const getEntityIcon = (iconName: string) => {
  const iconMap: { [key: string]: any } = {
    FaUser: FaUser,
    FaMapMarkerAlt: FaMapMarkerAlt,
    FaMicrochip: FaMicrochip,
    FaGlobe: FaGlobe,
    FaCog: FaCog,
    FaLightbulb: FaLightbulb,
  };
  return iconMap[iconName] || FaCog;
};

const DomainPresetSelectionModal: React.FC<DomainPresetSelectionModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { setProject, setCurrentFilePath } = useProjectData();
  const { showSuccess, showError } = useNotification();
  const { setViewMode, setCurrentProjectId } = useAppState();

  const [selectedPreset, setSelectedPreset] = useState<DomainPreset | null>(
    null,
  );
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectThumbnail, setProjectThumbnail] = useState<string | null>(null);
  const [step, setStep] = useState<"select" | "configure">("select");
  const [isCreating, setIsCreating] = useState(false);

  const handlePresetSelect = (preset: DomainPreset) => {
    setSelectedPreset(preset);
    setProjectName(`My ${preset.name} Project`);
    setProjectDescription(preset.description);
    setProjectThumbnail(null);
    setStep("configure");
  };

  const handleCreateProject = async () => {
    if (!selectedPreset || !projectName.trim()) {
      showError("Please provide a project name");
      return;
    }

    setIsCreating(true);
    try {
      // Create the project using the existing createProject service
      const result = await createProject({
        name: projectName.trim(),
        description: projectDescription.trim(),
      });

      if (result.success && result.data) {
        // Enhance the project with domain preset data and thumbnail
        const enhancedProject = {
          ...result.data,
          domainPreset: selectedPreset.id,
          thumbnailUrl: projectThumbnail || undefined,
          // Add entity types from preset
          entityTypes: selectedPreset.entityTypes,
          // Initialize empty entities array with proper type
          entities: [] as any[], // This ensures it's typed as GenericEntity[]
          // Add sample data if available
          ...(selectedPreset.sampleData && {
            ...selectedPreset.sampleData,
          }),
        };

        // Set the project in context
        setProject(enhancedProject);

        // Set a mock file path for browser-based projects
        const safeName = projectName.toLowerCase().replace(/\s+/g, "-");
        setCurrentFilePath(`/mock/${safeName}.ark`);

        // Set the current project ID in app state
        setCurrentProjectId(enhancedProject.id);

        showSuccess(`${selectedPreset.name} project created successfully!`);

        // Navigate to dashboard
        setViewMode("dashboard");
        onClose();
      } else {
        throw new Error(result.error || "Failed to create project");
      }
    } catch (error) {
      showError(
        `Failed to create project: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleCustomProject = async () => {
    // For custom projects, just create a basic project without presets
    setIsCreating(true);
    try {
      const result = await createProject({
        name: "New Custom Project",
        description: "A custom project with no preset template",
      });

      if (result.success && result.data) {
        // Add thumbnail if one was set (though unlikely in custom flow)
        const projectWithThumbnail = {
          ...result.data,
          thumbnailUrl: projectThumbnail || undefined,
        };

        setProject(projectWithThumbnail);
        const safeName = "new-custom-project";
        setCurrentFilePath(`/mock/${safeName}.ark`);
        setCurrentProjectId(result.data.id);

        showSuccess("Custom project created successfully!");
        setViewMode("dashboard");
        onClose();
      } else {
        throw new Error(result.error || "Failed to create custom project");
      }
    } catch (error) {
      showError(
        `Failed to create custom project: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleBack = () => {
    if (step === "configure") {
      setStep("select");
      setSelectedPreset(null);
      setProjectThumbnail(null);
    } else {
      onClose();
    }
  };

  const handleClose = () => {
    setStep("select");
    setSelectedPreset(null);
    setProjectName("");
    setProjectDescription("");
    setProjectThumbnail(null);
    onClose();
  };

  const renderPresetCard = (preset: DomainPreset) => {
    const CategoryIcon = getCategoryIcon(preset.category);

    return (
      <div
        key={preset.id}
        onClick={() => handlePresetSelect(preset)}
        className="p-6 border-2 border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-md transition-all duration-200 bg-white dark:bg-gray-800"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 dark:bg-opacity-30 rounded-lg">
              <CategoryIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                {preset.name}
              </h3>
              <span className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                {preset.category}
              </span>
            </div>
          </div>
        </div>

        <p className="text-gray-600 dark:text-gray-300 mb-4 text-sm leading-relaxed">
          {preset.description}
        </p>

        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Entity Types Included:
          </h4>
          <div className="flex flex-wrap gap-2">
            {preset.entityTypes.slice(0, 4).map((entityType) => {
              const EntityIcon = getEntityIcon(entityType.icon);
              return (
                <div
                  key={entityType.id}
                  className="flex items-center space-x-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-md text-xs"
                  style={{
                    borderLeftColor: entityType.color,
                    borderLeftWidth: "3px",
                  }}
                >
                  <EntityIcon
                    className="h-3 w-3"
                    style={{ color: entityType.color }}
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    {entityType.name}
                  </span>
                </div>
              );
            })}
            {preset.entityTypes.length > 4 && (
              <div className="flex items-center px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-md text-xs text-gray-500 dark:text-gray-400">
                +{preset.entityTypes.length - 4} more
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        step === "select"
          ? "Choose Your Project Type"
          : `Configure ${selectedPreset?.name} Project`
      }
      size="xl"
    >
      <div className="p-6">
        {step === "select" ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
              {DOMAIN_PRESETS.map((preset) => renderPresetCard(preset))}

              {/* Custom/Advanced Option */}
              <div
                onClick={handleCustomProject}
                className="p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 flex flex-col items-center justify-center text-center"
              >
                <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg mb-4">
                  <FaPlus className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
                  Custom Project
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Start with a blank project and create your own entity types
                  and fields.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {selectedPreset && (
              <div className="bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center space-x-3 mb-2">
                  <div className="p-1 bg-blue-100 dark:bg-blue-900 dark:bg-opacity-30 rounded">
                    {React.createElement(
                      getCategoryIcon(selectedPreset.category),
                      {
                        className: "h-5 w-5 text-blue-600 dark:text-blue-400",
                      },
                    )}
                  </div>
                  <h3 className="font-semibold text-blue-800 dark:text-blue-200">
                    {selectedPreset.name} Template
                  </h3>
                </div>
                <p className="text-blue-700 dark:text-blue-300 text-sm">
                  {selectedPreset.description}
                </p>
              </div>
            )}

            <div className="space-y-4">
              <InputField
                label="Project Name"
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Enter your project name"
                required
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Project Description
                </label>
                <textarea
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="Describe your project (optional)"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <ProjectThumbnailUpload
                currentThumbnail={projectThumbnail}
                onThumbnailChange={setProjectThumbnail}
                disabled={isCreating}
              />
            </div>

            {selectedPreset && (
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-3">
                  This template includes:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedPreset.entityTypes.map((entityType) => {
                    const EntityIcon = getEntityIcon(entityType.icon);
                    return (
                      <div
                        key={entityType.id}
                        className="flex items-center space-x-2"
                      >
                        <EntityIcon
                          className="h-4 w-4"
                          style={{ color: entityType.color }}
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {entityType.namePlural}
                          </span>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {entityType.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-between pt-6 border-t border-gray-200 dark:border-gray-700 mt-6">
          <Button variant="outline" onClick={handleBack} disabled={isCreating}>
            {step === "select" ? "Cancel" : "Back"}
          </Button>

          {step === "configure" && (
            <Button
              variant="primary"
              onClick={handleCreateProject}
              disabled={!projectName.trim() || isCreating}
              isLoading={isCreating}
            >
              {isCreating ? "Creating Project..." : "Create Project"}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default DomainPresetSelectionModal;
