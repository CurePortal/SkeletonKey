import React, { useState, useEffect, useMemo } from "react";
import {
  FaUser,
  FaMapMarkerAlt,
  FaMicrochip,
  FaGlobe,
  FaFileAlt,
  FaTags,
  FaPlus,
  FaSearch,
  FaColumns,
  FaShieldAlt,
  FaTrash,
  FaCog,
  FaList,
  FaTh,
  FaSortAlphaDown,
  FaSortAlphaUp,
  FaFilter,
  FaCalendarAlt,
  FaLightbulb,
} from "react-icons/fa";
import { useProjectData } from "../contexts/ProjectDataContext";
import { useNotification } from "../contexts/NotificationContext";
import { useAppState } from "../contexts/AppStateContext";
import MainContentArea from "../components/layout/MainContentArea";
import Button from "../components/common/Button";
import Modal from "../components/common/Modal";
import CharacterForm from "./CharacterForm";
import LocationForm from "./LocationForm";
import TechnologyForm from "./TechnologyForm";
import CultureForm from "./CultureForm";
import SourceDocumentForm from "./SourceDocumentForm";
import EntityCard from "../components/EntityCard";
import EntityDetailsPanel from "../components/EntityDetailsPanel";
import { useProjectTags } from "../hooks/useProjectTags";
import TagCloud from "../components/common/TagCloud";
import InterconnectedTagCloud from "../components/common/InterconnectedTagCloud";
import KnowledgeBaseConsistencyChecker from "../components/KnowledgeBaseConsistencyChecker";
import EventRelationshipSankey from "../components/timeline/EventRelationshipSankey";
import TimelineSelector from "../components/timeline/TimelineSelector";
import { KnowledgeBaseSectionType, SingularEntityType } from "../types/ui";
import { SourceDocumentType, ID } from "../types/project";
import { CustomEntityType } from "../types/dynamicEntity";

type EntityType = KnowledgeBaseSectionType | string;

const LEGACY_ENTITY_TYPES: CustomEntityType[] = [
  {
    id: "characters",
    name: "Character",
    namePlural: "Characters",
    icon: "FaUser",
  },
  {
    id: "locations",
    name: "Location",
    namePlural: "Locations",
    icon: "FaMapMarkerAlt",
  },
  {
    id: "technologies",
    name: "Technology",
    namePlural: "Technologies",
    icon: "FaMicrochip",
  },
  { id: "cultures", name: "Culture", namePlural: "Cultures", icon: "FaGlobe" },
  { id: "sources", name: "Source", namePlural: "Sources", icon: "FaFileAlt" },
  { id: "tags", name: "Tag", namePlural: "Tags", icon: "FaTags" },
] as any;

const iconMap: { [key: string]: React.ElementType } = {
  FaUser,
  FaMapMarkerAlt,
  FaMicrochip,
  FaGlobe,
  FaFileAlt,
  FaTags,
  FaCog,
  FaLightbulb,
};

const KnowledgeBasePage: React.FC = () => {
  const {
    project,
    addCharacter,
    updateCharacter,
    deleteCharacter,
    addLocation,
    updateLocation,
    deleteLocation,
    addTechnology,
    updateTechnology,
    deleteTechnology,
    addCulture,
    updateCulture,
    deleteCulture,
    addSourceDocument,
    updateSourceDocument,
    deleteSourceDocument,
    getTimelineById,
  } = useProjectData();

  const [, forceUpdate] = useState(0);

  useEffect(() => {
    forceUpdate((prev) => prev + 1);
  }, [
    project?.characters?.length,
    project?.locations?.length,
    project?.technologies?.length,
    project?.cultures?.length,
    project?.sources?.length,
    project?.entities?.length,
  ]);

  const { tagStats, getEntitiesByTag } = useProjectTags(project);
  const { showSuccess, showError } = useNotification();
  const {
    appState: {
      viewMode,
      currentKnowledgeBaseCategory,
      selectedKnowledgeBaseEntityId,
      showConsistencyAnalysis,
    },
    setCurrentKnowledgeBaseCategory,
    setSelectedKnowledgeBaseEntityId,
    setShowConsistencyAnalysis,
  } = useAppState();

  const [refreshKey, setRefreshKey] = useState(0);

  const isDynamicProject = useMemo(() => {
    const result =
      project &&
      Array.isArray(project.entityTypes) &&
      project.entityTypes.length > 0;
    return result;
  }, [project]);

  const knowledgeBaseSections = useMemo(() => {
    if (!project) {
      return [];
    }

    const allSections = isDynamicProject
      ? [
          ...(project.entityTypes || []),
          ...LEGACY_ENTITY_TYPES.filter(
            (s) => s.id === "sources" || s.id === "tags",
          ),
        ]
      : [...LEGACY_ENTITY_TYPES];

    const uniqueSectionMap = new Map<string, CustomEntityType>();
    allSections.forEach((section) => {
      uniqueSectionMap.set(section.id, section);
    });
    const uniqueSections = Array.from(uniqueSectionMap.values());
    const tagsSection = uniqueSections.find((s) => s.id === "tags");
    const finalSections = uniqueSections.filter((s) => s.id !== "tags");
    if (tagsSection) {
      finalSections.push(tagsSection);
    }

    return finalSections;
  }, [project, isDynamicProject]);

  const [currentSection, setCurrentSection] = useState<EntityType>(
    knowledgeBaseSections[0]?.id || "characters",
  );

  const [tagViewMode, setTagViewMode] = useState<"list" | "cloud">("list");
  const [showRelationshipViewer, setShowRelationshipViewer] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingEntityInfo, setEditingEntityInfo] = useState<{
    type: SingularEntityType | string;
    data?: any;
  } | null>(null);
  const [entityToDelete, setEntityToDelete] = useState<{
    type: SingularEntityType | string;
    data: any;
  } | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedEntityForDetails, setSelectedEntityForDetails] = useState<
    any | null
  >(null);
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);
  const [selectedTimelineId, setSelectedTimelineId] = useState<string>("");
  const [isTimelineSelectorOpen, setIsTimelineSelectorOpen] = useState(false);

  const [displayMode, setDisplayMode] = useState<"card" | "list">("card");
  const [sortField, setSortField] = useState<"name" | "date">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [expandedTag, setExpandedTag] = useState<string | null>(null);

  useEffect(() => {
    if (project?.timelines?.length && !selectedTimelineId) {
      setSelectedTimelineId(project.timelines[0].id);
    }
  }, [project?.timelines, selectedTimelineId]);

  const getEntityCountForSection = (sectionId: string): number => {
    if (!project) return 0;

    if (sectionId === "tags") {
      return tagStats.length;
    }

    if (sectionId === "sources") {
      return (project.sources || project.sources || []).length;
    }

    if (isDynamicProject) {
      let count = 0;

      if (project.entities && project.entities.length > 0) {
        count = project.entities.filter(
          (e: any) => e.entityType === sectionId,
        ).length;
      }

      if (count === 0) {
        const legacyMapping: Record<string, keyof typeof project> = {
          character: "characters",
          location: "locations",
          technology: "technologies",
          culture: "cultures",
          setting: "locations",
          plot_device: "technologies",
        };

        const legacyKey = legacyMapping[sectionId];
        if (legacyKey && project[legacyKey]) {
          count = (project[legacyKey] as any[]).length;
        }
      }

      return count;
    }

    switch (sectionId) {
      case "characters":
        return (project.characters || []).length;
      case "locations":
        return (project.locations || []).length;
      case "technologies":
        return (project.technologies || []).length;
      case "cultures":
        return (project.cultures || []).length;
      default:
        return 0;
    }
  };

  const entities = useMemo(() => {
    if (!project) {
      return [];
    }

    if (currentSection === "tags") {
      return [];
    }

    if (currentSection === "sources") {
      const sources = [...(project.sources || project.sources || [])];
      return sources;
    }

    if (isDynamicProject) {
      let dynamicEntities: any[] = [];
      if (project.entities && project.entities.length > 0) {
        const allEntityTypes =
          project.entities.map((e: any) => e.entityType) || [];
        const uniqueEntityTypes = [...new Set(allEntityTypes)];

        dynamicEntities =
          project.entities.filter(
            (e: any) => e.entityType === currentSection,
          ) || [];
      }

      if (dynamicEntities.length === 0) {
        const legacyMapping: Record<string, keyof typeof project> = {
          character: "characters",
          location: "locations",
          technology: "technologies",
          culture: "cultures",
          setting: "locations",
          plot_device: "technologies",
        };

        const legacyKey = legacyMapping[currentSection];
        if (legacyKey && project[legacyKey]) {
          const legacyData = project[legacyKey] as any[];
          return [...legacyData];
        }
      }

      return dynamicEntities;
    }

    let legacyEntities: any[] = [];
    switch (currentSection) {
      case "characters":
        legacyEntities = [...(project.characters || [])];
        break;
      case "locations":
        legacyEntities = [...(project.locations || [])];
        break;
      case "technologies":
        legacyEntities = [...(project.technologies || [])];
        break;
      case "cultures":
        legacyEntities = [...(project.cultures || [])];
        break;
      default:
        legacyEntities = [];
    }

    return legacyEntities;
  }, [
    project,
    currentSection,
    isDynamicProject,
    project?.characters,
    project?.locations,
    project?.technologies,
    project?.cultures,
    project?.sources,
    project?.entities,
    project?.characters?.length,
    project?.locations?.length,
    project?.technologies?.length,
    project?.cultures?.length,
    project?.sources?.length,
    project?.entities?.length,
    refreshKey,
  ]);

  useEffect(() => {
    setRefreshKey((prev) => prev + 1);
  }, [
    project?.characters?.length,
    project?.locations?.length,
    project?.technologies?.length,
    project?.cultures?.length,
    project?.sources?.length,
    project?.entities?.length,
  ]);

  const finalDisplayedEntities = useMemo(() => {
    let processedEntities = [...entities];

    if (searchQuery) {
      const queryLower = searchQuery.toLowerCase();
      processedEntities = processedEntities.filter((entity) => {
        return (
          entity.name?.toLowerCase().includes(queryLower) ||
          (entity as SourceDocumentType).title
            ?.toLowerCase()
            .includes(queryLower) ||
          entity.description?.toLowerCase().includes(queryLower)
        );
      });
    }

    const sortedEntities = processedEntities.sort((a, b) => {
      let aValue, bValue;
      switch (sortField) {
        case "name":
          aValue = (a.name || a.title || "").toLowerCase();
          bValue = (b.name || b.title || "").toLowerCase();
          break;
        case "date":
          const dateFields: Record<string, keyof any> = {
            characters: "birthDate",
            cultures: "foundedDate",
            sources: "publicationDate",
          };
          const field = dateFields[currentSection as string] || "createdAt";
          aValue = a[field] || "9999";
          bValue = b[field] || "9999";
          break;
        default:
          aValue = (a.name || a.title || "").toLowerCase();
          bValue = (b.name || b.title || "").toLowerCase();
      }
      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sortedEntities;
  }, [entities, searchQuery, sortField, sortDirection, currentSection]);

  const getSingularEntityType = (
    section: EntityType = currentSection,
  ): SingularEntityType | string => {
    if (!isDynamicProject) {
      const mapping: Record<string, SingularEntityType> = {
        characters: "character",
        locations: "location",
        technologies: "technology",
        cultures: "culture",
        sources: "source",
      };
      return mapping[section as string] || section;
    }
    return section;
  };

  useEffect(() => {
    const editOrder = sessionStorage.getItem("editEntity");
    if (editOrder) {
      sessionStorage.removeItem("editEntity");
      try {
        const { category, id } = JSON.parse(editOrder);
        const entityToEdit = entities.find((e) => e.id === id);
        if (entityToEdit) {
          setCurrentSection(category);
          setCurrentKnowledgeBaseCategory(category);
          setEditingEntityInfo({
            type: getSingularEntityType(category),
            data: entityToEdit,
          });
        }
      } catch (e) {
        console.error("Failed to parse editEntity order", e);
      }
    }
  }, [entities]);

  useEffect(() => {
    if (viewMode === "knowledge-base") {
      const activeCategory =
        currentKnowledgeBaseCategory || knowledgeBaseSections[0]?.id;
      if (activeCategory) setCurrentSection(activeCategory);
      if (!editingEntityInfo && selectedKnowledgeBaseEntityId) {
        const entityToSelect = entities.find(
          (entity) => entity.id === selectedKnowledgeBaseEntityId,
        );
        setSelectedEntityForDetails(entityToSelect || null);
        setShowDetailsPanel(!!entityToSelect);
      } else if (!selectedKnowledgeBaseEntityId) {
        setSelectedEntityForDetails(null);
        setShowDetailsPanel(false);
      }
      if (editingEntityInfo) {
        setShowDetailsPanel(false);
        setSelectedEntityForDetails(null);
      }
    } else {
      setEditingEntityInfo(null);
    }
  }, [
    viewMode,
    currentKnowledgeBaseCategory,
    selectedKnowledgeBaseEntityId,
    project,
    editingEntityInfo,
    knowledgeBaseSections,
    entities,
  ]);

  useEffect(() => {
    const handleSessionOpen = (key: string, section: EntityType) => {
      if (sessionStorage.getItem(key) === "true") {
        setCurrentSection(section);
        setCurrentKnowledgeBaseCategory(section);
        setSelectedKnowledgeBaseEntityId(null);
        setEditingEntityInfo({
          type: getSingularEntityType(section),
          data: null,
        });
        sessionStorage.removeItem(key);
      }
    };
    handleSessionOpen("openCharacterForm", "characters");
    handleSessionOpen("openLocationForm", "locations");
    handleSessionOpen("openTechnologyForm", "technologies");
    handleSessionOpen("openCultureForm", "cultures");
    handleSessionOpen("openSourceForm", "sources");
  }, [setCurrentKnowledgeBaseCategory, setSelectedKnowledgeBaseEntityId]);

  if (!project) {
    return (
      <MainContentArea title="Knowledge Base">
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500 dark:text-gray-400">
            No project is currently loaded.
          </p>
        </div>
      </MainContentArea>
    );
  }

  const getCurrentSectionInfo = (sectionId: EntityType = currentSection) => {
    return knowledgeBaseSections.find((s) => s.id === sectionId);
  };
  const getSectionLabel = (sectionId: EntityType = currentSection) => {
    return getCurrentSectionInfo(sectionId)?.namePlural || "Entities";
  };
  const getSingularLabel = (sectionId: EntityType = currentSection): string => {
    if (sectionId === "sources") return "Source Document";
    return getCurrentSectionInfo(sectionId)?.name || "Entity";
  };
  const getSectionIcon = (sectionId: EntityType) => {
    const iconName = getCurrentSectionInfo(sectionId)?.icon;
    if (!iconName) return null;
    const IconComponent = iconMap[iconName];
    return IconComponent ? <IconComponent className="h-5 w-5 mr-1" /> : null;
  };

  const handleAddEntity = () => {
    if (currentSection === "tags") {
      showError("Tags are managed by adding them to other entities.");
      return;
    }
    setSelectedEntityForDetails(null);
    setShowDetailsPanel(false);
    setSelectedKnowledgeBaseEntityId(null);
    setEditingEntityInfo({
      type: getSingularEntityType(currentSection),
      data: null,
    });
  };

  const handleShowEntityDetails = (entity: any) => {
    setEditingEntityInfo(null);
    setSelectedEntityForDetails(entity);
    setShowDetailsPanel(true);
    setCurrentKnowledgeBaseCategory(currentSection);
    setSelectedKnowledgeBaseEntityId(entity.id);
  };

  const handleEntityCardClick = (entity: any) => {
    handleShowEntityDetails(entity);
  };

  const handleEditFromDetails = () => {
    if (selectedEntityForDetails) {
      setEditingEntityInfo({
        type: getSingularEntityType(currentSection),
        data: selectedEntityForDetails,
      });
      setShowDetailsPanel(false);
    }
  };

  const handleFormCancel = () => {
    setEditingEntityInfo(null);
    if (selectedEntityForDetails) {
      setShowDetailsPanel(true);
    } else {
      setSelectedKnowledgeBaseEntityId(null);
    }
  };

  const handleFormSubmit = async (formData: any) => {
    if (!editingEntityInfo) return;
    const { type, data: originalData } = editingEntityInfo;
    const isEditing = !!originalData;

    try {
      const serviceType =
        type === "setting"
          ? "location"
          : type === "plot_device"
            ? "technology"
            : type;

      let newEntityId: ID | null = null;
      if (isEditing && originalData.id) {
        const payload = { ...formData, id: originalData.id };
        switch (serviceType) {
          case "character":
            await updateCharacter(payload);
            break;
          case "location":
            await updateLocation(payload);
            break;
          case "technology":
            await updateTechnology(payload);
            break;
          case "culture":
            await updateCulture(payload);
            break;
          case "source":
            await updateSourceDocument(payload);
            break;
        }
        showSuccess(
          `${getSingularLabel(type as EntityType)} updated successfully`,
        );
        newEntityId = originalData.id;
      } else {
        switch (serviceType) {
          case "character":
            newEntityId = addCharacter(formData);
            break;
          case "location":
            newEntityId = addLocation(formData);
            break;
          case "technology":
            newEntityId = addTechnology(formData);
            break;
          case "culture":
            newEntityId = addCulture(formData);
            break;
          case "source":
            newEntityId = addSourceDocument(formData);
            break;
        }
        showSuccess(
          `${getSingularLabel(type as EntityType)} created successfully`,
        );
      }

      setEditingEntityInfo(null);
      setRefreshKey((prev) => prev + 1);

      if (newEntityId) {
        setTimeout(() => {
          setRefreshKey((prev) => prev + 1);

          setTimeout(() => {
            const sectionKey = isDynamicProject
              ? "entities"
              : (`${serviceType}s` as keyof typeof project);

            let entityList: any[] = [];
            if (isDynamicProject) {
              entityList =
                project?.entities?.filter((e: any) => e.entityType === type) ||
                [];
            } else {
              entityList = (project?.[sectionKey] as any[]) || [];
            }

            const savedEntity = entityList.find(
              (e: any) => e.id === newEntityId,
            );
            if (savedEntity) {
              handleShowEntityDetails(savedEntity);
            }
          }, 200);
        }, 100);
      }
    } catch (error) {
      showError(
        `Error saving ${getSingularLabel(
          type as EntityType,
        ).toLowerCase()}: ${error}`,
      );
    }
  };

  const handleDeleteFromDetails = () => {
    if (selectedEntityForDetails) {
      setEntityToDelete({
        type: getSingularEntityType(currentSection),
        data: selectedEntityForDetails,
      });
      setIsDeleteModalOpen(true);
      setShowDetailsPanel(false);
      setSelectedEntityForDetails(null);
      setSelectedKnowledgeBaseEntityId(null);
    }
  };

  const handleDeleteFromForm = () => {
    if (editingEntityInfo?.data) {
      setEntityToDelete({
        type: editingEntityInfo.type,
        data: editingEntityInfo.data,
      });
      setIsDeleteModalOpen(true);
      setEditingEntityInfo(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!entityToDelete) return;

    try {
      const { type, data } = entityToDelete;
      const serviceType =
        type === "setting"
          ? "location"
          : type === "plot_device"
            ? "technology"
            : type;
      switch (serviceType) {
        case "character":
          await deleteCharacter(data.id);
          break;
        case "location":
          await deleteLocation(data.id);
          break;
        case "technology":
          await deleteTechnology(data.id);
          break;
        case "culture":
          await deleteCulture(data.id);
          break;
        case "source":
          await deleteSourceDocument(data.id);
          break;
        default:
          throw new Error(`Cannot delete unknown type: ${type}`);
      }
      showSuccess(
        `${getSingularLabel(type as EntityType)} deleted successfully`,
      );
      setIsDeleteModalOpen(false);
      setEntityToDelete(null);
      setSelectedEntityForDetails(null);
      setShowDetailsPanel(false);
      setSelectedKnowledgeBaseEntityId(null);
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      showError(`Error deleting: ${error}`);
      setIsDeleteModalOpen(false);
      setEntityToDelete(null);
    }
  };

  const handleEntityClick = (entityType: string, entityId: ID) => {
    const entityTypePlural = (entityType + "s") as EntityType;
    setCurrentSection(entityTypePlural);
    setCurrentKnowledgeBaseCategory(entityTypePlural);
    const actualEntity = entities.find((e) => e.id === entityId);
    if (actualEntity) {
      handleShowEntityDetails(actualEntity);
    }
  };

  const handleTimelineSelect = (timelineId: ID) => {
    setSelectedTimelineId(timelineId);
    setIsTimelineSelectorOpen(false);
  };

  const handleAddTimelineClick = () => {
    alert("This would open the timeline creation modal");
  };

  const renderActiveForm = () => {
    if (!editingEntityInfo) return null;
    const { type, data } = editingEntityInfo;
    const commonProps = {
      initialData: data,
      onSubmit: handleFormSubmit,
      onCancel: handleFormCancel,
    };

    switch (type) {
      case "character":
        return <CharacterForm {...commonProps} />;
      case "location":
      case "setting":
        return <LocationForm {...commonProps} />;
      case "technology":
      case "plot_device":
        return <TechnologyForm {...commonProps} />;
      case "culture":
        return <CultureForm {...commonProps} />;
      case "source":
        return <SourceDocumentForm {...commonProps} />;
      case "theme":
        return (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-md text-center">
            <p className="text-yellow-800 dark:text-yellow-200">
              A dedicated form for the '<b>Theme</b>' entity type has not been
              created yet.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleFormCancel}
              className="mt-4"
            >
              Go Back
            </Button>
          </div>
        );
      default:
        return <p>No form available for entity type: {type}</p>;
    }
  };

  return (
    <MainContentArea
      title="Knowledge Base"
      actions={
        editingEntityInfo && editingEntityInfo.data?.id ? (
          <Button
            variant="danger"
            size="sm"
            onClick={handleDeleteFromForm}
            leftIcon={<FaTrash className="h-4 w-4" />}
          >
            Delete {getSingularLabel(editingEntityInfo.type as EntityType)}
          </Button>
        ) : !editingEntityInfo ? (
          <div className="flex items-center gap-2">
            {!showRelationshipViewer && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRelationshipViewer(true)}
                  title="Explore connections between events and entities"
                >
                  Relationship Viewer
                </Button>
                <Button
                  variant={showConsistencyAnalysis ? "primary" : "outline"}
                  size="sm"
                  onClick={() =>
                    setShowConsistencyAnalysis(!showConsistencyAnalysis)
                  }
                  leftIcon={<FaShieldAlt className="h-4 w-4" />}
                  title={
                    showConsistencyAnalysis
                      ? "Hide Consistency Tool"
                      : "Show Consistency Tool"
                  }
                >
                  {showConsistencyAnalysis ? "Hide Tools" : "Show Tools"}
                </Button>
              </>
            )}
            {showRelationshipViewer && (
              <>
                <div className="relative z-50">
                  <TimelineSelector
                    timelines={project.timelines || []}
                    currentTimelineId={selectedTimelineId}
                    onTimelineSelect={(id) => id && handleTimelineSelect(id)}
                    onAddTimelineClick={handleAddTimelineClick}
                    isOpen={isTimelineSelectorOpen}
                    onToggle={() =>
                      setIsTimelineSelectorOpen(!isTimelineSelectorOpen)
                    }
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRelationshipViewer(false)}
                >
                  Back
                </Button>
              </>
            )}
            {!showRelationshipViewer &&
              selectedEntityForDetails &&
              !editingEntityInfo && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDetailsPanel(!showDetailsPanel)}
                  leftIcon={<FaColumns className="h-4 w-4" />}
                >
                  {showDetailsPanel ? "Hide Details" : "Show Details"}
                </Button>
              )}
            {!showRelationshipViewer &&
              currentSection !== "tags" &&
              !editingEntityInfo && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleAddEntity}
                  leftIcon={<FaPlus className="h-4 w-4" />}
                >
                  Add {getSingularLabel(currentSection)}
                </Button>
              )}
          </div>
        ) : null
      }
    >
      {showRelationshipViewer ? (
        <div className="h-full flex flex-col">
          <div
            className="flex-1"
            style={{ height: "calc(100vh - 200px)", width: "100%" }}
          >
            {selectedTimelineId ? (
              <EventRelationshipSankey
                timelineId={selectedTimelineId}
                height={window.innerHeight - 200}
                width={window.innerWidth - 40}
                onEventClick={(event) => console.log("Event clicked:", event)}
                onEntityClick={handleEntityClick}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                Please select a timeline to view relationships.
              </div>
            )}
          </div>
        </div>
      ) : editingEntityInfo ? (
        <div className="p-1 sm:p-2 md:p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md border dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-6">
            {editingEntityInfo.data
              ? `Edit ${getSingularLabel(editingEntityInfo.type as EntityType)}`
              : `Create New ${getSingularLabel(
                  editingEntityInfo.type as EntityType,
                )}`}
          </h2>
          {renderActiveForm()}
        </div>
      ) : (
        <>
          <div
            className={`h-full ${showDetailsPanel && selectedEntityForDetails && !editingEntityInfo ? "mr-96" : ""}`}
          >
            <div className="flex flex-col h-full">
              {showConsistencyAnalysis && <KnowledgeBaseConsistencyChecker />}
              <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4 overflow-x-auto pb-px">
                {knowledgeBaseSections.map((section) => {
                  const sectionCount = getEntityCountForSection(section.id);

                  return (
                    <button
                      key={section.id}
                      className={`px-4 py-2 text-sm font-medium flex items-center whitespace-nowrap ${
                        currentSection === section.id
                          ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600"
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-800"
                      }`}
                      onClick={() => {
                        setCurrentSection(section.id);
                        setCurrentKnowledgeBaseCategory(section.id);
                        setSelectedKnowledgeBaseEntityId(null);
                        setShowDetailsPanel(false);
                        setSelectedEntityForDetails(null);
                        setEditingEntityInfo(null);
                      }}
                    >
                      {getSectionIcon(section.id)} {getSectionLabel(section.id)}
                      <span className="ml-2 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full text-xs">
                        {sectionCount}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div className="relative flex-grow sm:max-w-xs md:max-w-sm">
                  <input
                    type="text"
                    className="pl-10 pr-4 py-2 w-full border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700"
                    placeholder={`Search ${getSectionLabel().toLowerCase()}...`}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                    }}
                  />
                  <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                </div>

                <div className="flex items-center gap-x-4 gap-y-2">
                  {currentSection === "tags" && (
                    <div className="flex items-center gap-1 rounded-md bg-gray-100 dark:bg-gray-700 p-1">
                      <button
                        onClick={() => setTagViewMode("list")}
                        className={`px-2 py-1 text-sm rounded ${
                          tagViewMode === "list"
                            ? "bg-white dark:bg-gray-800 shadow-sm"
                            : "text-gray-600 dark:text-gray-300"
                        }`}
                        title="List View"
                      >
                        <FaTh className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setTagViewMode("cloud")}
                        className={`px-2 py-1 text-sm rounded ${
                          tagViewMode === "cloud"
                            ? "bg-white dark:bg-gray-800 shadow-sm"
                            : "text-gray-600 dark:text-gray-300"
                        }`}
                        title="Cloud View"
                      >
                        <FaGlobe className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  {currentSection !== "tags" && (
                    <>
                      <div className="flex items-center gap-1 rounded-md bg-gray-100 dark:bg-gray-700 p-1">
                        <button
                          onClick={() => setDisplayMode("card")}
                          className={`px-2 py-1 text-sm rounded ${
                            displayMode === "card"
                              ? "bg-white dark:bg-gray-800 shadow-sm"
                              : "text-gray-600 dark:text-gray-300"
                          }`}
                          title="Card View"
                        >
                          <FaTh className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDisplayMode("list")}
                          className={`px-2 py-1 text-sm rounded ${
                            displayMode === "list"
                              ? "bg-white dark:bg-gray-800 shadow-sm"
                              : "text-gray-600 dark:text-gray-300"
                          }`}
                          title="List View"
                        >
                          <FaList className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={sortField}
                          onChange={(e) =>
                            setSortField(e.target.value as "name" | "date")
                          }
                          className="text-sm rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                        >
                          <option value="name">Sort by Name</option>
                          <option value="date">Sort by Date</option>
                        </select>
                        <button
                          onClick={() =>
                            setSortDirection(
                              sortDirection === "asc" ? "desc" : "asc",
                            )
                          }
                          title={`Sort ${
                            sortDirection === "asc" ? "Descending" : "Ascending"
                          }`}
                        >
                          {sortDirection === "asc" ? (
                            <FaSortAlphaDown className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                          ) : (
                            <FaSortAlphaUp className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-auto pr-2">
                {currentSection === "tags" ? (
                  tagStats.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                      <FaTags className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No tags found in project.</p>
                      <p className="text-sm mt-2">
                        Add tags to your entities to see them here.
                      </p>
                    </div>
                  ) : tagViewMode === "cloud" ? (
                    <div className="p-4">
                      <InterconnectedTagCloud
                        onTagClick={(tag) => {
                          setExpandedTag(tag);
                          setTagViewMode("list");
                        }}
                      />
                    </div>
                  ) : (
                    <div className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {tagStats
                          .sort((a, b) => b.count - a.count)
                          .map((tagStat) => {
                            const isExpanded = expandedTag === tagStat.tag;
                            const relatedTags = new Set<string>();

                            tagStat.entities.forEach((entity) => {
                              const entityTags =
                                project?.characters?.find(
                                  (c: any) => c.id === entity.id,
                                )?.tags ||
                                project?.locations?.find(
                                  (l: any) => l.id === entity.id,
                                )?.tags ||
                                project?.technologies?.find(
                                  (t: any) => t.id === entity.id,
                                )?.tags ||
                                project?.cultures?.find(
                                  (c: any) => c.id === entity.id,
                                )?.tags ||
                                project?.sources?.find(
                                  (s: any) => s.id === entity.id,
                                )?.tags ||
                                project?.timelines
                                  ?.flatMap((t: any) => t.events)
                                  ?.find((e: any) => e.id === entity.id)
                                  ?.tags ||
                                [];
                              entityTags.forEach((tag: string) => {
                                if (tag !== tagStat.tag) relatedTags.add(tag);
                              });
                            });

                            const entitiesByType = tagStat.entities.reduce(
                              (acc, entity) => {
                                const type = entity.type;
                                if (!acc[type]) acc[type] = [];
                                acc[type].push(entity);
                                return acc;
                              },
                              {} as Record<string, typeof tagStat.entities>,
                            );

                            return (
                              <div
                                key={tagStat.tag}
                                className={`bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-sm hover:shadow-md transition-all ${
                                  isExpanded
                                    ? "md:col-span-2 lg:col-span-2 xl:col-span-2"
                                    : ""
                                }`}
                              >
                                <div
                                  onClick={() =>
                                    setExpandedTag(
                                      isExpanded ? null : tagStat.tag,
                                    )
                                  }
                                  // FINAL BUG FIX: Use a fully conditional class to handle mutually exclusive expanded and hover states correctly.
                                  className={`flex items-center justify-between p-4 cursor-pointer rounded-t-lg transition-colors ${
                                    isExpanded
                                      ? "bg-gray-100 dark:bg-gray-700"
                                      : "hover:bg-gray-50 dark:hover:bg-gray-700"
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                                      <FaTags className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div>
                                      <p className="font-semibold text-gray-900 dark:text-white">
                                        {tagStat.tag}
                                      </p>
                                      <p className="text-sm text-gray-500 dark:text-gray-400">
                                        Used in {tagStat.count}{" "}
                                        {tagStat.count === 1
                                          ? "entity"
                                          : "entities"}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center justify-center w-8 h-8 text-sm font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-full">
                                      {tagStat.count}
                                    </span>
                                    <svg
                                      className={`w-5 h-5 text-gray-400 transition-transform ${
                                        isExpanded ? "rotate-180" : ""
                                      }`}
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 9l-7 7-7-7"
                                      />
                                    </svg>
                                  </div>
                                </div>

                                {isExpanded && (
                                  <div className="border-t dark:border-gray-700 p-4 space-y-4">
                                    <div>
                                      <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">
                                        Connected Entities
                                      </h4>
                                      <div className="space-y-2">
                                        {Object.entries(entitiesByType).map(
                                          ([type, entities]) => (
                                            <div key={type}>
                                              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                                                {type}s
                                              </p>
                                              <div className="flex flex-wrap gap-1">
                                                {entities
                                                  .slice(0, 5)
                                                  .map((entity) => (
                                                    <span
                                                      key={entity.id}
                                                      className="inline-block px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded"
                                                    >
                                                      {entity.name}
                                                    </span>
                                                  ))}
                                                {entities.length > 5 && (
                                                  <span className="inline-block px-2 py-1 text-xs text-gray-500 dark:text-gray-400">
                                                    +{entities.length - 5} more
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          ),
                                        )}
                                      </div>
                                    </div>

                                    {relatedTags.size > 0 && (
                                      <div>
                                        <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">
                                          Related Tags
                                        </h4>
                                        <div className="flex flex-wrap gap-1">
                                          {Array.from(relatedTags)
                                            .slice(0, 10)
                                            .map((tag) => (
                                              <span
                                                key={tag}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setExpandedTag(tag);
                                                }}
                                                className="inline-block px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-800"
                                              >
                                                {tag}
                                              </span>
                                            ))}
                                          {relatedTags.size > 10 && (
                                            <span className="inline-block px-2 py-1 text-xs text-gray-500 dark:text-gray-400">
                                              +{relatedTags.size - 10} more
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )
                ) : entities.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 space-y-4">
                    <p className="text-gray-500 dark:text-gray-400">
                      No {getSectionLabel().toLowerCase()} found.
                    </p>
                    <Button
                      variant="primary"
                      size="md"
                      onClick={handleAddEntity}
                      leftIcon={<FaPlus className="h-4 w-4" />}
                    >
                      Add {getSingularLabel(currentSection)}
                    </Button>
                  </div>
                ) : displayMode === "card" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                    {finalDisplayedEntities.map((entity) => (
                      <EntityCard
                        key={entity.id}
                        entity={entity}
                        entityType={getSingularEntityType(currentSection)}
                        onClick={() => handleEntityCardClick(entity)}
                        isSelected={
                          selectedEntityForDetails?.id === entity.id &&
                          !editingEntityInfo
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {finalDisplayedEntities.map((entity) => (
                      <div
                        key={entity.id}
                        onClick={() => handleEntityCardClick(entity)}
                        className={`flex items-center p-3 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-md shadow-sm hover:shadow-md cursor-pointer transition-all ${
                          selectedEntityForDetails?.id === entity.id &&
                          !editingEntityInfo
                            ? "ring-2 ring-blue-500"
                            : ""
                        }`}
                      >
                        <div className="flex-grow min-w-0">
                          <p className="font-semibold truncate">
                            {entity.name || entity.title}
                          </p>
                          <p className="text-sm text-gray-500 truncate">
                            {entity.description?.replace(/<[^>]*>?/gm, "") ||
                              "No description"}
                          </p>
                        </div>
                        {entity.tags && (
                          <div className="flex-shrink-0 ml-4 flex gap-1">
                            {entity.tags.slice(0, 2).map((tag: string) => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 rounded text-xs  bg-gray-100 dark:bg-gray-700"
                              >
                                {tag}
                              </span>
                            ))}
                            {entity.tags.length > 2 && (
                              <span className="text-xs text-gray-500">
                                +{entity.tags.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {showDetailsPanel &&
            selectedEntityForDetails &&
            !editingEntityInfo && (
              <EntityDetailsPanel
                entity={selectedEntityForDetails}
                entityType={getSingularEntityType(currentSection)}
                onClose={() => {
                  setShowDetailsPanel(false);
                  setSelectedKnowledgeBaseEntityId(null);
                }}
                onEdit={handleEditFromDetails}
                onDelete={handleDeleteFromDetails}
              />
            )}
        </>
      )}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirm Deletion"
      >
        <div className="p-4">
          <p>
            Are you sure you want to delete "
            <span className="font-medium">
              {entityToDelete?.data?.name || entityToDelete?.data?.title}
            </span>
            "?
          </p>
          <div className="flex justify-end space-x-3 mt-6">
            <Button
              variant="outline"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </MainContentArea>
  );
};

export default KnowledgeBasePage;
