// src/pages/LLMAnalysisPage.tsx
import React, { useState, useEffect, useRef } from "react";
import { useProjectData } from "../contexts/ProjectDataContext";
import Button from "../components/common/Button";
import { useLLMAnalysis } from "../hooks/useLLMAnalysis";
import MessageBox from "../components/common/MessageBox";
import ChatMessageBubble from "../components/LLM/ChatMessageBubble";
import MainContentArea from "../components/layout/MainContentArea";
import { checkOllamaStatus } from "../services/ollamaService";
import {
  hqPullProject,
  runHqActions,
} from "../services/hqBridgeService";
import { mergeProjects } from "../services/mainProjectService";
import {
  LLM_PROVIDERS,
  getModel,
  getProvider,
  getProviderKey,
} from "../services/llmProviders";

// Define the structure for a chat message
export interface ChatMessage {
  id: string;
  sender: "user" | "ai" | "system";
  type: "text" | "error" | "info" | "success" | "loading";
  content: any;
  timestamp: Date;
  details?: string;
}

// Props for the chat input component
interface AnalysisChatInputInterfaceProps {
  onSendMessage: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

interface AssistantTask {
  label: string;
  hint: string;
  prompt: string;
}

const ASSISTANT_TASKS: AssistantTask[] = [
  {
    label: "Shift brief",
    hint: "What matters right now",
    prompt:
      "Give me a tight shift brief from this record: what is open, what is overdue, what is new or unreviewed, any recent activity, and the three things I should handle first. Keep it operational and short.",
  },
  {
    label: "What's next",
    hint: "Prioritised action list",
    prompt:
      "Based on open tasks, deadlines, documents, and recent events, give me a prioritised action list for today. For each item: the next concrete step, who or what it depends on, and the deadline risk.",
  },
  {
    label: "Task triage",
    hint: "Clean up the task list",
    prompt:
      "Triage the open tasks: flag blockers, duplicates, stale items, and anything that should be done next. Suggest missing tasks implied by the record, but do not invent facts. Recommend status changes where clear.",
  },
  {
    label: "Follow-ups",
    hint: "Loose ends and promises",
    prompt:
      "Find loose ends in this record: unanswered questions, promises, deadlines, and events with no follow-up. Turn each into a concrete follow-up action with the records involved.",
  },
  {
    label: "Document sweep",
    hint: "What needs reading or review",
    prompt:
      "Review the document list. Tell me which are unreviewed or new, what each likely needs, which to read first, and what task or follow-up each implies. Do not guess at contents you cannot see.",
  },
  {
    label: "Look up a person",
    hint: "Brief on a person or org",
    prompt:
      "I need a lookup. If I named a person or organisation above, brief me on them from the record: role, involvement, related events and places, open questions, and linked tasks. If no name is given, ask me who. Do not invent details.",
  },
  {
    label: "Look up a place",
    hint: "Brief on a location",
    prompt:
      "I need a lookup. If I named a place above, brief me on it from the record: what it is, who and what is connected, events there, access or risk notes, and linked tasks. If no place is given, ask me which. Do not invent details.",
  },
  {
    label: "Gap check",
    hint: "What the record is missing",
    prompt:
      "Compare timelines, tasks, and documents. List the gaps that matter operationally: missing records, missing steps, missing dates, and things referenced but not logged. For each gap, say what to add or verify next.",
  },
  {
    label: "Draft status update",
    hint: "Short update for the record",
    prompt:
      "Draft a short status update from this record: what is done, what is blocked, what is next, and what needs a decision from me. Plain language, no speculation, no filler.",
  },
];

const AssistantTaskButtons: React.FC<{
  onAction: (prompt: string) => void;
  disabled?: boolean;
}> = ({ onAction, disabled }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
    {ASSISTANT_TASKS.map((task) => (
      <button
        key={task.label}
        type="button"
        disabled={disabled}
        onClick={() => onAction(task.prompt)}
        className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-3 py-2 text-left transition-colors hover:border-indigo-400 hover:bg-indigo-50 dark:hover:border-indigo-500 dark:hover:bg-indigo-900/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="block text-sm font-medium text-gray-800 dark:text-gray-100">
          {task.label}
        </span>
        <span className="block text-[11px] text-gray-500 dark:text-gray-400">
          {task.hint}
        </span>
      </button>
    ))}
  </div>
);

// Chat input component
const AnalysisChatInputInterface: React.FC<AnalysisChatInputInterfaceProps> = ({
  onSendMessage,
  disabled,
  placeholder,
}) => {
  const [inputValue, setInputValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (inputValue.trim()) {
      onSendMessage(inputValue.trim());
      setInputValue("");
    }
  };

  return (
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
        placeholder={placeholder || "Ask for a brief, a lookup, or a tasking plan..."}
        disabled={disabled}
        className="flex-grow p-2.5 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:opacity-70 disabled:cursor-not-allowed resize-none"
        rows={Math.max(2, Math.min(5, inputValue.split("\n").length))}
      />
      <Button
        onClick={handleSubmit}
        disabled={disabled || !inputValue.trim()}
        className="h-full px-4 py-2.5"
      >
        Send
      </Button>
    </div>
  );
};

// Local-only AI availability message
const AINotAvailableMessage: React.FC = () => (
  <div className="flex-grow flex items-center justify-center p-8">
    <MessageBox
      type="warning"
      title="AI Model Unavailable"
      message={
        <>
          <p className="mb-3">
            The selected AI provider is not ready. AI analysis needs Ollama on
            this computer, or a cloud provider with a key and a chosen model.
          </p>
          <ul className="list-disc list-inside mb-3 space-y-2 text-left">
            <li>Ollama: start it and pull a model.</li>
            <li>Cloud: add the provider key and choose a model in Settings.</li>
          </ul>
          <p>
            No account or Pro tier is involved. Open Settings to choose a
            provider and refresh the model list.
          </p>
        </>
      }
    />
  </div>
);

const LLMAnalysisPage: React.FC = () => {
  const { project, setProject, currentFilePath } = useProjectData();
  const {
    response: llmResponse,
    loading: llmLoading,
    error: llmError,
    proposeActions,
    reset: resetLLMAnalysis,
  } = useLLMAnalysis();

  const [assistantBusy, setAssistantBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [modelCheckStatus, setModelCheckStatus] = useState<
    "checking" | "available" | "unavailable"
  >("checking");

  const hasProject = !!project;

  useEffect(() => {
    let isMounted = true;
    setModelCheckStatus("checking");
    console.log("LLM Check - Mount Effect: Initializing AI provider check.");

    const performActualCheck = async () => {
      if (!isMounted) return;
      const provider = getProvider();
      if (provider !== "ollama") {
        const ready = Boolean(getProviderKey(provider) && getModel());
        if (isMounted) setModelCheckStatus(ready ? "available" : "unavailable");
        return;
      }
      try {
        const isOllamaUp = await checkOllamaStatus();
        if (isMounted) {
          setModelCheckStatus(isOllamaUp ? "available" : "unavailable");
        }
      } catch (error) {
        console.error("LLM Check: Ollama check threw an error:", error);
        if (isMounted) setModelCheckStatus("unavailable");
      }
    };

    performActualCheck();

    return () => {
      isMounted = false;
      console.log("LLM Check: Mount Effect cleanup.");
    };
  }, []); // Run only once on mount.


  const chatInputDisabled =
    assistantBusy ||
    llmLoading ||
    !hasProject ||
    modelCheckStatus !== "available";

  const getPlaceholderText = () => {
    if (modelCheckStatus === "checking") return "Checking AI model availability...";
    if (modelCheckStatus === "unavailable") {
      return "The selected AI provider is unavailable. Check Settings.";
    }
    if (llmLoading) return "AI is analyzing...";
    if (!hasProject) return "Load or create a project to start AI analysis...";

    return `Ask for a brief, lookup, or task (using ${LLM_PROVIDERS[getProvider()].short})...`;
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
          details: msgData.details,
        };
        return [...prevMessages, newMessage];
      }
    });
  };

  useEffect(() => {
    if (llmError && llmError.message.includes("Ollama")) {
      setModelCheckStatus("unavailable");
      console.warn("LLM Check: Ollama error during use, marking as unavailable.", llmError);
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
          content: `Analysis Error: ${llmError.message}`,
          details: "Your selected AI provider could not complete the request. Please check settings or try again."
        });
      } else if (llmResponse) {
        addMessageHelper({
          id: loadingMessage.id,
          sender: "ai",
          type: "text",
          content: llmResponse,
        });
      }
      resetLLMAnalysis();
    }
  }, [llmResponse, llmLoading, llmError]); // Removed resetLLMAnalysis & addMessageHelper from deps

  const handleSendMessage = async (userInputText: string) => {
    if (!project) {
      addMessageHelper({
        sender: "system",
        type: "error",
        content: "No Project Loaded",
        details: "Please load or create a project to use AI analysis features.",
      });
      return;
    }

    if (modelCheckStatus !== "available") {
      addMessageHelper({
        sender: "system",
        type: "error",
        content: "AI Model Not Available",
        details: "Ollama is not accessible. Start it and check the model in Settings.",
      });
      return;
    }

    addMessageHelper({
      sender: "user",
      type: "text",
      content: userInputText,
    });

    const loadingId = Date.now().toString() + "-loading-ai";
    addMessageHelper({
      id: loadingId,
      sender: "ai",
      type: "loading",
      content: "Working the record...",
    });

    setAssistantBusy(true);
    try {
      const plan = await proposeActions(project, userInputText);
      let outcome = "";
      if (plan.actions.length > 0) {
        const response = await runHqActions(plan.actions);
        const applied = response.results.filter((row) => row.ok).length;
        const failed = response.results.filter((row) => !row.ok);
        outcome = `\n\nApplied ${applied} of ${plan.actions.length} change(s).`;
        if (failed.length > 0) {
          outcome += ` Failed: ${failed
            .map((row) => `${row.kind || "action"} — ${row.error || "error"}`)
            .join("; ")}`;
        }
        try {
          const incoming = await hqPullProject();
          if (incoming) {
            setProject(
              mergeProjects(project, incoming),
              currentFilePath,
              false,
            );
          }
        } catch {
          outcome += " Changes are saved to HQ and will sync shortly.";
        }
      }
      addMessageHelper({
        id: loadingId,
        sender: "ai",
        type: "text",
        content: `${plan.reply}${outcome}`,
      });
    } catch (error) {
      addMessageHelper({
        id: loadingId,
        sender: "system",
        type: "error",
        content: `Assistant error: ${
          error instanceof Error ? error.message : String(error)
        }`,
        details:
          "The assistant could not reach the local MCP or the selected AI provider.",
      });
    } finally {
      setAssistantBusy(false);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    resetLLMAnalysis();
  };

  const renderContent = () => {
    if (modelCheckStatus === "checking") {
      return (
        <div className="flex-grow flex items-center justify-center">
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Checking AI model availability...
          </p>
        </div>
      );
    }

    if (modelCheckStatus === "unavailable") {
      return <AINotAvailableMessage />;
    }

    if (modelCheckStatus === "available") {
      return (
        <>
          {/* Messages Area */}
          <div
            ref={messagesEndRef}
            className="flex-grow overflow-y-auto p-4 space-y-2"
          >
            {messages.length === 0 && !llmLoading && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                {!hasProject && (
                  <div className="mb-4 w-full px-2 max-w-2xl">
                    <MessageBox
                      type="info"
                      title="No Project Loaded"
                      message="Load or create a project to analyze your project data with AI."
                    />
                  </div>
                )}
                <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
                  HQ Assistant
                </h3>
                <p className="text-md text-gray-600 dark:text-gray-400 max-w-xl">
                  {hasProject
                    ? ""
                    : "Once a project is loaded, you can ask questions here to get AI-powered analysis."}
                </p>
                 <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Using: {LLM_PROVIDERS[getProvider()].short}
                </p>
              </div>
            )}
            {messages.map((msg) => (
              <ChatMessageBubble key={msg.id} message={msg} />
            ))}
          </div>

          {(messages.length > 0 || llmLoading) && (
            <div className="p-2 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 text-center">
              <Button variant="outline" size="sm" onClick={handleClearChat}>
                Clear Chat
              </Button>
            </div>
          )}

          {/* Input Area */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div className="mb-3">
              <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Assistant tasks
              </h4>
              <AssistantTaskButtons
                onAction={handleSendMessage}
                disabled={chatInputDisabled}
              />
            </div>
            <AnalysisChatInputInterface
              onSendMessage={handleSendMessage}
              disabled={chatInputDisabled}
              placeholder={getPlaceholderText()}
            />
          </div>
        </>
      );
    }
    return null;
  };

  return (
    <MainContentArea title="HQ Assistant">
      <div className="flex flex-col h-full">{renderContent()}</div>
    </MainContentArea>
  );
};

export default LLMAnalysisPage;
