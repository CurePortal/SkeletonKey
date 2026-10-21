import React, { useRef, useCallback, useState, useEffect } from "react";

// The interfaces remain the same
interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
  label?: string;
  error?: string;
  helpText?: string;
}

interface ToolbarButtonProps {
  command: string;
  value?: string;
  title: string;
  icon: React.ReactNode;
  isActive?: boolean;
  onClick: (command: string, value?: string) => void;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  command,
  value,
  title,
  icon,
  isActive = false,
  onClick,
}) => {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick(command, value);
      }}
      className={`
        p-2 rounded border border-gray-300 dark:border-gray-600
        hover:bg-gray-100 dark:hover:bg-gray-700
        transition-colors duration-150 ease-in-out
        ${
          isActive
            ? "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300"
            : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
        }
      `}
    >
      {icon}
    </button>
  );
};

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = "Enter text...",
  className = "",
  rows = 4,
  label,
  error,
  helpText,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isEditorFocused, setIsEditorFocused] = useState(false);

  // CHANGE #1: Add a useEffect to sync the editor content
  // This effect ensures the editor's content is updated if the `value` prop
  // changes from an external source, without interfering with user input.
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const isCommandActive = useCallback((command: string): boolean => {
    try {
      return document.queryCommandState(command);
    } catch {
      return false;
    }
  }, []);

  const executeCommand = useCallback(
    (command: string, value?: string) => {
      if (!editorRef.current) return;
      try {
        editorRef.current.focus();
        if (value) {
          document.execCommand(command, false, value);
        } else {
          document.execCommand(command, false);
        }
        onChange(editorRef.current.innerHTML);
      } catch (error) {
        console.warn("Failed to execute command:", command, error);
      }
    },
    [onChange],
  );

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "b":
            e.preventDefault();
            executeCommand("bold");
            break;
          case "i":
            e.preventDefault();
            executeCommand("italic");
            break;
          case "u":
            e.preventDefault();
            executeCommand("underline");
            break;
        }
      }
    },
    [executeCommand],
  );

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {label}
        </label>
      )}

      <div
        className={`
          border rounded-md overflow-hidden
          ${error ? "border-red-300 dark:border-red-600" : "border-gray-300 dark:border-gray-600"}
          ${isEditorFocused ? "ring-2 ring-blue-500 ring-opacity-50 border-blue-500" : ""}
        `}
      >
        {/* Toolbar */}
        <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-600 p-2">
          {/* ... Toolbar content is unchanged ... */}
          <div className="flex items-center gap-1 flex-wrap">
                        {/* Text formatting */}
                       {" "}
            <ToolbarButton
              command="bold"
              title="Bold (Ctrl+B)"
              isActive={isCommandActive("bold")}
              onClick={executeCommand}
              icon={
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  {" "}
                  <path
                    fillRule="evenodd"
                    d="M5 4v12h4.5a3.5 3.5 0 0 0 2.6-5.8A3 3 0 0 0 10.5 4H5zm2.5 2h2a1 1 0 1 1 0 2h-2V6zm0 4h2.5a1.5 1.5 0 1 1 0 3H7.5v-3z"
                  />{" "}
                </svg>
              }
            />
                       {" "}
            <ToolbarButton
              command="italic"
              title="Italic (Ctrl+I)"
              isActive={isCommandActive("italic")}
              onClick={executeCommand}
              icon={
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  {" "}
                  <path
                    fillRule="evenodd"
                    d="M8 4h4v2h-1l-2 8h1v2H6v-2h1l2-8H8V4z"
                  />{" "}
                </svg>
              }
            />
                       {" "}
            <ToolbarButton
              command="underline"
              title="Underline (Ctrl+U)"
              isActive={isCommandActive("underline")}
              onClick={executeCommand}
              icon={
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  {" "}
                  <path
                    fillRule="evenodd"
                    d="M4 16h12v2H4v-2zm2-12h2v6a2 2 0 1 0 4 0V4h2v6a4 4 0 1 1-8 0V4z"
                  />{" "}
                </svg>
              }
            />
                        {/* Separator */}
                       {" "}
            <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />     
                  {/* Lists */}
                       {" "}
            <ToolbarButton
              command="insertUnorderedList"
              title="Bullet List"
              isActive={isCommandActive("insertUnorderedList")}
              onClick={executeCommand}
              icon={
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  {" "}
                  <path
                    fillRule="evenodd"
                    d="M3 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm0 4a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm0 4a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm4-8h10v2H7V6zm0 4h10v2H7v-2zm0 4h10v2H7v-2z"
                  />{" "}
                </svg>
              }
            />
                       {" "}
            <ToolbarButton
              command="insertOrderedList"
              title="Numbered List"
              isActive={isCommandActive("insertOrderedList")}
              onClick={executeCommand}
              icon={
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  {" "}
                  <path
                    fillRule="evenodd"
                    d="M2 3h1v1H2V3zm0 3h1v1H2V6zm0 3h1v1H2V9zm0 3h1v1H2v-1zm4-9h12v2H6V3zm0 4h12v2H6V7zm0 4h12v2H6v-2zm0 4h12v2H6v-2z"
                  />{" "}
                </svg>
              }
            />
                        {/* Separator */}
                       {" "}
            <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />     
                  {/* Indentation */}
                       {" "}
            <ToolbarButton
              command="outdent"
              title="Decrease Indent"
              onClick={executeCommand}
              icon={
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  {" "}
                  <path
                    fillRule="evenodd"
                    d="M3 4h14v2H3V4zm0 4h14v2H3V8zm0 4h14v2H3v-2zm0 4h14v2H3v-2zm4-12v8l-2-2 2-2z"
                  />{" "}
                </svg>
              }
            />
                       {" "}
            <ToolbarButton
              command="indent"
              title="Increase Indent"
              onClick={executeCommand}
              icon={
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  {" "}
                  <path
                    fillRule="evenodd"
                    d="M3 4h14v2H3V4zm0 4h14v2H3V8zm0 4h14v2H3v-2zm0 4h14v2H3v-2zM7 8l2 2-2 2V8z"
                  />{" "}
                </svg>
              }
            />
                        {/* Separator */}
                       {" "}
            <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />     
                  {/* Clear formatting */}
                       {" "}
            <ToolbarButton
              command="removeFormat"
              title="Clear Formatting"
              onClick={executeCommand}
              icon={
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  {" "}
                  <path
                    fillRule="evenodd"
                    d="M3 5a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1zm0 6a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1zm1 5a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2H4z"
                  />{" "}
                </svg>
              }
            />
          </div>
        </div>

        {/* Editor */}
        <div
          ref={editorRef}
          contentEditable
          className={`
            px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100
            focus:outline-none resize-none overflow-auto
            standardized-entity-content
          `}
          style={{
            minHeight: `${rows * 1.5}rem`,
            maxHeight: "300px",
          }}
          // CHANGE #2: Remove dangerouslySetInnerHTML from here
          // dangerouslySetInnerHTML={{ __html: value }}
          onInput={handleInput}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsEditorFocused(true)}
          onBlur={() => setIsEditorFocused(false)}
          data-placeholder={placeholder}
        />
      </div>

      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {helpText && !error && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {helpText}
        </p>
      )}

      {/* CSS for placeholder */}
      <style jsx>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
        .dark [contenteditable]:empty:before {
          color: #6b7280;
        }
      `}</style>
    </div>
  );
};

export default RichTextEditor;
