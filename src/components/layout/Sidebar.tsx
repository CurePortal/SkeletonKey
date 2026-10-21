// src/components/layout/Sidebar.tsx
import React, { useRef, ChangeEvent, useState } from "react";
import {
  FaUser,
  FaMapMarkerAlt,
  FaStickyNote,
  FaMicrochip,
  FaGlobe,
  FaFileAlt,
  FaThLarge, // For Dashboard
  FaStream, // For Timeline
  FaBookOpen, // For Knowledge Base
  FaMap, // For Map
  FaPenSquare, // For Narrative
  FaCog, // For Settings
  FaFolderOpen, // For Open Project
  FaPlus, // For New Project
  FaSpinner, // For Loading
  FaTasks,
  FaProjectDiagram,
  FaTags,
  FaLightbulb,
} from "react-icons/fa"; // Import react-icons
import { BsPin, BsPinFill } from "react-icons/bs"; // Import Pin icons
import { LuBrainCircuit } from "react-icons/lu"; // Import AI icon
import { useProjectData } from "../../contexts/ProjectDataContext";
import { useAppState } from "../../contexts/AppStateContext";
import { useNotification } from "../../contexts/NotificationContext";
import { openAnotherProject } from "../../services/mainProjectService";
import { ProjectType } from "../../types/project"; //
import {
  LEGACY_ID_ALIAS,
  knowledgeBaseEntitiesForSection,
  resolveKnowledgeBaseSections,
} from "../../utils/knowledgeBaseCategories";

interface NavItemProps {
  label: string;
  icon: React.ReactNode;
  isActive?: boolean;
  onClick: () => void;
  isDisabled?: boolean;
  badge?: string | number;
}

const NavItem: React.FC<NavItemProps> = ({
  label,
  icon,
  isActive = false,
  onClick,
  isDisabled = false,
  badge,
}) => {
  return (
    <button
      className={`
        w-full flex items-center px-2.5 py-1.5 text-[13px] rounded-md mb-0.5
        ${
          isActive
            ? "bg-blue-100 text-blue-700 dark:bg-blue-800 dark:bg-opacity-50 dark:text-blue-200"
            : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
        }
        ${isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
      `}
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
    >
      <span className="mr-1.5 text-base">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {badge !== undefined && (
        <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
          {badge}
        </span>
      )}
    </button>
  );
};

const PinIconOutline: React.FC<{ className?: string }> = ({
  className = "w-4 h-4",
}) => <BsPin className={className} />;

const PinIconSolid: React.FC<{ className?: string }> = ({
  className = "w-4 h-4",
}) => <BsPinFill className={className} />;

const Sidebar: React.FC = () => {
  const { project, setProject, setCurrentFilePath } = useProjectData();
  const {
    appState: {
      sidebarOpen,
      viewMode,
      currentTimelineId,
      timelinesPinned,
      knowledgeBasePinned,
      currentKnowledgeBaseCategory,
    },
    setViewMode,
    setCurrentTimelineId,
    setTimelinesPinned,
    setKnowledgeBasePinned,
    setCurrentKnowledgeBaseCategory,
    setSelectedKnowledgeBaseEntityId,
    openModal,
  } = useAppState();

  const { showSuccess, showError } = useNotification();
  const [isOpeningFile, setIsOpeningFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const readProjectFile = async (file: File): Promise<ProjectType> => {
    //
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event: ProgressEvent<FileReader>) => {
        try {
          if (event.target && typeof event.target.result === "string") {
            const fileContent: string = event.target.result;
            const projectData = JSON.parse(fileContent) as ProjectType; //

            if (
              !projectData ||
              !projectData.id ||
              !projectData.name ||
              !Array.isArray(projectData.timelines)
            ) {
              reject(
                new Error(
                  "Invalid project file format. Essential fields are missing.",
                ),
              );
              return;
            }
            resolve(projectData);
          } else {
            reject(
              new Error("File content is invalid or event target is missing."),
            );
          }
        } catch (err) {
          if (err instanceof Error) {
            reject(new Error(`Failed to parse project file: ${err.message}`));
          } else {
            reject(
              new Error(
                "Failed to parse project file: An unknown error occurred.",
              ),
            );
          }
        }
      };
      reader.onerror = () => {
        reject(new Error("Error reading file."));
      };
      reader.readAsText(file);
    });
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    if (
      !event.target ||
      !event.target.files ||
      event.target.files.length === 0
    ) {
      return;
    }
    const file = event.target.files[0];

    setIsOpeningFile(true);

    try {
      const projectData = await readProjectFile(file);
      setProject(projectData);
      if (file.name) {
        setCurrentFilePath(file.name);
      }
      setViewMode("dashboard");
      showSuccess(`Project "${projectData.name}" loaded successfully`);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "An unknown error occurred while loading the project.";
      showError(`Failed to load project: ${errorMessage}`);
    } finally {
      setIsOpeningFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const triggerFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const collapsedNav = [
    { view: "dashboard", label: "Overview", icon: <FaThLarge className="h-5 w-5" /> },
    { view: "tasks", label: "Tasks", icon: <FaTasks className="h-5 w-5" /> },
    { view: "map", label: "Maps & Tracking", icon: <FaMap className="h-5 w-5" /> },
    { view: "documents", label: "Documents", icon: <FaFileAlt className="h-5 w-5" /> },
    { view: "knowledge-base", label: "Knowledge Base", icon: <FaBookOpen className="h-5 w-5" /> },
    { view: "narrative", label: "Narrative", icon: <FaPenSquare className="h-5 w-5" /> },
    {
      view: "flows-ideas",
      label: "Flows & Ideas",
      icon: <FaProjectDiagram className="h-5 w-5" />,
    },
    { view: "timeline", label: "Timeline", icon: <FaStream className="h-5 w-5" /> },
    {
      view: "ai-analysis",
      label: "AI Analysis",
      icon: <LuBrainCircuit className="h-5 w-5" />,
    },
  ] as const;

  if (!sidebarOpen) {
    return (
      <div className="h-full w-14 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center py-3">
        <div className="flex flex-col items-center space-y-2">
          {collapsedNav.map((item) => (
            <button
              key={item.view}
              className={`p-1.5 rounded-md ${
                viewMode === item.view
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-800 dark:bg-opacity-50 dark:text-blue-200"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
              onClick={() => {
                setViewMode(item.view);
                setCurrentKnowledgeBaseCategory(null);
                setSelectedKnowledgeBaseEntityId(null);
              }}
              title={item.label}
              disabled={!project}
            >
              {item.icon}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        accept=".ark,.ahp,.json"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />
      <div className="h-full w-56 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-white truncate">
            {project ? project.name : "SkeletonKey"}
          </h2>
        </div>
        <nav className="flex-1 px-2 py-2 overflow-y-auto">
          {!project ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <button
                  onClick={() => {
                    void openAnotherProject().catch((error) => {
                      showError(
                        error instanceof Error ? error.message : String(error),
                      );
                    });
                  }}
                  disabled={isOpeningFile}
                  className="w-full flex items-center px-2.5 py-1.5 text-[13px] text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-300 dark:border-gray-600"
                >
                  <FaFolderOpen className="h-5 w-5 mr-2" />
                  Open main project
                </button>
                <button
                  onClick={() => openModal("new-project")}
                  className="w-full flex items-center px-2.5 py-1.5 text-[13px] text-white rounded-md bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  <FaPlus className="h-5 w-5 mr-2" />
                  Create main project
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <NavItem
                  label="Overview"
                  icon={<FaThLarge className="h-5 w-5" />}
                  isActive={viewMode === "dashboard"}
                  onClick={() => {
                    setViewMode("dashboard");
                    setCurrentKnowledgeBaseCategory(null);
                    setSelectedKnowledgeBaseEntityId(null);
                  }}
                />
                <NavItem
                  label="Tasks"
                  icon={<FaTasks className="h-5 w-5" />}
                  isActive={viewMode === "tasks"}
                  onClick={() => {
                    setViewMode("tasks");
                    setCurrentKnowledgeBaseCategory(null);
                    setSelectedKnowledgeBaseEntityId(null);
                  }}
                />
                <NavItem
                  label="Maps & Tracking"
                  icon={<FaMap className="h-5 w-5" />}
                  isActive={viewMode === "map"}
                  onClick={() => {
                    setViewMode("map");
                    setCurrentKnowledgeBaseCategory(null);
                    setSelectedKnowledgeBaseEntityId(null);
                  }}
                />
                <NavItem
                  label="Documents"
                  icon={<FaFileAlt className="h-5 w-5" />}
                  isActive={viewMode === "documents"}
                  onClick={() => {
                    setViewMode("documents");
                    setCurrentKnowledgeBaseCategory(null);
                    setSelectedKnowledgeBaseEntityId(null);
                  }}
                />
                <NavItem
                  label="Knowledge Base"
                  icon={<FaBookOpen className="h-5 w-5" />}
                  isActive={viewMode === "knowledge-base"}
                  onClick={() => {
                    setViewMode("knowledge-base");
                    setCurrentKnowledgeBaseCategory(null);
                    setSelectedKnowledgeBaseEntityId(null);
                  }}
                />
                <NavItem
                  label="Narrative"
                  icon={<FaPenSquare className="h-5 w-5" />}
                  isActive={viewMode === "narrative"}
                  onClick={() => {
                    setViewMode("narrative");
                    setCurrentKnowledgeBaseCategory(null);
                    setSelectedKnowledgeBaseEntityId(null);
                  }}
                />
                <NavItem
                  label="Flows & Ideas"
                  icon={<FaProjectDiagram className="h-5 w-5" />}
                  isActive={viewMode === "flows-ideas"}
                  onClick={() => {
                    setViewMode("flows-ideas");
                    setCurrentKnowledgeBaseCategory(null);
                    setSelectedKnowledgeBaseEntityId(null);
                  }}
                />
                <NavItem
                  label="Timeline Editor"
                  icon={<FaStream className="h-5 w-5" />}
                  isActive={viewMode === "timeline"}
                  onClick={() => {
                    setViewMode("timeline");
                    setCurrentKnowledgeBaseCategory(null);
                    setSelectedKnowledgeBaseEntityId(null);
                  }}
                  badge={project.timelines?.length || 0}
                />
                <NavItem
                  label="AI Analysis"
                  icon={
                    <LuBrainCircuit className="h-5 w-5 inline-block rotate-90" />
                  }
                  isActive={viewMode === "ai-analysis"}
                  onClick={() => {
                    setViewMode("ai-analysis");
                    setCurrentKnowledgeBaseCategory(null);
                    setSelectedKnowledgeBaseEntityId(null);
                  }}
                  isDisabled={!project}
                />
              </div>
              {(timelinesPinned || viewMode === "timeline") && (
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Timelines
                    </h3>
                    {setTimelinesPinned && (
                      <button
                        onClick={() => setTimelinesPinned(!timelinesPinned)}
                        className="p-1 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none"
                        title={
                          timelinesPinned ? "Unpin Timelines" : "Pin Timelines"
                        }
                      >
                        {timelinesPinned ? (
                          <PinIconSolid />
                        ) : (
                          <PinIconOutline />
                        )}
                      </button>
                    )}
                  </div>
                  {!project.timelines || project.timelines.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                      No timelines.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {(project.timelines || []).map((timeline) => (
                        <button
                          key={timeline.id}
                          className={`
                            w-full flex items-center text-left px-2.5 py-1.5 text-[13px] rounded-md
                            ${
                              currentTimelineId === timeline.id &&
                              viewMode === "timeline"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-800 dark:bg-opacity-50 dark:text-blue-200"
                                : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            }
                          `}
                          onClick={() => {
                            setCurrentTimelineId(timeline.id);
                            setViewMode("timeline");
                            setCurrentKnowledgeBaseCategory(null);
                            setSelectedKnowledgeBaseEntityId(null);
                          }}
                        >
                          <div
                            className="w-3 h-3 rounded-full mr-2 flex-shrink-0"
                            style={{ backgroundColor: timeline.color }}
                          />
                          <span className="truncate flex-1">
                            {timeline.name}
                          </span>
                          <span className="ml-auto text-xs text-gray-500 dark:text-gray-400 pl-1">
                            {timeline.events?.length || 0}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {(knowledgeBasePinned || viewMode === "knowledge-base") && (
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Knowledge Categories
                    </h3>
                    {setKnowledgeBasePinned && (
                      <button
                        onClick={() =>
                          setKnowledgeBasePinned(!knowledgeBasePinned)
                        }
                        className="p-1 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none"
                        title={
                          knowledgeBasePinned
                            ? "Unpin Knowledge Base"
                            : "Pin Knowledge Base"
                        }
                      >
                        {knowledgeBasePinned ? (
                          <PinIconSolid />
                        ) : (
                          <PinIconOutline />
                        )}
                      </button>
                    )}
                  </div>
                  {resolveKnowledgeBaseSections(project)
                    .filter((section) => section.id !== "tags")
                    .map((section) => {
                      const iconMap: Record<
                        string,
                        React.ElementType
                      > = {
                        FaUser,
                        FaMapMarkerAlt,
                        FaMicrochip,
                        FaGlobe,
                        FaFileAlt,
                        FaTags,
                        FaCog,
                        FaLightbulb,
                      };
                      const Icon = iconMap[section.icon] || FaFileAlt;
                      const activeId =
                        LEGACY_ID_ALIAS[
                          currentKnowledgeBaseCategory || ""
                        ] || currentKnowledgeBaseCategory;
                      return (
                        <NavItem
                          key={section.id}
                          label={section.namePlural}
                          icon={<Icon className="h-5 w-5" />}
                          isActive={
                            viewMode === "knowledge-base" &&
                            activeId === section.id
                          }
                          onClick={() => {
                            setViewMode("knowledge-base");
                            setCurrentKnowledgeBaseCategory(section.id);
                            setSelectedKnowledgeBaseEntityId(null);
                          }}
                          badge={
                            knowledgeBaseEntitiesForSection(
                              project,
                              section.id,
                            ).length
                          }
                        />
                      );
                    })}
                </div>
              )}
            </>
          )}
        </nav>
        <div className="px-2 py-2 border-t border-gray-200 dark:border-gray-700">
          <button
            className="w-full flex items-center px-2.5 py-1.5 text-[13px] text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => {
              setViewMode("settings");
              setCurrentKnowledgeBaseCategory(null);
              setSelectedKnowledgeBaseEntityId(null);
            }}
          >
            <FaCog className="h-5 w-5 mr-2" />
            Settings
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
