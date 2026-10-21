import React, { useState, useRef, useEffect, useMemo } from "react";
import { validateProjectElement } from "../../utils/llmUtils";
import TimelinePreviewDisplay from "./TimelinePreviewDisplay";

interface LLMOutputDisplayProps {
  output: string;
  isLoading?: boolean;
  onUseJson?: (json: any) => void;
}

interface TextSection {
  type: "text";
  content: string;
}
interface JsonSection {
  type: "json";
  id: string;
}
type Section = TextSection | JsonSection;

export const LLMOutputDisplay: React.FC<LLMOutputDisplayProps> = ({
  output,
  isLoading = false,
  onUseJson,
}) => {
  const [copied, setCopied] = useState(false);
  const [previewJson, setPreviewJson] = useState<any | null>(null);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    type: string;
    errors: string[];
  } | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (copied) {
      timeoutId = setTimeout(() => setCopied(false), 2000);
    }
    return () => clearTimeout(timeoutId);
  }, [copied]);

  const handleCopyToClipboard = (text: string = output) => {
    if (text && navigator.clipboard) {
      navigator.clipboard
        .writeText(text)
        .then(() => setCopied(true))
        .catch((err) => console.error("Failed to copy text: ", err));
    }
  };

  if (isLoading) {
    return (
      <div className="mt-6 p-6 border border-gray-200 rounded-md bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p className="text-gray-600 dark:text-gray-400">
            Analyzing your project data...
          </p>
        </div>
      </div>
    );
  }

  if (!output) return null;

  const { jsonBlocks, sections } = useMemo(() => {
    console.log("=== EXTRACTING JSON BLOCKS ===");
    console.log("Raw output:", output);

    const jsonRegex = /```json\s*([\s\S]*?)\s*```/g;
    const matches: any[] = [];
    const sections: Section[] = [];

    let lastIndex = 0;
    let match;

    while ((match = jsonRegex.exec(output)) !== null) {
      console.log("Found JSON match:", match[0]);
      console.log("JSON content:", match[1].trim());

      if (match.index > lastIndex) {
        sections.push({
          type: "text",
          content: output.substring(lastIndex, match.index),
        });
      }

      try {
        const jsonContent = match[1].trim();
        const parsedJson = JSON.parse(jsonContent);
        console.log("Parsed JSON:", parsedJson);

        const matchId: string = `json-${matches.length}`;

        const validationResultData = validateProjectElement(parsedJson); // Renamed to avoid conflict
        console.log("Validation result:", validationResultData);

        matches.push({
          id: matchId,
          raw: jsonContent,
          parsed: parsedJson,
          validation: validationResultData,
        });

        sections.push({
          type: "json",
          id: matchId,
        });
      } catch (e) {
        console.error("Failed to parse JSON:", e);
        console.error("Raw JSON content:", match[1].trim());
        sections.push({
          type: "text",
          content: match[0],
        });
      }

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < output.length) {
      sections.push({
        type: "text",
        content: output.substring(lastIndex),
      });
    }

    console.log("Final matches:", matches);
    console.log("Final sections:", sections);
    console.log("=== END EXTRACTION ===");

    return { jsonBlocks: matches, sections };
  }, [output]);

  const formatTextContent = (text: string) => {
    const withHeaders = text.replace(
      /^(#{1,6})\s+(.+)$/gm,
      (_, hashes, content) => {
        const level = hashes.length;
        return `<h${level} class="text-${
          level === 1 ? "xl" : level === 2 ? "lg" : "md"
        } font-bold my-2">${content}</h${level}>`;
      },
    );
    const withBold = withHeaders.replace(
      /\*\*(.*?)\*\*/g,
      "<strong>$1</strong>",
    );
    const withItalic = withBold.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    const withLists = withItalic.replace(
      /^[-*]\s+(.+)$/gm,
      '<li class="ml-4">$1</li>',
    );
    return withLists
      .split("\n\n")
      .map((paragraph) =>
        paragraph.startsWith("<li")
          ? `<ul class="list-disc ml-4 my-2">${paragraph}</ul>`
          : paragraph.startsWith("<h")
            ? paragraph
            : `<p class="my-2">${paragraph.replace(/\n/g, "<br/>")}</p>`,
      )
      .join("");
  };

  const handlePreviewJson = (jsonBlock: any) => {
    console.log("Previewing JSON block:", jsonBlock);
    setPreviewJson(jsonBlock.parsed);
    setValidationResult(jsonBlock.validation); // Use the component's state setter
  };

  const handleUseJson = (jsonBlock: any) => {
    console.log("Using JSON in project:", jsonBlock);
    if (onUseJson) {
      onUseJson(jsonBlock.parsed);
    }
  };

  return (
    <div className="mt-6">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-medium text-gray-800 dark:text-white">
          Analysis Result
        </h3>
        <div className="flex space-x-2">
          {jsonBlocks.length > 0 && (
            <button
              onClick={() => console.log("JSON blocks:", jsonBlocks)}
              className="text-xs px-2 py-1 rounded bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-800 dark:hover:bg-yellow-700 text-yellow-800 dark:text-yellow-200"
              title="Log JSON blocks to console"
            >
              Debug ({jsonBlocks.length} JSON)
            </button>
          )}
          <button
            onClick={() => handleCopyToClipboard()}
            className="flex items-center text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors"
            aria-label="Copy to clipboard"
          >
            {copied ? (
              <>
                <svg
                  className="w-4 h-4 mr-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4 mr-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002 2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                  />
                </svg>
                Copy
              </>
            )}
          </button>
        </div>
      </div>
      <div
        ref={outputRef}
        className="p-4 border border-gray-200 rounded-md bg-white dark:bg-gray-800 dark:border-gray-700 overflow-auto shadow-sm"
      >
        <div className="prose dark:prose-invert max-w-none text-gray-800 dark:text-gray-200 text-sm">
          {sections.map((section, index) => {
            if (section.type === "text") {
              return (
                <div
                  key={`text-${index}`}
                  dangerouslySetInnerHTML={{
                    __html: formatTextContent(section.content || ""),
                  }}
                />
              );
            } else if (section.type === "json") {
              const jsonBlock = jsonBlocks.find(
                (block) => block.id === section.id,
              );
              if (!jsonBlock) {
                console.warn("JSON block not found for section:", section);
                return null;
              }
              const validationInfo = jsonBlock.validation;
              const jsonType = validationInfo?.type || "unknown";
              const isValid = validationInfo?.valid || false;
              const validationErrors = validationInfo?.errors || [];
              let typeLabel = "Content";
              switch (jsonType) {
                case "timeline":
                case "timeline_array":
                  typeLabel = "Timeline";
                  break;
                case "character":
                case "character_array":
                  typeLabel = "Character";
                  break;
                case "event":
                case "event_array":
                  typeLabel = "Event";
                  break;
                case "project":
                  typeLabel = "Project";
                  break;
                case "location":
                case "location_array":
                  typeLabel = "Location";
                  break;
                case "technology":
                case "technology_array":
                  typeLabel = "Technology";
                  break;
                case "culture":
                case "culture_array":
                  typeLabel = "Culture";
                  break;
                case "narrative":
                case "narrative_array":
                  typeLabel = "Narrative";
                  break;
              }
              return (
                <div
                  key={`json-${index}`}
                  className="my-4 border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden"
                >
                  <div className="bg-gray-100 dark:bg-gray-700 p-2 flex justify-between items-center">
                    <span className="font-medium text-gray-700 dark:text-gray-300 flex items-center">
                      {typeLabel} ({jsonType})
                      {isValid ? (
                        <span className="ml-2 text-xs px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100 rounded-full">
                          Valid
                        </span>
                      ) : (
                        <span className="ml-2 text-xs px-2 py-0.5 bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100 rounded-full">
                          Invalid
                        </span>
                      )}
                    </span>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handlePreviewJson(jsonBlock)}
                        className="px-2 py-1 text-xs bg-purple-500 hover:bg-purple-600 text-white rounded transition-colors"
                        disabled={!isValid}
                      >
                        Preview
                      </button>
                      {onUseJson && (
                        <button
                          onClick={() => handleUseJson(jsonBlock)}
                          className={`px-2 py-1 text-xs ${isValid ? "bg-green-500 hover:bg-green-600" : "bg-gray-400 cursor-not-allowed"} text-white rounded transition-colors`}
                          disabled={!isValid}
                        >
                          Use in Project
                        </button>
                      )}
                    </div>
                  </div>
                  {!isValid && validationErrors.length > 0 && (
                    <div className="p-2 bg-red-50 dark:bg-red-900 border-b border-red-200 dark:border-red-700">
                      <h4 className="font-medium text-red-800 dark:text-red-200 text-sm mb-1">
                        Validation Errors:
                      </h4>
                      <ul className="list-disc pl-5 text-xs text-red-700 dark:text-red-300">
                        {/* --- FIX: Added types (string, number) --- */}
                        {validationErrors.map((error: string, idx: number) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="p-3 bg-gray-50 dark:bg-gray-800">
                    <details>
                      <summary className="cursor-pointer text-gray-500 dark:text-gray-400 text-sm">
                        {isValid
                          ? "Content ready for preview"
                          : "Invalid content format"}{" "}
                        (Click to see raw JSON)
                      </summary>
                      <pre className="mt-2 text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded overflow-x-auto">
                        {jsonBlock.raw}
                      </pre>
                    </details>
                  </div>
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>
      {previewJson && (
        <div className="mt-6">
          <TimelinePreviewDisplay
            jsonData={previewJson}
            onUseInProject={() => {
              if (onUseJson) {
                onUseJson(previewJson);
              }
            }}
          />
        </div>
      )}
      {/* --- FIX: Added 'validationResult &&' to prevent accessing errors when null --- */}
      {validationResult && !validationResult.valid && (
        <div className="mt-4 p-4 border border-red-300 rounded-md bg-red-50 dark:bg-red-900 dark:border-red-700">
          <h4 className="font-medium text-red-700 dark:text-red-300 mb-2">
            JSON Validation Issues
          </h4>
          <p className="text-sm text-red-600 dark:text-red-400 mb-2">
            The generated content has the following issues that need to be fixed
            before it can be used in your project:
          </p>
          <ul className="list-disc pl-5 text-sm text-red-600 dark:text-red-400">
            {/* --- FIX: Added types (string, number) --- */}
            {validationResult.errors.map((error: string, idx: number) => (
              <li key={idx} className="mb-1">
                {error}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-red-700 dark:text-red-300">
            Try asking the AI to regenerate the data with the correct format.
          </p>
        </div>
      )}
    </div>
  );
};
