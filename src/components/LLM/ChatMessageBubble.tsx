import React from "react";
import { LLMOutputDisplay } from "./LLMOutputDisplay";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";

// --- Start: Added Local ChatMessage Definition ---
export type MessageSender = "user" | "ai" | "system";
// --- FIX: Added 'json_suggestion' ---
export type MessageType =
  | "text"
  | "error"
  | "info"
  | "success"
  | "loading"
  | "json_suggestion";

export interface ChatMessage {
  id: string;
  sender: MessageSender;
  type: MessageType;
  content: string | object; // Allow string or object (for JSON)
  timestamp: Date;
  details?: string;
  onUseJson?: (json: object) => void;
}
// --- End: Added Local ChatMessage Definition ---

interface ChatMessageBubbleProps {
  message: ChatMessage;
}

const ChatMessageBubble: React.FC<ChatMessageBubbleProps> = ({ message }) => {
  const isUser = message.sender === "user";
  const isAI = message.sender === "ai";

  let bubbleStyles = "";
  let textStyles = "";
  let alignment = "justify-start";
  let containerMaxWidth = "max-w-[90%]";

  if (isUser) {
    bubbleStyles = "bg-blue-500";
    textStyles = "text-white";
    alignment = "justify-end";
  } else if (isAI) {
    if (message.type === "loading") {
      bubbleStyles = "bg-gray-200 dark:bg-gray-700";
      textStyles = "text-gray-800 dark:text-gray-200";
    } else if (message.type === "text") {
      containerMaxWidth = "w-full";
    }
  } else {
    alignment = "justify-start";
    containerMaxWidth = "w-full";
    switch (message.type) {
      case "error":
        bubbleStyles =
          "bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700";
        textStyles = "text-red-700 dark:text-red-100";
        break;
      case "info":
        bubbleStyles =
          "bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700";
        textStyles = "text-blue-700 dark:text-blue-100";
        break;
      case "success":
        bubbleStyles =
          "bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700";
        textStyles = "text-green-700 dark:text-green-100";
        break;
      case "loading":
        bubbleStyles = "bg-gray-200 dark:bg-gray-700";
        textStyles = "text-gray-800 dark:text-gray-200";
        break;
      default:
        bubbleStyles = "bg-gray-200 dark:bg-gray-700";
        textStyles = "text-gray-800 dark:text-gray-200";
    }
  }

  // --- FIX: Refactored renderContent to handle types correctly ---
  const renderContent = () => {
    // AI text messages use LLMOutputDisplay directly
    if (
      isAI &&
      message.type === "text" &&
      typeof message.content === "string"
    ) {
      return (
        <LLMOutputDisplay
          output={message.content}
          onUseJson={message.onUseJson}
        />
      );
    }

    let mainContent: React.ReactNode;

    // Handle string content
    if (typeof message.content === "string") {
      mainContent = (
        <div className="whitespace-pre-wrap">{message.content}</div>
      );
    }
    // Handle object content (JSON)
    else if (typeof message.content === "object" && message.content !== null) {
      mainContent = (
        <SyntaxHighlighter
          language="json"
          style={atomDark}
          customStyle={{ margin: 0, fontSize: "0.8rem" }}
        >
          {JSON.stringify(message.content, null, 2)}
        </SyntaxHighlighter>
      );
    }
    // Fallback for any other type (shouldn't happen)
    else {
      mainContent = null;
    }

    // Special handling for error messages with details
    if (message.type === "error" && message.details) {
      const errorText =
        typeof message.content === "string"
          ? message.content
          : JSON.stringify(message.content); // Ensure it's a string

      return (
        <>
          <div className="font-semibold whitespace-pre-wrap">{errorText}</div>
          <p className="text-xs mt-1 whitespace-pre-wrap">{message.details}</p>
        </>
      );
    }

    return mainContent;
  };

  // If it's an AI 'text' message, render using the specific layout
  if (isAI && message.type === "text") {
    return (
      <div className={`flex ${alignment} mb-3`}>
        <div className={`${containerMaxWidth} `}>
          {renderContent()} {/* This now calls LLMOutputDisplay */}
          <div
            className={`text-xs mt-1 text-gray-500 dark:text-gray-400 ${alignment === "justify-end" ? "text-right" : "text-left"} pl-1 pr-1`}
          >
            {message.timestamp.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>
      </div>
    );
  }

  // Render user or system/non-text AI messages with standard bubble
  return (
    <div className={`flex ${alignment} mb-3`}>
      <div
        className={`${containerMaxWidth} p-3 rounded-lg shadow-md ${bubbleStyles} ${textStyles}`}
      >
        {renderContent()} {/* This handles string/object/error */}
        <div
          className={`text-xs mt-1 ${isUser ? "text-blue-200" : "text-gray-500 dark:text-gray-400"} text-right`}
        >
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
    </div>
  );
};

export default ChatMessageBubble;
