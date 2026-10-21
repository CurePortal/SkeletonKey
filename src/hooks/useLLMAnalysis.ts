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

  const reset = useCallback(() => {
    setResponse(null);
    setLoading(false);
    setError(null);
  }, []);

  return { response, loading, error, analyzeData, reset, model: getModel() };
};
