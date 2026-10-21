import { ID } from "./project";

export interface SearchResult {
  id: string;
  type:
    | "event"
    | "character"
    | "location"
    | "technology"
    | "culture"
    | "sourceDocument"
    | "narrative"
    | "timeline";
  title: string;
  description: string | null;
  matchType: "title" | "description" | "content" | "notes" | "tags";
  matchText: string;
  entityId: ID;
  parentId?: ID;
  date?: string | null;
  iconId?: string;
  tags?: string[];
}

export interface SearchState {
  query: string;
  results: SearchResult[];
  isSearching: boolean;
  selectedFilters: {
    types: (
      | "event"
      | "character"
      | "location"
      | "technology"
      | "culture"
      | "sourceDocument"
      | "narrative"
      | "timeline"
    )[];
    timelineIds: ID[];
    tags: string[];
  };
  pagination: {
    currentPage: number;
    resultsPerPage: number;
    totalResults: number;
  };
}
