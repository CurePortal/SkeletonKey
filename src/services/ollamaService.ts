// src/services/ollamaService.ts
import { ProjectType } from "../types";
import { bridgeUrl } from "./mapIntelligenceService";

const OLLAMA_API_BASE_URL = "http://localhost:11434/api";

// Check if Ollama is running. Direct first; then ask the local bridge, which is
// not subject to Ollama's browser CORS rules.
export const checkOllamaStatus = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${OLLAMA_API_BASE_URL}/tags`, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (response.ok) return true;
  } catch (error) {
    console.warn("Ollama status check failed:", error);
  }
  try {
    const response = await fetch(`${bridgeUrl()}/health`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return false;
    const data = await response.json();
    return Boolean(data?.ollama);
  } catch {
    return false;
  }
};

// Get available models. The bridge merges local pulls with the models in
// ~/.ollama/config.json, including cloud models that /api/tags omits.
export const getAvailableModels = async (): Promise<string[]> => {
  try {
    const response = await fetch(
      `${bridgeUrl()}/ollama/models?base=${encodeURIComponent("http://127.0.0.1:11434")}`,
      { signal: AbortSignal.timeout(15_000) },
    );
    if (response.ok) {
      const result = await response.json();
      const names: string[] = (result?.models || [])
        .map((model: any) => (typeof model === "string" ? model : model?.name))
        .filter((name: unknown): name is string => typeof name === "string");
      if (names.length) return [...new Set(names)].sort();
    }
  } catch {
    // Fall through to the direct endpoint.
  }
  const response = await fetch(`${OLLAMA_API_BASE_URL}/tags`);
  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.statusText}`);
  }
  const result = await response.json();
  return result?.models?.map((model: any) => model.name) || [];
};

// System prompts for different contexts
export const SYSTEM_PROMPTS = {
  analysis: `You are SkeletonKey AI, an assistant for analyzing project data.

CRITICAL RULES:
1. Provide detailed textual analysis based on the user's question
2. Base answers STRICTLY on provided project data
3. Do NOT generate JSON or suggest modifications
4. If data is insufficient, explain what's missing
5. Be conversational and helpful`,

  generation: `You are SkeletonKey AI, an assistant for generating project content.

CRITICAL RULES FOR JSON GENERATION:
1. ONLY generate the EXACT type requested (single object or array)
2. Use COMPLETE field structures as shown below
3. Wrap JSON in \`\`\`json code blocks
4. Include explanatory text with the JSON
5. Never generate project wrappers or unrelated types

# COMPLETE JSON STRUCTURES

## Timeline
\`\`\`json
{
  "name": "Timeline Name",
  "description": "Timeline description",
  "color": "#4287f5",
  "events": []
}
\`\`\`

## Event (requires timelineId separately)
\`\`\`json
{
  "title": "Event Title",
  "date": "YYYY-MM-DD",
  "description": "Event description",
  "importance": 5,
  "tags": []
}
\`\`\`

## Character (COMPLETE)
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

## Location (COMPLETE)
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
  "linkedEventIds": [],
  "mapUrl": null
}
\`\`\`

## Technology (COMPLETE)
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
  "linkedEventIds": [],
  "notes": ""
}
\`\`\`

## Culture (COMPLETE)
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
## Narrative
\`\`\`json
{
  "title": "Narrative Title",
  "description": "Narrative description",
  "narrativeType": "linear",
  "tags": [],
  "timelineId": null,
  "characterIds": [],
  "scenes": [
    {
      "title": "Scene Title",
      "content": "Full scene content description",
      "order": 0,
      "characterIds": [],
      "locationIds": [],
      "eventIds": []
    }
  ]
}
\`\`\`

IMPORTANT:
- Use null for optional date fields when not applicable
- Use empty arrays [] for list fields with no items
- Use empty strings "" for optional text fields
- Numbers like importance/impact default to 5 (scale 1-10)
- For multiple items, return an array of objects`,
};

// Format project data for the LLM
export function formatProjectDataForLLM(projectData: ProjectType | null): string {
  if (!projectData) {
    return "PROJECT DATA:\nNo project currently loaded.";
  }

  let output = "PROJECT DATA:\n\n";
  output += `Project: ${projectData.name || "Untitled"}\n`;
  output += `Description: ${projectData.description || "None"}\n\n`;

  // Timelines with events
  if (projectData.timelines?.length > 0) {
    output += "=== TIMELINES ===\n";
    projectData.timelines.forEach((timeline, idx) => {
      output += `\n${idx + 1}. ${timeline.name} (ID: ${timeline.id})\n`;
      output += `   Description: ${timeline.description || "None"}\n`;
      if (timeline.events?.length > 0) {
        output += `   Events (${timeline.events.length}):\n`;
        timeline.events.slice(0, 5).forEach((event) => {
          output += `   - ${event.date}: ${event.title}\n`;
        });
        if (timeline.events.length > 5) {
          output += `   ... and ${timeline.events.length - 5} more\n`;
        }
      }
    });
  } else {
    output += "=== TIMELINES ===\nNo timelines in project.\n";
  }

  // Characters
  output += "\n=== CHARACTERS ===\n";
  if (projectData.characters?.length > 0) {
    projectData.characters.forEach((char, idx) => {
      output += `${idx + 1}. ${char.name}: ${char.description || "No description"}\n`;
    });
  } else {
    output += "No characters in project.\n";
  }

  // Locations
  output += "\n=== LOCATIONS ===\n";
  if (projectData.locations?.length > 0) {
    projectData.locations.forEach((loc, idx) => {
      output += `${idx + 1}. ${loc.name} (${loc.type}): ${loc.description || "No description"}\n`;
    });
  } else {
    output += "No locations in project.\n";
  }

  // Technologies
  if (projectData.technologies?.length > 0) {
    output += "\n=== TECHNOLOGIES ===\n";
    projectData.technologies.forEach((tech, idx) => {
      output += `${idx + 1}. ${tech.name}: ${tech.description || "No description"}\n`;
    });
  }

  // Cultures
  if (projectData.cultures?.length > 0) {
    output += "\n=== CULTURES ===\n";
    projectData.cultures.forEach((culture, idx) => {
      output += `${idx + 1}. ${culture.name}: ${culture.description || "No description"}\n`;
    });
  }

  return output;
}

// Main analysis function
export const analyzeDataWithOllama = async (
  projectData: ProjectType | null,
  userPrompt: string,
  contextType: "analysis" | "general" = "general",
): Promise<string> => {
  try {
    const llmModel = localStorage.getItem("llm-model") || "gemma2:27b";
    const contextWindowSize = parseInt(
      localStorage.getItem("ollama-context-size") || "32768",
      10,
    );

    // Select appropriate system prompt
    const systemPrompt =
      contextType === "analysis"
        ? SYSTEM_PROMPTS.analysis
        : SYSTEM_PROMPTS.generation;

    // Format project data
    const projectContext = formatProjectDataForLLM(projectData);

    // Build complete prompt
    const completePrompt = `${systemPrompt}

${projectContext}

USER REQUEST: ${userPrompt}

RESPONSE:`;

    console.log("Ollama request:", {
      model: llmModel,
      contextType,
      promptLength: completePrompt.length,
      contextWindow: contextWindowSize,
    });

    // Make request to Ollama
    const response = await fetch(`${OLLAMA_API_BASE_URL}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: llmModel,
        prompt: completePrompt,
        options: {
          num_ctx: contextWindowSize,
          temperature: 0.7,
          top_p: 0.9,
        },
        stream: false,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Ollama error: ${error?.error || response.statusText}`);
    }

    const result = await response.json();

    if (!result?.response) {
      throw new Error("Invalid response from Ollama");
    }

    return result.response.trim();
  } catch (error) {
    console.error("Ollama service error:", error);
    throw error;
  }
};
