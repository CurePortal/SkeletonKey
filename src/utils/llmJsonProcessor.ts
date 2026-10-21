import {
  extractJsonFromLLMOutput,
  validateProjectElement,
  normalizeTimeline,
  normalizeCharacter,
} from "./llmUtils";

export interface LLMJsonProcessingResult {
  success: boolean;
  message: string;
  details?: string;
  processedData?: {
    type: string;
    timelines?: any[];
    characters?: any[];
    events?: any[];
    data?: any;
  };
  validationResults?: {
    valid: boolean;
    type: string;
    errors: string[];
  };
}

export const processLLMJsonOutput = (
  rawOutput: string,
): LLMJsonProcessingResult => {
  try {
    const jsonBlocks = extractJsonFromLLMOutput(rawOutput);

    if (jsonBlocks.length === 0) {
      return {
        success: false,
        message: "No valid JSON found in the LLM output",
        details:
          "The AI response doesn't contain any valid JSON blocks to process.",
      };
    }

    const validBlocks = jsonBlocks.map((block) => {
      const validationResult = validateProjectElement(block);
      return {
        data: block,
        validation: validationResult,
      };
    });

    const firstValidBlock = validBlocks.find((block) => block.validation.valid);

    if (!firstValidBlock) {
      return {
        success: false,
        message: "Invalid JSON format in LLM output",
        details:
          validBlocks[0]?.validation.errors.join(", ") ||
          "Unknown validation error",
        validationResults: validBlocks[0]?.validation,
      };
    }

    let processedDataOutput: LLMJsonProcessingResult["processedData"];
    const validationType = firstValidBlock.validation.type;
    const jsonData = firstValidBlock.data;

    switch (validationType) {
      case "project":
        processedDataOutput = {
          type: "project",
          timelines: jsonData.timelines
            ? jsonData.timelines.map(normalizeTimeline)
            : [],
          characters: jsonData.characters
            ? jsonData.characters.map(normalizeCharacter)
            : [],
        };
        break;

      case "timeline":
        processedDataOutput = {
          type: "timeline",
          timelines: [normalizeTimeline(jsonData)],
        };
        break;

      case "timeline_array":
        processedDataOutput = {
          type: "timeline",
          timelines: (jsonData as any[]).map(normalizeTimeline),
        };
        break;

      case "character":
        processedDataOutput = {
          type: "character",
          characters: [normalizeCharacter(jsonData)],
        };
        break;

      case "character_array":
        processedDataOutput = {
          type: "character",
          characters: (jsonData as any[]).map(normalizeCharacter),
        };
        break;

      case "event":
        processedDataOutput = {
          type: "event",
          events: [jsonData],
        };
        break;

      case "event_array":
        processedDataOutput = {
          type: "event",
          events: jsonData as any[],
        };
        break;

      default:
        console.warn(
          `processLLMJsonOutput: Unhandled SKELETON_KEY_VALID validation type: ${validationType}`,
        );
        processedDataOutput = {
          type: "unknown",
          data: jsonData,
        };
    }

    return {
      success: true,
      message: `Successfully processed ${processedDataOutput.type} data`,
      processedData: processedDataOutput,
      validationResults: firstValidBlock.validation,
    };
  } catch (error) {
    console.error("Error processing LLM JSON output:", error);
    return {
      success: false,
      message: "Error processing LLM output",
      details:
        error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
};

export const createUserFriendlyMessage = (
  result: LLMJsonProcessingResult,
): string => {
  if (!result.success || !result.processedData) {
    return result.message || "Processing failed or no data processed.";
  }

  const data = result.processedData;

  switch (data.type) {
    case "project":
      return `Project with ${data.timelines?.length || 0} timelines and ${data.characters?.length || 0} characters`;

    case "timeline":
      if (data.timelines?.length === 1) {
        const timeline = data.timelines[0];
        return `Timeline "${timeline.name}" with ${timeline.events?.length || 0} events`;
      } else {
        return `${data.timelines?.length || 0} timelines`;
      }

    case "event":
      if (data.events?.length === 1) {
        return `Event "${data.events[0].title}"`;
      }
      return `${data.events?.length || 0} events`;

    case "character":
      if (data.characters?.length === 1) {
        return `Character "${data.characters[0].name}"`;
      }
      return `${data.characters?.length || 0} characters`;

    case "unknown":
      return "Processed data of an unknown type.";

    default:
      return `Successfully processed ${data.type || "data"}.`;
  }
};
