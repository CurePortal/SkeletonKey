import { SelectOption } from "../components/common/SelectDropdown";
import { ProjectType } from "../types/project";
import { EnhancedProjectType } from "../types/dynamicEntity";

/**
 * Custom hook to generate options for knowledge base entities in dropdowns
 */
const useKnowledgeBaseOptions = (
  project: ProjectType | EnhancedProjectType | null,
) => {
  // Type guard to determine if we are working with the new dynamic entity structure
  const isDynamicProject = project && "entities" in project;

  // Get all events across timelines for SelectDropdown options
  const getEventOptions = (excludeEventId?: string): SelectOption[] => {
    if (!project) return [];

    const allEvents: SelectOption[] = [];

    project.timelines.forEach((timeline) => {
      timeline.events.forEach((event: any) => {
        // Don't include the current event in the options
        if (excludeEventId && event.id === excludeEventId) return;

        allEvents.push({
          value: event.id,
          label: `${event.title} (${timeline.name})`,
          icon: (
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: timeline.color }}
            ></div>
          ),
        });
      });
    });

    return allEvents;
  };

  // Convert characters to SelectDropdown options
  const getCharacterOptions = (): SelectOption[] => {
    if (!project || !("characters" in project)) return [];

    return (project.characters || []).map((character) => ({
      value: character.id,
      label: character.name,
      icon: (
        <svg
          className="h-3 w-3 text-gray-600 dark:text-gray-400"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
            clipRule="evenodd"
          />
        </svg>
      ),
    }));
  };

  // Convert locations to SelectDropdown options
  const getLocationOptions = (excludeLocationId?: string): SelectOption[] => {
    if (!project || !("locations" in project)) return [];

    return (project.locations || [])
      .filter((location) => {
        if (excludeLocationId && location.id === excludeLocationId) {
          return false;
        }
        return true;
      })
      .map((location) => ({
        value: location.id,
        label: location.name,
        icon: (
          <svg
            className="h-3 w-3 text-gray-600 dark:text-gray-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
              clipRule="evenodd"
            />
          </svg>
        ),
      }));
  };

  // Convert technologies to SelectDropdown options
  const getTechnologyOptions = (): SelectOption[] => {
    if (!project || !("technologies" in project)) return [];

    return (project.technologies || []).map((tech) => ({
      value: tech.id,
      label: tech.name,
      icon: (
        <svg
          className="h-3 w-3 text-gray-600 dark:text-gray-400"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
            clipRule="evenodd"
          />
        </svg>
      ),
    }));
  };

  // Convert cultures to SelectDropdown options
  const getCultureOptions = (): SelectOption[] => {
    if (!project || !("cultures" in project)) return [];

    return (project.cultures || []).map((culture) => ({
      value: culture.id,
      label: culture.name,
      icon: (
        <svg
          className="h-3 w-3 text-gray-600 dark:text-gray-400"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M7 2a1 1 0 00-.707 1.707L7 4.414v3.758a1 1 0 01-.293.707l-4 4C.817 14.769 2.156 18 4.828 18h10.343c2.673 0 4.012-3.231 2.122-5.121l-4-4A1 1 0 0113 8.172V4.414l.707-.707A1 1 0 0013 2H7zm2 6.172V4h2v4.172a3 3 0 00.879 2.12l1.168 1.168a4 4 0 00-2.298.634l-.172.087a4 4 0 01-3.556 0l-.172-.087a4 4 0 00-2.298-.634L5.879 8.46A3 3 0 006.75 8.172z"
            clipRule="evenodd"
          />
        </svg>
      ),
    }));
  };

  // Convert source documents to SelectDropdown options
  const getSourceDocumentOptions = (): SelectOption[] => {
    if (!project || !("sources" in project)) return [];

    return project.sources.map((doc) => ({
      value: doc.id,
      label: doc.title,
      icon: (
        <svg
          className="h-3 w-3 text-gray-600 dark:text-gray-400"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
            clipRule="evenodd"
          />
        </svg>
      ),
    }));
  };

  // Get narrative options for SelectDropdown
  const getNarrativeOptions = (): SelectOption[] => {
    if (!project || !(project as any).reports) return [];

    return (project as any).reports.map((narrative: any) => ({
      value: narrative.id,
      label: narrative.title,
      icon: (
        <svg
          className="h-3 w-3 text-gray-600 dark:text-gray-400"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 01-1 1h0a1 1 0 01-1-1V4a1 1 0 00-1-1H6a1 1 0 00-1 1v12a1 1 0 01-1 1h0a1 1 0 01-1-1V4z"
            clipRule="evenodd"
          />
        </svg>
      ),
    }));
  };

  // NEW: Generic function for dynamic projects to get options for any entity type
  const getOptionsForEntityType = (entityTypeId: string): SelectOption[] => {
    if (!project) return [];

    // For dynamic projects, filter the main 'entities' array
    if (isDynamicProject) {
      const dynamicProject = project as EnhancedProjectType;
      return (
        dynamicProject.entities
          .filter((entity) => entity.entityType === entityTypeId)
          .map((entity) => ({
            value: entity.id,
            label: entity.name,
            // You can enhance this with a dynamic icon lookup if you store icons on the entityType definition
          })) || []
      );
    }

    // Fallback for legacy projects using the old structure
    switch (entityTypeId) {
      case "character":
        return getCharacterOptions();
      case "location":
      case "setting": // map setting to location for compatibility
        return getLocationOptions();
      case "technology":
      case "plot_device": // map plot_device to technology for compatibility
        return getTechnologyOptions();
      case "culture":
        return getCultureOptions();
      case "event":
        return getEventOptions();
      default:
        return [];
    }
  };

  return {
    getEventOptions,
    getCharacterOptions,
    getLocationOptions,
    getTechnologyOptions,
    getCultureOptions,
    getSourceDocumentOptions,
    getNarrativeOptions,
    getOptionsForEntityType, // Expose the new function
  };
};

export default useKnowledgeBaseOptions;
