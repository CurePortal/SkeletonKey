import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  FormEvent,
  RefObject,
  DetailedHTMLProps,
  HTMLAttributes,
  DragEvent, // ✅ Added DragEvent for drop handlers
} from "react";

const TAG_REGEX =
  /\[(Character|Location|Event|Technology|Culture|Source): "([^"]*)" ID: "([^"]+)"\]/g;

const textToHtml = (text: string): string => {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(TAG_REGEX, (_match, type, name, id) => {
      console.log("[textToHtml] Converting tag:", { type, name, id });
      return `<span
        contentEditable="false"
        class="resource-tag bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-0.5 rounded-full text-sm inline-block mx-0.5 cursor-default"
        data-type="${type}"
        data-id="${id}"
        data-name="${name}"
      >${name}</span>`;
    })
    .replace(/\n/g, "<br>");
};

const htmlToText = (html: string): string => {
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html.replace(/<br\s*\/?>/gi, "\n");

  tempDiv.querySelectorAll(".resource-tag").forEach((span) => {
    const s = span as HTMLElement;
    const type = s.dataset.type || "Unknown";
    const name = s.dataset.name || "Unknown";
    const id = s.dataset.id || "Unknown";
    span.replaceWith(`[${type}: "${name}" ID: "${id}"]`);
  });

  let text = tempDiv.textContent || "";
  text = text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
  return text;
};

interface ContentEditableWithTagsProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export interface ContentEditableRef {
  focus: () => void;
  insertHtml: (html: string) => void;
  getElement: () => HTMLDivElement | null;
}

interface CustomDivProps
  extends DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> {
  "data-placeholder"?: string;
}

const ContentEditableWithTags = React.forwardRef<
  ContentEditableRef,
  ContentEditableWithTagsProps
>(({ value, onChange, className, placeholder }, ref) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastValueRef = useRef<string>(value);

  useEffect(() => {
    if (editorRef.current && value !== lastValueRef.current) {
      const selection = window.getSelection();
      const range =
        selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      const startContainer = range?.startContainer;

      editorRef.current.innerHTML = textToHtml(value);
      lastValueRef.current = value;

      try {
        if (
          range &&
          startContainer &&
          editorRef.current.contains(startContainer)
        ) {
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      } catch (e) {
        console.warn("Could not restore selection:", e);
      }
    }
  }, [value]);

  const handleInput = (e: FormEvent<HTMLDivElement>) => {
    const currentHtml = (e.target as HTMLDivElement).innerHTML;
    const newTextValue = htmlToText(currentHtml);
    if (newTextValue !== lastValueRef.current) {
      lastValueRef.current = newTextValue;
      onChange(newTextValue);
    }
  };

  const insertHtmlLogic = (htmlToInsert: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    range.deleteContents();

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlToInsert;
    const frag = document.createDocumentFragment();
    let node, lastNode;
    while ((node = tempDiv.firstChild)) {
      lastNode = frag.appendChild(node);
    }
    range.insertNode(frag);

    if (lastNode) {
      range.setStartAfter(lastNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    const event = new Event("input", { bubbles: true, cancelable: true });
    editorRef.current.dispatchEvent(event);
  };

  useImperativeHandle(ref, () => ({
    focus: () => {
      editorRef.current?.focus();
    },
    getElement: () => editorRef.current,
    insertHtml: insertHtmlLogic,
  }));

  // ✅ FIX: Added onDrop and onDragOver handlers for the editor
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    console.log("[ContentEditableWithTags] Drop event triggered");

    const name = e.dataTransfer.getData("application/reactflow-name");
    const id = e.dataTransfer.getData("application/reactflow-id");
    const type = e.dataTransfer.getData("application/reactflow-type");

    console.log("[ContentEditableWithTags] Drop data:", { name, id, type });

    if (!name || !id || !type) {
      console.warn("[ContentEditableWithTags] Missing required drop data");
      return;
    }

    // Create HTML with all necessary data attributes - FIXED VERSION
    const html = `<span
      contentEditable="false"
      class="resource-tag bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-0.5 rounded-full text-sm inline-block mx-0.5 cursor-default"
      data-id="${id}"
      data-type="${type}"
      data-name="${name}"
    >${name}</span>&nbsp;`;

    console.log("[ContentEditableWithTags] Inserting HTML:", html);
    insertHtmlLogic(html);
  };

  const divProps: CustomDivProps = {
    ref: editorRef as RefObject<HTMLDivElement>,
    contentEditable: true,
    className: className,
    onInput: handleInput,
    suppressContentEditableWarning: true,
    style: {
      minHeight: "10em",
      outline: "none",
      whiteSpace: "pre-wrap",
      wordWrap: "break-word",
    },
    "data-placeholder": placeholder,
  };

  // ✅ FIX: Added the handlers to the returned div
  return <div {...divProps} onDrop={handleDrop} onDragOver={handleDragOver} />;
});

export default ContentEditableWithTags;
