// Provider-agnostic model discovery and calls. Keys are kept in sessionStorage
// only, so they disappear when the app/tab closes. Cloud models are optional and
// use the user's own key; there is no SkeletonKey account or Pro tier.

import { bridgeUrl } from "./mapIntelligenceService";

export type LlmProvider =
  | "ollama"
  | "ollama-cloud"
  | "anthropic"
  | "openai"
  | "gemini"
  | "deepseek";

export interface ProviderInfo {
  id: LlmProvider;
  label: string;
  short: string;
  keyRequired: boolean;
  help: string;
}

export const LLM_PROVIDERS: Record<LlmProvider, ProviderInfo> = {
  ollama: {
    id: "ollama",
    label: "Ollama (local)",
    short: "Ollama",
    keyRequired: false,
    help: "Runs on this computer. No key.",
  },
  "ollama-cloud": {
    id: "ollama-cloud",
    label: "Ollama Cloud (local relay)",
    short: "Ollama Cloud",
    keyRequired: false,
    help: "Uses the local Ollama Cloud / fallback relay. No key.",
  },
  anthropic: {
    id: "anthropic",
    label: "Claude (Anthropic)",
    short: "Claude",
    keyRequired: true,
    help: "Uses your Anthropic API key. Session only.",
  },
  openai: {
    id: "openai",
    label: "ChatGPT (OpenAI)",
    short: "ChatGPT",
    keyRequired: true,
    help: "Uses your OpenAI API key. Session only.",
  },
  gemini: {
    id: "gemini",
    label: "Gemini (Google)",
    short: "Gemini",
    keyRequired: true,
    help: "Uses your Google AI key. Session only.",
  },
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    short: "DeepSeek",
    keyRequired: true,
    help: "Uses your DeepSeek API key. Session only.",
  },
};

export function getProvider(): LlmProvider {
  const value = localStorage.getItem("llm-provider") || "ollama";
  return value in LLM_PROVIDERS ? (value as LlmProvider) : "ollama";
}

export function getModel(): string {
  return localStorage.getItem("llm-model") || "";
}

export function getProviderKey(provider: LlmProvider): string {
  try {
    return sessionStorage.getItem(`sk-ai-key:${provider}`) || "";
  } catch {
    return "";
  }
}

export function setProviderKey(provider: LlmProvider, key: string): void {
  try {
    if (key.trim()) sessionStorage.setItem(`sk-ai-key:${provider}`, key.trim());
    else sessionStorage.removeItem(`sk-ai-key:${provider}`);
  } catch {
    // Ignore storage failures.
  }
}

export function setSelection(provider: LlmProvider, model: string): void {
  localStorage.setItem("llm-provider", provider);
  localStorage.setItem("llm-model", model);
}

function safeBase(url: string): string {
  const value = (url || "http://127.0.0.1:11434").trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(value) ? value : `http://${value}`;
}

const OLLAMA_BASE = "http://127.0.0.1:11434";

// Ollama only allows browser calls when OLLAMA_ORIGINS is configured. The local
// bridge is a Node process, so use it first and fall back to a direct call.
function ollamaProxy(path: string): string {
  return `${bridgeUrl()}/ollama${path}?base=${encodeURIComponent(OLLAMA_BASE)}`;
}

async function listOllamaModels(): Promise<string[]> {
  try {
    const data = await fetchJson(ollamaProxy("/models"), {}, 15_000);
    const rows: any[] = Array.isArray(data.models) ? data.models : [];
    const names: string[] = rows
      .map((row: any) => (typeof row === "string" ? row : row?.name))
      .filter((name: unknown): name is string => typeof name === "string")
      .map((name: string) => name.trim())
      .filter((name: string) => name.length > 0);
    if (names.length) return [...new Set(names)].sort();
  } catch {
    // Fall through to the direct endpoint.
  }
  const data = await fetchJson(`${OLLAMA_BASE}/api/tags`);
  return (data.models || [])
    .map((row: any) => row.name || row.model || "")
    .filter(Boolean)
    .sort();
}

async function ollamaChat(init: RequestInit, timeout: number): Promise<any> {
  try {
    return await fetchJson(ollamaProxy("/api/chat"), init, timeout);
  } catch (proxyError) {
    try {
      return await fetchJson(`${OLLAMA_BASE}/api/chat`, init, timeout);
    } catch {
      throw proxyError;
    }
  }
}

function headers(provider: LlmProvider, key: string): Record<string, string> {
  if (provider === "anthropic") {
    return {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    };
  }
  if (provider === "openai" || provider === "deepseek") {
    return { Authorization: `Bearer ${key}` };
  }
  return {};
}

async function fetchJson(url: string, init: RequestInit = {}, timeout = 30000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    });
    const text = await response.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    if (!response.ok) {
      const message =
        data?.error?.message ||
        data?.error ||
        data?.message ||
        text.slice(0, 300) ||
        `HTTP ${response.status}`;
      throw new Error(String(message));
    }
    return data;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("The model provider took too long to answer.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function listProviderModels(
  provider: LlmProvider,
  key: string,
): Promise<string[]> {
  if (provider === "ollama") {
    return listOllamaModels();
  }
  if (provider === "ollama-cloud") {
    const data = await fetchJson("http://127.0.0.1:8790/v1/models");
    return (data.data || [])
      .map((row: any) => row.id || "")
      .filter(Boolean)
      .sort();
  }
  if (!key) throw new Error("Add a key to load this provider's models.");
  if (provider === "openai") {
    const data = await fetchJson("https://api.openai.com/v1/models", {
      headers: headers(provider, key),
    });
    return (data.data || [])
      .map((row: any) => row.id || "")
      .filter((name: string) => /gpt|o1|o3|o4|chatgpt/i.test(name))
      .sort();
  }
  if (provider === "anthropic") {
    const data = await fetchJson("https://api.anthropic.com/v1/models", {
      headers: headers(provider, key),
    });
    return (data.data || []).map((row: any) => row.id || "").filter(Boolean).sort();
  }
  if (provider === "gemini") {
    const data = await fetchJson(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
    );
    return (data.models || [])
      .filter((row: any) => (row.supportedGenerationMethods || []).includes("generateContent"))
      .map((row: any) => String(row.name || "").replace(/^models\//, ""))
      .filter(Boolean)
      .sort();
  }
  if (provider === "deepseek") {
    const data = await fetchJson("https://api.deepseek.com/models", {
      headers: headers(provider, key),
    });
    return (data.data || []).map((row: any) => row.id || "").filter(Boolean).sort();
  }
  return [];
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function callConfiguredAI(
  system: string,
  user: string,
  options: { temperature?: number; maxTokens?: number; timeout?: number } = {},
): Promise<string> {
  const provider = getProvider();
  const model = getModel();
  const key = getProviderKey(provider);
  const temperature = options.temperature ?? 0.3;
  const maxTokens = options.maxTokens ?? 1600;
  const timeout = options.timeout ?? 180000;
  if (!model) throw new Error("Choose a model in Settings first.");
  if (LLM_PROVIDERS[provider].keyRequired && !key) {
    throw new Error(`Add a ${LLM_PROVIDERS[provider].short} key in Settings first.`);
  }

  const messages: ChatMessage[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];

  if (provider === "ollama") {
    const contextSize = Number(localStorage.getItem("ollama-context-size") || 32768);
    const data = await ollamaChat(
      {
        method: "POST",
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          options: { temperature, num_ctx: contextSize },
        }),
      },
      timeout,
    );
    const reply = String(data?.message?.content || "").trim();
    if (!reply) throw new Error("Ollama returned an empty answer.");
    return reply;
  }

  if (provider === "ollama-cloud") {
    const data = await fetchJson(
      "http://127.0.0.1:8790/v1/chat/completions",
      {
        method: "POST",
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
        }),
      },
      timeout,
    );
    const reply = String(data?.choices?.[0]?.message?.content || "").trim();
    if (!reply) throw new Error("Ollama Cloud returned an empty answer.");
    return reply;
  }

  if (provider === "anthropic") {
    const data = await fetchJson(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: headers(provider, key),
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature,
          system,
          messages: [{ role: "user", content: user }],
        }),
      },
      timeout,
    );
    const reply = (data.content || [])
      .filter((block: any) => block.type === "text")
      .map((block: any) => block.text || "")
      .join("")
      .trim();
    if (!reply) throw new Error("Claude returned an empty answer.");
    return reply;
  }

  if (provider === "openai" || provider === "deepseek") {
    const base = provider === "openai" ? "https://api.openai.com/v1" : "https://api.deepseek.com/v1";
    const reasoning = provider === "openai" && /^(o1|o3|o4|gpt-5)/i.test(model);
    const body = reasoning
      ? { model, messages, max_completion_tokens: maxTokens }
      : { model, messages, temperature, max_tokens: maxTokens };
    const data = await fetchJson(
      `${base}/chat/completions`,
      {
        method: "POST",
        headers: headers(provider, key),
        body: JSON.stringify(body),
      },
      timeout,
    );
    const reply = String(data?.choices?.[0]?.message?.content || "").trim();
    if (!reply) throw new Error("The model returned an empty answer.");
    return reply;
  }

  if (provider === "gemini") {
    const data = await fetchJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { temperature, maxOutputTokens: maxTokens },
        }),
      },
      timeout,
    );
    const reply = (data?.candidates?.[0]?.content?.parts || [])
      .map((part: any) => part.text || "")
      .join("")
      .trim();
    if (!reply) throw new Error("Gemini returned an empty answer.");
    return reply;
  }

  throw new Error("That provider is not supported.");
}
