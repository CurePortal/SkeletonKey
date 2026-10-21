// src/contexts/SearchContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useEffect,
} from "react";
import { ProjectType } from "../types/project"; // Removed ID
import { SearchState } from "../types/search"; // Removed SearchResult
import { searchProject, getAllProjectTags } from "../services/searchService";
import { useProjectData } from "./ProjectDataContext";
import { useAppState } from "./AppStateContext";

const defaultSearchState: SearchState = {
  query: "",
  results: [],
  isSearching: false,
  selectedFilters: {
    types: [],
    timelineIds: [],
    tags: [],
  },
  pagination: {
    currentPage: 1,
    resultsPerPage: 15,
    totalResults: 0,
  },
};

interface SearchContextType {
  searchState: SearchState;
  setSearchQueryFromContext: (query: string) => void;
  performSearch: (
    project: ProjectType,
    query: string,
    filters?: SearchState["selectedFilters"],
    page?: number,
  ) => void;
  clearSearch: () => void;
  setSearchFilters: (filters: SearchState["selectedFilters"]) => void;
  setSearchPage: (page: number) => void;
  availableTags: string[];
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

interface SearchProviderProps {
  children: ReactNode;
}

export const SearchProvider: React.FC<SearchProviderProps> = ({ children }) => {
  const [searchState, setSearchState] =
    useState<SearchState>(defaultSearchState);
  const { project } = useProjectData();
  const { appState, setSearchQuery: setGlobalSearchQuery } = useAppState();
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  const executeSearch = useCallback(
    (
      projectToSearch: ProjectType,
      query: string,
      filters: SearchState["selectedFilters"],
      page: number,
    ) => {
      setSearchState((prev) => ({
        ...prev,
        isSearching: true,
        query,
        selectedFilters: filters,
      }));

      // Assume searchProject returns the appropriate result type
      const allResults = searchProject(projectToSearch, query, filters);

      const { resultsPerPage } = searchState.pagination;
      const paginatedResults = allResults.slice(
        (page - 1) * resultsPerPage,
        page * resultsPerPage,
      );

      setSearchState((prev) => ({
        ...prev,
        results: paginatedResults, // Ensure results are typed correctly if needed elsewhere
        isSearching: false,
        pagination: {
          ...prev.pagination,
          currentPage: page,
          totalResults: allResults.length,
        },
      }));
    },
    [searchState.pagination], // Dependency array
  );

  useEffect(() => {
    if (project) {
      setAvailableTags(getAllProjectTags(project));
    } else {
      setAvailableTags([]);
      setSearchState(defaultSearchState);
    }
  }, [project]);

  useEffect(() => {
    if (appState.viewMode === "search-results") {
      if (appState.searchQuery !== searchState.query) {
        setSearchState((prev) => ({
          ...prev,
          query: appState.searchQuery,
          pagination: { ...prev.pagination, currentPage: 1 },
        }));
        if (project && appState.searchQuery.trim()) {
          executeSearch(
            project,
            appState.searchQuery,
            searchState.selectedFilters,
            1,
          );
        } else if (!appState.searchQuery.trim()) {
          setSearchState((prev) => ({
            ...prev,
            results: [],
            isSearching: false,
            pagination: { ...prev.pagination, totalResults: 0, currentPage: 1 },
          }));
        }
      }
    }
    // Added executeSearch, searchState.query, and searchState.selectedFilters
  }, [
    appState.searchQuery,
    appState.viewMode,
    project,
    executeSearch,
    searchState.query,
    searchState.selectedFilters,
  ]);

  const setSearchQueryFromContext = useCallback((query: string) => {
    setSearchState((prev) => ({ ...prev, query }));
  }, []);

  const performSearch = useCallback(
    (
      projectToSearch: ProjectType,
      queryToSearch: string,
      filters?: SearchState["selectedFilters"],
      page: number = 1,
    ) => {
      const currentFilters = filters || searchState.selectedFilters;
      if (queryToSearch !== appState.searchQuery) {
        setGlobalSearchQuery(queryToSearch);
      }
      executeSearch(projectToSearch, queryToSearch, currentFilters, page);
    },
    [
      executeSearch,
      searchState.selectedFilters,
      appState.searchQuery,
      setGlobalSearchQuery,
    ],
  );

  const clearSearch = useCallback(() => {
    setSearchState(defaultSearchState);
    if (appState.searchQuery !== "") {
      setGlobalSearchQuery("");
    }
  }, [setGlobalSearchQuery, appState.searchQuery]);

  const setSearchFilters = useCallback(
    (filters: SearchState["selectedFilters"]) => {
      setSearchState((prev) => ({
        ...prev,
        selectedFilters: filters,
        pagination: { ...prev.pagination, currentPage: 1 },
      }));
      if (project && searchState.query.trim()) {
        executeSearch(project, searchState.query, filters, 1);
      }
    },
    [project, searchState.query, executeSearch],
  );

  const setSearchPage = useCallback(
    (page: number) => {
      if (project && searchState.query.trim()) {
        executeSearch(
          project,
          searchState.query,
          searchState.selectedFilters,
          page,
        );
      } else {
        setSearchState((prev) => ({
          ...prev,
          pagination: { ...prev.pagination, currentPage: page },
        }));
      }
    },
    [project, searchState.query, searchState.selectedFilters, executeSearch],
  );

  return (
    <SearchContext.Provider
      value={{
        searchState,
        setSearchQueryFromContext,
        performSearch,
        clearSearch,
        setSearchFilters,
        setSearchPage,
        availableTags,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
};

export const useSearch = () => {
  const context = useContext(SearchContext);
  if (context === undefined) {
    throw new Error("useSearch must be used within a SearchProvider");
  }
  return context;
};

export default SearchContext;
