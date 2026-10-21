import {
  ProjectType,
  TimelineType,
  EventType,
  PointOfDivergenceType,
  CharacterType,
  LocationType,
  TechnologyType,
  CultureType,
  SourceDocumentType,
  ID,
} from "./project";

export interface CreateProjectRequest {
  name: string;
  description: string;
}
export interface LoadProjectRequest {
  filePath: string;
}
export interface SaveProjectRequest {
  project: ProjectType;
  filePath?: string;
}

export interface AddTimelineRequest {
  projectId: ID;
  timeline: Omit<TimelineType, "id">;
}
export interface UpdateTimelineRequest {
  projectId: ID;
  timeline: TimelineType;
}
export interface DeleteTimelineRequest {
  projectId: ID;
  timelineId: ID;
}

export interface AddEventRequest {
  projectId: ID;
  timelineId: ID;
  event: Omit<EventType, "id">;
}
export interface UpdateEventRequest {
  projectId: ID;
  timelineId: ID;
  event: EventType;
}
export interface DeleteEventRequest {
  projectId: ID;
  timelineId: ID;
  eventId: ID;
}

export interface AddPoDRequest {
  projectId: ID;
  timelineId: ID;
  pointOfDivergence: Omit<PointOfDivergenceType, "id">;
}
export interface UpdatePoDRequest {
  projectId: ID;
  timelineId: ID;
  pointOfDivergence: PointOfDivergenceType;
}
export interface DeletePoDRequest {
  projectId: ID;
  timelineId: ID;
  podId: ID;
}

export interface AddCharacterRequest {
  projectId: ID;
  character: Omit<CharacterType, "id">;
}
export interface UpdateCharacterRequest {
  projectId: ID;
  character: CharacterType;
}
export interface DeleteCharacterRequest {
  projectId: ID;
  characterId: ID;
}

export interface AddLocationRequest {
  projectId: ID;
  location: Omit<LocationType, "id">;
}
export interface UpdateLocationRequest {
  projectId: ID;
  location: LocationType;
}
export interface DeleteLocationRequest {
  projectId: ID;
  locationId: ID;
}

export interface AddTechnologyRequest {
  projectId: ID;
  technology: Omit<TechnologyType, "id">;
}
export interface UpdateTechnologyRequest {
  projectId: ID;
  technology: TechnologyType;
}
export interface DeleteTechnologyRequest {
  projectId: ID;
  technologyId: ID;
}

export interface AddCultureRequest {
  projectId: ID;
  culture: Omit<CultureType, "id">;
}
export interface UpdateCultureRequest {
  projectId: ID;
  culture: CultureType;
}
export interface DeleteCultureRequest {
  projectId: ID;
  cultureId: ID;
}

export interface AddSourceDocumentRequest {
  projectId: ID;
  sourceDocument: Omit<SourceDocumentType, "id">;
}
export interface UpdateSourceDocumentRequest {
  projectId: ID;
  sourceDocument: SourceDocumentType;
}
export interface DeleteSourceDocumentRequest {
  projectId: ID;
  sourceDocumentId: ID;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
