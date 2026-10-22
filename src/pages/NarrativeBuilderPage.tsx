import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  DragEvent,
  MouseEvent,
} from "react";
import {
  ReactFlow,
  Controls,
  Background,
  addEdge,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  OnConnect,
  Connection,
  NodeTypes,
  ReactFlowProvider,
  ReactFlowInstance as ReactFlowInstanceType,
  Handle,
  Position,
  MiniMap,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  FaStream,
  FaProjectDiagram,
  FaBook,
  FaMapMarkerAlt,
  FaUser,
  FaLightbulb,
  FaUsers,
  FaFlask,
  FaPlus,
  FaTrash,
  FaEdit,
  FaArrowLeft,
  FaStickyNote,
  FaTasks,
} from "react-icons/fa";

import { useProjectData } from "../contexts/ProjectDataContext";
import { useNotification } from "../contexts/NotificationContext";
import MainContentArea from "../components/layout/MainContentArea";
import Button from "../components/common/Button";
import Modal from "../components/common/Modal";
import InputField from "../components/common/InputField";
import NarrativeResourcePanel from "../components/NarrativeResourcePanel";
import ContentEditableWithTags, {
  ContentEditableRef,
} from "../components/common/ContentEditableWithTags";
import NotesApp from "../components/notes/NotesApp";
import { ID, ReportType, SceneType, FlowNodeType } from "../types";

const ResourceNode: React.FC<{ data: any }> = ({ data }) => {
  const typeStyles: { [key: string]: { style: string; icon: JSX.Element } } = {
    Character: {
      style:
        "bg-blue-100 border-blue-400 text-blue-800 dark:bg-blue-900/50 dark:border-blue-500 dark:text-blue-200",
      icon: <FaUser />,
    },
    Location: {
      style:
        "bg-green-100 border-green-400 text-green-800 dark:bg-green-900/50 dark:border-green-500 dark:text-green-200",
      icon: <FaMapMarkerAlt />,
    },
    Event: {
      style:
        "bg-amber-100 border-amber-400 text-amber-800 dark:bg-amber-900/50 dark:border-amber-500 dark:text-amber-200",
      icon: <FaLightbulb />,
    },
    Technology: {
      style:
        "bg-purple-100 border-purple-400 text-purple-800 dark:bg-purple-900/50 dark:border-purple-500 dark:text-purple-200",
      icon: <FaFlask />,
    },
    Culture: {
      style:
        "bg-indigo-100 border-indigo-400 text-indigo-800 dark:bg-indigo-900/50 dark:border-indigo-500 dark:text-indigo-200",
      icon: <FaUsers />,
    },
    Task: {
      style:
        "bg-teal-100 border-teal-400 text-teal-800 dark:bg-teal-900/50 dark:border-teal-500 dark:text-teal-200",
      icon: <FaTasks />,
    },
    Source: {
      style:
        "bg-slate-100 border-slate-400 text-slate-800 dark:bg-slate-600/50 dark:border-slate-500 dark:text-slate-200",
      icon: <FaBook />,
    },
  };
  const { style, icon } = typeStyles[data.resourceType] || typeStyles.Source;

  return (
    <div
      className={`relative px-3 py-1.5 rounded-md border shadow-sm w-44 font-sans ${style} hover:shadow-md transition-shadow`}
    >
      <Handle type="target" position={Position.Left} className="!bg-gray-400" />
      <div className="flex items-center justify-center gap-1.5">
        <span className="opacity-80">{icon}</span>
        <div className="flex-1 text-center">
          <div className="text-[10px] font-semibold uppercase opacity-70 mb-0.5 tracking-wide">
            {data.resourceType}
          </div>
          <div className="text-xs font-semibold truncate" title={data.label}>
            {data.label}
          </div>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-gray-400"
      />
    </div>
  );
};

const GenericNode: React.FC<{ data: any }> = ({ data }) => {
  return (
    <div className="relative px-3 py-2 rounded-md border shadow-sm w-44 font-sans bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 hover:shadow-md transition-shadow">
      <Handle type="target" position={Position.Left} className="!bg-gray-400" />
      <div className="text-center">
        <div className="text-xs font-semibold" title={data.label}>
          {data.label}
        </div>
        {data.description && (
          <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
            {data.description}
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-gray-400"
      />
    </div>
  );
};

const ContextMenu: React.FC<{
  id: string;
  top: number;
  left: number;
  onDelete: (id: string) => void;
  onEdit?: (id: string) => void;
}> = ({ id, top, left, onDelete, onEdit }) => {
  return (
    <div
      style={{ top, left }}
      className="absolute z-50 w-40 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5"
    >
      <div className="py-1">
        {onEdit && (
          <button
            onClick={() => onEdit(id)}
            className="w-full text-left block px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <FaEdit className="inline mr-2" />
            Edit Node
          </button>
        )}
        <button
          onClick={() => onDelete(id)}
          className="w-full text-left block px-3 py-1.5 text-xs text-red-700 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <FaTrash className="inline mr-2" />
          Delete Node
        </button>
      </div>
    </div>
  );
};

const GenericNodeModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (label: string, description: string) => void;
  existingNode?: { label: string; description: string };
}> = ({ isOpen, onClose, onSave, existingNode }) => {
  const [label, setLabel] = useState(existingNode?.label || "");
  const [description, setDescription] = useState(
    existingNode?.description || "",
  );

  useEffect(() => {
    if (existingNode) {
      setLabel(existingNode.label || "");
      setDescription(existingNode.description || "");
    } else {
      setLabel("");
      setDescription("");
    }
  }, [existingNode, isOpen]);

  const handleSave = () => {
    if (!label.trim()) return;
    onSave(label, description);
    setLabel("");
    setDescription("");
    onClose();
  };

  const handleClose = () => {
    setLabel("");
    setDescription("");
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={existingNode ? "Edit Node" : "Create Generic Node"}
    >
      <div className="space-y-4">
        <InputField
          label="Label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          required
        />
        <InputField
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          as="textarea"
          rows={3}
        />
      </div>
      <div className="mt-6 flex justify-end space-x-2">
        <Button variant="outline" onClick={handleClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave}>
          {existingNode ? "Save Changes" : "Create Node"}
        </Button>
      </div>
    </Modal>
  );
};

const NarrativeBuilderPageInternal: React.FC<{
  section: "narrative" | "flows";
}> = ({ section }) => {
  const isFlowsSection = section === "flows";
  const {
    project,
    addReport,
    updateReport,
    deleteReport,
    addScene,
    updateScene,
    deleteScene,
  } = useProjectData();
  const { showSuccess, showError } = useNotification();
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNodeType>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstanceType<any, any> | null>(null);

  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    id: string;
    top: number;
    left: number;
  } | null>(null);
  const [selectedNarrativeId, setSelectedNarrativeId] = useState<ID | null>(
    null,
  );
  const [viewMode, setViewMode] = useState<"list" | "flow" | "notes">(
    isFlowsSection ? "flow" : "list",
  );
  const [sceneViewMode, setSceneViewMode] = useState<"list" | "view" | "edit">(
    "list",
  );

  const lastNodePosition = useRef({ x: 100, y: 100 });

  const [selectedSceneId, setSelectedSceneId] = useState<ID | null>(null);
  const [sceneTitle, setSceneTitle] = useState("");
  const [sceneDescription, setSceneDescription] = useState("");
  const [sceneContent, setSceneContent] = useState("");
  const sceneContentRef = useRef<ContentEditableRef>(null);
  const [contentKey, setContentKey] = useState(0);

  const [isNarrativeModalOpen, setIsNarrativeModalOpen] = useState(false);
  const [isDeleteNarrativeModalOpen, setIsDeleteNarrativeModalOpen] =
    useState(false);
  const [isDeleteSceneModalOpen, setIsDeleteSceneModalOpen] = useState(false);
  const [isGenericNodeModalOpen, setIsGenericNodeModalOpen] = useState(false);

  const [isEditingNarrative, setIsEditingNarrative] = useState<boolean>(false);
  const [narrativeTitle, setNarrativeTitle] = useState("");
  const [narrativeDescription, setNarrativeDescription] = useState("");
  const [narrativeTimelineId, setNarrativeTimelineId] = useState<ID | "">("");
  const [reportType, setNarrativeType] = useState<
    "linear" | "flow" | "note"
  >(
    "linear",
  );

  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);

  const nodeTypes: NodeTypes = useMemo(
    () => ({
      resource: ResourceNode,
      generic: GenericNode,
    }),
    [],
  );

  const sectionReports = useMemo(
    () =>
      (project?.reports || []).filter((report) =>
        isFlowsSection
          ? report.reportType === "flow" || report.reportType === "note"
          : report.reportType !== "flow" && report.reportType !== "note",
      ),
    [project?.reports, isFlowsSection],
  );

  const selectedNarrative = useMemo(
    () => project?.reports.find((n) => n.id === selectedNarrativeId) || null,
    [project?.reports, selectedNarrativeId],
  );

  const selectedScene = useMemo(
    () =>
      selectedNarrative?.scenes?.find((s) => s.id === selectedSceneId) || null,
    [selectedNarrative, selectedSceneId],
  );
  const sceneForDeleteModal = useMemo(
    () =>
      selectedNarrative?.scenes?.find((s) => s.id === selectedSceneId) || null,
    [selectedNarrative, selectedSceneId],
  );

  const processContentForDisplay = useCallback((content: string) => {
    if (!content) return "";

    // Parse HTML content to extract text and resource references
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, "text/html");

    const resourceTags = doc.querySelectorAll(".resource-tag");

    const elements: JSX.Element[] = [];
    let lastIndex = 0;
    let key = 0;

    // Get the full HTML string
    const fullHtml = doc.body.innerHTML;

    // Process the content to create JSX elements
    resourceTags.forEach((tag) => {
      const resourceId = tag.getAttribute("data-id");
      const resourceType = tag.getAttribute("data-type");
      const resourceName =
        tag.getAttribute("data-name") || tag.textContent || "Unknown";

      // Find the position of this tag in the HTML
      const tagHtml = tag.outerHTML;
      const tagIndex = fullHtml.indexOf(tagHtml, lastIndex);

      if (tagIndex > lastIndex) {
        // Add text before the tag
        const textBefore = fullHtml.substring(lastIndex, tagIndex);
        if (textBefore) {
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = textBefore;
          const text = tempDiv.textContent || "";
          if (text) {
            elements.push(<span key={key++}>{text}</span>);
          }
        }
      }

      // Add the resource tag as a styled span
      elements.push(
        <span
          key={key++}
          className="inline-block bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-0.5 rounded-full text-sm mx-0.5"
        >
          {resourceName}
        </span>,
      );

      lastIndex = tagIndex + tagHtml.length;
    });

    // Add any remaining text after the last tag
    if (lastIndex < fullHtml.length) {
      const textAfter = fullHtml.substring(lastIndex);
      if (textAfter) {
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = textAfter;
        const text = tempDiv.textContent || "";
        if (text) {
          elements.push(<span key={key++}>{text}</span>);
        }
      }
    }

    // If no resource tags, just return the text content
    if (elements.length === 0) {
      return doc.body.textContent || "";
    }

    return elements;
  }, []);

  const SceneCard: React.FC<{
    scene: SceneType;
    onClick: () => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    isFirst: boolean;
    isLast: boolean;
  }> = ({ scene, onClick, onMoveUp, onMoveDown, isFirst, isLast }) => {
    const displayContent = processContentForDisplay(scene.content);
    const contentText =
      typeof displayContent === "string"
        ? displayContent
        : scene.content?.replace(/<[^>]*>/g, "").substring(0, 150);

    return (
      <div
        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2 hover:shadow-sm transition-shadow cursor-pointer"
        onClick={onClick}
      >
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {scene.order}. {scene.title || "Untitled Scene"}
            </h3>
            {scene.description && (
              <p
                className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1"
                title={scene.description}
              >
                {scene.description}
              </p>
            )}
          </div>
          <div className="flex flex-col space-y-1 ml-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onMoveUp) onMoveUp();
              }}
              className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
                isFirst ? "opacity-30 cursor-not-allowed" : ""
              }`}
              disabled={isFirst}
              title="Move up"
            >
              <svg
                className="h-4 w-4 text-gray-500 dark:text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 15l7-7 7 7"
                />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onMoveDown) onMoveDown();
              }}
              className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
                isLast ? "opacity-30 cursor-not-allowed" : ""
              }`}
              disabled={isLast}
              title="Move down"
            >
              <svg
                className="h-4 w-4 text-gray-500 dark:text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          </div>
        </div>
        {contentText && (
          <div className="mt-1.5 text-xs text-gray-600 dark:text-gray-300 line-clamp-2">
            <div title={contentText}>
              {contentText}
              {contentText.length > 150 ? "..." : ""}
            </div>
          </div>
        )}
      </div>
    );
  };

  useEffect(() => {
    if (sectionReports.length > 0 && !selectedNarrativeId) {
      setSelectedNarrativeId(sectionReports[0].id);
    }
  }, [sectionReports, selectedNarrativeId]);

  useEffect(() => {
    if (selectedNarrative) {
      if (isFlowsSection) {
        setViewMode(
          selectedNarrative.reportType === "note" ? "notes" : "flow",
        );
      } else {
        setViewMode("list");
      }
      if (selectedNarrative.reportType === "flow") {
        setNodes(selectedNarrative.nodes || []);
        setEdges(selectedNarrative.edges || []);
      }
      setSceneViewMode("list");
      setSelectedSceneId(null);
    }
  }, [selectedNarrative, isFlowsSection, setNodes, setEdges]);

  const onConnect: OnConnect = useCallback(
    (params) => {
      const label = prompt("Label this connection (optional):");
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: "smoothstep",
            animated: true,
            label: label || undefined,
            style: { stroke: "#6366f1", strokeWidth: 2 },
          } as Edge,
          eds,
        ),
      );
    },
    [setEdges],
  );

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setIsDraggingOver(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setIsDraggingOver(false);
  }, []);

  const onPaneClick = useCallback(() => setContextMenu(null), []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      setIsDraggingOver(false);

      console.log("[onDrop] Event Fired.");
      console.log(
        "[onDrop] Available DataTransfer types:",
        event.dataTransfer.types,
      );

      // --- Attempt to get primary data types ---
      let type = event.dataTransfer.getData("application/reactflow-type");
      let name = event.dataTransfer.getData("application/reactflow-name");
      let id = event.dataTransfer.getData("application/reactflow-id");

      console.log("[onDrop] Read primary data:", { type, name, id });

      // --- Fallback for browsers or environments that clear custom types ---
      if (!type && event.dataTransfer.types.includes("text/plain")) {
        console.log("[onDrop] Primary types empty. Using text/plain fallback.");
        try {
          const data = JSON.parse(event.dataTransfer.getData("text/plain"));
          type = data.type;
          name = data.name;
          id = data.id;
          console.log("[onDrop] Parsed fallback data:", { type, name, id });
        } catch (e) {
          console.error("Failed to parse text/plain data from drop event", e);
          showError("Error processing dropped item.");
          return;
        }
      }

      if (!reactFlowWrapper.current || !reactFlowInstance) {
        console.error("React Flow instance not available on drop.");
        showError("Flow canvas is not ready to accept nodes.");
        return;
      }

      if (!type || !name || !id) {
        console.error(
          "Missing required data for dropped node even after fallback.",
        );
        showError("Could not identify the dropped item.");
        return;
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: FlowNodeType = {
        id: `${type}-${id}-${Date.now()}`,
        type: "resource",
        position,
        data: {
          label: name,
          resourceId: id,
          resourceType: type,
        },
      };

      setNodes((nds) => nds.concat(newNode));
      showSuccess(`Added '${name}' to the flow.`);
    },
    [reactFlowInstance, setNodes, showSuccess, showError],
  );

  const handleCreateNarrative = () => {
    setIsEditingNarrative(false);
    setNarrativeTitle("");
    setNarrativeDescription("");
    setNarrativeTimelineId("");
    setNarrativeType(isFlowsSection ? "flow" : "linear");
    setIsNarrativeModalOpen(true);
  };

  const handleEditNarrative = () => {
    if (!selectedNarrative) return;
    setIsEditingNarrative(true);
    setNarrativeTitle(selectedNarrative.title);
    setNarrativeDescription(selectedNarrative.description);
    setNarrativeTimelineId(selectedNarrative.timelineId || "");
    setNarrativeType(selectedNarrative.reportType || "linear");
    setIsNarrativeModalOpen(true);
  };

  const handleSaveNarrative = () => {
    if (!narrativeTitle.trim())
      return showError("Narrative title is required.");

    if (isEditingNarrative && selectedNarrative) {
      updateReport({
        ...selectedNarrative,
        title: narrativeTitle,
        description: narrativeDescription,
        timelineId: narrativeTimelineId || null,
        reportType,
        updatedAt: new Date().toISOString(),
      });
      showSuccess("Narrative updated.");
    } else {
      const newNarrative = {
        title: narrativeTitle,
        description: narrativeDescription,
        reportType,
        content: "",
        scenes: [],
        nodes: [],
        edges: [],
        timelineId: narrativeTimelineId || null,
        characterIds: [],
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      addReport(newNarrative);
      showSuccess("Narrative created.");
    }
    setIsNarrativeModalOpen(false);
  };

  const handleDeleteNarrative = () => {
    if (!selectedNarrative) return;
    deleteReport(selectedNarrative.id);
    setIsDeleteNarrativeModalOpen(false);
    setSelectedNarrativeId(null);
    showSuccess("Narrative deleted.");
  };

  const handleCreateScene = () => {
    setSceneViewMode("edit");
    setSelectedSceneId(null);
    setSceneTitle("");
    setSceneDescription("");
    setSceneContent("");
    setContentKey((prev) => prev + 1);
  };

  const handleSelectScene = (scene: SceneType) => {
    setSelectedSceneId(scene.id);
    setSceneViewMode("view");
  };

  const handleEditScene = () => {
    if (!selectedScene) return;
    setSceneTitle(selectedScene.title || "");
    setSceneDescription(selectedScene.description || "");
    setSceneContent(selectedScene.content || "");
    setContentKey((prev) => prev + 1);
    setSceneViewMode("edit");
  };

  const handleBackToList = () => {
    setSceneViewMode("list");
    setSelectedSceneId(null);
    setSceneTitle("");
    setSceneDescription("");
    setSceneContent("");
  };

  const handleSaveScene = () => {
    if (!selectedNarrativeId) return showError("No narrative selected.");
    if (!sceneTitle.trim()) return showError("Scene title cannot be empty.");

    if (selectedSceneId) {
      const originalScene = selectedNarrative?.scenes.find(
        (s) => s.id === selectedSceneId,
      );
      if (!originalScene) return;

      const updatedScene: SceneType = {
        ...originalScene,
        title: sceneTitle,
        description: sceneDescription,
        content: sceneContent,
      };
      updateScene(selectedNarrativeId, updatedScene);
      showSuccess("Scene updated.");
    } else {
      const newScene: Omit<SceneType, "id"> = {
        title: sceneTitle,
        description: sceneDescription,
        content: sceneContent,
        order: (selectedNarrative?.scenes?.length || 0) + 1,
        characters: [],
        locations: [],
        eventIds: [],
        technologies: [],
        cultures: [],
        sources: [],
        notes: "",
      };
      addScene(selectedNarrativeId, newScene);
      showSuccess("Scene created.");
    }
    setSceneViewMode("list");
    setSelectedSceneId(null);
    setSceneTitle("");
    setSceneDescription("");
    setSceneContent("");
  };

  const handleCancelEditScene = () => {
    if (selectedSceneId) {
      setSceneViewMode("view");
    } else {
      setSceneViewMode("list");
    }
    setSceneTitle("");
    setSceneDescription("");
    setSceneContent("");
  };

  const handleDeleteScene = () => {
    if (!selectedNarrative || !sceneForDeleteModal) return;
    deleteScene(selectedNarrative.id, sceneForDeleteModal.id);
    setIsDeleteSceneModalOpen(false);
    setSceneViewMode("list");
    setSelectedSceneId(null);
    setSceneTitle("");
    setSceneDescription("");
    setSceneContent("");
    showSuccess("Scene deleted successfully.");
  };

  const handleMoveScene = (sceneId: ID, direction: "up" | "down") => {
    if (!selectedNarrative) return;
    const currentScenes = [...(selectedNarrative.scenes || [])].sort(
      (a, b) => a.order - b.order,
    );
    const sceneIndex = currentScenes.findIndex((s) => s.id === sceneId);

    if (sceneIndex === -1) return;

    const targetIndex = direction === "up" ? sceneIndex - 1 : sceneIndex + 1;
    if (targetIndex < 0 || targetIndex >= currentScenes.length) return;

    const temp = currentScenes[sceneIndex];
    currentScenes[sceneIndex] = currentScenes[targetIndex];
    currentScenes[targetIndex] = temp;

    const updatedScenesWithOrder = currentScenes.map((s, idx) => ({
      ...s,
      order: idx + 1,
    }));

    const updatedNarrative: ReportType = {
      ...selectedNarrative,
      scenes: updatedScenesWithOrder,
      updatedAt: new Date().toISOString(),
    };
    updateReport(updatedNarrative);
    showSuccess(`Scene moved ${direction}.`);
  };

  const handleMoveSceneUp = (sceneId: ID) => handleMoveScene(sceneId, "up");
  const handleMoveSceneDown = (sceneId: ID) => handleMoveScene(sceneId, "down");

  const onNodeContextMenu = useCallback((event: MouseEvent, node: Node) => {
    event.preventDefault();
    const pane = reactFlowWrapper.current?.getBoundingClientRect();
    if (!pane) return;
    setContextMenu({
      id: node.id,
      top: event.clientY - pane.top,
      left: event.clientX - pane.left,
    });
  }, []);

  const deleteNodeById = (idToDelete: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== idToDelete));
    setEdges((eds) =>
      eds.filter(
        (edge) => edge.source !== idToDelete && edge.target !== idToDelete,
      ),
    );
    setContextMenu(null);
    showSuccess("Node deleted.");
  };

  const editNodeById = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (node && node.type === "generic") {
      setEditingNodeId(nodeId);
      setIsGenericNodeModalOpen(true);
    }
    setContextMenu(null);
  };

  const handleSaveFlow = () => {
    if (!selectedNarrative) return;
    updateReport({
      ...selectedNarrative,
      nodes,
      edges,
      updatedAt: new Date().toISOString(),
    });
    showSuccess("Flow saved successfully.");
  };

  const handleInsertResource = (type: string, name: string, id: ID) => {
    if (viewMode === "list") {
      if (sceneViewMode === "edit" && sceneContentRef.current) {
        const html = `<span contentEditable="false" class="resource-tag bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-0.5 rounded-full text-sm inline-block mx-0.5 cursor-default" data-id="${id}" data-type="${type}" data-name="${name}">${name}</span>&nbsp;`;
        sceneContentRef.current.insertHtml(html);
      } else {
        showError("Enter edit mode to insert resources.");
      }
      return;
    }

    if (viewMode === "flow") {
      if (!reactFlowInstance) {
        showError("Flow canvas is not ready. Please wait and try again.");
        return;
      }

      const currentNodes = nodes;
      let position;

      if (currentNodes.length === 0) {
        position = { x: 250, y: 250 };
      } else {
        const offset = 50;
        position = {
          x: lastNodePosition.current.x + offset,
          y: lastNodePosition.current.y + offset,
        };

        if (position.x > 800) {
          position.x = 100;
          position.y += 100;
        }
        if (position.y > 600) {
          position.y = 100;
        }
      }

      lastNodePosition.current = position;

      const newNode: FlowNodeType = {
        id: `${type}-${id}-${Date.now()}`,
        type: "resource",
        position,
        data: {
          label: name,
          resourceId: id,
          resourceType: type,
        },
      };

      setNodes((nds) => nds.concat(newNode));
      showSuccess(`Added '${name}' to the flow.`);
    }
  };

  const handleCreateGenericNode = () => {
    setEditingNodeId(null);
    setIsGenericNodeModalOpen(true);
  };

  const handleSaveGenericNode = (label: string, description: string) => {
    if (editingNodeId) {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === editingNodeId
            ? { ...node, data: { ...node.data, label, description } }
            : node,
        ),
      );
      showSuccess("Node updated.");
    } else {
      if (!reactFlowInstance || !reactFlowWrapper.current) {
        showError("Flow canvas is not ready. Please wait and try again.");
        return;
      }

      const currentNodes = nodes;
      let position;

      if (currentNodes.length === 0) {
        position = { x: 250, y: 250 };
      } else {
        const offset = 50;
        position = {
          x: lastNodePosition.current.x + offset,
          y: lastNodePosition.current.y + offset,
        };

        if (position.x > 800) {
          position.x = 100;
          position.y += 100;
        }
        if (position.y > 600) {
          position.y = 100;
        }
      }

      lastNodePosition.current = position;

      const newNode: FlowNodeType = {
        id: `generic-${Date.now()}`,
        type: "generic",
        position,
        data: { label, description, resourceId: "", resourceType: "generic" },
      };

      setNodes((nds) => nds.concat(newNode));
      showSuccess("Generic node created.");
    }
    setEditingNodeId(null);
  };

  const renderFlowView = () => (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center p-2.5 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex space-x-2">
          <Button size="sm" variant="outline" onClick={handleCreateGenericNode}>
            <FaPlus className="mr-1" />
            Add Node
          </Button>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Drag resources from the right panel or create custom nodes
        </div>
      </div>

      <div
        className={`flex-1 rounded-lg overflow-hidden border-2 relative transition-colors ${
          isDraggingOver
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
            : "border-gray-200 dark:border-gray-700"
        }`}
        ref={reactFlowWrapper}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onDragOver={onDragOver}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={(instance) => setReactFlowInstance(instance as any)}
          nodeTypes={nodeTypes}
          onNodeContextMenu={onNodeContextMenu}
          onPaneClick={onPaneClick}
          fitView
          className="bg-gray-50 dark:bg-gray-900"
        >
          <div
            className={`absolute inset-0 transition-opacity duration-300 pointer-events-none flex items-center justify-center ${
              isDraggingOver ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="bg-blue-100 dark:bg-blue-800 border-2 border-dashed border-blue-400 rounded-lg p-6 text-center">
              <FaPlus className="mx-auto h-6 w-6 text-blue-600 dark:text-blue-300 mb-2" />
              <p className="text-blue-600 dark:text-blue-300 font-medium">
                Drop resources here to add to flow
              </p>
            </div>
          </div>
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
        {contextMenu && (
          <ContextMenu
            {...contextMenu}
            onDelete={deleteNodeById}
            onEdit={editNodeById}
          />
        )}
      </div>
    </div>
  );

  const renderSceneList = () => (
    <div>
      <div className="flex justify-end mb-2">
        <Button variant="primary" size="sm" onClick={handleCreateScene}>
          Add Scene
        </Button>
      </div>
      <div className="space-y-2">
        {selectedNarrative?.scenes && selectedNarrative.scenes.length > 0 ? (
          selectedNarrative.scenes
            .sort((a, b) => a.order - b.order)
            .map((scene, i, arr) => (
              <SceneCard
                key={scene.id}
                scene={scene}
                onClick={() => handleSelectScene(scene)}
                onMoveUp={() => handleMoveSceneUp(scene.id)}
                onMoveDown={() => handleMoveSceneDown(scene.id)}
                isFirst={i === 0}
                isLast={i === arr.length - 1}
              />
            ))
        ) : (
          <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
            No scenes yet. Click "Add Scene" to create your first scene.
          </div>
        )}
      </div>
    </div>
  );

  const renderSceneView = () => {
    if (!selectedScene) return null;

    const displayContent = processContentForDisplay(selectedScene.content);

    return (
      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
              Scene {selectedScene.order}: {selectedScene.title}
            </h2>
            {selectedScene.description && (
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {selectedScene.description}
              </p>
            )}
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" onClick={handleBackToList}>
              <FaArrowLeft className="mr-1" />
              Back to List
            </Button>
            <Button variant="primary" size="sm" onClick={handleEditScene}>
              <FaEdit className="mr-1" />
              Edit
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setIsDeleteSceneModalOpen(true)}
            >
              <FaTrash className="mr-1" />
              Delete
            </Button>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg min-h-[100px]">
          {selectedScene.content ? (
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800 dark:text-gray-200">
              {typeof displayContent === "string"
                ? displayContent
                : displayContent}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
              No content added to this scene yet.
            </p>
          )}
        </div>
      </div>
    );
  };

  const renderSceneEditor = () => (
    <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">
      <h3 className="text-sm font-semibold mb-2 text-gray-900 dark:text-white">
        {selectedSceneId ? "Edit Scene" : "New Scene"}
      </h3>
      <div className="space-y-3">
        <InputField
          label="Scene Title"
          value={sceneTitle}
          onChange={(e) => setSceneTitle(e.target.value)}
          required
        />
        <InputField
          label="Brief Description"
          as="textarea"
          rows={2}
          value={sceneDescription}
          onChange={(e) => setSceneDescription(e.target.value)}
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Content
          </label>
          <ContentEditableWithTags
            key={contentKey}
            ref={sceneContentRef}
            value={sceneContent}
            onChange={(html) => setSceneContent(html)}
            className="w-full min-h-[100px] p-2 text-sm border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>
      <div className="flex justify-end space-x-2 mt-4">
        <Button variant="outline" onClick={handleCancelEditScene}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSaveScene}>
          Save Scene
        </Button>
      </div>
    </div>
  );

  return (
    <MainContentArea
      title={isFlowsSection ? "Flows & Notes" : "Narrative Builder"}
      noPadding={true}
      actions={
        isFlowsSection && selectedNarrative?.reportType === "flow" ? (
          <Button variant="primary" onClick={handleSaveFlow}>
            Save Flow
          </Button>
        ) : undefined
      }
    >
      <div className="h-full flex overflow-hidden bg-gray-50 dark:bg-gray-900">
        <div className="w-56 flex-shrink-0 bg-white dark:bg-gray-800 p-2 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full overflow-hidden">
          <div className="flex justify-between items-center mb-3 px-1">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              {isFlowsSection ? "Flows & notes" : "Stories & diary"}
            </h2>
            <Button size="sm" onClick={handleCreateNarrative}>
              New
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {sectionReports.map((n) => {
              const isSelected = selectedNarrativeId === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => setSelectedNarrativeId(n.id)}
                  className={`w-full text-left p-1.5 rounded-md transition-colors flex items-start gap-2 ${
                    isSelected
                      ? "bg-blue-600 text-white"
                      : "hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  <FaBook
                    className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 ${
                      isSelected
                        ? "text-blue-200"
                        : "text-gray-400 dark:text-gray-500"
                    }`}
                  />
                  <div className="flex-1 overflow-hidden">
                    <p
                      className={`text-sm font-medium truncate ${
                        isSelected
                          ? "text-white"
                          : "text-gray-800 dark:text-gray-100"
                      }`}
                    >
                      {n.title}
                    </p>
                    <p
                      className={`text-xs line-clamp-2 ${
                        isSelected
                          ? "text-blue-200"
                          : "text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      {n.description}
                    </p>
                    <div
                      className={`text-xs mt-1 ${
                        isSelected ? "text-blue-200" : "text-gray-400"
                      }`}
                    >
                      {n.reportType === "flow"
                        ? "Flow Chart"
                        : n.reportType === "note"
                          ? "Note"
                          : "Story"}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0 bg-gray-50 dark:bg-gray-900 h-full overflow-hidden">
          {selectedNarrative ? (
            <>
              <div className="p-2.5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                    {selectedNarrative.title}
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                    {selectedNarrative.description}
                  </p>
                </div>
                <div className="flex space-x-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleEditNarrative}
                  >
                    Edit Details
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setIsDeleteNarrativeModalOpen(true)}
                  >
                    Delete
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-hidden">
                {selectedNarrative.reportType === "note" ? (
                  <NotesApp
                    project={project}
                    documentId={selectedNarrative.id}
                    initialContent={selectedNarrative.content || ""}
                    onContentChange={(content) =>
                      updateReport({
                        ...selectedNarrative,
                        content,
                        updatedAt: new Date().toISOString(),
                      })
                    }
                  />
                ) : selectedNarrative.reportType === "flow" ? (
                  renderFlowView()
                ) : (
                  <div className="h-full overflow-y-auto p-3">
                    {sceneViewMode === "list" && renderSceneList()}
                    {sceneViewMode === "view" && renderSceneView()}
                    {sceneViewMode === "edit" && renderSceneEditor()}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 h-full">
              <p className="text-sm text-gray-500">
                {isFlowsSection
                  ? "Create or select a flow or note to begin."
                  : "Create or select a story to begin."}
              </p>
              <Button size="sm" onClick={handleCreateNarrative}>
                New {isFlowsSection ? "flow" : "story"}
              </Button>
            </div>
          )}
        </div>

        {selectedNarrative?.reportType !== "note" && (
          <div className="w-60 flex-shrink-0 h-full overflow-hidden">
            <NarrativeResourcePanel onInsertResource={handleInsertResource} />
          </div>
        )}
      </div>

      <Modal
        isOpen={isNarrativeModalOpen}
        onClose={() => setIsNarrativeModalOpen(false)}
        title={
          isEditingNarrative
            ? isFlowsSection
              ? "Edit Flow or Note"
              : "Edit Story"
            : isFlowsSection
              ? "New Flow or Note"
              : "New Story"
        }
      >
        <div className="space-y-4">
          <InputField
            label="Title"
            value={narrativeTitle}
            onChange={(e) => setNarrativeTitle(e.target.value)}
            required
          />
          <InputField
            label="Description"
            value={narrativeDescription}
            onChange={(e) => setNarrativeDescription(e.target.value)}
            as="textarea"
            rows={3}
          />
          {isFlowsSection && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Type
              </label>
              <select
                value={reportType}
                onChange={(e) =>
                  setNarrativeType(e.target.value as "flow" | "note")
                }
                className="w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-md"
              >
                <option value="flow">Flow chart</option>
                <option value="note">Note</option>
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Associated Timeline
            </label>
            <select
              value={narrativeTimelineId}
              onChange={(e) => setNarrativeTimelineId(e.target.value)}
              className="w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-md"
            >
              <option value="">None</option>
              {project?.timelines.map((timeline) => (
                <option key={timeline.id} value={timeline.id}>
                  {timeline.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-6 flex justify-end space-x-2">
          <Button
            variant="outline"
            onClick={() => setIsNarrativeModalOpen(false)}
          >
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSaveNarrative}>
            {isEditingNarrative
              ? "Save Changes"
              : isFlowsSection
                ? "Create Flow or Note"
                : "Create Story"}
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={isDeleteNarrativeModalOpen}
        onClose={() => setIsDeleteNarrativeModalOpen(false)}
        title={isFlowsSection ? "Delete Flow or Note" : "Delete Story"}
      >
        <p>
          Are you sure you want to delete "{selectedNarrative?.title}"? This
          action cannot be undone.
        </p>
        <div className="mt-6 flex justify-end space-x-2">
          <Button
            variant="outline"
            onClick={() => setIsDeleteNarrativeModalOpen(false)}
          >
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDeleteNarrative}>
            Delete
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={isDeleteSceneModalOpen}
        onClose={() => setIsDeleteSceneModalOpen(false)}
        title="Delete Scene"
        size="sm"
      >
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Are you sure you want to delete "
          {sceneForDeleteModal?.title || "this scene"}"? This action cannot be
          undone.
        </p>
        <div className="flex justify-end space-x-3">
          <Button
            variant="outline"
            onClick={() => setIsDeleteSceneModalOpen(false)}
          >
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDeleteScene}>
            Delete
          </Button>
        </div>
      </Modal>

      <GenericNodeModal
        isOpen={isGenericNodeModalOpen}
        onClose={() => {
          setIsGenericNodeModalOpen(false);
          setEditingNodeId(null);
        }}
        onSave={handleSaveGenericNode}
        existingNode={
          editingNodeId
            ? (nodes.find((n) => n.id === editingNodeId)?.data as any)
            : undefined
        }
      />
    </MainContentArea>
  );
};

interface NarrativeBuilderPageProps {
  section?: "narrative" | "flows";
}

const NarrativeBuilderPage: React.FC<NarrativeBuilderPageProps> = ({
  section = "narrative",
}) => (
  <ReactFlowProvider>
    <NarrativeBuilderPageInternal section={section} />
  </ReactFlowProvider>
);

export default NarrativeBuilderPage;
