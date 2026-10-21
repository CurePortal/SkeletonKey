// src/components/LLM/LLMAssistantPanel.tsx
import React, { useState, useEffect, useRef } from "react";
import { useProjectData } from "../../contexts/ProjectDataContext";
import Button from "../common/Button";
import { useLLMAnalysis } from "../../hooks/useLLMAnalysis";
import MessageBox from "../common/MessageBox";
import {
  validateProjectElement,
  normalizeTimeline,
  normalizeCharacter,
  normalizeEvent,
  normalizeLocation,
  normalizeTechnology,
  normalizeCulture,
  normalizeNarrative,
} from "../../utils/llmUtils";
import ChatMessageBubble from "./ChatMessageBubble";
import { useAppState } from "../../contexts/AppStateContext";
import { api } from "../../services/unifiedApiService";

// Define LLMActionType here or import from a shared types file
export type LLMActionType =
  | "ADD_EVENT"
  | "ADD_TIMELINE"
  | "ADD_CHARACTER"
  | "ADD_LOCATION"
  | "ADD_TECHNOLOGY"
  | "ADD_CULTURE"
  | "ADD_NARRATIVE";

// Define the structure for a chat message
export interface ChatMessage {
  id: string;
  sender: "user" | "ai" | "system";
  type: "text" | "error" | "info" | "success" | "loading" | "json_suggestion";
  content: any;
  actionType?: LLMActionType;
  timestamp: Date;
  details?: string;
  validationResult?: ReturnType<typeof validateProjectElement>;
  onUseJson?: (jsonData: any) => void;
}

// Props for the new chat input component
interface NewChatInputInterfaceProps {
  onSendMessage: (text: string, action?: LLMActionType) => void;
  actions?: Array<{ label: string; value: LLMActionType; colorClass: string }>;
  disabled?: boolean;
  placeholder?: string;
  showActions?: boolean;
}

// Placeholder for NewChatInputInterface component
const NewChatInputInterface: React.FC<NewChatInputInterfaceProps> = ({
  onSendMessage,
  actions = [],
  disabled,
  placeholder,
  showActions = true,
}) => {
  const [inputValue, setInputValue] = useState("");
  const [selectedAction, setSelectedAction] = useState<
    LLMActionType | undefined
  >(undefined);
  const [currentPlaceholder, setCurrentPlaceholder] = useState(
    placeholder || "Type your message or select an action...",
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (selectedAction && showActions) {
      const actionLabel = actions.find(
        (a) => a.value === selectedAction,
      )?.label;
      setCurrentPlaceholder(
        actionLabel
          ? `Describe the ${actionLabel.toLowerCase()}... (or type a general query)`
          : placeholder || "Type your message or select an action...",
      );
      textareaRef.current?.focus();
    } else {
      setCurrentPlaceholder(
        placeholder || "Type your message or select an action...",
      );
    }
  }, [selectedAction, actions, placeholder, showActions]);

  useEffect(() => {
    if (!selectedAction || !showActions) {
      setCurrentPlaceholder(
        placeholder || "Type your message or select an action...",
      );
    }
  }, [placeholder, selectedAction, showActions]);

  const handleSubmit = () => {
    if (inputValue.trim() || selectedAction) {
      onSendMessage(inputValue.trim(), selectedAction);
      setInputValue("");
    }
  };

  const handleActionClick = (action: LLMActionType) => {
    if (selectedAction === action) {
      setSelectedAction(undefined);
    } else {
      setSelectedAction(action);
    }
  };

  const clearSelectedAction = () => {
    setSelectedAction(undefined);
    setCurrentPlaceholder(
      placeholder || "Type your message or select an action...",
    );
    textareaRef.current?.focus();
  };

  return (
    <div className="flex flex-col gap-3">
      {showActions && actions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300 mr-1">
            Actions:
          </span>
          {actions.map((action) => (
            <button
              key={action.value}
              onClick={() => handleActionClick(action.value)}
              disabled={disabled}
              title={`Set action to ${action.label}`}
              className={`px-2.5 py-1 text-xs font-medium text-white ${action.colorClass} rounded-full shadow-sm hover:opacity-90 focus:outline-none disabled:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 ease-in-out
                                ${selectedAction === action.value ? "ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-800 ring-black dark:ring-gray-300 scale-105" : "opacity-80 hover:opacity-100"}`}
              aria-pressed={selectedAction === action.value}
              aria-label={`Set action to ${action.label}`}
            >
              {action.label}
            </button>
          ))}
          {selectedAction && (
            <button
              onClick={clearSelectedAction}
              disabled={disabled}
              title="Clear selected action"
              className="px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-200 dark:text-gray-300 dark:bg-gray-600 rounded-full shadow-sm hover:bg-gray-300 dark:hover:bg-gray-500 focus:outline-none disabled:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Clear selected action"
            >
              &times; Clear Action
            </button>
          )}
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!disabled) handleSubmit();
            }
          }}
          placeholder={currentPlaceholder}
          disabled={disabled}
          className="flex-grow p-2.5 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:opacity-70 disabled:cursor-not-allowed resize-none"
          rows={Math.max(2, Math.min(5, inputValue.split("\n").length))}
        />
        <Button
          onClick={handleSubmit}
          disabled={disabled || (!inputValue.trim() && !selectedAction)}
          className="h-full px-4 py-2.5"
        >
          Send
        </Button>
      </div>
    </div>
  );
};

interface LLMAssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const LLMAssistantPanel: React.FC<LLMAssistantPanelProps> = ({
  isOpen,
  onClose,
}) => {
  const { project, addReport } = useProjectData();

  const {
    setViewMode,
    setCurrentTimelineId,
    appState: { currentTimelineId },
  } = useAppState();

  const {
    response: llmResponse,
    loading: llmLoading,
    error: llmError,
    analyzeData,
    reset: resetLLMAnalysis,
  } = useLLMAnalysis();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [usedFallback, setUsedFallback] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const hasProject = !!project;
  const hasTimelines =
    hasProject && project.timelines && project.timelines.length > 0;

  const newChatInputDisabled =
    llmLoading || !hasProject || (hasProject && !hasTimelines);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  const getPlaceholderText = () => {
    if (llmLoading) return "AI is thinking...";
    if (!hasProject) return "Load a project to start using AI features...";
    if (hasProject && !hasTimelines) {
      return "Add a timeline to your project to enable AI actions.";
    }
    return "Type your message or select an action...";
  };

  const addMessageHelper = (
    msgData: Omit<ChatMessage, "id" | "timestamp"> & { id?: string },
  ) => {
    setMessages((prevMessages) => {
      const existingMessageIndex = msgData.id
        ? prevMessages.findIndex((m) => m.id === msgData.id)
        : -1;

      if (existingMessageIndex !== -1) {
        const updatedMessages = [...prevMessages];
        updatedMessages[existingMessageIndex] = {
          ...prevMessages[existingMessageIndex],
          ...msgData,
          timestamp: new Date(),
        };
        return updatedMessages;
      } else {
        const newMessage: ChatMessage = {
          id:
            msgData.id ||
            Date.now().toString() + Math.random().toString(36).substring(2, 7),
          timestamp: new Date(),
          sender: msgData.sender,
          type: msgData.type,
          content: msgData.content,
          actionType: msgData.actionType,
          details: msgData.details,
          validationResult: msgData.validationResult,
          onUseJson: msgData.onUseJson,
        };
        return [...prevMessages, newMessage];
      }
    });
  };

  const handleNavigateToTimelinePage = () => {
    setViewMode("timeline");
    if (
      project?.timelines &&
      project.timelines.length > 0 &&
      !currentTimelineId
    ) {
      setCurrentTimelineId(project.timelines[0].id);
    }
    onClose();
  };

  useEffect(() => {
    if (llmError && llmError.message.includes("OpenAI")) {
      setUsedFallback(true);
    }
  }, [llmError]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const loadingMessage = messages.find(
      (m) => m.type === "loading" && m.sender === "ai",
    );

    if (loadingMessage && !llmLoading) {
      if (llmError) {
        addMessageHelper({
          id: loadingMessage.id,
          sender: "system",
          type: "error",
          content: llmError.message.includes("Ollama")
            ? `Ollama Error: ${llmError.message}. Please ensure Ollama is running and accessible.`
            : `An error occurred during analysis: ${llmError.message}`,
          details: usedFallback
            ? "Attempted to use local Ollama model due to previous OpenAI error."
            : undefined,
        });
      } else if (llmResponse) {
        addMessageHelper({
          id: loadingMessage.id,
          sender: "ai",
          type: "text",
          content: llmResponse,
          validationResult: undefined,
          onUseJson:
            project && hasTimelines
              ? handleUseJsonInProjectAndNotify
              : undefined,
        });
      }
      resetLLMAnalysis();
    }
  }, [
    llmResponse,
    llmLoading,
    llmError,
    usedFallback,
    resetLLMAnalysis,
    project,
    hasTimelines,
  ]);

  const handleSendMessage = async (
    userInputText: string,
    actionType?: LLMActionType,
  ) => {
    if (!hasProject) {
      addMessageHelper({
        sender: "system",
        type: "error",
        content: "No Project Loaded",
        details: "Please load or create a project to use AI features.",
      });
      return;
    }

    if (hasProject && !hasTimelines) {
      addMessageHelper({
        sender: "system",
        type: "error",
        content: "Timeline Required for AI Actions",
        details:
          "Please add at least one timeline to your project to use AI actions that modify project data. You can use the button in the message above to go to the Timeline Editor.",
      });
      return;
    }

    addMessageHelper({
      sender: "user",
      type: "text",
      content: userInputText,
      actionType,
    });

    const loadingId = Date.now().toString() + "-loading-ai";
    addMessageHelper({
      id: loadingId,
      sender: "ai",
      type: "loading",
      content: "AI is thinking...",
    });

    setUsedFallback(false);

    let generatedPrompt = "";
    const baseInstruction =
      "CRITICAL: Generate ONLY the requested element type. Do NOT generate a full project structure. Do NOT include empty arrays for other element types. Generate ONLY what is specifically requested.";

    if (actionType) {
      switch (actionType) {
        case "ADD_EVENT":
          generatedPrompt = `Generate ONLY event JSON object(s) based on the user's input: "${userInputText}".

    CRITICAL INSTRUCTIONS:
    - Generate ONLY events, nothing else
    - If multiple events are requested, return a JSON array of event objects
    - If a single event is requested, return a single event object
    - Do NOT generate a project structure
    - Do NOT include timelines, characters, or any other element types

    For a single event:
    \`\`\`json
    {
      "title": "Event Title",
      "date": "YYYY-MM-DD",
      "description": "Event description",
      "color": "#3498DB"
    }
    \`\`\`

    For multiple events:
    \`\`\`json
    [
      { "title": "Event 1", "date": "YYYY-MM-DD", "description": "Description 1", "color": "#3498DB" },
      { "title": "Event 2", "date": "YYYY-MM-DD", "description": "Description 2", "color": "#E74C3C" }
    ]
    \`\`\`

    ${baseInstruction}`;
          break;

        case "ADD_TIMELINE":
          generatedPrompt = `Generate ONLY timeline JSON object(s) based on the user's input: "${userInputText}".

    CRITICAL INSTRUCTIONS:
    - Generate ONLY timelines, nothing else
    - If multiple timelines are requested, return a JSON array of timeline objects
    - If a single timeline is requested, return a single timeline object
    - Do NOT generate a project structure
    - Do NOT include characters, locations, or any other element types

    For a single timeline:
    \`\`\`json
    {
      "name": "Timeline Name",
      "description": "Timeline description",
      "color": "#E74C3C",
      "events": []
    }
    \`\`\`

    For multiple timelines:
    \`\`\`json
    [
      { "name": "Timeline 1", "description": "Description 1", "color": "#E74C3C", "events": [] },
      { "name": "Timeline 2", "description": "Description 2", "color": "#3498DB", "events": [] }
    ]
    \`\`\`

    ${baseInstruction}`;
          break;

        case "ADD_CHARACTER":
          generatedPrompt = `Generate ONLY character JSON object(s) based on the user's input: "${userInputText}".

          CRITICAL INSTRUCTIONS:
          - Generate ONLY characters, nothing else
          - Include ALL required fields with appropriate defaults
          - Use null for optional fields when not applicable

          For a single character:
          \`\`\`json
          {
            "name": "Character Name",
            "description": "Character description",
            "birthDate": null,
            "deathDate": null,
            "traits": [],
            "motivation": "",
            "background": "",
            "notes": "",
            "isHistorical": false,
            "imageUrl": null,
            "tags": [],
            "timelineIds": [],
            "relatedCharacterIds": {},
            "linkedEventIds": [],
            "locations": []
          }
          \`\`\`

          For multiple characters, use an array of the above structure.
          ${baseInstruction}`;
          break;

        case "ADD_LOCATION":
          generatedPrompt = `Generate ONLY location JSON object(s) based on the user's input: "${userInputText}".

          CRITICAL INSTRUCTIONS:
          - Generate ONLY locations, nothing else
          - Include ALL required fields with appropriate defaults

          For a single location:
          \`\`\`json
          {
            "name": "Location Name",
            "description": "Location description",
            "type": "City",
            "coordinates": null,
            "foundedDate": null,
            "destroyedDate": null,
            "population": null,
            "importance": 5,
            "notes": "",
            "tags": [],
            "timelineIds": [],
            "parentLocationId": null,
            "linkedEventIds": []
          }
          \`\`\`
          ${baseInstruction}`;
          break;

        case "ADD_TECHNOLOGY":
          generatedPrompt = `Generate ONLY technology JSON object(s) based on the user's input: "${userInputText}".

          CRITICAL INSTRUCTIONS:
          - Generate ONLY technologies, nothing else
          - Include ALL required fields

          For a single technology:
          \`\`\`json
          {
            "name": "Technology Name",
            "description": "Technology description",
            "discoveryDate": null,
            "developmentLevel": 5,
            "impact": 5,
            "fields": [],
            "tags": [],
            "timelineIds": [],
            "prerequisiteTechIds": [],
            "derivedTechIds": [],
            "inventors": [],
            "linkedEventIds": []
          }
          \`\`\`
          ${baseInstruction}`;
          break;

        case "ADD_CULTURE":
          generatedPrompt = `Generate ONLY culture JSON object(s) based on the user's input: "${userInputText}".

          CRITICAL INSTRUCTIONS:
          - Generate ONLY cultures, nothing else
          - Include ALL required fields

          For a single culture:
          \`\`\`json
          {
            "name": "Culture Name",
            "description": "Culture description",
            "foundedDate": null,
            "endDate": null,
            "values": [],
            "practices": [],
            "languages": [],
            "beliefs": [],
            "notes": "",
            "imageUrl": null,
            "tags": [],
            "timelineIds": [],
            "linkedLocationIds": [],
            "linkedCharacterIds": [],
            "linkedEventIds": []
          }
          \`\`\`
          ${baseInstruction}`;
          break;

        case "ADD_NARRATIVE":
          generatedPrompt = `Generate ONLY narrative JSON object(s) based on the user's input: "${userInputText}".

    CRITICAL INSTRUCTIONS:
    - Generate ONLY narratives, nothing else
    - If multiple narratives are requested, return a JSON array of narrative objects
    - If a single narrative is requested, return a single narrative object
    - Do NOT generate a project structure
    - Do NOT include timelines, characters, or any other element types

    For a single narrative:
    \`\`\`json
    {
      "title": "Narrative Title",
      "description": "Narrative content",
      "narrativeType": "general",
      "relatedEventIds": [],
      "relatedCharacterIds": [],
      "relatedTimelineIds": [],
      "tags": []
    }
    \`\`\`

    For multiple narratives:
    \`\`\`json
    [
      { "title": "Narrative 1", "description": "Content 1", "narrativeType": "general", "tags": [] },
      { "title": "Narrative 2", "description": "Content 2", "narrativeType": "general", "tags": [] }
    ]
    \`\`\`

    ${baseInstruction}`;
          break;
        default:
          console.warn("Unhandled AI action type for prompt:", actionType);
          generatedPrompt = userInputText;
      }
    } else {
      generatedPrompt = `User query: "${userInputText}". Provide a helpful response. If the query seems to imply creating structured data (like an event, character, etc.) for a project context, and a project is available, provide ONLY that specific data type as a valid JSON object or array in a markdown code block (\`\`\`json ... \`\`\`). Do NOT generate entire project structures. ${baseInstruction}`;
    }
    analyzeData(project, generatedPrompt);
  };

  const handleUseJsonInProjectAndNotify = async (jsonData: any) => {
    if (!project) {
      addMessageHelper({
        sender: "system",
        type: "error",
        content: "No project is currently loaded to add data to.",
      });
      return;
    }

    if (!hasTimelines) {
      addMessageHelper({
        sender: "system",
        type: "error",
        content: "Cannot add data: Project has no timelines.",
        details:
          "Please create at least one timeline in your project before adding elements using AI suggestions.",
      });
      return;
    }

    const processingMessageId = Date.now().toString() + "-processing-json";
    addMessageHelper({
      id: processingMessageId,
      sender: "system",
      type: "info",
      content: "Processing submitted JSON data...",
    });

    try {
      const validationResult = validateProjectElement(jsonData);

      console.log("Raw JSON data received for project addition:", jsonData);
      console.log("Validation result:", validationResult);

      if (!validationResult.valid) {
        addMessageHelper({
          id: processingMessageId,
          sender: "system",
          type: "error",
          content: `Invalid JSON format for type: ${validationResult.type || "unknown"}.`,
          details: validationResult.errors.join("; "),
        });
        console.warn(
          "JSON validation failed in handleUseJson:",
          validationResult.errors,
        );
        return;
      }

      let processedItemsCount = 0;
      const type = validationResult.type;
      let successDetails = "";

      // Using the unified API instead of direct context calls
      switch (type) {
        case "project":
          if (jsonData.timelines && Array.isArray(jsonData.timelines)) {
            for (const timeline of jsonData.timelines) {
              const result = api.timeline.add(normalizeTimeline(timeline));
              if (result.success) processedItemsCount++;
            }
          }
          if (jsonData.characters && Array.isArray(jsonData.characters)) {
            for (const character of jsonData.characters) {
              const result = api.kb.character.add(
                normalizeCharacter(character),
              );
              if (result.success) processedItemsCount++;
            }
          }
          if (jsonData.locations && Array.isArray(jsonData.locations)) {
            for (const loc of jsonData.locations) {
              const result = api.kb.location.add(normalizeLocation(loc));
              if (result.success) processedItemsCount++;
            }
          }
          if (jsonData.technologies && Array.isArray(jsonData.technologies)) {
            for (const tech of jsonData.technologies) {
              const result = api.kb.technology.add(normalizeTechnology(tech));
              if (result.success) processedItemsCount++;
            }
          }
          if (jsonData.cultures && Array.isArray(jsonData.cultures)) {
            for (const cult of jsonData.cultures) {
              const result = api.kb.culture.add(normalizeCulture(cult));
              if (result.success) processedItemsCount++;
            }
          }
          successDetails = `Added ${processedItemsCount} items from project data.`;
          break;

        case "timeline_array":
          if (Array.isArray(jsonData)) {
            for (const timeline of jsonData) {
              const result = api.timeline.add(normalizeTimeline(timeline));
              if (result.success) processedItemsCount++;
            }
            successDetails = `Added ${processedItemsCount} timelines.`;
          }
          break;

        case "timeline":
          if (!Array.isArray(jsonData)) {
            const norm = normalizeTimeline(jsonData);
            const result = api.timeline.add(norm);
            if (result.success) {
              processedItemsCount = 1;
              successDetails = `Added timeline "${norm.name}".`;
            }
          }
          break;

        case "project_array":
          // Check if this is actually a character array misidentified as project
          if (Array.isArray(jsonData) && jsonData.length > 0) {
            const firstItem = jsonData[0];
            // Check for character-specific fields
            if (
              firstItem.traits ||
              firstItem.isHistorical !== undefined ||
              firstItem.birthDate !== undefined ||
              firstItem.motivation
            ) {
              // This is actually a character array
              for (const item of jsonData) {
                const result = api.kb.character.add(normalizeCharacter(item));
                if (result.success) processedItemsCount++;
              }
              successDetails = `Added ${processedItemsCount} characters.`;
              break;
            }
          }
          // If not characters, show error
          addMessageHelper({
            id: processingMessageId,
            sender: "system",
            type: "error",
            content: `Unhandled JSON structure type: project_array`,
            details:
              "The data appears to be a project structure but cannot be processed as individual items.",
          });
          return;

        case "character_array":
          if (Array.isArray(jsonData)) {
            for (const item of jsonData) {
              const result = api.kb.character.add(normalizeCharacter(item));
              if (result.success) processedItemsCount++;
            }
            successDetails = `Added ${processedItemsCount} characters.`;
          }
          break;

        case "character":
          if (!Array.isArray(jsonData)) {
            const norm = normalizeCharacter(jsonData);
            const result = api.kb.character.add(norm);
            if (result.success) {
              processedItemsCount = 1;
              successDetails = `Added character "${norm.name}".`;
            }
          }
          break;

        case "narrative_array":
          if (Array.isArray(jsonData)) {
            for (const item of jsonData) {
              addReport(normalizeNarrative(item));
              processedItemsCount++;
            }
            successDetails = `Added ${processedItemsCount} narratives.`;
          }
          break;

        case "narrative":
          if (!Array.isArray(jsonData)) {
            const norm = normalizeNarrative(jsonData);
            addReport(norm);
            processedItemsCount = 1;
            successDetails = `Added narrative "${norm.title}".`;
          }
          break;

        case "event_array":
        case "event":
          {
            const eventsToAdd = Array.isArray(jsonData) ? jsonData : [jsonData];
            if (
              hasTimelines &&
              project.timelines &&
              project.timelines.length > 0
            ) {
              if (eventsToAdd.length === 0 && type === "event_array") {
                successDetails =
                  "Received an empty list of events. Nothing added.";
                processedItemsCount = 0;
              } else if (eventsToAdd.length > 0) {
                const targetTimelineId = project.timelines[0].id;
                const targetTimelineName = project.timelines[0].name;
                for (const eventItem of eventsToAdd) {
                  const result = api.event.add(
                    targetTimelineId,
                    normalizeEvent(eventItem, targetTimelineId),
                  );
                  if (result.success) processedItemsCount++;
                }
                successDetails = `Added ${processedItemsCount} event(s) to timeline "${targetTimelineName}".`;
              } else if (eventsToAdd.length === 0 && type === "event") {
                successDetails =
                  "Received a single event structure, but it was empty or invalid. Nothing added.";
                processedItemsCount = 0;
              }
            } else {
              addMessageHelper({
                id: processingMessageId,
                sender: "system",
                type: "error",
                content:
                  "Cannot add events: No suitable timeline found in the project.",
              });
              return;
            }
          }
          break;

        case "location_array":
          if (Array.isArray(jsonData)) {
            for (const item of jsonData) {
              const result = api.kb.location.add(normalizeLocation(item));
              if (result.success) processedItemsCount++;
            }
            successDetails = `Added ${processedItemsCount} locations.`;
          }
          break;

        case "location":
          if (!Array.isArray(jsonData)) {
            const norm = normalizeLocation(jsonData);
            const result = api.kb.location.add(norm);
            if (result.success) {
              processedItemsCount = 1;
              successDetails = `Added location "${norm.name}".`;
            }
          }
          break;

        case "technology_array":
          if (Array.isArray(jsonData)) {
            for (const item of jsonData) {
              const result = api.kb.technology.add(normalizeTechnology(item));
              if (result.success) processedItemsCount++;
            }
            successDetails = `Added ${processedItemsCount} technologies.`;
          }
          break;

        case "technology":
          if (!Array.isArray(jsonData)) {
            const norm = normalizeTechnology(jsonData);
            const result = api.kb.technology.add(norm);
            if (result.success) {
              processedItemsCount = 1;
              successDetails = `Added technology "${norm.name}".`;
            }
          }
          break;

        case "culture_array":
          if (Array.isArray(jsonData)) {
            for (const item of jsonData) {
              const result = api.kb.culture.add(normalizeCulture(item));
              if (result.success) processedItemsCount++;
            }
            successDetails = `Added ${processedItemsCount} cultures.`;
          }
          break;

        case "culture":
          if (!Array.isArray(jsonData)) {
            const norm = normalizeCulture(jsonData);
            const result = api.kb.culture.add(norm);
            if (result.success) {
              processedItemsCount = 1;
              successDetails = `Added culture "${norm.name}".`;
            }
          }
          break;

        case "unknown_array_empty":
          successDetails = "Received an empty list. Nothing added.";
          processedItemsCount = 0;
          break;

        default:
          addMessageHelper({
            id: processingMessageId,
            sender: "system",
            type: "error",
            content: `Unhandled JSON structure type for project addition: ${type}`,
          });
          return;
      }

      if (successDetails) {
        let finalMessageType: ChatMessage["type"] = "info";
        let finalContent = "Processing complete.";

        if (processedItemsCount > 0) {
          finalMessageType = "success";
          finalContent = "Successfully added data to project.";
        } else if (
          type === "unknown_array_empty" ||
          successDetails.includes("empty list") ||
          successDetails.includes("Nothing added")
        ) {
          finalMessageType = "info";
          finalContent = "Processing complete.";
        }

        addMessageHelper({
          id: processingMessageId,
          sender: "system",
          type: finalMessageType,
          content: finalContent,
          details: successDetails,
        });
      } else if (type !== "unknown_array_empty") {
        addMessageHelper({
          id: processingMessageId,
          sender: "system",
          type: "info",
          content: "No items were processed from the JSON data.",
          details:
            "The JSON might be valid but didn't match expected structures or was an unhandled empty structure.",
        });
      }
    } catch (e) {
      console.error("Error adding data to project:", e);
      addMessageHelper({
        id: processingMessageId,
        sender: "system",
        type: "error",
        content: "Failed to add data to your project.",
        details: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const availableActions: Array<{
    label: string;
    value: LLMActionType;
    colorClass: string;
  }> = [
    {
      label: "Event",
      value: "ADD_EVENT",
      colorClass: "bg-blue-600 hover:bg-blue-700",
    },
    {
      label: "Timeline",
      value: "ADD_TIMELINE",
      colorClass: "bg-purple-600 hover:bg-purple-700",
    },
    {
      label: "Character",
      value: "ADD_CHARACTER",
      colorClass: "bg-teal-600 hover:bg-teal-700",
    },
    {
      label: "Location",
      value: "ADD_LOCATION",
      colorClass: "bg-indigo-600 hover:bg-indigo-700",
    },
    {
      label: "Technology",
      value: "ADD_TECHNOLOGY",
      colorClass: "bg-pink-600 hover:bg-pink-700",
    },
    {
      label: "Culture",
      value: "ADD_CULTURE",
      colorClass: "bg-yellow-500 hover:bg-yellow-600",
    },
    {
      label: "Narrative",
      value: "ADD_NARRATIVE",
      colorClass: "bg-red-600 hover:bg-red-700",
    },
  ];

  const handleClearChat = () => {
    setMessages([]);
    resetLLMAnalysis();
    setUsedFallback(false);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={panelRef}
      style={{ zIndex: 9999 }}
      className="fixed mt-20 mr-4 pb-24 rounded-xl top-0 right-0 z-99 w-1/4 max-h-screen bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-xl transform transition-transform duration-300 ease-in-out translate-x-0 flex flex-col shadow-2xl"
    >
      <div className="p-4 h-14 rounded-t-xl bg-indigo-500 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
        <h3 className="text-lg font-semibold text-white">AI Assistant</h3>
        <button
          onClick={onClose}
          className="hover:text-gray-300 text-gray-50 p-1"
          title="Close AI Panel"
          aria-label="Close AI Panel"
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

      <div
        ref={messagesEndRef}
        className="flex-grow overflow-y-auto p-4 space-y-2"
      >
        {messages.length === 0 && !llmLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            {hasProject && !hasTimelines && (
              <div className="mb-4 w-full px-2">
                <MessageBox
                  type="warning"
                  title="Timeline Required for AI Actions"
                  message="To use AI actions that modify or add to your project, your project needs at least one timeline."
                  actions={[
                    {
                      label: "Go to Timeline Editor",
                      onClick: handleNavigateToTimelinePage,
                    },
                  ]}
                />
              </div>
            )}
            {!hasProject && (
              <div className="mb-4 w-full px-2">
                <MessageBox
                  type="info"
                  title="No Project Loaded"
                  message="Load or create a project to enable AI actions that modify project data. General questions are still welcome."
                />
              </div>
            )}
            <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-2">
              AI Assistant Ready
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {hasProject && !hasTimelines
                ? "Please use the button above to go to the Timeline Editor and add a timeline. You can then use AI actions here."
                : hasTimelines
                  ? "How can I help you with your project today?"
                  : "Load a project or ask a general question."}
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <ChatMessageBubble key={msg.id} message={msg} />
        ))}
        {usedFallback &&
          messages.some(
            (m) => m.sender === "ai" || m.details?.includes("Ollama"),
          ) &&
          !messages.find((m) => m.id === "fallback-info-message") && (
            <ChatMessageBubble
              key="fallback-info-message"
              message={{
                id: "fallback-info-message",
                sender: "system",
                type: "info",
                content:
                  "Cloud AI service may be unavailable. Using your local Ollama model if configured as fallback.",
                timestamp: new Date(),
              }}
            />
          )}
      </div>

      {(messages.length > 0 || llmLoading) && (
        <div className="p-2 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 text-center">
          <Button variant="outline" size="sm" onClick={handleClearChat}>
            Clear Chat & Start Over
          </Button>
        </div>
      )}

      <div
        className={`p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 ${messages.length === 0 && !llmLoading ? "mt-auto" : ""}`}
      >
        <NewChatInputInterface
          onSendMessage={handleSendMessage}
          actions={availableActions}
          disabled={newChatInputDisabled}
          placeholder={getPlaceholderText()}
          showActions={true}
        />
      </div>
    </div>
  );
};

export default LLMAssistantPanel;
