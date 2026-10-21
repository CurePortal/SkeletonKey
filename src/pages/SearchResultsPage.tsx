// src/pages/SearchResultsPage.tsx
import React, { useState, useEffect, useMemo } from "react"; // Removed useCallback
import {
  FiGrid,
  FiList,
  FiFilter,
  FiX,
  FiChevronLeft,
  FiChevronRight,
  FiSearch,
  FiBookOpen,
  FiUsers,
  FiMapPin,
  FiCpu,
  FiGlobe,
  FiFileText,
  FiGitMerge,
  FiClock,
  FiAlertCircle,
} from "react-icons/fi";
import { useSearch } from "../contexts/SearchContext";
import { useProjectData } from "../contexts/ProjectDataContext";
import { useAppState } from "../contexts/AppStateContext";
import { SearchResult, SearchState } from "../types/search";
// Removed unused type imports from "../types/project" (TS6192)
import Button from "../components/common/Button";
import { openAnotherProject } from "../services/mainProjectService";
import LoadingSpinner from "../components/common/LoadingSpinner";
import MainContentArea from "../components/layout/MainContentArea";
import { entityIconMapping } from "../utils/entityIconMapping";

// Helper to get appropriate icon for search result type
const getResultIcon = (
  type: SearchResult["type"] /* Removed iconId: TS6133 */,
) => {
  const IconComponent = entityIconMapping[type] || FiAlertCircle;
  return (
    <IconComponent className="h-5 w-5 mr-2 flex-shrink-0 text-gray-500 dark:text-gray-400" />
  );
};

const SearchResultsPage: React.FC = () => {
  const {
    searchState,
    setSearchFilters,
    setSearchPage,
    performSearch,
    availableTags,
    // clearSearch, // Removed: TS6133
  } = useSearch();
  const {
    project,
    getTimelineById,
    // getEventById, // Removed: TS6133
    // getCharacterById, // Removed: TS6133
    // getLocationById, // Removed: TS6133
    // getTechnologyById, // Removed: TS6133
    // getCultureById, // Removed: TS6133
    // getSourceDocumentById, // Removed: TS6133
    // getReportById, // Removed: TS6133
  } = useProjectData();
  const {
    appState,
    setViewMode,
    setSelectedEntityId,
    setSelectedEntityType,
    setCurrentTimelineId,
    setCurrentKnowledgeBaseCategory,
    setSelectedKnowledgeBaseEntityId,
    setSearchQuery: setGlobalSearchQuery,
  } = useAppState();

  const { query, results, isSearching, selectedFilters, pagination } =
    searchState;

  const [currentView, setCurrentView] = useState<"grid" | "list">("list");
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [tempFilters, setTempFilters] =
    useState<SearchState["selectedFilters"]>(selectedFilters);

  useEffect(() => {
    setTempFilters(selectedFilters);
  }, [selectedFilters]);

  useEffect(() => {
    if (
      project &&
      appState.searchQuery &&
      appState.viewMode === "search-results" &&
      results.length === 0 &&
      !isSearching
    ) {
      performSearch(project, appState.searchQuery, selectedFilters, 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, appState.searchQuery, appState.viewMode]);

  const handleFilterChange = <K extends keyof SearchState["selectedFilters"]>(
    filterType: K,
    value: SearchState["selectedFilters"][K],
  ) => {
    setTempFilters((prev) => ({ ...prev, [filterType]: value }));
  };

  const handleTagToggle = (tag: string) => {
    setTempFilters((prev) => {
      const newTags = prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag];
      return { ...prev, tags: newTags };
    });
  };

  const handleEntityTypeToggle = (entityType: SearchResult["type"]) => {
    setTempFilters((prev) => {
      const currentTypes = prev.types as SearchResult["type"][];
      const newTypes = currentTypes.includes(entityType)
        ? currentTypes.filter((t) => t !== entityType)
        : [...currentTypes, entityType];
      return { ...prev, types: newTypes };
    });
  };

  const applyFilters = () => {
    setSearchFilters(tempFilters);
    setShowFilterPanel(false);
  };

  const resetAndClearFilters = () => {
    const cleared = { types: [], timelineIds: [], tags: [] };
    setTempFilters(cleared);
    setSearchFilters(cleared);
    setShowFilterPanel(false);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      setSearchPage(newPage);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    setSelectedEntityId(result.entityId);
    setSelectedEntityType(result.type);

    switch (result.type) {
      case "event":
        if (result.parentId) setCurrentTimelineId(result.parentId);
        setViewMode("timeline");
        break;
      case "timeline":
        setCurrentTimelineId(result.entityId);
        setViewMode("timeline");
        break;
      case "character":
        setCurrentKnowledgeBaseCategory("characters");
        setSelectedKnowledgeBaseEntityId(result.entityId);
        setViewMode("knowledge-base");
        break;
      case "location":
        setCurrentKnowledgeBaseCategory("locations");
        setSelectedKnowledgeBaseEntityId(result.entityId);
        setViewMode("knowledge-base");
        break;
      case "technology":
        setCurrentKnowledgeBaseCategory("technologies");
        setSelectedKnowledgeBaseEntityId(result.entityId);
        setViewMode("knowledge-base");
        break;
      case "culture":
        setCurrentKnowledgeBaseCategory("cultures");
        setSelectedKnowledgeBaseEntityId(result.entityId);
        setViewMode("knowledge-base");
        break;
      case "sourceDocument":
        setCurrentKnowledgeBaseCategory("sources");
        setSelectedKnowledgeBaseEntityId(result.entityId);
        setViewMode("knowledge-base");
        break;
      case "narrative":
        setViewMode("narrative");
        break;
      default:
        setViewMode("dashboard");
    }
  };

  const totalPages = Math.ceil(
    pagination.totalResults / pagination.resultsPerPage,
  );

  const availableEntityTypes: {
    value: SearchResult["type"];
    label: string;
    icon: React.ReactNode;
  }[] = [
    {
      value: "timeline",
      label: "Timelines",
      icon: <FiGitMerge className="mr-2" />,
    },
    { value: "event", label: "Events", icon: <FiClock className="mr-2" /> },
    {
      value: "character",
      label: "Characters",
      icon: <FiUsers className="mr-2" />,
    },
    {
      value: "location",
      label: "Locations",
      icon: <FiMapPin className="mr-2" />,
    },
    {
      value: "technology",
      label: "Technologies",
      icon: <FiCpu className="mr-2" />,
    },
    { value: "culture", label: "Cultures", icon: <FiGlobe className="mr-2" /> },
    {
      value: "sourceDocument",
      label: "Sources",
      icon: <FiFileText className="mr-2" />,
    },
    {
      value: "narrative",
      label: "Narratives",
      icon: <FiBookOpen className="mr-2" />,
    },
  ];

  const allTimelines = useMemo(() => project?.timelines || [], [project]);

  const renderGridItem = (result: SearchResult) => (
    <div
      key={result.id}
      className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:shadow-lg transition-shadow bg-white dark:bg-gray-800 cursor-pointer flex flex-col h-full"
      onClick={() => handleResultClick(result)}
    >
      <div className="p-4 flex-grow">
        <div className="flex items-center mb-2">
          {getResultIcon(
            result.type /*, result.iconId - iconId param removed */,
          )}
          <h3
            className="text-md font-semibold text-gray-800 dark:text-white truncate"
            title={result.title}
          >
            {result.title}
          </h3>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 capitalize mb-1">
          {result.type}{" "}
          {result.parentId && project
            ? `(in ${getTimelineById(result.parentId)?.name || "Timeline"})`
            : ""}
        </p>
        {result.date && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            Date: {result.date}
          </p>
        )}
        <p
          className="text-sm text-gray-600 dark:text-gray-300 mt-1 line-clamp-3 flex-grow"
          title={result.description || ""}
        >
          {result.description || "No description."}
        </p>
      </div>
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <p
          className="text-xs text-gray-500 dark:text-gray-400 italic truncate"
          title={`Matched: ${result.matchText}`}
        >
          Matched <span className="font-semibold">{result.matchType}</span>: "
          {result.matchText}"
        </p>
        {result.tags && result.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {result.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full"
              >
                {tag}
              </span>
            ))}
            {result.tags.length > 3 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                +{result.tags.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderListItem = (result: SearchResult) => (
    <div
      key={result.id}
      className="flex p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-shadow bg-white dark:bg-gray-800 mb-2 cursor-pointer"
      onClick={() => handleResultClick(result)}
    >
      <div className="flex-shrink-0 pt-1">
        {getResultIcon(result.type /*, result.iconId - iconId param removed */)}
      </div>
      <div className="flex-grow ml-2 overflow-hidden">
        {" "}
        <h3
          className="text-base font-medium text-gray-800 dark:text-white truncate"
          title={result.title}
        >
          {result.title}
        </h3>
        <div className="text-xs text-gray-500 dark:text-gray-400 capitalize mb-0.5">
          <span>{result.type}</span>
          {result.parentId && project && (
            <span>
              {" "}
              in{" "}
              <span className="font-medium">
                {getTimelineById(result.parentId)?.name || "Timeline"}
              </span>
            </span>
          )}
          {result.date && <span className="ml-2">Date: {result.date}</span>}
        </div>
        <p
          className="text-sm text-gray-600 dark:text-gray-300 mt-0.5 line-clamp-2"
          title={result.description || ""}
        >
          {result.description || "No description available."}
        </p>
        <p
          className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic truncate"
          title={`Matched ${result.matchType}: ${result.matchText}`}
        >
          Matched <span className="font-semibold">{result.matchType}</span> on
          field: "{result.matchText}"
        </p>
        {result.tags && result.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {result.tags.slice(0, 5).map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 rounded-full"
              >
                {tag}
              </span>
            ))}
            {result.tags.length > 5 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                +{result.tags.length - 5}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (!project) {
    return (
      <MainContentArea title="Search Project">
        <div className="text-center py-12">
          <FiSearch className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            No Project Loaded
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Please open or create a project to start searching.
          </p>
          <div className="mt-6">
            <Button
              variant="primary"
              onClick={() => void openAnotherProject()}
            >
              Open main project
            </Button>
          </div>
        </div>
      </MainContentArea>
    );
  }

  return (
    <MainContentArea
      title={query ? `Search Results for "${query}"` : "Project Search"}
      showBackButton={true}
      onBackClick={() => {
        setGlobalSearchQuery("");
        setViewMode("dashboard");
      }}
      actions={
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            leftIcon={<FiFilter />}
          >
            Filters{" "}
            {tempFilters.types.length +
              tempFilters.timelineIds.length +
              tempFilters.tags.length >
              0 &&
              `(${tempFilters.types.length + tempFilters.timelineIds.length + tempFilters.tags.length})`}
          </Button>
          <div className="flex items-center">
            <button
              title="Grid View"
              className={`p-2 rounded ${currentView === "grid" ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200" : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"}`}
              onClick={() => setCurrentView("grid")}
            >
              <FiGrid className="h-5 w-5" />
            </button>
            <button
              title="List View"
              className={`ml-2 p-2 rounded ${currentView === "list" ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200" : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"}`}
              onClick={() => setCurrentView("list")}
            >
              <FiList className="h-5 w-5" />
            </button>
          </div>
        </div>
      }
    >
      {/* Filter Panel */}
      {showFilterPanel && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setShowFilterPanel(false)}
        >
          <div
            className="fixed top-0 right-0 h-full w-full max-w-xs sm:max-w-sm bg-white dark:bg-gray-800 shadow-xl z-50 transform transition-transform ease-in-out duration-300 p-5 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Search Filters
              </h2>
              <Button
                variant="outline" // Changed from "ghost" (TS2322)
                size="sm" // Changed from "icon" (TS2322)
                onClick={() => setShowFilterPanel(false)}
                aria-label="Close filters"
              >
                <FiX className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex-grow overflow-y-auto pr-2 space-y-5">
              {/* Entity Type Filter */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Filter by Type
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {availableEntityTypes.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => handleEntityTypeToggle(type.value)}
                      className={`flex items-center justify-center p-2 rounded-md text-xs transition-colors ${
                        tempFilters.types.includes(type.value)
                          ? "bg-blue-500 text-white hover:bg-blue-600"
                          : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"
                      }`}
                    >
                      {React.cloneElement(type.icon as React.ReactElement, {
                        className: "mr-1.5 h-4 w-4",
                      })}
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Timeline Filter */}
              {allTimelines.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Filter by Timeline
                  </h3>
                  <div className="max-h-40 overflow-y-auto space-y-1 border dark:border-gray-600 rounded-md p-2">
                    {allTimelines.map((timeline) => (
                      <label
                        key={timeline.id}
                        className="flex items-center p-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 text-blue-600 border-gray-300 dark:border-gray-500 rounded focus:ring-blue-500 bg-white dark:bg-gray-600"
                          checked={tempFilters.timelineIds.includes(
                            timeline.id,
                          )}
                          onChange={() =>
                            handleFilterChange(
                              "timelineIds",
                              tempFilters.timelineIds.includes(timeline.id)
                                ? tempFilters.timelineIds.filter(
                                    (id) => id !== timeline.id,
                                  )
                                : [...tempFilters.timelineIds, timeline.id],
                            )
                          }
                        />
                        <span
                          className="ml-2 text-xs text-gray-700 dark:text-gray-300 truncate"
                          title={timeline.name}
                        >
                          {timeline.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Tag Filter */}
              {availableTags.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Filter by Tags
                  </h3>
                  <div className="max-h-40 overflow-y-auto flex flex-wrap gap-1.5 border dark:border-gray-600 rounded-md p-2">
                    {availableTags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => handleTagToggle(tag)}
                        className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
                          tempFilters.tags.includes(tag)
                            ? "bg-blue-500 text-white hover:bg-blue-600"
                            : "bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200"
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-auto pt-5 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={resetAndClearFilters}
              >
                Clear All
              </Button>
              <Button variant="primary" size="sm" onClick={applyFilters}>
                Apply Filters
              </Button>
            </div>
          </div>
        </div>
      )}

      {isSearching && results.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10">
          <LoadingSpinner size="lg" />
          <p className="mt-3 text-gray-600 dark:text-gray-400">Searching...</p>
        </div>
      ) : !isSearching && results.length === 0 && query.trim() !== "" ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/30 rounded-lg">
          <FiSearch className="mx-auto h-10 w-10 text-gray-400 mb-3" />
          <h3 className="text-md font-medium text-gray-900 dark:text-white">
            No results found for "{query}"
          </h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Try a different search term or adjust your filters.
          </p>
        </div>
      ) : !isSearching &&
        results.length === 0 &&
        query.trim() === "" &&
        appState.viewMode === "search-results" ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/30 rounded-lg">
          <FiSearch className="mx-auto h-10 w-10 text-gray-400 mb-3" />
          <h3 className="text-md font-medium text-gray-900 dark:text-white">
            Start Searching
          </h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Enter a term in the search bar above to find content in your
            project.
          </p>
        </div>
      ) : (
        results.length > 0 && (
          <>
            <div className="mb-3 text-xs text-gray-600 dark:text-gray-400">
              Showing{" "}
              {pagination.currentPage * pagination.resultsPerPage -
                pagination.resultsPerPage +
                1}
              -
              {Math.min(
                pagination.currentPage * pagination.resultsPerPage,
                pagination.totalResults,
              )}{" "}
              of {pagination.totalResults} results.
            </div>
            {currentView === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {results.map(renderGridItem)}
              </div>
            ) : (
              <div className="space-y-2">{results.map(renderListItem)}</div>
            )}

            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.currentPage - 1)}
                  disabled={pagination.currentPage === 1 || isSearching}
                  leftIcon={<FiChevronLeft />}
                >
                  Previous
                </Button>
                <span className="text-xs text-gray-700 dark:text-gray-300">
                  Page {pagination.currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.currentPage + 1)}
                  disabled={
                    pagination.currentPage === totalPages || isSearching
                  }
                  rightIcon={<FiChevronRight />}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )
      )}
    </MainContentArea>
  );
};

export default SearchResultsPage;
