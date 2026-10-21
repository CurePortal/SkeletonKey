// NarrativeFlowPage.tsx

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  DragEvent,
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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { FaChevronUp, FaChevronDown } from "react-icons/fa";

import { useProjectData } from "../contexts/ProjectDataContext";
import { useNotification } from "../contexts/NotificationContext";
import { ID } from "../types";
import MainContentArea from "../components/layout/MainContentArea";
import Button from "../components/common/Button";

type FlowNodeData = {
  label: string;
  resourceId: ID;
  resourceType: string;
};
type FlowNodeType = Node<FlowNodeData>;

export interface NarrativeFlowType {
  id: ID;
  title: string;
  description: string;
  nodes: FlowNodeType[];
  edges: Edge[];
}

const ResourceNode: React.FC<{ data: FlowNodeData }> = ({ data }) => {
  const typeStyles: { [key: string]: string } = {
    Character:
      "bg-blue-100 border-blue-400 text-blue-800 dark:bg-blue-900/50 dark:border-blue-500 dark:text-blue-200",
    Location:
      "bg-green-100 border-green-400 text-green-800 dark:bg-green-900/50 dark:border-green-500 dark:text-green-200",
    Event:
      "bg-amber-100 border-amber-400 text-amber-800 dark:bg-amber-900/50 dark:border-amber-500 dark:text-amber-200",
    Technology:
      "bg-purple-100 border-purple-400 text-purple-800 dark:bg-purple-900/50 dark:border-purple-500 dark:text-purple-200",
    Culture:
      "bg-indigo-100 border-indigo-400 text-indigo-800 dark:bg-indigo-900/50 dark:border-indigo-500 dark:text-indigo-200",
    Source:
      "bg-slate-100 border-slate-400 text-slate-800 dark:bg-slate-600/50 dark:border-slate-500 dark:text-slate-200",
  };
  const style = typeStyles[data.resourceType] || typeStyles.Source;

  return (
    <div
      className={`relative px-4 py-2 rounded-lg border-2 shadow-md w-48 text-center font-sans ${style}`}
    >
      <Handle type="target" position={Position.Left} className="!bg-gray-400" />
      <div className="text-xs font-bold uppercase opacity-70 mb-1 tracking-wider">
        {data.resourceType}
      </div>
      <div className="text-sm font-semibold truncate" title={data.label}>
        {data.label}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-gray-400"
      />
    </div>
  );
};

const searchFilter = (
  items: any[],
  query: string,
  nameField: string = "name",
): any[] => {
  if (!items) return [];
  if (!query) return items;
  const lowerCaseQuery = query.toLowerCase();
  return items.filter((item) => {
    const value = item[nameField] || item.title || "Unnamed";
    return value.toLowerCase().includes(lowerCaseQuery);
  });
};

const ResourceAccordion: React.FC<{
  title: string;
  items: any[];
  type: string;
  searchQuery: string;
  nameField?: string;
}> = ({ title, items, type, searchQuery, nameField = "name" }) => {
  const [isOpen, setIsOpen] = useState(true);
  const filteredItems = useMemo(
    () => searchFilter(items, searchQuery, nameField),
    [items, searchQuery, nameField],
  );

  const onDragStart = (event: DragEvent, item: any) => {
    const itemName = item[nameField] || item.title || "Unnamed";
    event.dataTransfer.setData("application/reactflow-type", type);
    event.dataTransfer.setData("application/reactflow-name", itemName);
    event.dataTransfer.setData("application/reactflow-id", item.id);
    event.dataTransfer.effectAllowed = "move";
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="w-full">
      <button
        type="button"
        className="flex w-full justify-between items-center rounded-md bg-slate-100 dark:bg-slate-700/50 px-3 py-2 text-left text-sm font-medium text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>
          {title} ({filteredItems.length})
        </span>
        {isOpen ? <FaChevronUp /> : <FaChevronDown />}
      </button>
      {isOpen && (
        <div className="py-2 text-sm text-slate-500 dark:text-slate-400 max-h-60 overflow-y-auto">
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => (
              <div
                key={item.id}
                onDragStart={(event) => onDragStart(event, item)}
                draggable
                className="p-2 text-sm text-slate-800 dark:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 cursor-grab"
                title={item[nameField] || item.title}
              >
                {item[nameField] || item.title || "Unnamed"}
              </div>
            ))
          ) : (
            <p className="p-2 text-xs">No matching {title.toLowerCase()}.</p>
          )}
        </div>
      )}
    </div>
  );
};

const ProjectResourcesPanel: React.FC = () => {
  const { project } = useProjectData();
  const [searchQuery, setSearchQuery] = useState("");

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

  return (
    <div className="w-full h-full p-4 bg-white dark:bg-slate-800 flex flex-col shadow-lg">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
        Project Resources
      </h3>
      <input
        type="text"
        placeholder="Search resources..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full mb-4 px-3 py-2 rounded-md bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="flex-1 overflow-y-auto space-y-2 pr-2">
        <ResourceAccordion
          title="Characters"
          items={project?.characters || []}
          type="Character"
          searchQuery={searchQuery}
        />
        <ResourceAccordion
          title="Locations"
          items={project?.locations || []}
          type="Location"
          searchQuery={searchQuery}
        />
        <ResourceAccordion
          title="Events"
          items={allEvents}
          type="Event"
          searchQuery={searchQuery}
          nameField="displayName"
        />
        <ResourceAccordion
          title="Technologies"
          items={project?.technologies || []}
          type="Technology"
          searchQuery={searchQuery}
        />
        <ResourceAccordion
          title="Cultures"
          items={project?.cultures || []}
          type="Culture"
          searchQuery={searchQuery}
        />
        <ResourceAccordion
          title="Sources"
          items={project?.sourceDocuments || []}
          type="Source"
          searchQuery={searchQuery}
          nameField="title"
        />
      </div>
    </div>
  );
};

const NarrativeFlowPage: React.FC = () => {
  // --- FIX: Destructure updateNarrative and showError ---
  const { project, updateNarrative } = useProjectData();
  const { showSuccess, showError } = useNotification();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstanceType<any, any> | null>(null);
  const [activeFlow, setActiveFlow] = useState<NarrativeFlowType | null>(null);
  const nodeTypes = useMemo(() => ({ resource: ResourceNode }), []);

  const narrativeFlows: NarrativeFlowType[] = useMemo(
    () =>
      (project?.narratives || [])
        .filter((n: any) => n.narrativeType === "flow")
        .map((n: any) => ({
          id: n.id,
          title: n.title,
          description: n.description,
          nodes: n.nodes || [],
          edges: n.edges || [],
        })),
    [project],
  );

  useEffect(() => {
    if (narrativeFlows.length > 0 && !activeFlow) {
      setActiveFlow(narrativeFlows[0]);
    }
  }, [narrativeFlows, activeFlow]);

  useEffect(() => {
    if (activeFlow) {
      setNodes(activeFlow.nodes);
      setEdges(activeFlow.edges);
    }
  }, [activeFlow, setNodes, setEdges]);

  const onConnect: OnConnect = useCallback(
    (params: Connection) => {
      const relationshipType = prompt("Describe this relationship:", "causes");
      if (relationshipType) {
        setEdges((eds) =>
          addEdge(
            { ...params, type: "smoothstep", label: relationshipType },
            eds,
          ),
        );
      }
    },
    [setEdges],
  );

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      if (!reactFlowWrapper.current || !reactFlowInstance) return;

      const type = event.dataTransfer.getData("application/reactflow-type");
      if (!type) return;

      // Use screenToFlowPosition instead of project
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: FlowNodeType = {
        id: `${type}-${event.dataTransfer.getData("application/reactflow-id")}-${Date.now()}`,
        type: "resource",
        position,
        data: {
          label: event.dataTransfer.getData("application/reactflow-name"),
          resourceId: event.dataTransfer.getData("application/reactflow-id"),
          resourceType: type,
        },
      };
      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes],
  );
  // --- FIX: Implemented the handleSave function to save flow data ---
  const handleSave = () => {
    if (!activeFlow) {
      showError("No active flow to save.");
      return;
    }
    if (!updateNarrative) {
      showError("Save function is not available.");
      return;
    }

    // Find the full narrative object in the project's state.
    const narrativeToUpdate = project?.narratives.find(
      (n) => n.id === activeFlow.id,
    );

    if (!narrativeToUpdate) {
      showError("Could not find the original narrative to update.");
      return;
    }

    // Call the context's update function with the current nodes and edges.
    updateNarrative({
      ...narrativeToUpdate,
      nodes,
      edges,
      updatedAt: new Date().toISOString(),
    });

    showSuccess(`'${activeFlow.title}' saved successfully.`);
  };

  return (
    <MainContentArea
      title="Narrative Flow Builder"
      subtitle={activeFlow ? activeFlow.title : "Visually map relationships"}
      actions={
        <Button variant="primary" onClick={handleSave} disabled={!activeFlow}>
          Save Flow
        </Button>
      }
    >
      <div className="flex h-full -mx-6 -my-6 bg-slate-50 dark:bg-slate-900">
        <div className="w-64 flex-shrink-0 bg-white dark:bg-slate-800 p-4 border-r border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-medium text-slate-900 dark:text-white mb-4">
            Narrative Flows
          </h2>
          <div className="space-y-2">
            {narrativeFlows.map((flow) => (
              <button
                key={flow.id}
                onClick={() => setActiveFlow(flow)}
                className={`w-full text-left p-3 rounded-md transition-colors ${
                  activeFlow?.id === flow.id
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-800/50 dark:text-blue-100"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                }`}
              >
                <div className="font-semibold">{flow.title}</div>
              </button>
            ))}
          </div>
        </div>

        <div
          className="flex-1"
          ref={reactFlowWrapper}
          onDrop={onDrop}
          onDragOver={onDragOver}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={(instance) => setReactFlowInstance(instance)}
            nodeTypes={nodeTypes}
            fitView
            className="bg-slate-50 dark:bg-slate-900"
          >
            <Background gap={24} />
            <Controls />
          </ReactFlow>
        </div>

        <div className="w-80 flex-shrink-0 border-l border-slate-200 dark:border-slate-700">
          <ProjectResourcesPanel />
        </div>
      </div>
    </MainContentArea>
  );
};

const NarrativeFlowPageWrapper = () => (
  <ReactFlowProvider>
    <NarrativeFlowPage />
  </ReactFlowProvider>
);

export default NarrativeFlowPageWrapper;
