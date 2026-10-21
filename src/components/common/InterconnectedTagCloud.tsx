// src/components/common/InterconnectedTagCloud.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useProjectData } from "../../contexts/ProjectDataContext";

interface TagNode {
  id: string;
  tag: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  connections: string[];
  frequency: number;
  radius: number;
  isSelected: boolean;
  isConnected: boolean;
  isHovered: boolean;
  entityTypes: Set<string>;
}

interface Connection {
  source: string;
  target: string;
  strength: number;
}

interface TagData {
  tag: string;
  entities: Array<{ id: string; type: string; name: string }>;
  frequency: number;
}

interface ViewState {
  x: number;
  y: number;
  scale: number;
}

interface InterconnectedTagCloudProps {
  onTagClick?: (tag: string) => void;
  selectedTag?: string;
}

const InterconnectedTagCloud: React.FC<InterconnectedTagCloudProps> = ({
  onTagClick,
  selectedTag: externalSelectedTag,
}) => {
  const { project } = useProjectData();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const [nodes, setNodes] = useState<TagNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(
    externalSelectedTag || null,
  );
  const [hoveredTag, setHoveredTag] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Zoom and pan state
  const [viewState, setViewState] = useState<ViewState>({
    x: 0,
    y: 0,
    scale: 1.2, // Increased default zoom
  });

  // Mouse interaction state
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [smoothHover, setSmoothHover] = useState<string | null>(null);

  // Update dimensions based on window size
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const newHeight = Math.max(
          500,
          Math.min(800, window.innerHeight * 0.6),
        );
        setDimensions({ width: containerWidth, height: newHeight });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // Transform screen coordinates to world coordinates
  const screenToWorld = useCallback(
    (screenX: number, screenY: number) => {
      const { width, height } = dimensions;
      const worldX =
        (screenX - width / 2 - viewState.x) / viewState.scale + width / 2;
      const worldY =
        (screenY - height / 2 - viewState.y) / viewState.scale + height / 2;
      return { x: worldX, y: worldY };
    },
    [dimensions, viewState],
  );

  // Transform world coordinates to screen coordinates
  const worldToScreen = useCallback(
    (worldX: number, worldY: number) => {
      const { width, height } = dimensions;
      const screenX =
        (worldX - width / 2) * viewState.scale + width / 2 + viewState.x;
      const screenY =
        (worldY - height / 2) * viewState.scale + height / 2 + viewState.y;
      return { x: screenX, y: screenY };
    },
    [dimensions, viewState],
  );

  // Extract all tags from project entities (optimized)
  const extractTagsFromProject = useCallback((): TagData[] => {
    if (!project) return [];

    const tagMap = new Map<
      string,
      Array<{ id: string; type: string; name: string }>
    >();

    // Helper function to add tags from an entity
    const addEntityTags = (entity: any, type: string) => {
      if (!entity.tags || !Array.isArray(entity.tags)) return;

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

    // Extract tags from all entity types
    project.characters?.forEach((char) => addEntityTags(char, "character"));
    project.locations?.forEach((loc) => addEntityTags(loc, "location"));
    project.technologies?.forEach((tech) => addEntityTags(tech, "technology"));
    project.cultures?.forEach((cult) => addEntityTags(cult, "culture"));
    project.sources?.forEach((doc) => addEntityTags(doc, "source"));
    project.reports?.forEach((narr) => addEntityTags(narr, "narrative"));

    // Also extract from events in all timelines
    project.timelines?.forEach((timeline) => {
      timeline.events?.forEach((event) => addEntityTags(event, "event"));
    });

    // Convert to TagData array and filter out tags with only 1 entity for performance
    return Array.from(tagMap.entries())
      .filter(([_, entities]) => entities.length >= 1) // Keep all tags, even single ones
      .map(([tag, entities]) => ({
        tag,
        entities,
        frequency: entities.length,
      }))
      .sort((a, b) => b.frequency - a.frequency) // Sort by frequency, most used first
      .slice(0, 50); // Limit to top 50 tags for performance
  }, [project]);

  // Calculate tag relationships based on shared entities
  const calculateConnections = useCallback(
    (tagData: TagData[]): Connection[] => {
      const connections: Connection[] = [];

      for (let i = 0; i < tagData.length; i++) {
        for (let j = i + 1; j < tagData.length; j++) {
          const tag1 = tagData[i];
          const tag2 = tagData[j];

          // Find shared entities
          const sharedEntities = tag1.entities.filter((entity1) =>
            tag2.entities.some(
              (entity2) =>
                entity1.id === entity2.id && entity1.type === entity2.type,
            ),
          );

          if (sharedEntities.length > 0) {
            // Calculate connection strength based on shared entities relative to total
            const strength =
              sharedEntities.length /
              Math.max(tag1.entities.length, tag2.entities.length);

            connections.push({
              source: tag1.tag,
              target: tag2.tag,
              strength: Math.min(1, strength * 2), // Amplify weaker connections slightly
            });
          }
        }
      }

      return connections;
    },
    [],
  );

  // Initialize nodes and connections
  useEffect(() => {
    const tagData = extractTagsFromProject();
    if (tagData.length === 0) {
      setNodes([]);
      setConnections([]);
      return;
    }

    const newConnections = calculateConnections(tagData);
    setConnections(newConnections);

    // Create connection map for each tag
    const connectionMap = new Map<string, string[]>();
    newConnections.forEach((conn) => {
      if (!connectionMap.has(conn.source)) connectionMap.set(conn.source, []);
      if (!connectionMap.has(conn.target)) connectionMap.set(conn.target, []);
      connectionMap.get(conn.source)!.push(conn.target);
      connectionMap.get(conn.target)!.push(conn.source);
    });

    // Create nodes with physics properties
    const newNodes: TagNode[] = tagData.map((tag, index) => {
      const radius = Math.max(15, Math.min(35, 15 + tag.frequency * 1.8));

      // Position nodes in a circle initially, with some randomness
      const angle = (index / tagData.length) * 2 * Math.PI;
      const initialRadius = Math.min(dimensions.width, dimensions.height) * 0.3;
      const randomOffset = (Math.random() - 0.5) * 120;

      // Get unique entity types for this tag
      const entityTypes = new Set(tag.entities.map((e) => e.type));

      return {
        id: tag.tag,
        tag: tag.tag,
        x:
          dimensions.width / 2 +
          Math.cos(angle) * (initialRadius + randomOffset),
        y:
          dimensions.height / 2 +
          Math.sin(angle) * (initialRadius + randomOffset),
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        connections: connectionMap.get(tag.tag) || [],
        frequency: tag.frequency,
        radius,
        isSelected: false,
        isConnected: false,
        isHovered: false,
        entityTypes,
      };
    });

    setNodes(newNodes);
  }, [project, dimensions, extractTagsFromProject, calculateConnections]);

  // Update selection based on external prop
  useEffect(() => {
    if (externalSelectedTag !== selectedTag) {
      setSelectedTag(externalSelectedTag || null);
    }
  }, [externalSelectedTag]);

  // Update node selection and hover states
  useEffect(() => {
    setNodes((prevNodes) =>
      prevNodes.map((node) => ({
        ...node,
        isSelected: node.tag === selectedTag,
        isConnected:
          selectedTag && node.tag !== selectedTag
            ? connections.some(
                (conn) =>
                  (conn.source === selectedTag && conn.target === node.tag) ||
                  (conn.target === selectedTag && conn.source === node.tag),
              )
            : false,
        isHovered: node.tag === smoothHover,
      })),
    );
  }, [selectedTag, connections, smoothHover]);

  // Physics simulation with performance optimization
  useEffect(() => {
    if (nodes.length === 0) return;

    let isRunning = true;
    let frameCount = 0;
    const maxFrames = 600; // Limit simulation frames
    const targetFPS = 30;
    const frameInterval = 1000 / targetFPS;
    let lastFrameTime = 0;

    const simulate = (currentTime: number) => {
      if (!isRunning) return;

      // Throttle frame rate
      if (currentTime - lastFrameTime < frameInterval) {
        animationRef.current = requestAnimationFrame(simulate);
        return;
      }
      lastFrameTime = currentTime;

      // Stop simulation after stabilization
      frameCount++;
      if (frameCount > maxFrames) {
        isRunning = false;
        return;
      }

      setNodes((prevNodes) => {
        const newNodes = [...prevNodes];
        const centerForce = 0.0008;
        const repulsionForce = 80;
        const dampening = 0.94;
        const attractionForce = 0.003;

        let totalMovement = 0;

        // Apply forces more efficiently
        for (let i = 0; i < newNodes.length; i++) {
          const node = newNodes[i];
          let fx = 0,
            fy = 0;

          // Center force
          fx += (dimensions.width / 2 - node.x) * centerForce;
          fy += (dimensions.height / 2 - node.y) * centerForce;

          // Repulsion from other nodes (only check nearby nodes)
          for (let j = 0; j < newNodes.length; j++) {
            if (i === j) continue;
            const other = newNodes[j];
            const dx = node.x - other.x;
            const dy = node.y - other.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 0 && distance < 120) {
              const force = repulsionForce / (distance * distance);
              fx += (dx / distance) * force;
              fy += (dy / distance) * force;
            }
          }

          // Attraction to connected nodes (optimize lookup)
          node.connections.forEach((connectedTag) => {
            const target = newNodes.find((n) => n.tag === connectedTag);
            if (target) {
              const dx = target.x - node.x;
              const dy = target.y - node.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              if (distance > 0) {
                const connection = connections.find(
                  (c) =>
                    (c.source === node.tag && c.target === connectedTag) ||
                    (c.target === node.tag && c.source === connectedTag),
                );
                const strength = connection?.strength || 0.5;
                const optimalDistance = (node.radius + target.radius) * 3.5;
                const force =
                  (distance - optimalDistance) * attractionForce * strength;

                fx += (dx / distance) * force;
                fy += (dy / distance) * force;
              }
            }
          });

          // Apply forces with dampening
          node.vx = (node.vx + fx) * dampening;
          node.vy = (node.vy + fy) * dampening;

          // Update position
          node.x += node.vx;
          node.y += node.vy;

          // Boundary constraints
          const margin = node.radius;
          node.x = Math.max(
            margin,
            Math.min(dimensions.width - margin, node.x),
          );
          node.y = Math.max(
            margin,
            Math.min(dimensions.height - margin, node.y),
          );

          // Track total movement for stabilization detection
          totalMovement += Math.abs(node.vx) + Math.abs(node.vy);
        }

        // Stop simulation if movement is minimal
        if (totalMovement < 0.08) {
          isRunning = false;
        }

        return newNodes;
      });

      if (isRunning) {
        animationRef.current = requestAnimationFrame(simulate);
      }
    };

    animationRef.current = requestAnimationFrame(simulate);

    return () => {
      isRunning = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [nodes.length, connections, dimensions]);

  // Handle tag selection
  const handleTagClick = (tag: string) => {
    const newSelection = selectedTag === tag ? null : tag;
    setSelectedTag(newSelection);

    if (onTagClick) {
      onTagClick(newSelection || "");
    }
  };

  // Get color for entity type with hover effects
  const getEntityTypeColor = (
    entityTypes: Set<string>,
    isHovered: boolean,
    isSelected: boolean,
  ) => {
    const alpha = isSelected ? 1 : isHovered ? 0.9 : 0.8;
    const typeArray = Array.from(entityTypes);

    if (typeArray.includes("character")) return `rgba(34, 197, 94, ${alpha})`; // green
    if (typeArray.includes("location")) return `rgba(245, 158, 11, ${alpha})`; // amber
    if (typeArray.includes("technology")) return `rgba(139, 92, 246, ${alpha})`; // purple
    if (typeArray.includes("culture")) return `rgba(236, 72, 153, ${alpha})`; // pink
    if (typeArray.includes("source")) return `rgba(100, 116, 139, ${alpha})`; // slate
    if (typeArray.includes("event")) return `rgba(59, 130, 246, ${alpha})`; // blue
    return `rgba(75, 85, 99, ${alpha})`; // gray default
  };

  // Canvas drawing with zoom support
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Use a single animation frame for drawing
    const draw = () => {
      // Clear canvas
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      // Set canvas size for high DPI
      const dpr = window.devicePixelRatio || 1;
      if (
        canvas.width !== dimensions.width * dpr ||
        canvas.height !== dimensions.height * dpr
      ) {
        canvas.width = dimensions.width * dpr;
        canvas.height = dimensions.height * dpr;
        canvas.style.width = `${dimensions.width}px`;
        canvas.style.height = `${dimensions.height}px`;
        ctx.scale(dpr, dpr);
      }

      // Save context and apply transformations
      ctx.save();
      ctx.translate(
        dimensions.width / 2 + viewState.x,
        dimensions.height / 2 + viewState.y,
      );
      ctx.scale(viewState.scale, viewState.scale);
      ctx.translate(-dimensions.width / 2, -dimensions.height / 2);

      // Draw connections (only visible ones)
      connections.forEach((conn) => {
        const sourceNode = nodes.find((n) => n.tag === conn.source);
        const targetNode = nodes.find((n) => n.tag === conn.target);

        if (!sourceNode || !targetNode) return;

        const isHighlighted =
          selectedTag &&
          (sourceNode.tag === selectedTag || targetNode.tag === selectedTag);

        const isHovered = sourceNode.isHovered || targetNode.isHovered;

        if (!selectedTag || isHighlighted || isHovered) {
          ctx.beginPath();
          ctx.moveTo(sourceNode.x, sourceNode.y);
          ctx.lineTo(targetNode.x, targetNode.y);

          if (isHighlighted) {
            ctx.strokeStyle = `rgba(59, 130, 246, ${0.6 + conn.strength * 0.4})`;
            ctx.lineWidth = 2 + conn.strength * 3;
          } else if (isHovered) {
            ctx.strokeStyle = `rgba(99, 102, 241, ${0.3 + conn.strength * 0.3})`;
            ctx.lineWidth = 1 + conn.strength * 2;
          } else {
            ctx.strokeStyle = `rgba(156, 163, 175, ${0.1 + conn.strength * 0.2})`;
            ctx.lineWidth = 0.5 + conn.strength;
          }
          ctx.stroke();
        }
      });

      // Draw nodes with enhanced hover effects
      nodes.forEach((node) => {
        const isVisible =
          !selectedTag || node.isSelected || node.isConnected || node.isHovered;
        if (!isVisible && selectedTag) return; // Skip invisible nodes entirely

        const effectiveRadius = node.isHovered
          ? node.radius * 1.1
          : node.radius;

        // Node background with glow effect for hovered nodes
        if (node.isHovered) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, effectiveRadius + 3, 0, 2 * Math.PI);
          ctx.fillStyle = getEntityTypeColor(
            node.entityTypes,
            false,
            false,
          ).replace(/[\d.]+\)$/g, "0.2)");
          ctx.fill();
        }

        // Main node
        ctx.beginPath();
        ctx.arc(node.x, node.y, effectiveRadius, 0, 2 * Math.PI);

        ctx.fillStyle = getEntityTypeColor(
          node.entityTypes,
          node.isHovered,
          node.isSelected,
        );
        ctx.fill();

        // Node border with enhanced styling
        if (node.isSelected || node.isConnected || node.isHovered) {
          ctx.strokeStyle = node.isSelected
            ? "rgba(29, 78, 216, 1)"
            : node.isHovered
              ? "rgba(255, 255, 255, 0.9)"
              : "rgba(255, 255, 255, 0.6)";
          ctx.lineWidth = node.isSelected ? 3 : node.isHovered ? 2 : 1;
          ctx.stroke();
        }

        // Tag text with better scaling
        const fontSize = Math.max(9, Math.min(12, effectiveRadius / 2.5));
        if (
          effectiveRadius > 10 ||
          node.isSelected ||
          node.isConnected ||
          node.isHovered
        ) {
          ctx.fillStyle = "white";
          ctx.font = `${fontSize}px system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          // Add text shadow for better readability
          ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
          ctx.shadowBlur = 2;
          ctx.fillText(node.tag, node.x, node.y);
          ctx.shadowBlur = 0;
        }
      });

      // Restore context
      ctx.restore();

      // Draw labels for selected/connected/hovered small nodes (in screen space)
      nodes.forEach((node) => {
        if (
          (node.isSelected || node.isConnected || node.isHovered) &&
          node.radius <= 15
        ) {
          const screenPos = worldToScreen(node.x, node.y);
          const labelY = screenPos.y - 25;
          const labelText = node.tag;

          ctx.font = "12px system-ui, sans-serif";
          ctx.textAlign = "center";
          const textWidth = ctx.measureText(labelText).width;
          const padding = 6;

          // Label background
          ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
          ctx.fillRect(
            screenPos.x - textWidth / 2 - padding,
            labelY - 7,
            textWidth + padding * 2,
            14,
          );

          // Label text
          ctx.fillStyle = "white";
          ctx.textBaseline = "middle";
          ctx.fillText(labelText, screenPos.x, labelY);
        }
      });
    };

    draw();
  }, [
    nodes,
    connections,
    selectedTag,
    dimensions,
    viewState,
    getEntityTypeColor,
    worldToScreen,
  ]);

  // Handle mouse events with zoom support
  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (isDragging) {
      // Handle panning
      const deltaX = x - lastMousePos.x;
      const deltaY = y - lastMousePos.y;
      setViewState((prev) => ({
        ...prev,
        x: prev.x + deltaX,
        y: prev.y + deltaY,
      }));
      setLastMousePos({ x, y });
    } else {
      // Handle hover detection
      const worldPos = screenToWorld(x, y);
      const hoveredNode = nodes.find((node) => {
        const dx = worldPos.x - node.x;
        const dy = worldPos.y - node.y;
        return Math.sqrt(dx * dx + dy * dy) <= node.radius;
      });

      const newHovered = hoveredNode ? hoveredNode.tag : null;

      // Smooth hover transitions
      if (newHovered !== hoveredTag) {
        setHoveredTag(newHovered);
        // Delayed update for smooth hover effect
        setTimeout(() => setSmoothHover(newHovered), 50);
      }

      canvas.style.cursor = hoveredNode
        ? "pointer"
        : isDragging
          ? "grabbing"
          : "grab";
    }
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    setIsDragging(true);
    setLastMousePos({ x, y });
    canvas.style.cursor = "grabbing";
  };

  const handleMouseUp = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      setIsDragging(false);

      // Check if this was a click (small movement) vs drag
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const deltaX = Math.abs(x - lastMousePos.x);
      const deltaY = Math.abs(y - lastMousePos.y);

      if (deltaX < 5 && deltaY < 5) {
        // This was a click, not a drag
        const worldPos = screenToWorld(x, y);
        const clickedNode = nodes.find((node) => {
          const dx = worldPos.x - node.x;
          const dy = worldPos.y - node.y;
          return Math.sqrt(dx * dx + dy * dy) <= node.radius;
        });

        if (clickedNode) {
          handleTagClick(clickedNode.tag);
        } else {
          // Click on empty space to deselect
          handleTagClick("");
        }
      }

      canvas.style.cursor = "grab";
    }
  };

  // Handle wheel zoom
  const handleWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Zoom factor
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(0.3, viewState.scale * zoomFactor), 3);

    // Zoom towards mouse position
    const zoomPointX = mouseX - dimensions.width / 2;
    const zoomPointY = mouseY - dimensions.height / 2;

    setViewState((prev) => ({
      x: prev.x - zoomPointX * (newScale / prev.scale - 1),
      y: prev.y - zoomPointY * (newScale / prev.scale - 1),
      scale: newScale,
    }));
  };

  // Zoom controls
  const zoomIn = () => {
    setViewState((prev) => ({
      ...prev,
      scale: Math.min(3, prev.scale * 1.2),
    }));
  };

  const zoomOut = () => {
    setViewState((prev) => ({
      ...prev,
      scale: Math.max(0.3, prev.scale * 0.8),
    }));
  };

  const resetView = () => {
    setViewState({ x: 0, y: 0, scale: 1.2 });
  };

  // Statistics
  const totalConnections = connections.length;
  const selectedConnections = selectedTag
    ? connections.filter(
        (conn) => conn.source === selectedTag || conn.target === selectedTag,
      ).length
    : 0;

  if (!project || nodes.length === 0) {
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
              Add tags to your entities to see the relationship cloud
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Tag Relationship Cloud
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {nodes.length} tags, {totalConnections} connections
            {selectedTag &&
              ` • ${selectedConnections} connections to "${selectedTag}"`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-md">
            <button
              onClick={zoomOut}
              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-l-md transition-colors"
              title="Zoom out"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 12H4"
                />
              </svg>
            </button>
            <button
              onClick={resetView}
              className="px-3 py-2 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              title="Reset view"
            >
              {Math.round(viewState.scale * 100)}%
            </button>
            <button
              onClick={zoomIn}
              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-r-md transition-colors"
              title="Zoom in"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
            </button>
          </div>

          {selectedTag && (
            <button
              onClick={() => handleTagClick("")}
              className="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
            >
              Clear Selection
            </button>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => setIsDragging(false)}
          onWheel={handleWheel}
          className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 select-none"
        />

        {/* Hover tooltip */}
        {hoveredTag && !isDragging && (
          <div className="absolute top-2 left-2 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800 px-3 py-2 rounded-md text-sm shadow-lg pointer-events-none z-10">
            <div className="font-medium">{hoveredTag}</div>
            <div className="text-xs opacity-75">
              {nodes.find((n) => n.tag === hoveredTag)?.frequency} entities
            </div>
            <div className="text-xs opacity-75">
              {Array.from(
                nodes.find((n) => n.tag === hoveredTag)?.entityTypes || [],
              ).join(", ")}
            </div>
          </div>
        )}

        {/* View state indicator */}
        <div className="absolute bottom-2 right-2 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800 px-2 py-1 rounded text-xs opacity-75">
          {Math.round(viewState.scale * 100)}% | {Math.round(viewState.x)},{" "}
          {Math.round(viewState.y)}
        </div>
      </div>

      {/* Instructions */}
      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <p>
              • <strong>Click</strong> a tag to see its connections and related
              entities
            </p>
            <p>
              • <strong>Drag</strong> to pan around the view
            </p>
            <p>
              • <strong>Scroll</strong> to zoom in/out
            </p>
          </div>
          <div>
            <p>
              • <strong>Node size</strong> indicates how many entities use that
              tag
            </p>
            <p>
              • <strong>Node color</strong> represents the primary entity type
            </p>
            <p>
              • <strong>Connections</strong> show tags that share entities
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterconnectedTagCloud;
