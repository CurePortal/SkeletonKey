// Provider-agnostic AI analysis. Local Ollama or a cloud provider with the
// user's own key. No account, no Pro tier.
import { useCallback, useState } from "react";
import {
  LLM_PROVIDERS,
  callConfiguredAI,
  getModel,
  getProvider,
} from "../services/llmProviders";
import {
  SYSTEM_PROMPTS,
  formatProjectDataForLLM,
} from "../services/ollamaService";
import type { HqProjectAction } from "../services/hqBridgeService";

export interface AssistantPlan {
  reply: string;
  actions: HqProjectAction[];
}

const ACTION_PROMPT = `You are HQ, the operator for this SkeletonKey record. Decide whether the user is asking for information or asking you to change the project.

Return ONLY a JSON object, with no markdown fences, in this shape:
{"reply":"one or two plain sentences for the operative","actions":[]}

Project actions you may request (each action is applied to the MCP project store):
- task.upsert: {title, id?, status?: "todo"|"doing"|"blocked"|"done", section?, due?, dueEnd?, linkedEntityIds?, documentIds?}
- asset.upsert: {name, id?, category?, quantity?, condition?, status?: "owned"|"loaned"|"stored"|"sold"|"lost", location?, serialNumber?, value?, acquiredDate?, notes?, tags?}
- finance.source.upsert: {name, id?, kind?: "beancount"|"stripe"|"crypto"|"bank"|"manual"|"other", status?: "active"|"paused"|"error", ledgerAccount?, envVar?, reference?, chain?, notes?, tags?}
- profile.update: {name?, callsign?, pronouns?, timezone?, homeBase?, languages?, communicationStyle?, accessibilityNeeds?, healthNotes?, constraints?, skills?, resources?, routines?, currentObjectives?, importantPeople?, dislikes?, notes?, tags?}
- report.upsert: {title, id?, reportType?: "linear"|"flow"|"note", description?, content?, scenes?, nodes?, edges?, tags?}
- kb.type.upsert: {id?, name, namePlural?, icon?, description?, color?}
- kb.entity.upsert: {entityType, name, description?, tags?, fields?}
- event.add: {title, date?, description?, timeline?, tags?}
- character.upsert: {name, description?, notes?, tags?}
- location.upsert: {name, lat, lon, type?, description?, tags?}

Rules:
- Only include actions when the user explicitly asks to add, change, rename, complete, or save something.
- Questions, briefs, lookups, and recommendations must return an empty actions array.
- Use exact existing names and ids from the record. Never invent coordinates, dates, people, or ids.
- For a note, use report.upsert with reportType "note" and put the text in content.
- For a flow chart, use report.upsert with reportType "flow"; only supply nodes/edges if the user specified them.
- Do not add a timeline event for a completed task yourself; task.upsert handles that.
- Keep "reply" short and operational.`;


export interface LLMAnalysisError extends Error {
  isOperational?: boolean;
  details?: string;
}

export const useLLMAnalysis = () => {
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<LLMAnalysisError | null>(null);

  const analyzeData = useCallback(
    async (
      projectData: any,
      userPrompt: string,
      contextType: "analysis" | "general" = "general",
    ) => {
      setLoading(true);
      setError(null);
      setResponse(null);
      const provider = getProvider();
      try {
        const systemPrompt =
          contextType === "analysis"
            ? SYSTEM_PROMPTS.analysis
            : SYSTEM_PROMPTS.generation;
        const projectContext = formatProjectDataForLLM(projectData);
        const reply = await callConfiguredAI(
          `${systemPrompt}\n\n${projectContext}`,
          `USER REQUEST: ${userPrompt}\n\nRESPONSE:`,
          { temperature: 0.7 },
        );
        setResponse(reply);
      } catch (e: any) {
        setError({
          name: e.name || "LLMAnalysisError",
          message: `${LLM_PROVIDERS[provider].short} request failed: ${e.message}`,
          isOperational: true,
          details: e.details || (e.cause ? String(e.cause) : undefined),
        });
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const proposeActions = useCallback(
    async (
      projectData: any,
      userPrompt: string,
    ): Promise<AssistantPlan> => {
      const projectContext = formatProjectDataForLLM(projectData);
      const reply = await callConfiguredAI(
        `${ACTION_PROMPT}\n\n${projectContext}`,
        `USER REQUEST: ${userPrompt}\n\nJSON RESPONSE:`,
        { temperature: 0.2 },
      );
      const raw = String(reply || "").trim();
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start < 0 || end <= start) {
        return { reply: raw, actions: [] };
      }
      try {
        const parsed = JSON.parse(raw.slice(start, end + 1));
        const actions = Array.isArray(parsed?.actions)
          ? parsed.actions
              .filter(
                (action: any) =>
                  action && typeof action.kind === "string" && action.kind,
              )
              .map((action: any) => ({
                kind: String(action.kind),
                args:
                  action.args && typeof action.args === "object"
                    ? action.args
                    : {},
              }))
          : [];
        return {
          reply: String(parsed?.reply || "").trim() || raw,
          actions,
        };
      } catch {
        return { reply: raw, actions: [] };
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setResponse(null);
    setLoading(false);
    setError(null);
  }, []);

  return {
    response,
    loading,
    error,
    analyzeData,
    proposeActions,
    reset,
    model: getModel(),
  };
};
