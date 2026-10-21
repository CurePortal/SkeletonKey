import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  FiBold,
  FiItalic,
  FiUnderline,
  FiAlignLeft,
  FiAlignCenter,
  FiAlignRight,
  FiAlignJustify,
  FiList,
  FiImage,
  FiLink,
  FiTable,
  FiCode,
  FiMaximize2,
  FiMinimize2,
  FiDownload,
  FiUpload,
  FiCheckCircle,
  FiAlertCircle,
  FiInfo,
  FiMoreVertical,
  FiHash,
  FiUser,
  FiMapPin,
  FiCalendar,
  FiBookOpen,
  FiSave,
  FiChevronDown,
  FiMessageSquare,
} from "react-icons/fi";

interface NotesAppProps {
  project?: any;
  documentId?: string;
  initialContent?: string;
  onContentChange?: (content: string) => void;
}

const NotesApp: React.FC<NotesAppProps> = ({
  project,
  documentId,
  initialContent = "",
  onContentChange,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [showResourcePalette, setShowResourcePalette] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const [isInitialized, setIsInitialized] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const contentRef = useRef<string>("");
  const previousDocumentIdRef = useRef<string>("");

  // Convert markdown to HTML for display
  const markdownToHtml = (markdown: string): string => {
    let html = markdown;

    // Headers
    html = html.replace(/^#### (.+)$/gm, "<h4>$1</h4>");
    html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
    html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
    html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

    // Bold and italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
    html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");
    html = html.replace(/_(.+?)_/g, "<em>$1</em>");

    // Lists
    html = html.replace(/^\* (.+)$/gm, "<li>$1</li>");
    html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
    html = html.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");

    // Links
    html = html.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" class="text-blue-600 dark:text-blue-400 underline">$1</a>',
    );

    // Images
    html = html.replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      '<img src="$2" alt="$1" class="max-w-full rounded-lg my-4" />',
    );

    // Blockquotes
    html = html.replace(
      /^> (.+)$/gm,
      '<blockquote class="border-l-4 border-gray-300 pl-4 italic my-4">$1</blockquote>',
    );

    // Inline code
    html = html.replace(
      /`([^`]+)`/g,
      '<code class="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm">$1</code>',
    );

    // Horizontal rules
    html = html.replace(
      /^---$/gm,
      '<hr class="my-6 border-gray-300 dark:border-gray-600" />',
    );

    // Resource tags
    html = html.replace(
      /@(\w+):([^@\s]+)/g,
      '<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm"><i class="text-xs">@</i>$1:$2</span>',
    );
    html = html.replace(
      /#(\w+)/g,
      '<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full text-sm">#$1</span>',
    );

    // Paragraphs
    html = html.replace(/\n\n/g, "</p><p>");
    html = "<p>" + html + "</p>";

    // Clean up empty paragraphs
    html = html.replace(/<p><\/p>/g, "");
    html = html.replace(/<p>(<h[1-6]>)/g, "$1");
    html = html.replace(/(<\/h[1-6]>)<\/p>/g, "$1");
    html = html.replace(/<p>(<li>)/g, "<ul>$1");
    html = html.replace(/(<\/li>)<\/p>/g, "$1</ul>");

    return html;
  };

  // Convert HTML back to markdown for storage
  const htmlToMarkdown = (html: string): string => {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;

    let markdown = "";

    const processNode = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || "";
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        const tagName = element.tagName.toLowerCase();
        let content = Array.from(element.childNodes).map(processNode).join("");

        switch (tagName) {
          case "h1":
            return `# ${content}\n\n`;
          case "h2":
            return `## ${content}\n\n`;
          case "h3":
            return `### ${content}\n\n`;
          case "h4":
            return `#### ${content}\n\n`;
          case "strong":
          case "b":
            return `**${content}**`;
          case "em":
          case "i":
            return `*${content}*`;
          case "u":
            return `_${content}_`;
          case "a":
            return `[${content}](${element.getAttribute("href") || ""})`;
          case "img":
            return `![${element.getAttribute("alt") || ""}](${element.getAttribute("src") || ""})`;
          case "code":
            return `\`${content}\``;
          case "blockquote":
            return `> ${content}\n\n`;
          case "li":
            return `- ${content}\n`;
          case "ul":
          case "ol":
            return content + "\n";
          case "p":
            return content + "\n\n";
          case "br":
            return "\n";
          case "hr":
            return "---\n\n";
          case "div":
            return content;
          case "span":
            if (
              element.textContent?.startsWith("@") ||
              element.textContent?.startsWith("#")
            ) {
              return element.textContent;
            }
            return content;
          default:
            return content;
        }
      }

      return "";
    };

    markdown = Array.from(tempDiv.childNodes).map(processNode).join("");

    // Clean up extra whitespace
    markdown = markdown.replace(/\n{3,}/g, "\n\n");
    markdown = markdown.trim();

    return markdown;
  };

  // Save cursor position
  const saveCursorPosition = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(editorRef.current!);
    preCaretRange.setEnd(range.endContainer, range.endOffset);

    return preCaretRange.toString().length;
  };

  // Restore cursor position
  const restoreCursorPosition = (position: number | null) => {
    if (position === null || !editorRef.current) return;

    const selection = window.getSelection();
    if (!selection) return;

    let charCount = 0;
    let node: Node | null = null;
    let offset = 0;

    const traverse = (n: Node): boolean => {
      if (n.nodeType === Node.TEXT_NODE) {
        const textLength = n.textContent?.length || 0;
        if (charCount + textLength >= position) {
          node = n;
          offset = position - charCount;
          return true;
        }
        charCount += textLength;
      } else {
        for (let i = 0; i < n.childNodes.length; i++) {
          if (traverse(n.childNodes[i])) return true;
        }
      }
      return false;
    };

    traverse(editorRef.current);

    if (node) {
      const range = document.createRange();
      range.setStart(node as Node, Math.min(offset, (node as any).textContent?.length || 0));
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  };

  // Background save function
  const performBackgroundSave = useCallback(() => {
    if (!editorRef.current || !documentId) return;

    const markdown = htmlToMarkdown(editorRef.current.innerHTML);
    contentRef.current = markdown;

    // Save to localStorage
    localStorage.setItem(`note_content_${documentId}`, markdown);

    // Call the callback if provided
    if (onContentChange) {
      onContentChange(markdown);
    }

    setIsDirty(false);
    setLastSaved(new Date());
  }, [documentId, onContentChange]);

  // Schedule background save
  const scheduleBackgroundSave = useCallback(() => {
    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set dirty flag
    setIsDirty(true);

    // Schedule new save
    saveTimeoutRef.current = setTimeout(() => {
      performBackgroundSave();
    }, 2000); // 2 seconds delay for better UX
  }, [performBackgroundSave]);

  // Load initial content
  useEffect(() => {
    if (!documentId) return;

    // Reset initialization when documentId changes
    if (isInitialized && documentId !== previousDocumentIdRef.current) {
      setIsInitialized(false);
      previousDocumentIdRef.current = documentId;
    }

    if (!isInitialized) {
      const savedContent = localStorage.getItem(`note_content_${documentId}`);
      const contentToLoad = savedContent || initialContent || "";

      if (editorRef.current && contentToLoad) {
        editorRef.current.innerHTML = markdownToHtml(contentToLoad);
        contentRef.current = contentToLoad;
      }

      setIsInitialized(true);
      previousDocumentIdRef.current = documentId;
    }
  }, [documentId, initialContent, isInitialized]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        // Perform final save if there are unsaved changes
        if (isDirty) {
          performBackgroundSave();
        }
      }
    };
  }, [isDirty, performBackgroundSave]);

  // Handle input with non-interfering save
  const handleInput = useCallback(() => {
    if (!editorRef.current) return;

    // Update word count
    const text = editorRef.current.innerText || "";
    const words = text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);
    setWordCount(words.length);

    // Schedule background save
    scheduleBackgroundSave();

    // Update active formats
    updateActiveFormats();
  }, [scheduleBackgroundSave]);

  const updateActiveFormats = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const formats = new Set<string>();

    if (document.queryCommandState("bold")) formats.add("bold");
    if (document.queryCommandState("italic")) formats.add("italic");
    if (document.queryCommandState("underline")) formats.add("underline");
    if (document.queryCommandState("justifyLeft")) formats.add("left");
    if (document.queryCommandState("justifyCenter")) formats.add("center");
    if (document.queryCommandState("justifyRight")) formats.add("right");
    if (document.queryCommandState("justifyFull")) formats.add("justify");

    setActiveFormats(formats);
  };

  const execCommand = (command: string, value?: string) => {
    // Save cursor position before command
    const cursorPos = saveCursorPosition();

    document.execCommand(command, false, value);

    // Restore focus and cursor
    editorRef.current?.focus();
    restoreCursorPosition(cursorPos);

    handleInput();
  };

  const insertHeading = (level: number) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const selectedText = range.toString() || "Heading";

    const heading = document.createElement(`h${level}`);
    heading.textContent = selectedText;

    range.deleteContents();
    range.insertNode(heading);

    handleInput();
  };

  const insertLink = () => {
    const url = prompt("Enter URL:");
    if (url) {
      execCommand("createLink", url);
    }
  };

  const insertImage = () => {
    const url = prompt("Enter image URL:");
    if (url) {
      execCommand("insertImage", url);
    }
  };

  const insertTable = () => {
    const rows = prompt("Number of rows:", "3");
    const cols = prompt("Number of columns:", "3");

    if (rows && cols) {
      const table = document.createElement("table");
      table.className =
        "border-collapse border border-gray-300 dark:border-gray-600 my-4";

      for (let i = 0; i < parseInt(rows); i++) {
        const tr = document.createElement("tr");
        for (let j = 0; j < parseInt(cols); j++) {
          const td = document.createElement("td");
          td.className =
            "border border-gray-300 dark:border-gray-600 px-3 py-2";
          td.contentEditable = "true";
          td.textContent = `Cell ${i + 1}-${j + 1}`;
          tr.appendChild(td);
        }
        table.appendChild(tr);
      }

      if (editorRef.current) {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.insertNode(table);
        }
      }

      handleInput();
    }
  };

  const insertResource = (type: string, name: string) => {
    if (editorRef.current) {
      const tag = document.createElement("span");
      tag.className =
        "inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm mx-1";
      tag.contentEditable = "false";
      tag.textContent = `@${type}:${name}`;

      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.insertNode(tag);

        // Add a space after the tag
        const space = document.createTextNode(" ");
        range.collapse(false);
        range.insertNode(space);
      }

      handleInput();
    }
  };

  const exportDocument = () => {
    // Perform a save before export
    performBackgroundSave();

    const markdown =
      contentRef.current || htmlToMarkdown(editorRef.current?.innerHTML || "");
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `document_${documentId || Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importDocument = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (editorRef.current) {
        editorRef.current.innerHTML = markdownToHtml(text);
        contentRef.current = text;
      }
      scheduleBackgroundSave();
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Manual save with Ctrl+S
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      // Clear any pending saves
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // Perform immediate save
      performBackgroundSave();
    }
  };

  return (
    <div
      className={`flex flex-col h-full bg-white dark:bg-gray-900 ${isFullscreen ? "fixed inset-0 z-50" : ""}`}
    >
      {/* Toolbar */}
      <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        {/* Primary Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            {/* Text Style Dropdown */}
            <div className="relative">
              <button className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                Normal text
                <FiChevronDown className="w-3 h-3" />
              </button>
            </div>

            {/* Formatting Buttons */}
            <div className="flex items-center gap-1 border-l border-gray-300 dark:border-gray-600 pl-4">
              <button
                onClick={() => execCommand("bold")}
                className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${activeFormats.has("bold") ? "bg-gray-200 dark:bg-gray-700" : ""}`}
                title="Bold (Ctrl+B)"
              >
                <FiBold className="w-4 h-4" />
              </button>
              <button
                onClick={() => execCommand("italic")}
                className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${activeFormats.has("italic") ? "bg-gray-200 dark:bg-gray-700" : ""}`}
                title="Italic (Ctrl+I)"
              >
                <FiItalic className="w-4 h-4" />
              </button>
              <button
                onClick={() => execCommand("underline")}
                className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${activeFormats.has("underline") ? "bg-gray-200 dark:bg-gray-700" : ""}`}
                title="Underline (Ctrl+U)"
              >
                <FiUnderline className="w-4 h-4" />
              </button>
            </div>

            {/* Alignment */}
            <div className="flex items-center gap-1 border-l border-gray-300 dark:border-gray-600 pl-4">
              <button
                onClick={() => execCommand("justifyLeft")}
                className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                title="Align Left"
              >
                <FiAlignLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => execCommand("justifyCenter")}
                className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                title="Align Center"
              >
                <FiAlignCenter className="w-4 h-4" />
              </button>
              <button
                onClick={() => execCommand("justifyRight")}
                className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                title="Align Right"
              >
                <FiAlignRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => execCommand("justifyFull")}
                className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                title="Justify"
              >
                <FiAlignJustify className="w-4 h-4" />
              </button>
            </div>

            {/* Lists and Quotes */}
            <div className="flex items-center gap-1 border-l border-gray-300 dark:border-gray-600 pl-4">
              <button
                onClick={() => execCommand("insertUnorderedList")}
                className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                title="Bullet List"
              >
                <FiList className="w-4 h-4" />
              </button>
              <button
                onClick={() => execCommand("formatBlock", "blockquote")}
                className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                title="Quote"
              >
                <FiMessageSquare className="w-4 h-4" />
              </button>
            </div>

            {/* Insert Elements */}
            <div className="flex items-center gap-1 border-l border-gray-300 dark:border-gray-600 pl-4">
              <button
                onClick={insertLink}
                className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                title="Insert Link"
              >
                <FiLink className="w-4 h-4" />
              </button>
              <button
                onClick={insertImage}
                className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                title="Insert Image"
              >
                <FiImage className="w-4 h-4" />
              </button>
              <button
                onClick={insertTable}
                className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                title="Insert Table"
              >
                <FiTable className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowResourcePalette(!showResourcePalette)}
                className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                title="Insert Resource"
              >
                <FiHash className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={performBackgroundSave}
              className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
              title="Save Now (Ctrl+S)"
            >
              <FiSave className="w-4 h-4" />
            </button>
            <button
              onClick={exportDocument}
              className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
              title="Export"
            >
              <FiDownload className="w-4 h-4" />
            </button>
            <label className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer">
              <FiUpload className="w-4 h-4" />
              <input
                ref={fileInputRef}
                type="file"
                accept=".md,.txt"
                onChange={importDocument}
                className="hidden"
              />
            </label>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? (
                <FiMinimize2 className="w-4 h-4" />
              ) : (
                <FiMaximize2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between px-4 py-1 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-4">
            <span>{wordCount} words</span>
            {isDirty && (
              <span className="flex items-center gap-1 text-orange-500">
                <FiAlertCircle className="w-3 h-3" />
                Unsaved changes
              </span>
            )}
            {lastSaved && !isDirty && (
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <FiCheckCircle className="w-3 h-3" />
                Saved {lastSaved.toLocaleTimeString()}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500">
            Auto-saves every 2 seconds • Press Ctrl+S to save immediately
          </div>
        </div>
      </div>

      {/* Resource Palette */}
      {showResourcePalette && (
        <div className="absolute top-24 right-4 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-20 p-4">
          <h3 className="text-sm font-semibold mb-3">Insert Resource</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {project?.characters && project.characters.length > 0 && (
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                  Characters
                </div>
                <div className="space-y-1">
                  {project.characters.map((char: any) => (
                    <button
                      key={char.id}
                      onClick={() => {
                        insertResource("character", char.name);
                        setShowResourcePalette(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2"
                    >
                      <FiUser className="w-3 h-3 text-blue-500" />
                      {char.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {project?.locations && project.locations.length > 0 && (
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                  Locations
                </div>
                <div className="space-y-1">
                  {project.locations.map((loc: any) => (
                    <button
                      key={loc.id}
                      onClick={() => {
                        insertResource("location", loc.name);
                        setShowResourcePalette(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2"
                    >
                      <FiMapPin className="w-3 h-3 text-green-500" />
                      {loc.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {project?.events && project.events.length > 0 && (
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                  Events
                </div>
                <div className="space-y-1">
                  {project.events.map((event: any) => (
                    <button
                      key={event.id}
                      onClick={() => {
                        insertResource("event", event.name);
                        setShowResourcePalette(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2"
                    >
                      <FiCalendar className="w-3 h-3 text-purple-500" />
                      {event.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 py-8">
          <div
            ref={editorRef}
            contentEditable
            className="notes-editor min-h-[600px] prose prose-lg dark:prose-invert max-w-none focus:outline-none"
            style={{
              fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif',
              lineHeight: "1.8",
            }}
            onInput={handleInput}
            onKeyUp={updateActiveFormats}
            onMouseUp={updateActiveFormats}
            onKeyDown={handleKeyDown}
            suppressContentEditableWarning={true}
          >
            <p>Start writing your document...</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotesApp;
