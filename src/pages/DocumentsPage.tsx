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
  BackgroundVariant,
  addEdge,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  OnConnect,
  Connection,
  NodeTypes,
  EdgeTypes,
  ReactFlowProvider,
  ReactFlowInstance as ReactFlowInstanceType,
  Handle,
  Position,
  MiniMap,
  Panel,
  MarkerType,
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  getBezierPath,
  getStraightPath,
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
  FaFolder,
  FaFile,
  FaLink,
  FaCog,
  FaEllipsisV,
  FaFont,
  FaSquare,
  FaCircle,
  FaPalette,
  FaArrowRight,
  FaArrowDown,
  FaArrowUp,
  FaEye,
  FaDrawPolygon,
  FaMap,
  FaClock,
} from "react-icons/fa";

import { useProjectData } from "../contexts/ProjectDataContext";
import { useNotification } from "../contexts/NotificationContext";
import { useAppState } from "../contexts/AppStateContext";
import MainContentArea from "../components/layout/MainContentArea";
import Button from "../components/common/Button";
import Modal from "../components/common/Modal";
import InputField from "../components/common/InputField";
import NarrativeResourcePanel from "../components/NarrativeResourcePanel";
import NotesApp from "../components/notes/NotesApp";
import { ID, SceneType, FlowNodeType } from "../types";

// Document types
type DocumentType = "scenes" | "flow" | "notes" | "file";
type NodeShape = "rectangle" | "rounded" | "circle" | "diamond";

interface DocumentCategory {
  id: string;
  name: string;
  color: string;
}

interface Document {
  id: string;
  title: string;
  description: string;
  type: DocumentType;
  categoryId: string;
  content: any;
  linkedFile?: {
    name: string;
    path: string;
    type: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface Scene {
  id: string;
  title: string;
  description: string;
  content: string;
  order: number;
}

const DEFAULT_CATEGORIES: DocumentCategory[] = [
  { id: "narratives", name: "Narratives", color: "blue" },
  { id: "worldbuilding", name: "World Building", color: "green" },
  { id: "research", name: "Research", color: "purple" },
  { id: "sources", name: "Sources", color: "gray" },
];

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
    Source: {
      style:
        "bg-slate-100 border-slate-400 text-slate-800 dark:bg-slate-600/50 dark:border-slate-500 dark:text-slate-200",
      icon: <FaBook />,
    },
    Timeline: {
      style:
        "bg-teal-100 border-teal-400 text-teal-800 dark:bg-teal-900/50 dark:border-teal-500 dark:text-teal-200",
      icon: <FaClock />,
    },
    MapShape: {
      style:
        "bg-orange-100 border-orange-400 text-orange-800 dark:bg-orange-900/50 dark:border-orange-500 dark:text-orange-200",
      icon: <FaDrawPolygon />,
    },
    MapScenario: {
      style:
        "bg-pink-100 border-pink-400 text-pink-800 dark:bg-pink-900/50 dark:border-pink-500 dark:text-pink-200",
      icon: <FaMap />,
    },
  };
  const { style, icon } = typeStyles[data.resourceType] || typeStyles.Source;

  return (
    <div
      className={`relative px-4 py-2 rounded-lg border-2 shadow-md w-48 font-sans ${style} hover:shadow-lg transition-shadow`}
    >
      {/* Top handles */}
      <Handle
        type="source"
        position={Position.Top}
        className="!bg-gray-500 !w-3 !h-3 hover:!bg-blue-500"
        id="top-source"
      />
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-gray-500 !w-3 !h-3 hover:!bg-blue-500"
        id="top-target"
      />

      {/* Left handles */}
      <Handle
        type="source"
        position={Position.Left}
        className="!bg-gray-500 !w-3 !h-3 hover:!bg-blue-500"
        id="left-source"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-gray-500 !w-3 !h-3 hover:!bg-blue-500"
        id="left-target"
      />

      <div className="flex items-center justify-center gap-2">
        <span className="opacity-80">{icon}</span>
        <div className="flex-1 text-center">
          <div className="text-xs font-bold uppercase opacity-70 mb-1 tracking-wider">
            {data.resourceType}
          </div>
          <div className="text-sm font-semibold truncate" title={data.label}>
            {data.label}
          </div>
        </div>
      </div>

      {/* Right handles */}
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-gray-500 !w-3 !h-3 hover:!bg-blue-500"
        id="right-source"
      />
      <Handle
        type="target"
        position={Position.Right}
        className="!bg-gray-500 !w-3 !h-3 hover:!bg-blue-500"
        id="right-target"
      />

      {/* Bottom handles */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-gray-500 !w-3 !h-3 hover:!bg-blue-500"
        id="bottom-source"
      />
      <Handle
        type="target"
        position={Position.Bottom}
        className="!bg-gray-500 !w-3 !h-3 hover:!bg-blue-500"
        id="bottom-target"
      />
    </div>
  );
};

const GenericNode: React.FC<{ data: any }> = ({ data }) => {
  const shape = data.shape || "rectangle";
  const bgColor = data.bgColor || "bg-white dark:bg-gray-800";
  const borderColor =
    data.borderColor || "border-gray-300 dark:border-gray-600";
  const textColor = data.textColor || "text-gray-800 dark:text-gray-200";

  const shapeClasses = {
    rectangle: "rounded-none",
    rounded: "rounded-lg",
    circle: "rounded-full aspect-square flex items-center justify-center",
    diamond: "transform rotate-45",
  };

  const contentClasses = shape === "diamond" ? "transform -rotate-45" : "";

  return (
    <div
      className={`relative px-4 py-3 border-2 shadow-md w-48 font-sans ${bgColor} ${borderColor} ${textColor} hover:shadow-lg transition-shadow ${shapeClasses[shape]}`}
    >
      {/* Top handles */}
      <Handle
        type="source"
        position={Position.Top}
        className="!bg-gray-500 !w-3 !h-3 hover:!bg-blue-500"
        id="top-source"
      />
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-gray-500 !w-3 !h-3 hover:!bg-blue-500"
        id="top-target"
      />

      {/* Left handles */}
      <Handle
        type="source"
        position={Position.Left}
        className="!bg-gray-500 !w-3 !h-3 hover:!bg-blue-500"
        id="left-source"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-gray-500 !w-3 !h-3 hover:!bg-blue-500"
        id="left-target"
      />

      <div className={`text-center ${contentClasses}`}>
        <div className="text-sm font-semibold" title={data.label}>
          {data.label}
        </div>
        {data.description && (
          <div className="text-xs opacity-75 mt-1 line-clamp-2">
            {data.description}
          </div>
        )}
      </div>

      {/* Right handles */}
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-gray-500 !w-3 !h-3 hover:!bg-blue-500"
        id="right-source"
      />
      <Handle
        type="target"
        position={Position.Right}
        className="!bg-gray-500 !w-3 !h-3 hover:!bg-blue-500"
        id="right-target"
      />

      {/* Bottom handles */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-gray-500 !w-3 !h-3 hover:!bg-blue-500"
        id="bottom-source"
      />
      <Handle
        type="target"
        position={Position.Bottom}
        className="!bg-gray-500 !w-3 !h-3 hover:!bg-blue-500"
        id="bottom-target"
      />
    </div>
  );
};

const TextNode: React.FC<{ data: any }> = ({ data }) => {
  return (
    <div className="relative p-4 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-300 dark:border-yellow-700 rounded-lg shadow-md min-w-[200px] max-w-[400px]">
      {/* Top handles */}
      <Handle
        type="source"
        position={Position.Top}
        className="!bg-gray-500 !w-3 !h-3 hover:!bg-blue-500"
        id="top-source"
      />
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-gray-500 !w-3 !h-3 hover:!bg-blue-500"
        id="top-target"
      />

      {/* Left handles */}
      <Handle
        type="source"
        position={Position.Left}
        className="!bg-gray-500 !w-3 !h-3 hover:!bg-blue-500"
        id="left-source"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-gray-500 !w-3 !h-3 hover:!bg-blue-500"
        id="left-target"
      />

      <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
        {data.text || "Double-click to edit"}
      </div>

      {/* Right handles */}
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-gray-500 !w-3 !h-3 hover:!bg-blue-500"
        id="right-source"
      />
      <Handle
        type="target"
        position={Position.Right}
        className="!bg-gray-500 !w-3 !h-3 hover:!bg-blue-500"
        id="right-target"
      />

      {/* Bottom handles */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-gray-500 !w-3 !h-3 hover:!bg-blue-500"
        id="bottom-source"
      />
      <Handle
        type="target"
        position={Position.Bottom}
        className="!bg-gray-500 !w-3 !h-3 hover:!bg-blue-500"
        id="bottom-target"
      />
    </div>
  );
};

// Custom Edge with Label
const CustomEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  markerStart,
  style,
}) => {
  const edgeType = data?.type || "smoothstep";
  let edgePath = "";
  let labelX = 0;
  let labelY = 0;

  if (edgeType === "straight") {
    [edgePath, labelX, labelY] = getStraightPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
    });
  } else if (edgeType === "bezier") {
    [edgePath, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });
  } else {
    [edgePath, labelX, labelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });
  }

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        markerStart={markerStart}
        style={style}
      />
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 12,
              pointerEvents: "all",
            }}
            className="nodrag nopan bg-white dark:bg-gray-800 px-2 py-1 rounded border border-gray-300 dark:border-gray-600"
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

const nodeTypes: NodeTypes = {
  resource: ResourceNode,
  generic: GenericNode,
  text: TextNode,
};

const edgeTypes: EdgeTypes = {
  custom: CustomEdge,
};

// Context Menu Component
const ContextMenu: React.FC<{
  id: string;
  top: number;
  left: number;
  onDelete: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
}> = ({ id, top, left, onDelete, onEdit, onDuplicate }) => {
  return (
    <div
      style={{ top, left }}
      className="absolute z-50 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5"
    >
      <div className="py-1">
        <button
          onClick={onEdit}
          className="w-full text-left block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <FaEdit className="inline mr-2" />
          Edit Node
        </button>
        <button
          onClick={onDuplicate}
          className="w-full text-left block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <FaPlus className="inline mr-2" />
          Duplicate
        </button>
        <hr className="my-1 border-gray-200 dark:border-gray-700" />
        <button
          onClick={onDelete}
          className="w-full text-left block px-4 py-2 text-sm text-red-700 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <FaTrash className="inline mr-2" />
          Delete Node
        </button>
      </div>
    </div>
  );
};

// Node Modal Component
const NodeModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  existingNode?: any;
  nodeType: "generic" | "text";
}> = ({ isOpen, onClose, onSave, existingNode, nodeType }) => {
  const [label, setLabel] = useState(existingNode?.data?.label || "");
  const [description, setDescription] = useState(
    existingNode?.data?.description || "",
  );
  const [text, setText] = useState(existingNode?.data?.text || "");
  const [shape, setShape] = useState<NodeShape>(
    existingNode?.data?.shape || "rounded",
  );
  const [bgColor, setBgColor] = useState(
    existingNode?.data?.bgColor || "bg-white dark:bg-gray-800",
  );
  const [borderColor, setBorderColor] = useState(
    existingNode?.data?.borderColor || "border-gray-300 dark:border-gray-600",
  );
  const [textColor, setTextColor] = useState(
    existingNode?.data?.textColor || "text-gray-800 dark:text-gray-200",
  );

  const handleSave = () => {
    if (nodeType === "text") {
      onSave({ text });
    } else {
      if (!label.trim()) return;
      onSave({ label, description, shape, bgColor, borderColor, textColor });
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        existingNode
          ? `Edit ${nodeType === "text" ? "Text" : "Node"}`
          : `Create ${nodeType === "text" ? "Text Block" : "Node"}`
      }
    >
      <div className="space-y-4">
        {nodeType === "text" ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Text Content
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              className="w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-md"
              placeholder="Enter your text here..."
            />
          </div>
        ) : (
          <>
            <InputField
              label="Label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
            />
            <InputField
              label="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              as="textarea"
              rows={2}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Shape
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(
                  ["rectangle", "rounded", "circle", "diamond"] as NodeShape[]
                ).map((s) => (
                  <button
                    key={s}
                    onClick={() => setShape(s)}
                    className={`p-2 border rounded ${
                      shape === s
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                        : "border-gray-300 dark:border-gray-600"
                    }`}
                  >
                    {s === "rectangle" && <FaSquare className="mx-auto" />}
                    {s === "rounded" && (
                      <div className="w-4 h-4 border-2 border-current rounded mx-auto" />
                    )}
                    {s === "circle" && <FaCircle className="mx-auto" />}
                    {s === "diamond" && (
                      <div className="w-4 h-4 border-2 border-current transform rotate-45 mx-auto" />
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Background Color
              </label>
              <select
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-md"
              >
                <option value="bg-white dark:bg-gray-800">White/Gray</option>
                <option value="bg-blue-100 dark:bg-blue-900/50">Blue</option>
                <option value="bg-green-100 dark:bg-green-900/50">Green</option>
                <option value="bg-yellow-100 dark:bg-yellow-900/50">
                  Yellow
                </option>
                <option value="bg-purple-100 dark:bg-purple-900/50">
                  Purple
                </option>
                <option value="bg-red-100 dark:bg-red-900/50">Red</option>
              </select>
            </div>
          </>
        )}
      </div>
      <div className="mt-6 flex justify-end space-x-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave}>
          {existingNode ? "Save Changes" : "Create"}
        </Button>
      </div>
    </Modal>
  );
};

const DocumentsPageInternal: React.FC = () => {
  const { project } = useProjectData();
  const { showSuccess, showError } = useNotification();
  const {
    setViewMode,
    setCurrentTimelineId,
    setSelectedEntityId,
    setSelectedEntityType,
    setCurrentKnowledgeBaseCategory,
    setSelectedKnowledgeBaseEntityId,
  } = useAppState();

  // Document and category state
  const [documents, setDocuments] = useState<Document[]>([]);
  const [categories, setCategories] =
    useState<DocumentCategory[]>(DEFAULT_CATEGORIES);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    null,
  );
  const [selectedCategoryId, setSelectedCategoryId] =
    useState<string>("narratives");

  // View modes
  const [viewMode, setViewModeLocal] = useState<"list" | "flow" | "notes">(
    "list",
  );

  // Modals
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isNodeModalOpen, setIsNodeModalOpen] = useState(false);
  const [nodeModalType, setNodeModalType] = useState<"generic" | "text">(
    "generic",
  );
  const [editingNode, setEditingNode] = useState<Node | null>(null);

  const [isEditingDocument, setIsEditingDocument] = useState(false);
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentDescription, setDocumentDescription] = useState("");
  const [documentType, setDocumentType] = useState<DocumentType>("scenes");
  const [documentCategoryId, setDocumentCategoryId] = useState("");

  const [categoryName, setCategoryName] = useState("");
  const [categoryColor, setCategoryColor] = useState("blue");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null,
  );

  // Flow view states
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstanceType<any, any> | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    id: string;
    top: number;
    left: number;
  } | null>(null);
  const lastNodePosition = useRef({ x: 100, y: 100 });

  // Scene states
  const [sceneViewMode, setSceneViewMode] = useState<"list" | "view" | "edit">(
    "list",
  );
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);

  // Add these state variables for inline editing
  const [editingDocumentTitle, setEditingDocumentTitle] = useState<
    string | null
  >(null);
  const [tempDocumentTitle, setTempDocumentTitle] = useState("");
  const [editingSceneTitle, setEditingSceneTitle] = useState<string | null>(
    null,
  );
  const [tempSceneTitle, setTempSceneTitle] = useState("");
  const [tempSceneDescription, setTempSceneDescription] = useState("");

  const edgeTypesRef: EdgeTypes = useMemo(
    () => ({
      custom: CustomEdge,
    }),
    [],
  );
  const handleSaveDocumentTitle = (docId: string) => {
    if (!tempDocumentTitle.trim()) {
      showError("Document title cannot be empty");
      setEditingDocumentTitle(null);
      return;
    }

    const updatedDocuments = documents.map((d) =>
      d.id === docId
        ? {
            ...d,
            title: tempDocumentTitle,
            updatedAt: new Date().toISOString(),
          }
        : d,
    );
    setDocuments(updatedDocuments);
    setEditingDocumentTitle(null);
    showSuccess("Document title updated");
  };

  const handleSaveSceneTitle = (sceneId: string) => {
    if (!selectedDocument || selectedDocument.type !== "scenes") return;
    if (!tempSceneTitle.trim()) {
      setTempSceneTitle(
        scenes.find((s: Scene) => s.id === sceneId)?.title || "",
      );
      setEditingSceneTitle(null);
      return;
    }

    const scenes = selectedDocument.content?.scenes || [];
    const updatedScenes = scenes.map((s: Scene) =>
      s.id === sceneId ? { ...s, title: tempSceneTitle } : s,
    );

    updateDocumentContent({
      ...selectedDocument.content,
      scenes: updatedScenes,
    });

    setEditingSceneTitle(null);
  };
  const selectedDocument = useMemo(
    () => documents.find((d) => d.id === selectedDocumentId) || null,
    [documents, selectedDocumentId],
  );

  const filteredDocuments = useMemo(
    () => documents.filter((d) => d.categoryId === selectedCategoryId),
    [documents, selectedCategoryId],
  );

  const selectedScene = useMemo(() => {
    if (!selectedDocument || selectedDocument.type !== "scenes") return null;
    const scenes = selectedDocument.content?.scenes || [];
    return scenes.find((s: Scene) => s.id === selectedSceneId) || null;
  }, [selectedDocument, selectedSceneId]);

  // Get selected node data
  const selectedNodeData = useMemo(() => {
    if (!selectedNode) return null;
    return nodes.find((n) => n.id === selectedNode);
  }, [selectedNode, nodes]);

  // Handle viewing/editing a resource node
  const handleViewEditResource = useCallback(() => {
    if (!selectedNodeData || selectedNodeData.type !== "resource") return;

    const { resourceType, resourceId } = selectedNodeData.data;

    switch (resourceType) {
      case "Timeline":
        setCurrentTimelineId(resourceId);
        setViewMode("timeline-editor");
        showSuccess(`Opening timeline editor...`);
        break;
      case "Character":
        setSelectedEntityId(resourceId);
        setSelectedEntityType("character");
        setCurrentKnowledgeBaseCategory("characters");
        setSelectedKnowledgeBaseEntityId(resourceId);
        setViewMode("knowledge-base");
        showSuccess(`Opening character in knowledge base...`);
        break;
      case "Location":
        setSelectedEntityId(resourceId);
        setSelectedEntityType("location");
        setCurrentKnowledgeBaseCategory("locations");
        setSelectedKnowledgeBaseEntityId(resourceId);
        setViewMode("knowledge-base");
        showSuccess(`Opening location in knowledge base...`);
        break;
      case "Technology":
        setSelectedEntityId(resourceId);
        setSelectedEntityType("technology");
        setCurrentKnowledgeBaseCategory("technologies");
        setSelectedKnowledgeBaseEntityId(resourceId);
        setViewMode("knowledge-base");
        showSuccess(`Opening technology in knowledge base...`);
        break;
      case "Culture":
        setSelectedEntityId(resourceId);
        setSelectedEntityType("culture");
        setCurrentKnowledgeBaseCategory("cultures");
        setSelectedKnowledgeBaseEntityId(resourceId);
        setViewMode("knowledge-base");
        showSuccess(`Opening culture in knowledge base...`);
        break;
      case "Source":
        setSelectedEntityId(resourceId);
        setSelectedEntityType("source");
        setCurrentKnowledgeBaseCategory("sourceDocuments");
        setSelectedKnowledgeBaseEntityId(resourceId);
        setViewMode("knowledge-base");
        showSuccess(`Opening source document in knowledge base...`);
        break;
      case "Event":
        // For events, we need to find which timeline it belongs to
        const timeline = project?.timelines.find((tl) =>
          tl.events.some((e) => e.id === resourceId),
        );
        if (timeline) {
          setCurrentTimelineId(timeline.id);
          setViewMode("timeline-editor");
          showSuccess(`Opening event in timeline editor...`);
        }
        break;
      default:
        showError(`Unknown resource type: ${resourceType}`);
    }
  }, [
    selectedNodeData,
    project,
    setCurrentTimelineId,
    setSelectedEntityId,
    setSelectedEntityType,
    setCurrentKnowledgeBaseCategory,
    setSelectedKnowledgeBaseEntityId,
    setViewMode,
    showSuccess,
    showError,
  ]);

  // Load documents and categories from localStorage
  useEffect(() => {
    const savedDocuments = localStorage.getItem(
      `documents_${project?.id || "default"}`,
    );
    const savedCategories = localStorage.getItem(
      `document_categories_${project?.id || "default"}`,
    );

    if (savedDocuments) {
      setDocuments(JSON.parse(savedDocuments));
    }

    if (savedCategories) {
      setCategories(JSON.parse(savedCategories));
    }
  }, [project?.id]);

  // Save documents to localStorage
  useEffect(() => {
    localStorage.setItem(
      `documents_${project?.id || "default"}`,
      JSON.stringify(documents),
    );
  }, [documents, project?.id]);

  // Save categories to localStorage
  useEffect(() => {
    localStorage.setItem(
      `document_categories_${project?.id || "default"}`,
      JSON.stringify(categories),
    );
  }, [categories, project?.id]);

  // Update view mode based on selected document
  useEffect(() => {
    if (selectedDocument) {
      if (selectedDocument.type === "flow") {
        setViewModeLocal("flow");
        setNodes(selectedDocument.content?.nodes || []);
        setEdges(selectedDocument.content?.edges || []);
      } else if (selectedDocument.type === "notes") {
        setViewModeLocal("notes");
      } else if (selectedDocument.type === "scenes") {
        setViewModeLocal("list");
      }
      setSceneViewMode("list");
      setSelectedSceneId(null);
    }
  }, [selectedDocument, setNodes, setEdges]);

  const handleCreateDocumentDirect = (docType: DocumentType) => {
    const newDocument: Document = {
      id: `doc_${Date.now()}`,
      title: `Untitled ${docType === "scenes" ? "Scene List" : docType === "flow" ? "Flow Chart" : "Notes"}`,
      description: "",
      type: docType,
      categoryId: selectedCategoryId,
      content:
        docType === "scenes"
          ? { scenes: [] }
          : docType === "flow"
            ? { nodes: [], edges: [] }
            : docType === "notes"
              ? { text: "" }
              : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setDocuments([...documents, newDocument]);
    setSelectedDocumentId(newDocument.id);
    showSuccess("Document created. You can rename it using the Edit button.");
  };

  const handleCreateDocumentWithModal = () => {
    setIsEditingDocument(false);
    setDocumentTitle("");
    setDocumentDescription("");
    setDocumentType("scenes");
    setDocumentCategoryId(selectedCategoryId);
    setIsDocumentModalOpen(true);
  };

  const handleEditDocument = () => {
    if (!selectedDocument) return;
    setIsEditingDocument(true);
    setDocumentTitle(selectedDocument.title);
    setDocumentDescription(selectedDocument.description);
    setDocumentType(selectedDocument.type);
    setDocumentCategoryId(selectedDocument.categoryId);
    setIsDocumentModalOpen(true);
  };

  const handleSaveDocument = () => {
    if (!documentTitle.trim()) {
      showError("Document title is required.");
      return;
    }

    if (isEditingDocument && selectedDocument) {
      const updatedDocuments = documents.map((d) =>
        d.id === selectedDocument.id
          ? {
              ...d,
              title: documentTitle,
              description: documentDescription,
              categoryId: documentCategoryId,
              updatedAt: new Date().toISOString(),
            }
          : d,
      );
      setDocuments(updatedDocuments);
      showSuccess("Document updated.");
    } else {
      const newDocument: Document = {
        id: `doc_${Date.now()}`,
        title: documentTitle,
        description: documentDescription,
        type: documentType,
        categoryId: documentCategoryId,
        content:
          documentType === "scenes"
            ? { scenes: [] }
            : documentType === "flow"
              ? { nodes: [], edges: [] }
              : documentType === "notes"
                ? { text: "" }
                : null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setDocuments([...documents, newDocument]);
      setSelectedDocumentId(newDocument.id);
      showSuccess("Document created.");
    }
    setIsDocumentModalOpen(false);
  };

  const handleDeleteDocument = () => {
    if (!selectedDocument) return;
    if (
      !confirm(
        `Delete document "${selectedDocument.title}"? This cannot be undone.`,
      )
    )
      return;

    setDocuments(documents.filter((d) => d.id !== selectedDocument.id));
    setSelectedDocumentId(null);
    showSuccess("Document deleted.");
  };

  const updateDocumentContent = (content: any) => {
    if (!selectedDocument) return;

    const updatedDocuments = documents.map((d) =>
      d.id === selectedDocument.id
        ? { ...d, content, updatedAt: new Date().toISOString() }
        : d,
    );
    setDocuments(updatedDocuments);
  };

  const handleSaveFlow = () => {
    if (!selectedDocument) return;
    updateDocumentContent({ ...selectedDocument.content, nodes, edges });
    showSuccess("Flow saved successfully.");
  };

  // Flow-specific handlers
  const handleCreateNode = (type: "generic" | "text") => {
    setNodeModalType(type);
    setEditingNode(null);
    setIsNodeModalOpen(true);
  };

  const handleSaveNode = (data: any) => {
    if (editingNode) {
      // Update existing node
      setNodes((nds) =>
        nds.map((node) =>
          node.id === editingNode.id
            ? { ...node, data: { ...node.data, ...data } }
            : node,
        ),
      );
      showSuccess("Node updated.");
    } else {
      // Create new node at the center of the current viewport
      let position = { x: 250, y: 250 };

      if (reactFlowInstance && reactFlowWrapper.current) {
        const { x, y, zoom } = reactFlowInstance.getViewport();
        const centerX = reactFlowWrapper.current.offsetWidth / 2;
        const centerY = reactFlowWrapper.current.offsetHeight / 2;

        // Convert screen center to flow coordinates
        position = {
          x: (centerX - x) / zoom,
          y: (centerY - y) / zoom,
        };

        // If there are existing nodes, offset slightly from the center
        if (nodes.length > 0) {
          position.x += (Math.random() - 0.5) * 100;
          position.y += (Math.random() - 0.5) * 100;
        }
      }

      const newNode: Node = {
        id: `${nodeModalType}-${Date.now()}`,
        type: nodeModalType,
        position,
        data,
      };

      setNodes((nds) => nds.concat(newNode));
      showSuccess(
        `${nodeModalType === "text" ? "Text block" : "Node"} created.`,
      );
    }
    setEditingNode(null);
  };

  // Direct connection without modal
  const onConnect: OnConnect = useCallback(
    (params) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: "custom",
            data: { type: "smoothstep", label: "" },
            animated: false,
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { stroke: "#6366f1", strokeWidth: 2 },
          },
          eds,
        ),
      );
      showSuccess("Connection created.");
    },
    [setEdges, showSuccess],
  );

  // Edge click handler
  const onEdgeClick = useCallback((event: MouseEvent, edge: Edge) => {
    setSelectedEdge(edge.id);
    setSelectedNode(null);
  }, []);

  // Node click handler
  const onNodeClick = useCallback((event: MouseEvent, node: Node) => {
    setSelectedNode(node.id);
    setSelectedEdge(null);
  }, []);

  // Update selected edge properties
  const updateSelectedEdge = (updates: Partial<Edge>) => {
    if (!selectedEdge) return;

    setEdges((eds) =>
      eds.map((edge) => {
        if (edge.id === selectedEdge) {
          const updatedEdge = { ...edge };

          // Handle markerEnd and markerStart updates properly
          if ("markerEnd" in updates) {
            updatedEdge.markerEnd = updates.markerEnd;
          }
          if ("markerStart" in updates) {
            updatedEdge.markerStart = updates.markerStart;
          }

          // Handle other updates
          Object.keys(updates).forEach((key) => {
            if (
              key !== "markerEnd" &&
              key !== "markerStart" &&
              key !== "data"
            ) {
              updatedEdge[key] = updates[key];
            }
          });

          // Handle data updates
          if (updates.data) {
            updatedEdge.data = { ...edge.data, ...updates.data };
          }

          return updatedEdge;
        }
        return edge;
      }),
    );
    showSuccess("Edge updated.");
  };

  // Delete selected edge
  const deleteSelectedEdge = () => {
    if (!selectedEdge) return;

    setEdges((eds) => eds.filter((edge) => edge.id !== selectedEdge));
    setSelectedEdge(null);
    showSuccess("Edge deleted.");
  };

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

  const onPaneClick = useCallback(() => {
    setContextMenu(null);
    setSelectedEdge(null);
    setSelectedNode(null);
  }, []);

  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((node) => node.id !== nodeId));
      setEdges((eds) =>
        eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
      );
      setContextMenu(null);
      setSelectedNode(null);
      showSuccess("Node deleted.");
    },
    [setNodes, setEdges, showSuccess],
  );

  const editNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (node) {
        setEditingNode(node);
        setNodeModalType(node.type === "text" ? "text" : "generic");
        setIsNodeModalOpen(true);
      }
      setContextMenu(null);
    },
    [nodes],
  );
  const duplicateNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (node) {
        const newNode: Node = {
          ...node,
          id: `${node.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          position: {
            x: node.position.x + 50,
            y: node.position.y + 50,
          },
          selected: false,
        };

        setNodes((nds) =>
          nds
            .map((n) => (n.id === nodeId ? { ...n, selected: false } : n))
            .concat(newNode),
        );

        setSelectedNode(null);
        showSuccess("Node duplicated.");
      }
      setContextMenu(null);
    },
    [nodes, setNodes, setSelectedNode, showSuccess],
  );
  const onNodeDoubleClick = useCallback(
    (event: MouseEvent, node: Node) => {
      if (node.type === "text" || node.type === "generic") {
        editNode(node.id);
      }
    },
    [editNode],
  );

  const onDragOver = useCallback((event: DragEvent) => {
    console.log("%c2. DRAG OVER CANVAS", "color: #ff9800; font-weight: bold;");
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setIsDraggingOver(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setIsDraggingOver(false);
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      console.log("%c3. DROP ON CANVAS", "color: #4caf50; font-weight: bold;");
      event.preventDefault();
      setIsDraggingOver(false);

      // Check if the React Flow instance is available
      if (!reactFlowInstance) {
        showError("Flow canvas is not ready. Please try again.");
        return;
      }

      // Read and parse the data being dragged
      const dataString = event.dataTransfer.getData("application/reactflow");
      if (!dataString) return;

      let nodeData;
      try {
        nodeData = JSON.parse(dataString);
      } catch {
        showError("Could not read dropped data.");
        return;
      }

      // Get the correct position on the canvas relative to the drop location
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Create the new node with the data and calculated position
      const newNode: FlowNodeType = {
        id: `${nodeData.resourceType}-${nodeData.resourceId}-${Date.now()}`,
        type: "resource",
        position,
        data: {
          label: nodeData.label,
          resourceId: nodeData.resourceId,
          resourceType: nodeData.resourceType,
        },
      };

      setNodes((nds) => nds.concat(newNode));
      showSuccess(`Added '${nodeData.label}' to the flow.`);
    },
    [reactFlowInstance, setNodes, showSuccess, showError],
  );

  const handleInsertResource = (type: string, name: string, id: ID) => {
    if (selectedDocument?.type === "flow") {
      if (!reactFlowInstance) {
        showError("Flow canvas is not ready. Please wait and try again.");
        return;
      }

      let position = { x: 250, y: 250 };

      if (reactFlowWrapper.current) {
        const { x, y, zoom } = reactFlowInstance.getViewport();
        const centerX = reactFlowWrapper.current.offsetWidth / 2;
        const centerY = reactFlowWrapper.current.offsetHeight / 2;

        // Convert screen center to flow coordinates
        position = {
          x: (centerX - x) / zoom,
          y: (centerY - y) / zoom,
        };

        // If there are existing nodes, offset slightly from the center
        if (nodes.length > 0) {
          position.x += (Math.random() - 0.5) * 150;
          position.y += (Math.random() - 0.5) * 150;
        }
      }

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

  // Scene management functions
  const handleCreateScene = () => {
    if (!selectedDocument || selectedDocument.type !== "scenes") return;

    const scenes = selectedDocument.content?.scenes || [];
    const newScene: Scene = {
      id: `scene_${Date.now()}`,
      title: `Scene ${scenes.length + 1}`,
      description: "",
      content: "",
      order: scenes.length + 1,
    };

    updateDocumentContent({
      ...selectedDocument.content,
      scenes: [...scenes, newScene],
    });

    setSelectedSceneId(newScene.id);
    setEditingSceneId(newScene.id);
    setSceneViewMode("edit");
    showSuccess("New scene created.");
  };

  const handleEditScene = (scene: Scene) => {
    setSelectedSceneId(scene.id);
    setEditingSceneId(scene.id);
    setSceneViewMode("edit");
  };

  const handleSaveSceneContent = useCallback(
    (sceneId: string, content: string) => {
      if (!selectedDocument || selectedDocument.type !== "scenes") return;

      const scenes = selectedDocument.content?.scenes || [];
      const updatedScenes = scenes.map((s: Scene) =>
        s.id === sceneId
          ? { ...s, content, updatedAt: new Date().toISOString() }
          : s,
      );

      updateDocumentContent({
        ...selectedDocument.content,
        scenes: updatedScenes,
      });
    },
    [selectedDocument, updateDocumentContent],
  );

  const handleDeleteScene = (sceneId: string) => {
    if (!selectedDocument || selectedDocument.type !== "scenes") return;
    if (!confirm("Delete this scene? This cannot be undone.")) return;

    const scenes = selectedDocument.content?.scenes || [];
    const updatedScenes = scenes.filter((s: Scene) => s.id !== sceneId);

    updateDocumentContent({
      ...selectedDocument.content,
      scenes: updatedScenes,
    });

    setSelectedSceneId(null);
    setEditingSceneId(null);
    setSceneViewMode("list");
    showSuccess("Scene deleted.");
  };

  const renderContent = () => {
    if (!selectedDocument) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-8">
              Choose a document type to create
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
              <button
                onClick={() => handleCreateDocumentDirect("scenes")}
                className="group p-6 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transition-all hover:shadow-lg"
              >
                <div className="flex flex-col items-center">
                  <FaStream className="h-12 w-12 text-blue-500 mb-3" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Scene List
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Create narrative scenes with sequential content
                  </p>
                </div>
              </button>

              <button
                onClick={() => handleCreateDocumentDirect("flow")}
                className="group p-6 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-purple-500 dark:hover:border-purple-400 transition-all hover:shadow-lg"
              >
                <div className="flex flex-col items-center">
                  <FaProjectDiagram className="h-12 w-12 text-purple-500 mb-3" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Flow Chart
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Visualize connections between resources
                  </p>
                </div>
              </button>

              <button
                onClick={() => handleCreateDocumentDirect("notes")}
                className="group p-6 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-green-500 dark:hover:border-green-400 transition-all hover:shadow-lg"
              >
                <div className="flex flex-col items-center">
                  <FaStickyNote className="h-12 w-12 text-green-500 mb-3" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Notes
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Write and organize your research notes
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (selectedDocument.type === "flow") {
      const selectedEdgeData = edges.find((e) => e.id === selectedEdge);

      return (
        <div className="h-full flex flex-col">
          <div className="flex justify-between items-center p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <div className="flex space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCreateNode("generic")}
              >
                <FaSquare className="mr-1" />
                Add Node
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCreateNode("text")}
              >
                <FaFont className="mr-1" />
                Add Text
              </Button>

              {selectedEdge && (
                <>
                  <div className="border-l border-gray-300 dark:border-gray-600 mx-2" />
                  <select
                    value={selectedEdgeData?.data?.type || "smoothstep"}
                    onChange={(e) => {
                      updateSelectedEdge({
                        data: {
                          ...selectedEdgeData?.data,
                          type: e.target.value,
                        },
                      });
                    }}
                    className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  >
                    <option value="smoothstep">Smooth Step</option>
                    <option value="straight">Straight</option>
                    <option value="bezier">Curved</option>
                  </select>
                  <select
                    value={
                      selectedEdgeData?.markerStart?.type &&
                      selectedEdgeData?.markerEnd?.type
                        ? "both"
                        : selectedEdgeData?.markerStart?.type
                          ? "left"
                          : selectedEdgeData?.markerEnd?.type
                            ? "right"
                            : "none"
                    }
                    onChange={(e) => {
                      const direction = e.target.value;
                      let markerEnd = undefined;
                      let markerStart = undefined;

                      if (direction === "right" || direction === "both") {
                        markerEnd = { type: MarkerType.ArrowClosed };
                      }
                      if (direction === "left" || direction === "both") {
                        markerStart = { type: MarkerType.ArrowClosed };
                      }

                      updateSelectedEdge({
                        markerEnd,
                        markerStart,
                      });
                    }}
                    className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  >
                    <option value="right">→</option>
                    <option value="left">←</option>
                    <option value="both">↔</option>
                    <option value="none">None</option>
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-20"
                    onClick={() => {
                      updateSelectedEdge({
                        animated: !selectedEdgeData?.animated,
                      });
                    }}
                  >
                    {selectedEdgeData?.animated ? "Static" : "Animate"}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={deleteSelectedEdge}
                  >
                    <FaTrash className="mr-1" />
                    Delete Connection
                  </Button>
                </>
              )}

              {selectedNode && selectedNodeData && (
                <>
                  <div className="border-l border-gray-300 dark:border-gray-600 mx-2" />
                  {selectedNodeData.type === "resource" ? (
                    <>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={handleViewEditResource}
                      >
                        <FaEye className="mr-1" />
                        View/Edit {selectedNodeData.data.resourceType}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => deleteNode(selectedNode)}
                      >
                        <FaTrash className="mr-1" />
                        Delete Node
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => editNode(selectedNode)}
                      >
                        <FaEdit className="mr-1" />
                        Edit Node
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => deleteNode(selectedNode)}
                      >
                        <FaTrash className="mr-1" />
                        Delete Node
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>

            <div className="text-sm text-gray-500 dark:text-gray-400">
              {selectedEdge
                ? "Connection selected"
                : selectedNode
                  ? `${selectedNodeData?.type === "resource" ? selectedNodeData.data.resourceType + " node" : "Node"} selected`
                  : "Click to select node or connection"}
            </div>
          </div>

          <div
            className="reactflow-wrapper h-full w-full relative"
            ref={reactFlowWrapper}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypesRef}
              onInit={setReactFlowInstance}
              onNodeClick={onNodeClick}
              onEdgeClick={onEdgeClick}
              onNodeContextMenu={onNodeContextMenu}
              onNodeDoubleClick={onNodeDoubleClick}
              onPaneClick={onPaneClick}
              fitView
            >
              <Panel
                position="top-left"
                className="bg-white dark:bg-gray-800 p-2 rounded-lg shadow-md"
              >
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Nodes: {nodes.length} | Connections: {edges.length}
                </div>
              </Panel>
              <Background
                variant={BackgroundVariant.Dots}
                color="#6b7280"
                className="dark:!bg-gray-900"
              />
              <Controls className="!bg-white dark:!bg-gray-800 !border-gray-200 dark:!border-gray-700 [&>button]:!bg-white dark:[&>button]:!bg-gray-800 [&>button]:!border-gray-200 dark:[&>button]:!border-gray-700 [&>button:hover]:!bg-gray-100 dark:[&>button:hover]:!bg-gray-700 [&>button]:!fill-gray-700 dark:[&>button]:!fill-gray-300" />
              <MiniMap
                className="!bg-white dark:!bg-gray-800 !border-gray-200 dark:!border-gray-700"
                nodeColor={(node) => {
                  if (node.type === "resource") {
                    const colors: { [key: string]: string } = {
                      Character: "#3B82F6",
                      Location: "#10B981",
                      Event: "#F59E0B",
                      Technology: "#8B5CF6",
                      Culture: "#6366F1",
                      Source: "#6B7280",
                      Timeline: "#14B8A6",
                    };
                    return colors[node.data.resourceType] || "#6B7280";
                  }
                  return "#E5E7EB";
                }}
                nodeStrokeWidth={3}
                maskColor="rgba(240, 240, 240, 0.6)"
                pannable
                zoomable
              />
            </ReactFlow>
            {contextMenu && (
              <ContextMenu
                {...contextMenu}
                onDelete={() => deleteNode(contextMenu.id)}
                onEdit={() => editNode(contextMenu.id)}
                onDuplicate={() => duplicateNode(contextMenu.id)}
              />
            )}
          </div>
        </div>
      );
    }

    if (selectedDocument.type === "notes") {
      return (
        <div className="h-full">
          <NotesApp
            project={project}
            documentId={selectedDocument.id}
            initialContent={selectedDocument.content?.text || ""}
            onContentChange={(content) =>
              updateDocumentContent({
                ...selectedDocument.content,
                text: content,
              })
            }
          />
        </div>
      );
    }

    // Render scenes view
    const scenes = selectedDocument.content?.scenes || [];

    if (sceneViewMode === "edit" && editingSceneId) {
      const editingScene = scenes.find((s: Scene) => s.id === editingSceneId);
      if (!editingScene) return null;

      return (
        <div className="h-full flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingSceneId(null);
                  setSceneViewMode("list");
                }}
              >
                <FaArrowLeft className="mr-1" />
                Back to List
              </Button>
              {editingSceneTitle === editingSceneId ? (
                <input
                  type="text"
                  value={tempSceneTitle}
                  onChange={(e) => setTempSceneTitle(e.target.value)}
                  onBlur={() => handleSaveSceneTitle(editingSceneId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSaveSceneTitle(editingSceneId);
                    }
                    if (e.key === "Escape") {
                      setTempSceneTitle(editingScene.title);
                      setEditingSceneTitle(null);
                    }
                  }}
                  className="text-xl font-bold px-2 py-1 border-b-2 border-blue-500 bg-transparent text-gray-900 dark:text-white focus:outline-none"
                  autoFocus
                />
              ) : (
                <h2
                  className="text-xl font-bold text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                  onClick={() => {
                    setEditingSceneTitle(editingSceneId);
                    setTempSceneTitle(editingScene.title);
                  }}
                >
                  {editingScene.title}
                </h2>
              )}
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={() => handleDeleteScene(editingSceneId)}
            >
              <FaTrash className="mr-1" />
              Delete Scene
            </Button>
          </div>
          <div className="flex-1 overflow-hidden">
            <NotesApp
              key={`scene_${editingSceneId}`}
              project={project}
              documentId={`scene_${editingSceneId}`}
              initialContent={editingScene.content || ""}
              onContentChange={(content) =>
                handleSaveSceneContent(editingSceneId, content)
              }
            />
          </div>
        </div>
      );
    }

    if (sceneViewMode === "view" && selectedScene) {
      return (
        <div className="h-full overflow-y-auto p-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  {selectedScene.title}
                </h2>
                {selectedScene.description && (
                  <p className="text-gray-600 dark:text-gray-400">
                    {selectedScene.description}
                  </p>
                )}
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSceneViewMode("list")}
                >
                  <FaArrowLeft className="mr-1" />
                  Back to List
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleEditScene(selectedScene)}
                >
                  <FaEdit className="mr-1" />
                  Edit
                </Button>
              </div>
            </div>
            <div className="prose dark:prose-invert max-w-none">
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg min-h-[200px]">
                {selectedScene.content ? (
                  <div className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                    {selectedScene.content}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 italic">
                    No content added to this scene yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full overflow-y-auto p-6">
        <div className="flex justify-end mb-4">
          <Button variant="primary" onClick={handleCreateScene}>
            <FaPlus className="mr-1" />
            Add Scene
          </Button>
        </div>
        <div className="space-y-4">
          {scenes.length > 0 ? (
            scenes.map((scene: Scene) => (
              <div
                key={scene.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
              >
                <div
                  className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  onClick={() => {
                    if (selectedSceneId === scene.id) {
                      setSelectedSceneId(null);
                    } else {
                      setSelectedSceneId(scene.id);
                    }
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        {scene.order}. {scene.title}
                      </h3>
                      {scene.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {scene.description}
                        </p>
                      )}
                      {scene.content && !selectedSceneId && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 line-clamp-2">
                          {scene.content.substring(0, 150)}
                          {scene.content.length > 150 && "..."}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded content */}
                {selectedSceneId === scene.id && (
                  <div className="border-t border-gray-200 dark:border-gray-700">
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50">
                      <div className="flex justify-between items-center mb-3">
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Scene Content
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingSceneId(scene.id);
                              setSceneViewMode("edit");
                            }}
                          >
                            <FaEdit className="mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteScene(scene.id);
                            }}
                          >
                            <FaTrash />
                          </Button>
                        </div>
                      </div>
                      <div className="prose dark:prose-invert max-w-none">
                        {scene.content ? (
                          <div className="whitespace-pre-wrap text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 p-4 rounded-lg">
                            {scene.content}
                          </div>
                        ) : (
                          <p className="text-gray-500 dark:text-gray-400 italic">
                            No content added to this scene yet.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No scenes yet. Click "Add Scene" to create your first scene.
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <MainContentArea
      title="Report Builder"
      noPadding={true}
      actions={
        selectedDocument && (
          <div className="flex items-center space-x-2">
            {selectedDocument.type === "flow" && (
              <Button variant="primary" onClick={handleSaveFlow}>
                Save Flow
              </Button>
            )}
          </div>
        )
      }
    >
      <div className="h-full flex overflow-hidden bg-gray-50 dark:bg-gray-900">
        {/* Categories Sidebar - keeping existing implementation */}
        <div className="w-[320px] flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full overflow-hidden">
          {/* Categories section */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Categories
              </h2>
            </div>
            <div className="space-y-1">
              {categories.map((category) => {
                const isSelected = selectedCategoryId === category.id;
                const docCount = documents.filter(
                  (d) => d.categoryId === category.id,
                ).length;
                return (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategoryId(category.id)}
                    className={`w-full flex items-center gap-2 p-2 rounded-md transition-colors text-left ${
                      isSelected
                        ? "bg-blue-600 text-white"
                        : "hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    <FaFolder
                      className={`h-4 w-4 text-${category.color}-500`}
                    />
                    <span className="flex-1">{category.name}</span>
                    <span
                      className={`text-xs ${isSelected ? "text-blue-200" : "text-gray-500"}`}
                    >
                      {docCount}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Documents section */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Documents
              </h3>
              <Button size="sm" onClick={handleCreateDocumentWithModal}>
                <FaPlus className="mr-1" />
                New
              </Button>
            </div>
            <div className="space-y-2">
              {filteredDocuments.map((doc) => {
                const isSelected = selectedDocumentId === doc.id;
                return (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedDocumentId(doc.id)}
                    className={`w-full text-left p-3 rounded-md transition-colors flex items-start gap-3 ${
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-900/30 border-l-2 border-blue-500"
                        : "hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    <span
                      className={`mt-1 flex-shrink-0 ${
                        isSelected
                          ? "text-blue-600"
                          : "text-gray-400 dark:text-gray-500"
                      }`}
                    >
                      {doc.type === "scenes" && <FaStream />}
                      {doc.type === "flow" && <FaProjectDiagram />}
                      {doc.type === "notes" && <FaStickyNote />}
                    </span>
                    <div className="flex-1 overflow-hidden">
                      <p
                        className={`font-medium truncate ${
                          isSelected
                            ? "text-blue-900 dark:text-blue-100"
                            : "text-gray-800 dark:text-gray-100"
                        }`}
                      >
                        {doc.title}
                      </p>
                      {doc.description && (
                        <p
                          className={`text-xs line-clamp-2 ${
                            isSelected
                              ? "text-blue-700 dark:text-blue-300"
                              : "text-gray-500 dark:text-gray-400"
                          }`}
                        >
                          {doc.description}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-gray-50 dark:bg-gray-900 h-full overflow-hidden">
          {selectedDocument && (
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {selectedDocument.title}
                </h2>
                {selectedDocument.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {selectedDocument.description}
                  </p>
                )}
              </div>
              <div className="flex space-x-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleEditDocument}
                >
                  <FaEdit className="mr-1" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={handleDeleteDocument}
                >
                  <FaTrash className="mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          )}

          <div
            className="flex-1 overflow-hidden"
            onDrop={onDrop}
            onDragOver={onDragOver}
          >
            {renderContent()}
          </div>
        </div>

        {/* Resource Panel */}
        {selectedDocument && (
          <div className="w-80 flex-shrink-0 h-full overflow-hidden">
            <NarrativeResourcePanel onInsertResource={handleInsertResource} />
          </div>
        )}
      </div>

      {/* Document Modal - keeping existing */}
      <Modal
        isOpen={isDocumentModalOpen}
        onClose={() => setIsDocumentModalOpen(false)}
        title={isEditingDocument ? "Edit Document" : "Choose a document type"}
      >
        {isEditingDocument ? (
          <>
            <div className="space-y-4">
              <InputField
                label="Title"
                value={documentTitle}
                onChange={(e) => setDocumentTitle(e.target.value)}
                required
              />
              <InputField
                label="Description"
                value={documentDescription}
                onChange={(e) => setDocumentDescription(e.target.value)}
                as="textarea"
                rows={3}
              />
            </div>
            <div className="mt-6 flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setIsDocumentModalOpen(false)}
              >
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSaveDocument}>
                Save Changes
              </Button>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => {
                handleCreateDocumentDirect("scenes");
                setIsDocumentModalOpen(false);
              }}
              className="group p-6 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transition-all hover:shadow-lg"
            >
              <div className="flex flex-col items-center">
                <FaStream className="h-12 w-12 text-blue-500 mb-3" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Scene List
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Create narrative scenes
                </p>
              </div>
            </button>

            <button
              onClick={() => {
                handleCreateDocumentDirect("flow");
                setIsDocumentModalOpen(false);
              }}
              className="group p-6 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-purple-500 dark:hover:border-purple-400 transition-all hover:shadow-lg"
            >
              <div className="flex flex-col items-center">
                <FaProjectDiagram className="h-12 w-12 text-purple-500 mb-3" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Flow Chart
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Visualize connections
                </p>
              </div>
            </button>

            <button
              onClick={() => {
                handleCreateDocumentDirect("notes");
                setIsDocumentModalOpen(false);
              }}
              className="group p-6 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-green-500 dark:hover:border-green-400 transition-all hover:shadow-lg"
            >
              <div className="flex flex-col items-center">
                <FaStickyNote className="h-12 w-12 text-green-500 mb-3" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Notes
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Research notes
                </p>
              </div>
              ``
            </button>
          </div>
        )}
      </Modal>

      {/* Node Modal */}
      <NodeModal
        isOpen={isNodeModalOpen}
        onClose={() => {
          setIsNodeModalOpen(false);
          setEditingNode(null);
        }}
        onSave={handleSaveNode}
        existingNode={editingNode}
        nodeType={nodeModalType}
      />
    </MainContentArea>
  );
};

const DocumentsPage = () => (
  <ReactFlowProvider>
    <DocumentsPageInternal />
  </ReactFlowProvider>
);

export default DocumentsPage;
