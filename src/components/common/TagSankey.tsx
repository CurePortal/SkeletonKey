// src/components/common/TagSankey.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useProjectData } from "../../contexts/ProjectDataContext";
import { ID } from "../../types";

interface TagNode {
  id: string;
  tag: string;
  type: "tag";
  frequency: number;
  entities: Array<{ id: string; type: string; name: string }>;
}

interface EntityTypeNode {
  id: string;
  name: string;
  type: "entityType";
  count: number;
  entityIds: ID[];
}

interface SankeyLink {
  source: string;
  target: string;
  value: number;
  tag?: string;
  entityType?: string;
}

interface TagSankeyProps {
  onTagClick?: (tag: string) => void;
  onEntityTypeClick?: (entityType: string) => void;
  selectedTag?: string;
  height?: number;
  width?: number;
}

const TagSankey: React.FC<TagSankeyProps> = ({
  onTagClick,
  onEntityTypeClick,
  selectedTag,
  height = 600,
  width = 1000,
}) => {
  const { project } = useProjectData();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [selectedItem, setSelectedItem] = useState<{
    id: string;
    type: string;
  } | null>(null);
  const [hoveredItem, setHoveredItem] = useState<{
    id: string;
    type: string;
  } | null>(null);
  const [dimensions, setDimensions] = useState({ width, height });

  // Update dimensions based on container size
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const newWidth = Math.min(containerWidth - 40, width);
        setDimensions({ width: newWidth, height });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, [width, height]);

  // Extract tags and entity types from project
  const extractTagsAndEntityTypes = useCallback(() => {
    if (!project) return { tagNodes: [], entityTypeNodes: [], links: [] };

    const tagMap = new Map<
      string,
      Array<{ id: string; type: string; name: string }>
    >();
    const entityTypeMap = new Map<string, { count: number; entityIds: ID[] }>();

    // Helper function to add tags from an entity
    const addEntityTags = (entity: any, type: string) => {
      if (!entity.tags || !Array.isArray(entity.tags)) return;

      // Update entity type count
      if (!entityTypeMap.has(type)) {
        entityTypeMap.set(type, { count: 0, entityIds: [] });
      }
      const typeData = entityTypeMap.get(type)!;
      typeData.count++;
      typeData.entityIds.push(entity.id);

      entity.tags.forEach((tag: string) => {
        if (!tag || tag.trim() === "") return;

        const normalizedTag = tag.trim().toLowerCase();
        if (!tagMap.has(normalizedTag)) {
          tagMap.set(normalizedTag, []);
        }

        tagMap.get(normalizedTag)!.push({
          id: entity.id,
          type,
          name: entity.name || entity.title || "Unnamed",
        });
      });
    };

    // Extract from all entity types
    project.characters?.forEach((char) => addEntityTags(char, "character"));
    project.locations?.forEach((loc) => addEntityTags(loc, "location"));
    project.technologies?.forEach((tech) => addEntityTags(tech, "technology"));
    project.cultures?.forEach((cult) => addEntityTags(cult, "culture"));
    project.sources?.forEach((doc) => addEntityTags(doc, "source"));
    project.reports?.forEach((narr) => addEntityTags(narr, "narrative"));

    // Extract from events in all timelines
    project.timelines?.forEach((timeline) => {
      timeline.events?.forEach((event) => addEntityTags(event, "event"));
    });

    // Create tag nodes (limit to top 20 for better visualization)
    const tagNodes: TagNode[] = Array.from(tagMap.entries())
      .filter(([_, entities]) => entities.length >= 1)
      .map(([tag, entities]) => ({
        id: `tag-${tag}`,
        tag,
        type: "tag" as const,
        frequency: entities.length,
        entities,
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 20);

    // Create entity type nodes
    const entityTypeNodes: EntityTypeNode[] = Array.from(
      entityTypeMap.entries(),
    )
      .map(([type, data]) => ({
        id: `entityType-${type}`,
        name: type.charAt(0).toUpperCase() + type.slice(1) + "s",
        type: "entityType" as const,
        count: data.count,
        entityIds: data.entityIds,
      }))
      .sort((a, b) => b.count - a.count);

    // Create links between tags and entity types
    const links: SankeyLink[] = [];
    tagNodes.forEach((tagNode) => {
      const entityTypeMap = new Map<string, number>();

      tagNode.entities.forEach((entity) => {
        const count = entityTypeMap.get(entity.type) || 0;
        entityTypeMap.set(entity.type, count + 1);
      });

      entityTypeMap.forEach((count, entityType) => {
        links.push({
          source: tagNode.id,
          target: `entityType-${entityType}`,
          value: count,
          tag: tagNode.tag,
          entityType: entityType,
        });
      });
    });

    return { tagNodes, entityTypeNodes, links };
  }, [project]);

  const { tagNodes, entityTypeNodes, links } = extractTagsAndEntityTypes();

  // Get color for different entity types
  const getEntityTypeColor = (type: string) => {
    switch (type) {
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
      case "event":
        return "#3b82f6"; // blue
      case "narrative":
        return "#06b6d4"; // cyan
      default:
        return "#6b7280"; // gray
    }
  };

  // Calculate positions for Sankey layout
  const calculateSankeyLayout = useCallback(() => {
    if (tagNodes.length === 0 || entityTypeNodes.length === 0) return null;

    const margin = { top: 40, right: 40, bottom: 40, left: 40 };
    const innerWidth = dimensions.width - margin.left - margin.right;
    const innerHeight = dimensions.height - margin.top - margin.bottom;

    // Position tag nodes on the left
    const tagHeight = innerHeight / Math.max(1, tagNodes.length - 1);
    const tagPositions = tagNodes.map((node, index) => ({
      ...node,
      x: margin.left,
      y: margin.top + index * tagHeight,
      width: 120,
      height: Math.min(40, tagHeight * 0.8),
    }));

    // Position entity type nodes on the right
    const entityTypeHeight =
      innerHeight / Math.max(1, entityTypeNodes.length - 1);
    const entityTypePositions = entityTypeNodes.map((node, index) => ({
      ...node,
      x: margin.left + innerWidth - 120,
      y: margin.top + index * entityTypeHeight,
      width: 120,
      height: Math.min(40, entityTypeHeight * 0.8),
    }));

    return {
      tagNodes: tagPositions,
      entityTypeNodes: entityTypePositions,
      links,
      margin,
      innerWidth,
      innerHeight,
    };
  }, [tagNodes, entityTypeNodes, links, dimensions]);

  const layout = calculateSankeyLayout();

  // Handle clicks
  const handleNodeClick = (node: TagNode | EntityTypeNode) => {
    if (node.type === "tag") {
      const tagNode = node as TagNode;
      setSelectedItem({ id: node.id, type: "tag" });
      if (onTagClick) onTagClick(tagNode.tag);
    } else {
      const entityTypeNode = node as EntityTypeNode;
      setSelectedItem({ id: node.id, type: "entityType" });
      if (onEntityTypeClick) {
        const singularType = entityTypeNode.name.toLowerCase().slice(0, -1); // Remove 's'
        onEntityTypeClick(singularType);
      }
    }
  };

  // Generate SVG paths for links
  const generateLinkPath = (tagNode: any, entityTypeNode: any) => {
    const sourceX = tagNode.x + tagNode.width;
    const sourceY = tagNode.y + tagNode.height / 2;
    const targetX = entityTypeNode.x;
    const targetY = entityTypeNode.y + entityTypeNode.height / 2;

    const midX = (sourceX + targetX) / 2;

    return `M ${sourceX} ${sourceY} C ${midX} ${sourceY}, ${midX} ${targetY}, ${targetX} ${targetY}`;
  };

  // Update selection based on external prop
  useEffect(() => {
    if (selectedTag) {
      const tagNode = tagNodes.find((n) => n.tag === selectedTag);
      if (tagNode) {
        setSelectedItem({ id: tagNode.id, type: "tag" });
      }
    }
  }, [selectedTag, tagNodes]);

  if (!project || tagNodes.length === 0) {
    return (
      <div ref={containerRef} className="w-full">
        <div className="flex items-center justify-center h-96 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-center">
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
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
            <p className="text-gray-500 dark:text-gray-400">
              No tags found in project
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Add tags to your entities to see the flow diagram
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!layout) return null;

  return (
    <div ref={containerRef} className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Tag Flow Diagram
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {tagNodes.length} tags flowing to {entityTypeNodes.length} entity
            types
            {selectedItem &&
              selectedItem.type === "tag" &&
              ` • ${selectedItem.id.replace("tag-", "")} selected`}
          </p>
        </div>
        {selectedItem && (
          <button
            onClick={() => setSelectedItem(null)}
            className="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
          >
            Clear Selection
          </button>
        )}
      </div>

      {/* SVG Container */}
      <div className="relative">
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
        >
          {/* Links */}
          <g className="links">
            {links.map((link, index) => {
              const tagNode = layout.tagNodes.find((n) => n.id === link.source);
              const entityTypeNode = layout.entityTypeNodes.find(
                (n) => n.id === link.target,
              );

              if (!tagNode || !entityTypeNode) return null;

              const isHighlighted =
                selectedItem &&
                (selectedItem.id === link.source ||
                  selectedItem.id === link.target);
              const isConnected =
                selectedItem &&
                (link.source === selectedItem.id ||
                  link.target === selectedItem.id);

              const opacity = selectedItem
                ? isHighlighted || isConnected
                  ? 0.8
                  : 0.1
                : 0.4;

              const strokeWidth = Math.max(2, Math.min(20, link.value * 3));

              return (
                <path
                  key={index}
                  d={generateLinkPath(link, tagNode)}
                  stroke={getEntityTypeColor(link.entityType || "default")}
                  strokeWidth={strokeWidth}
                  fill="none"
                  opacity={opacity}
                  className="transition-opacity duration-200"
                  onMouseEnter={() =>
                    setHoveredItem({ id: `link-${index}`, type: "link" })
                  }
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <title>
                    {link.tag} → {link.entityType}: {link.value} entities
                  </title>
                </path>
              );
            })}
          </g>

          {/* Tag nodes */}
          <g className="tag-nodes">
            {layout.tagNodes.map((node) => {
              const isSelected = selectedItem?.id === node.id;
              const isConnected =
                selectedItem &&
                links.some(
                  (link) =>
                    (link.source === selectedItem.id &&
                      link.target === node.id) ||
                    (link.target === selectedItem.id &&
                      link.source === node.id),
                );
              const opacity = selectedItem
                ? isSelected || isConnected
                  ? 1
                  : 0.3
                : 1;

              return (
                <g key={node.id} className="tag-node">
                  <rect
                    x={node.x}
                    y={node.y}
                    width={node.width}
                    height={node.height}
                    fill="#3b82f6"
                    opacity={opacity}
                    stroke={isSelected ? "#1d4ed8" : "none"}
                    strokeWidth={isSelected ? 2 : 0}
                    rx={6}
                    className="cursor-pointer transition-all duration-200 hover:opacity-80"
                    onClick={() => handleNodeClick(node)}
                    onMouseEnter={() =>
                      setHoveredItem({ id: node.id, type: "tag" })
                    }
                    onMouseLeave={() => setHoveredItem(null)}
                  />
                  <text
                    x={node.x + node.width / 2}
                    y={node.y + node.height / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize="12"
                    fontWeight="medium"
                    className="pointer-events-none select-none"
                    opacity={opacity}
                  >
                    {node.tag}
                  </text>
                  <text
                    x={node.x + node.width / 2}
                    y={node.y + node.height / 2 + 14}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize="10"
                    className="pointer-events-none select-none"
                    opacity={opacity * 0.8}
                  >
                    ({node.frequency})
                  </text>
                </g>
              );
            })}
          </g>

          {/* Entity type nodes */}
          <g className="entity-type-nodes">
            {layout.entityTypeNodes.map((node) => {
              const isSelected = selectedItem?.id === node.id;
              const isConnected =
                selectedItem &&
                links.some(
                  (link) =>
                    (link.source === selectedItem.id &&
                      link.target === node.id) ||
                    (link.target === selectedItem.id &&
                      link.source === node.id),
                );
              const opacity = selectedItem
                ? isSelected || isConnected
                  ? 1
                  : 0.3
                : 1;

              const entityType = node.name.toLowerCase().slice(0, -1); // Remove 's'
              const color = getEntityTypeColor(entityType);

              return (
                <g key={node.id} className="entity-type-node">
                  <rect
                    x={node.x}
                    y={node.y}
                    width={node.width}
                    height={node.height}
                    fill={color}
                    opacity={opacity}
                    stroke={isSelected ? "#ffffff" : "none"}
                    strokeWidth={isSelected ? 2 : 0}
                    rx={6}
                    className="cursor-pointer transition-all duration-200 hover:opacity-80"
                    onClick={() => handleNodeClick(node)}
                    onMouseEnter={() =>
                      setHoveredItem({ id: node.id, type: "entityType" })
                    }
                    onMouseLeave={() => setHoveredItem(null)}
                  />
                  <text
                    x={node.x + node.width / 2}
                    y={node.y + node.height / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize="12"
                    fontWeight="medium"
                    className="pointer-events-none select-none"
                    opacity={opacity}
                  >
                    {node.name}
                  </text>
                  <text
                    x={node.x + node.width / 2}
                    y={node.y + node.height / 2 + 14}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize="10"
                    className="pointer-events-none select-none"
                    opacity={opacity * 0.8}
                  >
                    ({node.count})
                  </text>
                </g>
              );
            })}
          </g>

          {/* Labels */}
          <g className="labels">
            <text
              x={layout.margin.left + 60}
              y={layout.margin.top - 10}
              textAnchor="middle"
              fontSize="14"
              fontWeight="medium"
              fill="currentColor"
              className="text-gray-700 dark:text-gray-300"
            >
              Tags
            </text>
            <text
              x={layout.margin.left + layout.innerWidth - 60}
              y={layout.margin.top - 10}
              textAnchor="middle"
              fontSize="14"
              fontWeight="medium"
              fill="currentColor"
              className="text-gray-700 dark:text-gray-300"
            >
              Entity Types
            </text>
          </g>
        </svg>

        {/* Hover tooltip */}
        {hoveredItem && (
          <div className="absolute top-2 left-2 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800 px-3 py-2 rounded-md text-sm shadow-lg pointer-events-none z-10">
            {hoveredItem.type === "tag" && (
              <>
                <div className="font-medium">
                  {tagNodes.find((n) => n.id === hoveredItem.id)?.tag}
                </div>
                <div className="text-xs opacity-75">
                  {tagNodes.find((n) => n.id === hoveredItem.id)?.frequency}{" "}
                  entities
                </div>
              </>
            )}
            {hoveredItem.type === "entityType" && (
              <>
                <div className="font-medium">
                  {entityTypeNodes.find((n) => n.id === hoveredItem.id)?.name}
                </div>
                <div className="text-xs opacity-75">
                  {entityTypeNodes.find((n) => n.id === hoveredItem.id)?.count}{" "}
                  entities
                </div>
              </>
            )}
            {hoveredItem.type === "link" &&
              hoveredItem.id.startsWith("link-") && (
                <>
                  <div className="font-medium">Connection</div>
                  <div className="text-xs opacity-75">Click to see details</div>
                </>
              )}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <p>
              • <strong>Click</strong> a tag or entity type to filter the view
            </p>
            <p>
              • <strong>Hover</strong> over elements to see details
            </p>
          </div>
          <div>
            <p>
              • <strong>Flow width</strong> represents number of shared entities
            </p>
            <p>
              • <strong>Colors</strong> represent different entity types
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TagSankey;
