import React, { useState, useEffect, useRef } from "react";
import { EventType, ID } from "../../types";
import { useProjectData } from "../../contexts/ProjectDataContext";
import { parseCalendarDate } from "../../utils/helpers";

interface EventRelationshipSankeyProps {
  timelineId: ID | null;
  height?: number;
  width?: number;
  onEventClick?: (event: EventType) => void;
  onEntityClick?: (entityType: string, entityId: ID) => void;
  disableFormPopup?: boolean;
}

const EventRelationshipSankey: React.FC<EventRelationshipSankeyProps> = ({
  timelineId,
  onEventClick,
  onEntityClick,
}) => {
  const {
    project,
    getCharacterById,
    getLocationById,
    getTechnologyById,
    getCultureById,
  } = useProjectData();

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const setupCompletedRef = useRef<boolean>(false);
  const [selectedItem, setSelectedItem] = useState<{
    id: string;
    type: string;
  } | null>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  // Find the current timeline and its events
  const timeline = project?.timelines.find((t) => t.id === timelineId);
  const events = timeline?.events || [];

  // Helper to get color for different entity types
  const getColor = (type: string) => {
    switch (type) {
      case "event":
        return "#3b82f6"; // blue
      case "character":
        return "#10b981"; // green
      case "location":
        return "#f59e0b"; // amber
      case "technology":
        return "#8b5cf6"; // purple
      case "culture":
        return "#ec4899"; // pink
      case "source":
        return "#64748b"; // slate
      default:
        return "#6b7280"; // gray
    }
  };

  // Helper to get ring color class for an entity type
  const getRingColorClass = (type: string) => {
    switch (type) {
      case "event":
        return ["ring-blue-500", "dark:ring-blue-400"];
      case "character":
        return ["ring-green-500", "dark:ring-green-400"];
      case "location":
        return ["ring-amber-500", "dark:ring-amber-400"];
      case "technology":
        return ["ring-purple-500", "dark:ring-purple-400"];
      case "culture":
        return ["ring-pink-500", "dark:ring-pink-400"];
      default:
        return ["ring-gray-500", "dark:ring-gray-400"];
    }
  };

  // Initialize the visualization only once per timeline change
  useEffect(() => {
    if (!containerRef.current || !events.length) return;
    if (setupCompletedRef.current && timelineId) return;

    setupCompletedRef.current = false;
    setSelectedItem(null);
    setActiveFilters([]);

    setupVisualization();

    return () => {
      setupCompletedRef.current = false;
    };
  }, [timelineId, events.length]);

  // Function to setup the visualization structure
  const setupVisualization = () => {
    if (!containerRef.current) return;

    // Clear previous content
    const container = containerRef.current;
    container.innerHTML = "";

    // Define types for internal data structure
    type EntityTypeLiteral =
      | "character"
      | "location"
      | "technology"
      | "culture";
    // Ensure ID is imported or defined appropriately (e.g., from '../../types')
    // type ID = string | number; // Example definition if not imported

    // Create data structure to track all entities and connections
    type EntityInfo = {
      id: string;
      name: string;
      type: string;
      data: any;
      relatedEvents: string[];
    };

    const entitiesMap: Record<string, EntityInfo> = {};

    // Process events and build relationship maps
    events.forEach((event) => {
      // Process characters
      (event.linkedCharacterIds || []).forEach((id) => {
        const character = getCharacterById(id);
        if (character) {
          if (!entitiesMap[`character-${id}`]) {
            entitiesMap[`character-${id}`] = {
              id,
              name: character.name,
              type: "character",
              data: character,
              relatedEvents: [event.id],
            };
          } else if (
            !entitiesMap[`character-${id}`].relatedEvents.includes(event.id)
          ) {
            entitiesMap[`character-${id}`].relatedEvents.push(event.id);
          }
        }
      });

      // Process locations
      (event.linkedLocationIds || []).forEach((id) => {
        const location = getLocationById(id);
        if (location) {
          if (!entitiesMap[`location-${id}`]) {
            entitiesMap[`location-${id}`] = {
              id,
              name: location.name,
              type: "location",
              data: location,
              relatedEvents: [event.id],
            };
          } else if (
            !entitiesMap[`location-${id}`].relatedEvents.includes(event.id)
          ) {
            entitiesMap[`location-${id}`].relatedEvents.push(event.id);
          }
        }
      });

      // Process technologies
      (event.linkedTechnologyIds || []).forEach((id) => {
        const technology = getTechnologyById(id);
        if (technology) {
          if (!entitiesMap[`technology-${id}`]) {
            entitiesMap[`technology-${id}`] = {
              id,
              name: technology.name,
              type: "technology",
              data: technology,
              relatedEvents: [event.id],
            };
          } else if (
            !entitiesMap[`technology-${id}`].relatedEvents.includes(event.id)
          ) {
            entitiesMap[`technology-${id}`].relatedEvents.push(event.id);
          }
        }
      });

      // Process cultures
      (event.linkedCultureIds || []).forEach((id) => {
        const culture = getCultureById(id);
        if (culture) {
          if (!entitiesMap[`culture-${id}`]) {
            entitiesMap[`culture-${id}`] = {
              id,
              name: culture.name,
              type: "culture",
              data: culture,
              relatedEvents: [event.id],
            };
          } else if (
            !entitiesMap[`culture-${id}`].relatedEvents.includes(event.id)
          ) {
            entitiesMap[`culture-${id}`].relatedEvents.push(event.id);
          }
        }
      });
    });

    // Group entities by type
    const characterEntities = Object.values(entitiesMap).filter(
      (e) => e.type === "character",
    );
    const locationEntities = Object.values(entitiesMap).filter(
      (e) => e.type === "location",
    );
    const technologyEntities = Object.values(entitiesMap).filter(
      (e) => e.type === "technology",
    );
    const cultureEntities = Object.values(entitiesMap).filter(
      (e) => e.type === "culture",
    );

    // Create the main structure
    const sankeyContainer = document.createElement("div");
    sankeyContainer.className = "sankey-container flex flex-col h-full";
    container.appendChild(sankeyContainer);

    // Create header with legend
    const header = document.createElement("div");
    header.className =
      "p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center";

    // Create legend items with clickable functionality and reset button
    const legendHTML = `
      <div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">Event Relationships</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400">Visualizing connections between events and entities</p>
      </div>
      <div class="flex items-center space-x-4">
        <div class="flex items-center space-x-2 text-xs" id="legend-container">
          <div class="legend-item flex items-center cursor-pointer" data-type="event">
            <span class="w-3 h-3 rounded-full bg-blue-500 mr-1"></span>
            <span class="text-gray-600 dark:text-gray-300 mr-2">Events (${events.length})</span>
          </div>

          <div class="legend-item flex items-center cursor-pointer" data-type="character">
            <span class="w-3 h-3 rounded-full bg-green-500 mr-1"></span>
            <span class="text-gray-600 dark:text-gray-300 mr-2">Characters (${characterEntities.length})</span>
          </div>

          <div class="legend-item flex items-center cursor-pointer" data-type="location">
            <span class="w-3 h-3 rounded-full bg-amber-500 mr-1"></span>
            <span class="text-gray-600 dark:text-gray-300 mr-2">Locations (${locationEntities.length})</span>
          </div>

          <div class="legend-item flex items-center cursor-pointer" data-type="technology">
            <span class="w-3 h-3 rounded-full bg-purple-500 mr-1"></span>
            <span class="text-gray-600 dark:text-gray-300 mr-2">Technologies (${technologyEntities.length})</span>
          </div>

          <div class="legend-item flex items-center cursor-pointer" data-type="culture">
            <span class="w-3 h-3 rounded-full bg-pink-500 mr-1"></span>
            <span class="text-gray-600 dark:text-gray-300">Cultures (${cultureEntities.length})</span>
          </div>
        </div>
        <button id="reset-selection" class="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded">
          Reset View
        </button>
      </div>
    `;

    header.innerHTML = legendHTML;
    sankeyContainer.appendChild(header);

    // Add reset button functionality
    const resetButton = header.querySelector("#reset-selection");
    resetButton?.addEventListener("click", (e) => {
      e.stopPropagation();
      setSelectedItem(null);
      setActiveFilters([]);

      // Reset legend items to inactive state
      const legendItems = header.querySelectorAll(".legend-item");
      legendItems.forEach((item) => {
        item.classList.remove("active");
        (item as HTMLElement).style.opacity = "1";
        (item as HTMLElement).style.fontWeight = "normal";
      });
    });

    // Add legend functionality
    const legendItems = header.querySelectorAll(".legend-item");

    legendItems.forEach((item) => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        const type = (item as HTMLElement).dataset.type;
        if (!type) return;

        // Toggle active class
        item.classList.toggle("active");

        // Update filters
        setActiveFilters((prev) => {
          if (prev.includes(type)) {
            return prev.filter((t) => t !== type);
          } else {
            return [...prev, type];
          }
        });

        // Apply visual feedback
        if (item.classList.contains("active")) {
          (item as HTMLElement).style.opacity = "1";
          (item as HTMLElement).style.fontWeight = "bold";
        } else {
          (item as HTMLElement).style.opacity = "0.7";
          (item as HTMLElement).style.fontWeight = "normal";
        }
      });

      // Set initial styles
      (item as HTMLElement).style.transition =
        "opacity 0.2s ease-in-out, font-weight 0.2s ease-in-out";
    });

    // Create main content area with three columns
    const contentArea = document.createElement("div");
    contentArea.className = "flex-1 overflow-auto grid grid-cols-3 gap-4 p-4";
    sankeyContainer.appendChild(contentArea);

    // Add click handler to content area for reset functionality
    contentArea.addEventListener("click", (e) => {
      // Only reset if the click target is the content area itself or the connections column
      if (
        e.target === contentArea ||
        (e.target as HTMLElement).closest(".connections-column") === e.target ||
        (e.target as HTMLElement).id === "connection-indicator"
      ) {
        setSelectedItem(null);
      }
    });

    // Create the three columns
    const eventsColumn = document.createElement("div");
    eventsColumn.className = "col-span-1 flex flex-col gap-4";
    eventsColumn.innerHTML = `<h3 class="text-base font-medium">Events (${events.length})</h3>`;
    contentArea.appendChild(eventsColumn);

    const connectionsColumn = document.createElement("div");
    connectionsColumn.className =
      "connections-column relative col-span-1 border-l border-r border-gray-200 dark:border-gray-700 px-4 flex items-center justify-center";
    contentArea.appendChild(connectionsColumn);

    const entitiesColumn = document.createElement("div");
    entitiesColumn.className = "col-span-1 flex flex-col gap-4";
    contentArea.appendChild(entitiesColumn);

    // Setup entities sections
    const characterSection = document.createElement("div");
    characterSection.className = "mb-6";
    characterSection.innerHTML = `<h3 class="text-base font-medium mb-3">Characters (${characterEntities.length})</h3>`;
    entitiesColumn.appendChild(characterSection);

    const charactersContainer = document.createElement("div");
    charactersContainer.className = "flex flex-col gap-2";
    characterSection.appendChild(charactersContainer);

    const locationSection = document.createElement("div");
    locationSection.className = "mb-6";
    locationSection.innerHTML = `<h3 class="text-base font-medium mb-3">Locations (${locationEntities.length})</h3>`;
    entitiesColumn.appendChild(locationSection);

    const locationsContainer = document.createElement("div");
    locationsContainer.className = "flex flex-col gap-2";
    locationSection.appendChild(locationsContainer);

    const technologySection = document.createElement("div");
    technologySection.className = "mb-6";
    technologySection.innerHTML = `<h3 class="text-base font-medium mb-3">Technologies (${technologyEntities.length})</h3>`;
    entitiesColumn.appendChild(technologySection);

    const technologiesContainer = document.createElement("div");
    technologiesContainer.className = "flex flex-col gap-2";
    technologySection.appendChild(technologiesContainer);

    const cultureSection = document.createElement("div");
    cultureSection.className = "mb-6";
    cultureSection.innerHTML = `<h3 class="text-base font-medium mb-3">Cultures (${cultureEntities.length})</h3>`;
    entitiesColumn.appendChild(cultureSection);

    const culturesContainer = document.createElement("div");
    culturesContainer.className = "flex flex-col gap-2";
    cultureSection.appendChild(culturesContainer);

    // Create SVG for connections
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.style.position = "absolute";
    svg.style.top = "0";
    svg.style.left = "0";
    svg.style.pointerEvents = "none";
    connectionsColumn.appendChild(svg);
    svgRef.current = svg;

    // Connection indicator text
    const connectionIndicator = document.createElement("div");
    connectionIndicator.className =
      "text-center text-gray-500 dark:text-gray-400 text-sm cursor-pointer";
    connectionIndicator.textContent = "Click an item to see connections";
    connectionIndicator.id = "connection-indicator";
    connectionsColumn.appendChild(connectionIndicator);

    // Create event cards
    events.forEach((event) => {
      const eventCard = document.createElement("div");
      eventCard.className =
        "event-card bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 rounded-md shadow-sm hover:shadow-md transition-shadow cursor-pointer";
      eventCard.style.borderLeftWidth = "4px";
      eventCard.style.borderLeftColor = getColor("event");
      eventCard.dataset.eventId = event.id;
      eventCard.id = `event-${event.id}`;

      const dateObj = parseCalendarDate(event.date);
      const formattedDate = dateObj.toLocaleDateString();

      eventCard.innerHTML = `
          <div class="flex justify-between items-start">
            <h4 class="font-medium text-gray-900 dark:text-white">${event.title}</h4>
            ${
              event.isPointOfDivergence
                ? '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:bg-opacity-50 dark:text-red-200">PoD</span>'
                : ""
            }
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">${formattedDate}</p>
          ${
            event.description
              ? `<p class="text-sm text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">${event.description}</p>`
              : ""
          }
          <div class="mt-2 flex flex-wrap gap-1">
            ${
              event.linkedCharacterIds?.length
                ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:bg-opacity-50 dark:text-green-200">${event.linkedCharacterIds.length} characters</span>`
                : ""
            }
            ${
              event.linkedLocationIds?.length
                ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900 dark:bg-opacity-50 dark:text-amber-200">${event.linkedLocationIds.length} locations</span>`
                : ""
            }
            ${
              event.linkedTechnologyIds?.length
                ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:bg-opacity-50 dark:text-purple-200">${event.linkedTechnologyIds.length} technologies</span>`
                : ""
            }
            ${
              event.linkedCultureIds?.length
                ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-pink-100 text-pink-800 dark:bg-pink-900 dark:bg-opacity-50 dark:text-pink-200">${event.linkedCultureIds.length} cultures</span>`
                : ""
            }
          </div>
          <div class="action-controls mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 ${selectedItem?.id === event.id && selectedItem?.type === "event" ? "" : "hidden"}">
            <div class="flex gap-2">

              <button class="edit-event-btn text-xs text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 px-2 py-1 rounded bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700">
                Edit Event
              </button>
            </div>
          </div>
        `;

      // Handle card click for selection
      eventCard.addEventListener("click", (e) => {
        e.stopPropagation();

        // Check if click was on action buttons
        if ((e.target as HTMLElement).closest(".edit-event-btn")) {
          if (onEventClick) onEventClick(event);
          return;
        }

        if ((e.target as HTMLElement).closest(".view-event-btn")) {
          // TODO: Implement view event functionality
          console.log("View event details:", event);
          return;
        }

        // Handle selection
        setSelectedItem({ id: event.id, type: "event" });
      });

      eventsColumn.appendChild(eventCard);
    });

    // Create entity cards
    const createEntityCard = (
      entity: EntityInfo,
      container: HTMLElement,
      type: EntityTypeLiteral,
    ) => {
      const entityCard = document.createElement("div");
      entityCard.className =
        "entity-card bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 rounded-md shadow-sm hover:shadow-md transition-shadow cursor-pointer";
      entityCard.style.borderLeftWidth = "4px";
      entityCard.style.borderLeftColor = getColor(type);
      // Ensure entity.id is a string for dataset and id attributes
      entityCard.dataset.entityId = String(entity.id);
      entityCard.dataset.entityType = type;
      entityCard.id = `${type}-${String(entity.id)}`;

      // Generate card content
      entityCard.innerHTML = `
        <h4 class="font-medium text-gray-900 dark:text-white">${entity.name}</h4>
        ${
          entity.data.description
            ? `<p class="text-sm text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">${entity.data.description}</p>`
            : ""
        }
        <div class="mt-2">
          <span class="text-xs text-gray-500 dark:text-gray-400">Connected to ${entity.relatedEvents.length} events</span>
        </div>
        <div class="action-controls mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 ${selectedItem?.id === entity.id && selectedItem?.type === type ? "" : "hidden"}">
          <div class="flex gap-2">

            <button class="edit-entity-btn text-xs text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 px-2 py-1 rounded bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700">
              Edit ${type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          </div>
        </div>
      `;

      // Handle card click for selection and actions
      entityCard.addEventListener("click", (e) => {
        e.stopPropagation();

        // Check if click was on action buttons
        if ((e.target as HTMLElement).closest(".edit-entity-btn")) {
          if (onEntityClick) onEntityClick(type, entity.id);
          return;
        }

        if ((e.target as HTMLElement).closest(".view-entity-btn")) {
          // TODO: Implement view entity functionality
          console.log(`View ${type} details:`, entity);
          return;
        }

        // Handle selection
        setSelectedItem({ id: entity.id, type });
      });

      container.appendChild(entityCard);
    };

    // Create entity cards for each type
    characterEntities.forEach((entity) => {
      createEntityCard(entity, charactersContainer, "character");
    });

    locationEntities.forEach((entity) => {
      createEntityCard(entity, locationsContainer, "location");
    });

    technologyEntities.forEach((entity) => {
      createEntityCard(entity, technologiesContainer, "technology");
    });

    cultureEntities.forEach((entity) => {
      createEntityCard(entity, culturesContainer, "culture");
    });

    // Handle empty sections
    [
      { entities: characterEntities, container: charactersContainer },
      { entities: locationEntities, container: locationsContainer },
      { entities: technologyEntities, container: technologiesContainer },
      { entities: cultureEntities, container: culturesContainer },
    ].forEach(({ entities, container }) => {
      if (entities.length === 0) {
        const emptyMessage = document.createElement("div");
        emptyMessage.className =
          "text-gray-500 dark:text-gray-400 text-sm italic";
        emptyMessage.textContent = "None found in this timeline";
        container.appendChild(emptyMessage);
      }
    });

    // Handle empty events
    if (events.length === 0) {
      const emptyMessage = document.createElement("div");
      emptyMessage.className =
        "text-gray-500 dark:text-gray-400 text-center py-10";
      emptyMessage.textContent = "No events found in this timeline";
      eventsColumn.appendChild(emptyMessage);
    }

    // Mark setup as completed for this timeline
    setupCompletedRef.current = true;
  };

  // Watch for active filters changes and update visibility
  useEffect(() => {
    if (!containerRef.current) return;

    // Update all elements based on active filters
    const updateElements = () => {
      const allCards = containerRef.current?.querySelectorAll(
        ".event-card, .entity-card",
      );

      // If no filters and no selection, show everything
      if (activeFilters.length === 0 && !selectedItem) {
        allCards?.forEach((card) => {
          (card as HTMLElement).style.opacity = "1";
          (card as HTMLElement).style.display = "block";
        });
        return;
      }

      // If there's a selected item, we handle visibility differently
      if (selectedItem) {
        handleSelectedItemVisibility();
        return;
      }

      // Show/hide based on filters only (no selection)
      allCards?.forEach((card) => {
        let shouldShow = false;

        // For event cards
        if (card.classList.contains("event-card")) {
          if (activeFilters.includes("event")) {
            shouldShow = true;
          } else {
            // Check if event has connections to any active entity types
            const eventId = (card as HTMLElement).dataset.eventId;
            if (eventId) {
              const event = events.find((e) => e.id === eventId);

              if (event) {
                if (
                  activeFilters.includes("character") &&
                  (event.linkedCharacterIds?.length || 0) > 0
                ) {
                  shouldShow = true;
                }
                if (
                  activeFilters.includes("location") &&
                  (event.linkedLocationIds?.length || 0) > 0
                ) {
                  shouldShow = true;
                }
                if (
                  activeFilters.includes("technology") &&
                  (event.linkedTechnologyIds?.length || 0) > 0
                ) {
                  shouldShow = true;
                }
                if (
                  activeFilters.includes("culture") &&
                  (event.linkedCultureIds?.length || 0) > 0
                ) {
                  shouldShow = true;
                }
              }
            }
          }
        }
        // For entity cards
        else if (card.classList.contains("entity-card")) {
          const type = (card as HTMLElement).dataset.entityType;
          if (type && activeFilters.includes(type)) {
            shouldShow = true;
          }
        }

        (card as HTMLElement).style.display = shouldShow ? "block" : "none";
      });
    };

    updateElements();
  }, [activeFilters, selectedItem, events]);

  // Handle selection state changes and display connections
  useEffect(() => {
    if (!containerRef.current || !svgRef.current) return;

    // Clear all highlights first
    const allCards = containerRef.current.querySelectorAll(
      ".event-card, .entity-card",
    );
    allCards.forEach((card) => {
      // Remove all possible ring classes
      const ringClasses = [
        "ring-2",
        "ring-blue-500",
        "dark:ring-blue-400",
        "ring-green-500",
        "dark:ring-green-400",
        "ring-amber-500",
        "dark:ring-amber-400",
        "ring-purple-500",
        "dark:ring-purple-400",
        "ring-pink-500",
        "dark:ring-pink-400",
      ];
      card.classList.remove(...ringClasses);

      // Hide action controls for all cards
      const controls = card.querySelector(".action-controls");
      if (controls) {
        controls.classList.add("hidden");
      }
    });

    // Clear SVG
    if (svgRef.current) {
      svgRef.current.innerHTML = "";
    }

    // Show/hide the indicator based on selection
    const indicator = containerRef.current.querySelector(
      "#connection-indicator",
    ) as HTMLElement;
    if (indicator) {
      indicator.style.display = selectedItem ? "none" : "block";
    }

    // If no selection, ensure all items are visible (subject to filters)
    if (!selectedItem) {
      handleSelectedItemVisibility();
      return;
    }

    // Find the selected element and show its action controls
    const selectedElement = containerRef.current.querySelector(
      `#${selectedItem.type}-${selectedItem.id}`,
    );
    if (selectedElement) {
      const controls = selectedElement.querySelector(".action-controls");
      if (controls) {
        controls.classList.remove("hidden");
      }
    }

    // Find the selected element
    handleSelectedItemVisibility();
  }, [selectedItem, events]);

  // Helper function to handle visibility when an item is selected
  const handleSelectedItemVisibility = () => {
    if (!containerRef.current || !svgRef.current) return;

    const allCards = containerRef.current.querySelectorAll(
      ".event-card, .entity-card",
    );

    // If no selection, handle based only on filters
    if (!selectedItem) {
      // If there are active filters, those are already handled in the filter effect
      if (activeFilters.length === 0) {
        // If no filters, show everything
        allCards.forEach((card) => {
          (card as HTMLElement).style.display = "block";
          (card as HTMLElement).style.opacity = "1";
        });
      }
      return;
    }

    // First, hide all cards by default (we'll show only connected ones)
    allCards.forEach((card) => {
      (card as HTMLElement).style.display = "none";
      (card as HTMLElement).style.opacity = "0.5";
    });

    let selectedElement: Element | null = null;
    const connectedElements: { element: Element; type: string }[] = [];

    // Find selected element based on type
    if (selectedItem.type === "event") {
      selectedElement = containerRef.current.querySelector(
        `#event-${selectedItem.id}`,
      );
      if (selectedElement) {
        (selectedElement as HTMLElement).style.display = "block";
        (selectedElement as HTMLElement).style.opacity = "1";
        const ringClasses = getRingColorClass("event");
        selectedElement.classList.add("ring-2", ...ringClasses);

        // Find connected entities
        const event = events.find((e) => e.id === selectedItem.id);
        if (event) {
          // Process characters
          (event.linkedCharacterIds || []).forEach((id) => {
            const el = containerRef.current?.querySelector(`#character-${id}`);
            if (el) {
              (el as HTMLElement).style.display = "block";
              (el as HTMLElement).style.opacity = "1";
              const ringClasses = getRingColorClass("character");
              el.classList.add("ring-2", ...ringClasses);
              connectedElements.push({ element: el, type: "character" });
            }
          });

          // Process locations
          (event.linkedLocationIds || []).forEach((id) => {
            const el = containerRef.current?.querySelector(`#location-${id}`);
            if (el) {
              (el as HTMLElement).style.display = "block";
              (el as HTMLElement).style.opacity = "1";
              const ringClasses = getRingColorClass("location");
              el.classList.add("ring-2", ...ringClasses);
              connectedElements.push({ element: el, type: "location" });
            }
          });

          // Process technologies
          (event.linkedTechnologyIds || []).forEach((id) => {
            const el = containerRef.current?.querySelector(`#technology-${id}`);
            if (el) {
              (el as HTMLElement).style.display = "block";
              (el as HTMLElement).style.opacity = "1";
              const ringClasses = getRingColorClass("technology");
              el.classList.add("ring-2", ...ringClasses);
              connectedElements.push({ element: el, type: "technology" });
            }
          });

          // Process cultures
          (event.linkedCultureIds || []).forEach((id) => {
            const el = containerRef.current?.querySelector(`#culture-${id}`);
            if (el) {
              (el as HTMLElement).style.display = "block";
              (el as HTMLElement).style.opacity = "1";
              const ringClasses = getRingColorClass("culture");
              el.classList.add("ring-2", ...ringClasses);
              connectedElements.push({ element: el, type: "culture" });
            }
          });
        }
      }
    } else {
      // For entity selection
      selectedElement = containerRef.current.querySelector(
        `#${selectedItem.type}-${selectedItem.id}`,
      );
      if (selectedElement) {
        (selectedElement as HTMLElement).style.display = "block";
        (selectedElement as HTMLElement).style.opacity = "1";

        // Apply ring color matching the entity type
        const ringClasses = getRingColorClass(selectedItem.type);
        selectedElement.classList.add("ring-2", ...ringClasses);

        // Find connected events
        events.forEach((event) => {
          let isConnected = false;

          if (
            selectedItem.type === "character" &&
            (event.linkedCharacterIds || []).includes(selectedItem.id)
          ) {
            isConnected = true;
          } else if (
            selectedItem.type === "location" &&
            (event.linkedLocationIds || []).includes(selectedItem.id)
          ) {
            isConnected = true;
          } else if (
            selectedItem.type === "technology" &&
            (event.linkedTechnologyIds || []).includes(selectedItem.id)
          ) {
            isConnected = true;
          } else if (
            selectedItem.type === "culture" &&
            (event.linkedCultureIds || []).includes(selectedItem.id)
          ) {
            isConnected = true;
          }

          if (isConnected) {
            const el = containerRef.current?.querySelector(
              `#event-${event.id}`,
            );
            if (el) {
              (el as HTMLElement).style.display = "block";
              (el as HTMLElement).style.opacity = "1";
              const ringClasses = getRingColorClass("event");
              el.classList.add("ring-2", ...ringClasses);
              connectedElements.push({ element: el, type: "event" });
            }
          }
        });
      }
    }

    // Draw connections if we have both a selected element and connected elements
    if (selectedElement && connectedElements.length > 0) {
      drawConnections(selectedElement, connectedElements);
    }
  };

  // Function to draw connection lines
  const drawConnections = (
    sourceElement: Element,
    targetElements: { element: Element; type: string }[],
  ) => {
    if (!svgRef.current || !containerRef.current) return;
    const svg = svgRef.current;
    svg.innerHTML = ""; // Clear existing connections

    const connectionsColumn = svg.parentElement;
    if (!connectionsColumn) return;

    const sourceRect = sourceElement.getBoundingClientRect();
    const containerRect = connectionsColumn.getBoundingClientRect();

    // Calculate sourceX relative to the SVG container
    const sourceX =
      sourceElement.closest(".col-span-1") ===
      connectionsColumn.previousElementSibling
        ? 0 // If source is an event, lines come from left edge of middle column
        : svg.clientWidth; // If source is an entity, lines come from right edge

    targetElements.forEach(({ element: targetEl, type: targetType }) => {
      if (!targetEl) return;

      const targetRect = targetEl.getBoundingClientRect();

      // Calculate targetX relative to the SVG container
      const targetX =
        targetEl.closest(".col-span-1") ===
        connectionsColumn.previousElementSibling
          ? 0 // If target is an event, lines go to left edge of middle column
          : svg.clientWidth; // If target is an entity, lines go to right edge

      // Calculate sourceY and targetY relative to the SVG
      const sourceY =
        sourceRect.top + sourceRect.height / 2 - containerRect.top;
      const targetY =
        targetRect.top + targetRect.height / 2 - containerRect.top;

      // Create path
      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );

      // Determine if we're going left-to-right or right-to-left
      let d;
      if (
        sourceElement.closest(".col-span-1") ===
        connectionsColumn.previousElementSibling
      ) {
        // Event to entity (left to right)
        d = `M ${sourceX} ${sourceY} C ${sourceX + 50} ${sourceY}, ${
          targetX - 50
        } ${targetY}, ${targetX} ${targetY}`;
      } else {
        // Entity to event (right to left)
        d = `M ${sourceX} ${sourceY} C ${sourceX - 50} ${sourceY}, ${
          targetX + 50
        } ${targetY}, ${targetX} ${targetY}`;
      }

      path.setAttribute("d", d);

      // Set color based on the target entity type
      let strokeColor = getColor("event"); // Default (blue)

      // If we're connecting to a specific entity type, use that color
      if (targetType !== "event") {
        strokeColor = getColor(targetType);
      }
      // If we're connecting from an entity to events, use the entity color
      // Ensure sourceElement is treated as an HTMLElement to access dataset
      else if (
        sourceElement instanceof HTMLElement &&
        sourceElement.dataset?.entityType
      ) {
        strokeColor = getColor(sourceElement.dataset.entityType);
      }

      path.setAttribute("stroke", strokeColor);
      path.setAttribute("stroke-width", "2");
      path.setAttribute("fill", "none");

      // Add some animation and interactivity
      path.setAttribute("stroke-dasharray", "4,4");
      path.setAttribute("stroke-dashoffset", "0");
      path.setAttribute("opacity", "0.8");

      // Create animation
      const animate = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "animate",
      );

      animate.setAttribute("attributeName", "stroke-dashoffset");
      animate.setAttribute("from", "0");
      animate.setAttribute("to", "8");
      animate.setAttribute("dur", "0.5s");
      animate.setAttribute("repeatCount", "indefinite");

      path.appendChild(animate);
      svg.appendChild(path);
    });
  };

  // Handle no timeline selected
  if (!timelineId) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
        <p className="text-gray-500 dark:text-gray-400">
          Select a timeline to view its event relationships
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full w-full bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
    >
      {/* Container is populated by the DOM manipulation in useEffect */}
    </div>
  );
};

export default EventRelationshipSankey;

//
