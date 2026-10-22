// NarrativeResourcePanel.tsx (Complete with Map Resources)

import React, { useMemo, useState } from "react";
import {
  FaChevronUp,
  FaChevronDown,
  FaChevronLeft,
  FaChevronRight,
  FaPlus,
  FaMap,
  FaDrawPolygon,
  FaTasks,
} from "react-icons/fa";
import { useProjectData } from "../contexts/ProjectDataContext";
import { ID } from "../types";
import Button from "../components/common/Button";

interface ResourceItemProps {
  item: any;
  type: string;
  nameField?: string;
  onInsert?: (type: string, name: string, id: ID) => void;
}

const ResourceItem: React.FC<ResourceItemProps> = ({
  item,
  type,
  nameField = "name",
  onInsert,
}) => {
  const itemName =
    item[nameField] || item.title || item.properties?.name || "Unnamed";

  const handleInsertClick = () => {
    if (onInsert) {
      onInsert(type, itemName, item.id);
    }
  };

  return (
    <div
      className="flex items-center justify-between p-1.5 text-xs text-slate-800 dark:text-slate-200 rounded-md hover:bg-blue-100 dark:hover:bg-blue-800/50 group"
      title={`Insert '${itemName}'`}
    >
      <span
        onClick={handleInsertClick}
        className="truncate cursor-pointer flex-1"
      >
        {itemName}
      </span>
      <button
        onClick={handleInsertClick}
        className="ml-2 p-1 rounded-full text-slate-400 group-hover:text-blue-500 group-hover:bg-blue-200 dark:group-hover:bg-blue-700 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label={`Insert ${itemName}`}
      >
        <FaPlus />
      </button>
    </div>
  );
};

interface ResourceAccordionProps {
  title: string;
  items: any[];
  type: string;
  searchQuery: string;
  nameField?: string;
  onInsert?: (type: string, name: string, id: ID) => void;
  icon?: React.ReactNode;
}

const ITEMS_PER_PAGE = 9;

const ResourceAccordion: React.FC<ResourceAccordionProps> = ({
  title,
  items,
  type,
  searchQuery,
  nameField = "name",
  onInsert,
  icon,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const lowerCaseQuery = searchQuery.toLowerCase();

  const filteredItems = useMemo(
    () =>
      items?.filter((item) => {
        const value =
          item[nameField] || item.title || item.properties?.name || "Unnamed";
        return value.toLowerCase().includes(lowerCaseQuery);
      }) || [],
    [items, lowerCaseQuery, nameField],
  );

  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredItems.slice(startIndex, endIndex);
  }, [filteredItems, currentPage]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  if (!items || items.length === 0) return null;

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full justify-between items-center rounded-t-md bg-slate-100 dark:bg-slate-700/50 px-2 py-1.5 text-left text-xs font-medium text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700"
      >
        <span className="flex items-center gap-2">
          {icon}
          {title} ({filteredItems.length})
        </span>
        {isOpen ? <FaChevronUp /> : <FaChevronDown />}
      </button>
      {isOpen && (
        <div className="border border-t-0 border-slate-200 dark:border-slate-700/50 rounded-b-md">
          <div className="py-1 space-y-1 px-1">
            {paginatedItems.length > 0 ? (
              paginatedItems.map((item) => (
                <ResourceItem
                  key={item.id}
                  item={item}
                  type={type}
                  nameField={nameField}
                  onInsert={onInsert}
                />
              ))
            ) : (
              <p className="p-2 text-xs text-slate-500">
                No matching {title.toLowerCase()}.
              </p>
            )}
          </div>
          {totalPages > 1 && (
            <div className="flex justify-between items-center p-2 border-t border-slate-200 dark:border-slate-700/50">
              <Button
                size="sm"
                variant="outline"
                onClick={handlePrevPage}
                disabled={currentPage === 1}
              >
                <FaChevronLeft />
              </Button>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                <FaChevronRight />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface NarrativeResourcePanelProps {
  onInsertResource?: (type: string, name: string, id: ID) => void;
  onInsert?: (type: string, name: string, id: ID) => void;
}

const NarrativeResourcePanel: React.FC<NarrativeResourcePanelProps> = ({
  onInsertResource,
  onInsert,
}) => {
  const { project } = useProjectData();
  const [searchQuery, setSearchQuery] = useState("");

  const handleInsert = onInsertResource || onInsert;

  const allEvents = useMemo(
    () =>
      project?.timelines?.flatMap((timeline) =>
        timeline.events.map((event) => ({
          ...event,
          displayName: `${event.title} (${timeline.name})`,
        })),
      ) || [],
    [project?.timelines],
  );

  // Prepare map shapes with proper display names
  const mapShapes = useMemo(
    () =>
      project?.mapData?.anchoredShapes?.map((shape) => ({
        ...shape,
        displayName: shape.properties?.name || `Shape ${shape.id.slice(0, 8)}`,
      })) || [],
    [project?.mapData?.anchoredShapes],
  );

  // Prepare map scenarios with proper display names
  const mapScenarios = useMemo(
    () =>
      project?.mapData?.scenarios?.map((scenario) => ({
        ...scenario,
        displayName: scenario.name || `Scenario ${scenario.id.slice(0, 8)}`,
      })) || [],
    [project?.mapData?.scenarios],
  );

  return (
    <div className="w-full h-full p-2 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex-shrink-0">
        Project Resources
      </h3>
      <div className="mb-2 flex-shrink-0">
        <input
          type="text"
          placeholder="Search resources..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-2 py-1.5 text-sm rounded-md bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="flex-1 overflow-y-auto space-y-4 pr-2 -mr-2">
        <ResourceAccordion
          title="Timelines"
          items={project?.timelines || []}
          type="Timeline"
          searchQuery={searchQuery}
          onInsert={handleInsert}
        />
        <ResourceAccordion
          title="Characters"
          items={project?.characters || []}
          type="Character"
          searchQuery={searchQuery}
          onInsert={handleInsert}
        />
        <ResourceAccordion
          title="Locations"
          items={project?.locations || []}
          type="Location"
          searchQuery={searchQuery}
          onInsert={handleInsert}
        />
        <ResourceAccordion
          title="Events"
          items={allEvents}
          type="Event"
          searchQuery={searchQuery}
          nameField="displayName"
          onInsert={handleInsert}
        />
        <ResourceAccordion
          title="Technologies"
          items={project?.technologies || []}
          type="Technology"
          searchQuery={searchQuery}
          onInsert={handleInsert}
        />
        <ResourceAccordion
          title="Cultures"
          items={project?.cultures || []}
          type="Culture"
          searchQuery={searchQuery}
          onInsert={handleInsert}
        />
        <ResourceAccordion
          title="Map Shapes"
          items={mapShapes}
          type="MapShape"
          searchQuery={searchQuery}
          nameField="displayName"
          onInsert={handleInsert}
          icon={<FaDrawPolygon className="h-3 w-3" />}
        />
        <ResourceAccordion
          title="Map Scenarios"
          items={mapScenarios}
          type="MapScenario"
          searchQuery={searchQuery}
          nameField="displayName"
          onInsert={handleInsert}
          icon={<FaMap className="h-3 w-3" />}
        />
        <ResourceAccordion
          title="Tasks"
          items={project?.tasks || []}
          type="Task"
          searchQuery={searchQuery}
          nameField="title"
          onInsert={handleInsert}
          icon={<FaTasks className="h-3 w-3" />}
        />
        <ResourceAccordion
          title="Sources"
          items={project?.sources || []}
          type="Source"
          searchQuery={searchQuery}
          nameField="title"
          onInsert={handleInsert}
        />
      </div>
    </div>
  );
};

export default NarrativeResourcePanel;
