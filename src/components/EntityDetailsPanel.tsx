import React, { useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { LatLngTuple } from "leaflet";
import { useProjectData } from "../contexts/ProjectDataContext";
import { useAppState } from "../contexts/AppStateContext";
import { parseCalendarDate } from "../utils/helpers";
import { StandardizedContent } from "./EntityCard";
import {
  ID,
  CharacterType,
  LocationType,
  TechnologyType,
  CultureType,
  SourceDocumentType,
  ProjectType,
  TimelineType,
  EventType,
} from "../types/project";

interface EntityDetailsPanelProps {
  entity: any | null;
  entityType: string;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return "Unknown";
  try {
    if (dateString.startsWith("-")) {
      const bcYear = Math.abs(parseInt(dateString.split("-")[1]));
      if (dateString.split("-").length > 2) {
        const dateParts = dateString.substring(1).split("-");
        const year = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]);
        const day = parseInt(dateParts[2]);
        const tempDate = new Date(0);
        tempDate.setUTCFullYear(year, month - 1, day);
        return `${tempDate.toLocaleString("default", {
          month: "short",
        })} ${day}, ${year} BCE`;
      }
      return `${bcYear} BCE`;
    }
    const date = parseCalendarDate(dateString);
    if (isNaN(date.getTime())) {
      if (/^\d{4}$/.test(dateString)) return dateString;
      if (/^\d{4}-\d{2}$/.test(dateString)) {
        const [year, month] = dateString.split("-");
        const tempDate = new Date(Number(year), Number(month) - 1);
        return tempDate.toLocaleString("default", {
          year: "numeric",
          month: "short",
        });
      }
      return "Invalid Date";
    }
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch (error) {
    return "Invalid Date";
  }
};

const LocationMapDisplay: React.FC<{ entity: LocationType }> = ({ entity }) => {
  if (
    !entity.coordinates ||
    entity.coordinates.lat == null ||
    entity.coordinates.lng == null
  ) {
    return (
      <div className="p-5 border-b border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
        No coordinates available for this location.
      </div>
    );
  }

  const position: LatLngTuple = [
    entity.coordinates.lat,
    entity.coordinates.lng,
  ];
  const mapZoom = 13;

  return (
    <div className="p-5 border-b border-gray-200 dark:border-gray-700">
      <div
        className="relative h-48 w-full rounded-lg overflow-hidden shadow-sm mb-3"
        style={{ zIndex: 1 }}
      >
        <MapContainer
          center={position}
          zoom={mapZoom}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={false}
          dragging={false}
          touchZoom={false}
          doubleClickZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={position}>
            <Popup>{entity.name}</Popup>
          </Marker>
        </MapContainer>
      </div>
      <div className="flex justify-between items-center text-sm">
        <div className="text-gray-600 dark:text-gray-300">
          <span className="font-medium">Coordinates:</span>{" "}
          {entity.coordinates.lat.toFixed(6)},{" "}
          {entity.coordinates.lng.toFixed(6)}
        </div>
        <button
          onClick={() =>
            navigator.clipboard.writeText(
              `${entity.coordinates!.lat}, ${entity.coordinates!.lng}`,
            )
          }
          className="text-blue-600 dark:text-blue-400 hover:underline text-xs"
          title="Copy coordinates"
        >
          Copy
        </button>
      </div>
      <div className="mt-2">
        <button
          onClick={() =>
            window.open(
              `https://www.openstreetmap.org/?mlat=${
                entity.coordinates!.lat
              }&mlon=${
                entity.coordinates!.lng
              }&zoom=15#map=15/${entity.coordinates!.lat}/${
                entity.coordinates!.lng
              }`,
              "_blank",
            )
          }
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center"
        >
          <svg
            className="w-3 h-3 mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
          View on OpenStreetMap
        </button>
      </div>
    </div>
  );
};

interface ImageModalProps {
  imageUrl: string;
  altText: string;
  onClose: () => void;
}

const ImageModal: React.FC<ImageModalProps> = ({
  imageUrl,
  altText,
  onClose,
}) => {
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      style={{ zIndex: 1051 }}
    >
      <div
        className="relative bg-white dark:bg-gray-900 p-4 rounded-lg shadow-xl max-w-3xl max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imageUrl}
          alt={altText}
          className="max-w-full max-h-[80vh] object-contain rounded"
        />
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-gray-800 rounded-full p-1.5 shadow-md"
          aria-label="Close image modal"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

const StyledTextContent: React.FC<{
  content: string;
  className?: string;
}> = ({ content, className = "" }) => {
  const hasHtmlTags = /<[^>]*>/g.test(content);

  if (hasHtmlTags) {
    return (
      <StandardizedContent
        content={content}
        className={`text-gray-600 dark:text-gray-300 ${className}`}
      />
    );
  } else {
    return (
      <p
        className={`text-gray-600 dark:text-gray-300 whitespace-pre-wrap ${className}`}
      >
        {content}
      </p>
    );
  }
};

const EntityDetailsPanel: React.FC<EntityDetailsPanelProps> = ({
  entity,
  entityType,
  onClose,
  onEdit,
  onDelete,
}) => {
  const { project } = useProjectData();
  const {
    setViewMode,
    setCurrentTimelineId,
    setCurrentKnowledgeBaseCategory,
    setSelectedKnowledgeBaseEntityId,
    setPendingEventToOpen, // Add this line
  } = useAppState();
  const [modalImageUrl, setModalImageUrl] = useState<string | null>(null);

  const enrichedData = useMemo(() => {
    if (!entity || !project) return null;

    const connectedEvents: any[] = [];
    const connectedEntities = {
      characters: [] as CharacterType[],
      locations: [] as LocationType[],
      technologies: [] as TechnologyType[],
      cultures: [] as CultureType[],
      sources: [] as SourceDocumentType[],
      timelines: [] as TimelineType[],
    };

    const getEntity = <T extends { id: ID }>(
      arr: T[] | undefined,
      id: ID,
    ): T | undefined => arr?.find((item) => item.id === id);

    project.timelines?.forEach((timeline) => {
      timeline.events.forEach((event) => {
        const linkChecks: {
          key: keyof EventType;
          type: keyof ProjectType;
          arr: any[];
          getter: (id: ID) => any;
        }[] = [
          {
            key: "linkedCharacterIds",
            type: "characters",
            arr: connectedEntities.characters,
            getter: (id) => getEntity(project.characters, id),
          },
          {
            key: "linkedLocationIds",
            type: "locations",
            arr: connectedEntities.locations,
            getter: (id) => getEntity(project.locations, id),
          },
          {
            key: "linkedTechnologyIds",
            type: "technologies",
            arr: connectedEntities.technologies,
            getter: (id) => getEntity(project.technologies, id),
          },
          {
            key: "linkedCultureIds",
            type: "cultures",
            arr: connectedEntities.cultures,
            getter: (id) => getEntity(project.cultures, id),
          },
          {
            key: "linkedSourceDocumentIds",
            type: "sources",
            arr: connectedEntities.sources,
            getter: (id) => getEntity(project.sources, id),
          },
        ];

        let eventIsLinked = false;
        linkChecks.forEach((check) => {
          const linkedIds = event[check.key] as ID[] | undefined;
          if (linkedIds?.includes(entity.id)) {
            eventIsLinked = true;
          }
        });

        if (eventIsLinked) {
          if (!connectedEvents.find((ce) => ce.id === event.id)) {
            connectedEvents.push({
              ...event,
              timelineName: timeline.name,
              timelineId: timeline.id,
              timelineColor: timeline.color,
            });
          }
          linkChecks.forEach((check) => {
            (event[check.key] as ID[] | undefined)?.forEach((id) => {
              if (id !== entity.id) {
                const related = check.getter(id);
                if (related && !check.arr.find((item) => item.id === id)) {
                  check.arr.push(related);
                }
              }
            });
          });
        }

        if (
          entity.timelineIds?.includes(timeline.id) &&
          !connectedEntities.timelines.find((t) => t.id === timeline.id)
        ) {
          connectedEntities.timelines.push(timeline);
        }
      });
    });

    // Fix for relatedCharacterIds - it's an object, not an array
    if (entityType === "character" && entity.relatedCharacterIds) {
      // relatedCharacterIds is Record<string, ID[]>
      Object.entries(entity.relatedCharacterIds).forEach(
        ([relationshipType, characterIds]) => {
          if (Array.isArray(characterIds)) {
            characterIds.forEach((id: ID) => {
              const char = getEntity(project.characters, id);
              if (
                char &&
                !connectedEntities.characters.some((c) => c.id === id)
              )
                connectedEntities.characters.push(char);
            });
          }
        },
      );
    }

    if (entityType === "character" && entity.locations) {
      entity.locations.forEach((locId: ID) => {
        const loc = getEntity(project.locations, locId);
        if (loc && !connectedEntities.locations.some((l) => l.id === locId))
          connectedEntities.locations.push(loc);
      });
    }

    if (entityType === "location" && entity.parentLocationId) {
      const parentLoc = getEntity(project.locations, entity.parentLocationId);
      if (
        parentLoc &&
        !connectedEntities.locations.some((l) => l.id === parentLoc.id)
      )
        connectedEntities.locations.push(parentLoc);
    }
    if (entityType === "location") {
      project.locations?.forEach((loc) => {
        if (
          loc.parentLocationId === entity.id &&
          !connectedEntities.locations.some((l) => l.id === loc.id)
        )
          connectedEntities.locations.push(loc);
      });
    }

    connectedEvents.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    const entitySpecificInfo = {
      lifespan:
        entityType === "character" && (entity.birthDate || entity.deathDate)
          ? {
              birth: formatDate(entity.birthDate),
              death: formatDate(entity.deathDate),
            }
          : null,
      traits: entityType === "character" && entity.traits ? entity.traits : [],
    };

    return {
      events: connectedEvents,
      entities: connectedEntities,
      timelineCount: new Set(
        connectedEvents
          .map((e) => e.timelineId)
          .concat(entity.timelineIds || []),
      ).size,
      entitySpecificInfo,
    };
  }, [entity, entityType, project]);

  const linkedTasks = useMemo(() => {
    if (!entity || !Array.isArray(project?.tasks)) return [];
    return project.tasks.filter((task) =>
      (task.linkedEntityIds || []).includes(entity.id),
    );
  }, [entity, project?.tasks]);

  const taskStatusLabel: Record<string, string> = {
    todo: "To do",
    doing: "In progress",
    blocked: "Blocked",
    done: "Done",
  };

  // Updated handleEventClick function
  const handleEventClick = (event: any) => {
    setViewMode("timeline");
    setCurrentTimelineId(event.timelineId);
    // Set the event to be opened after timeline loads
    setPendingEventToOpen(event);
  };

  const handleRelatedEntityClick = (relatedEntity: any, typeKey: string) => {
    const category = typeKey as any;
    setCurrentKnowledgeBaseCategory(category);
    setSelectedKnowledgeBaseEntityId(relatedEntity.id);
    setViewMode("knowledge-base");
  };

  // FIX: This function now correctly checks for the singular "source" type as well.
  const getEntityDisplayName = (ent: any, typeKey: string) => {
    if (
      typeKey === "source" ||
      typeKey === "sources" ||
      typeKey === "sources"
    ) {
      return ent.title || "Untitled Source";
    }
    return ent.name || "Unnamed Entity";
  };

  const openImageModal = (imageUrl: string) => setModalImageUrl(imageUrl);
  const closeImageModal = () => setModalImageUrl(null);

  if (!entity || !enrichedData) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700">
        <div className="text-center max-w-xs">
          <svg
            className="w-12 h-12 mx-auto mb-4 text-gray-400 dark:text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-gray-500 dark:text-gray-400">
            {entity ? "Loading details..." : "Select an item"}
          </p>
        </div>
      </div>
    );
  }

  const entityImageUrl = entity.image || entity.imageUrl || entity.imagePath;

  return (
    <>
      <div
        className="absolute right-0 top-0 bottom-0 w-96 overflow-y-auto bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700"
        style={{ zIndex: 10 }}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                {getEntityDisplayName(entity, entityType)}
              </h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {enrichedData && (
                  <>
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      {enrichedData.events.length} events
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      {enrichedData.timelineCount} timelines
                    </span>
                  </>
                )}
                {entity.isHistorical && (
                  <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200">
                    Historical
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={onEdit}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 p-1"
                title="Edit"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
              <button
                onClick={onDelete}
                className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-500 p-1"
                title="Delete"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 p-1"
                title="Close"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
          {entity.description && (
            <div className="text-sm">
              <StyledTextContent content={entity.description} />
            </div>
          )}
        </div>

        {entityImageUrl && (
          <div className="p-5 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <img
                src={entityImageUrl}
                alt={getEntityDisplayName(entity, entityType)}
                className="w-full h-48 object-cover rounded-lg shadow-sm cursor-pointer"
                onClick={() => openImageModal(entityImageUrl)}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent rounded-lg flex items-end pointer-events-none">
                <div className="p-4 text-white">
                  <p className="text-sm font-medium">
                    {getEntityDisplayName(entity, entityType)}
                  </p>
                  {entity.imageCaption && (
                    <p className="text-xs opacity-90 mt-1">
                      {entity.imageCaption}
                    </p>
                  )}
                </div>
              </div>
            </div>
            {entity.imageSource && (
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Image source: {entity.imageSource}
              </div>
            )}
          </div>
        )}

        {entityType === "location" && (
          <LocationMapDisplay entity={entity as LocationType} />
        )}

        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Details
          </h4>
          <div className="space-y-3">
            {entityType === "character" &&
              enrichedData?.entitySpecificInfo.lifespan &&
              (enrichedData.entitySpecificInfo.lifespan.birth !== "Unknown" ||
                enrichedData.entitySpecificInfo.lifespan.death !==
                  "Unknown") && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {enrichedData.entitySpecificInfo.lifespan.birth !==
                    "Unknown" && (
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Birth</p>
                      <p className="font-medium text-gray-800 dark:text-gray-200">
                        {enrichedData.entitySpecificInfo.lifespan.birth}
                      </p>
                    </div>
                  )}
                  {enrichedData.entitySpecificInfo.lifespan.death !==
                    "Unknown" && (
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Death</p>
                      <p className="font-medium text-gray-800 dark:text-gray-200">
                        {enrichedData.entitySpecificInfo.lifespan.death}
                      </p>
                    </div>
                  )}
                </div>
              )}
            {entityType === "character" && entity.background && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                  Background
                </p>
                <StyledTextContent
                  content={entity.background}
                  className="text-sm"
                />
              </div>
            )}
            {entityType === "character" && entity.motivation && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                  Motivation
                </p>
                <StyledTextContent
                  content={entity.motivation}
                  className="text-sm"
                />
              </div>
            )}
            {entityType === "character" &&
              enrichedData?.entitySpecificInfo.traits?.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    Traits
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {enrichedData.entitySpecificInfo.traits.map(
                      (trait: string, index: number) => (
                        <span
                          key={index}
                          className="text-xs px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
                        >
                          {trait}
                        </span>
                      ),
                    )}
                  </div>
                </div>
              )}
            {entity.notes && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                  Notes
                </p>
                <StyledTextContent content={entity.notes} className="text-sm" />
              </div>
            )}
          </div>
        </div>

        {enrichedData && (
          <div className="p-5 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Connections
            </h4>
            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
              <p>Events: {enrichedData.events.length}</p>
              <p>Timelines: {enrichedData.timelineCount}</p>
              <p>
                Related Characters:{" "}
                {
                  enrichedData.entities.characters.filter(
                    (c) => c.id !== entity.id,
                  ).length
                }
              </p>
              <p>
                Related Locations:{" "}
                {
                  enrichedData.entities.locations.filter(
                    (l) => l.id !== entity.id,
                  ).length
                }
              </p>
            </div>
          </div>
        )}

        {linkedTasks.length > 0 && (
          <div className="p-5 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Linked Tasks ({linkedTasks.length})
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {linkedTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => setViewMode("tasks")}
                  className="w-full rounded-md bg-gray-50 dark:bg-gray-700 p-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200">
                      {taskStatusLabel[task.status] || task.status}
                    </span>
                    <span className="truncate text-xs font-medium text-gray-800 dark:text-gray-200">
                      {task.title}
                    </span>
                  </div>
                  {task.due && (
                    <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                      Due {task.due}
                      {task.dueEnd && task.dueEnd !== task.due
                        ? ` – ${task.dueEnd}`
                        : ""}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {enrichedData?.events?.length > 0 && (
          <div className="p-5 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Connected Events
            </h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {enrichedData.events.map((event) => (
                <div
                  key={event.id}
                  className="p-2 bg-gray-50 dark:bg-gray-700 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  onClick={() => handleEventClick(event)}
                >
                  <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                    {event.title}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(event.date)} - On: {event.timelineName}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {Object.keys(enrichedData.entities).map((typeKey) => {
          const items =
            enrichedData.entities[
              typeKey as keyof typeof enrichedData.entities
            ] || [];
          const filteredItems = items.filter((item) => item.id !== entity.id);
          if (filteredItems.length === 0) return null;

          return (
            <div
              key={typeKey}
              className="p-5 border-b border-gray-200 dark:border-gray-700"
            >
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Related {typeKey.charAt(0).toUpperCase() + typeKey.slice(1)} (
                {filteredItems.length})
              </h4>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {filteredItems.map((item: any) => (
                  <div
                    key={item.id}
                    className="text-xs p-1.5 bg-gray-50 dark:bg-gray-700 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => handleRelatedEntityClick(item, typeKey)}
                  >
                    {getEntityDisplayName(item, typeKey)}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {modalImageUrl && (
        <ImageModal
          imageUrl={modalImageUrl}
          altText={`Enlarged view of ${getEntityDisplayName(
            entity,
            entityType,
          )}`}
          onClose={closeImageModal}
        />
      )}
    </>
  );
};

export default EntityDetailsPanel;
