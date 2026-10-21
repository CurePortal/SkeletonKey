import React from "react";

// Define the types of actions the buttons can trigger
export type LLMActionType =
  | "ADD_EVENT"
  | "ADD_TIMELINE"
  | "ADD_CHARACTER" // Added
  | "ADD_LOCATION" // Added
  | "ADD_TECHNOLOGY" // Added
  | "ADD_CULTURE" // Added
  | "ADD_NARRATIVE"; // Added

interface LLMPromptInputProps {
  /**
   * Callback function that is invoked when an action button is clicked.
   * It receives an LLMActionType corresponding to the button pressed.
   */
  onActionSubmit: (action: LLMActionType) => void;
  /**
   * If true, all action buttons will be disabled.
   * Useful for preventing multiple submissions while an action is in progress.
   */
  disabled?: boolean;
}

/**
 * LLMPromptInput component providing predefined action buttons for LLM interaction.
 */
export const LLMPromptInput: React.FC<LLMPromptInputProps> = ({
  onActionSubmit,
  disabled = false,
}) => {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        AI Actions - Generate New Project Content
      </label>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => onActionSubmit("ADD_TIMELINE")}
          disabled={disabled}
          className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md shadow-sm hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          aria-label="Add Timeline using AI"
        >
          Add Timeline
        </button>

        <button
          onClick={() => onActionSubmit("ADD_EVENT")}
          disabled={disabled}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          aria-label="Add Event using AI"
        >
          Add Event
        </button>

        <button
          onClick={() => onActionSubmit("ADD_CHARACTER")}
          disabled={disabled}
          className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-md shadow-sm hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          aria-label="Add Character using AI"
        >
          Add Character
        </button>

        <button
          onClick={() => onActionSubmit("ADD_LOCATION")}
          disabled={disabled}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          aria-label="Add Location using AI"
        >
          Add Location
        </button>

        <button
          onClick={() => onActionSubmit("ADD_TECHNOLOGY")}
          disabled={disabled}
          className="px-4 py-2 text-sm font-medium text-white bg-pink-600 rounded-md shadow-sm hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          aria-label="Add Technology using AI"
        >
          Add Technology
        </button>

        <button
          onClick={() => onActionSubmit("ADD_CULTURE")}
          disabled={disabled}
          className="px-4 py-2 text-sm font-medium text-white bg-yellow-500 rounded-md shadow-sm hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          aria-label="Add Culture using AI"
        >
          Add Culture
        </button>

        <button
          onClick={() => onActionSubmit("ADD_NARRATIVE")}
          disabled={disabled}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          aria-label="Add Narrative using AI"
        >
          Add Narrative
        </button>
      </div>
    </div>
  );
};
