import { logEvent } from "@/lib/monitoring";

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LlmResponse = {
  content: string;
  isFallback?: boolean;
};

export type LlmToolCallResponse = {
  toolArgumentsJson: unknown | null;
  isFallback?: boolean;
  error?: string;
};

function getApiBaseUrl() {
  const base = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  return base.replace(/\/$/, "");
}

export async function generateChatCompletion(
  messages: LlmMessage[]
): Promise<LlmResponse> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      content:
        "Der OKR-Coach ist noch nicht konfiguriert. Bitte OPENAI_API_KEY setzen.",
      isFallback: true,
    };
  }

  // Default to a higher-quality model; can be overridden via OPENAI_MODEL.
  const model = process.env.OPENAI_MODEL || "gpt-4.1";
  const fallbackModel = process.env.OPENAI_FALLBACK_MODEL || "gpt-4.1-mini";

  const doRequest = async (selectedModel: string) => {
    return fetch(`${getApiBaseUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: selectedModel,
        messages,
        temperature: 0.35,
        max_tokens: 700,
      }),
    });
  };

  let selectedModel = model;
  let response = await doRequest(selectedModel);

  if (!response.ok && fallbackModel && fallbackModel !== model) {
    // If the model is unavailable or blocked, retry once with a cheaper fallback.
    selectedModel = fallbackModel;
    response = await doRequest(selectedModel);
  }

  if (!response.ok) {
    logEvent("error", "llm_chat_request_failed", {
      status: response.status,
      model: selectedModel,
    });
    return {
      content:
        "Der OKR-Coach ist gerade nicht erreichbar. Bitte versuche es später noch einmal.",
      isFallback: true,
    };
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content?.trim();

  return {
    content: content || "Ich konnte dazu gerade nichts sagen. Versuch es erneut.",
  };
}

export async function generateToolCallCompletion(
  messages: LlmMessage[],
  tool: {
    name: string;
    description: string;
    parameters: unknown;
  }
): Promise<LlmToolCallResponse> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      toolArgumentsJson: null,
      isFallback: true,
      error:
        "Der OKR-Coach ist noch nicht konfiguriert. Bitte OPENAI_API_KEY setzen.",
    };
  }

  const model = process.env.OPENAI_MODEL || "gpt-4.1";
  const fallbackModel = process.env.OPENAI_FALLBACK_MODEL || "gpt-4.1-mini";

  const doRequest = async (selectedModel: string) => {
    return fetch(`${getApiBaseUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: selectedModel,
        messages,
        temperature: 0.25,
        max_tokens: 800,
        tools: [
          {
            type: "function",
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
            },
          },
        ],
        tool_choice: {
          type: "function",
          function: { name: tool.name },
        },
      }),
    });
  };

  let selectedModel = model;
  let response = await doRequest(selectedModel);
  let isFallback = false;

  if (!response.ok && fallbackModel && fallbackModel !== model) {
    selectedModel = fallbackModel;
    response = await doRequest(selectedModel);
    isFallback = true;
  }

  if (!response.ok) {
    logEvent("error", "llm_tool_call_request_failed", {
      status: response.status,
      model: selectedModel,
    });
    return {
      toolArgumentsJson: null,
      isFallback: true,
      error:
        "Der OKR-Coach ist gerade nicht erreichbar. Bitte versuche es später noch einmal.",
    };
  }

  const data = await response.json();
  const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
  const args = toolCall?.function?.arguments;

  if (!args || typeof args !== "string") {
    logEvent("error", "llm_tool_call_missing_arguments", {
      model: selectedModel,
    });
    return {
      toolArgumentsJson: null,
      isFallback,
      error:
        "Der OKR-Coach konnte gerade keine strukturierte Antwort liefern.",
    };
  }

  try {
    return {
      toolArgumentsJson: JSON.parse(args),
      isFallback,
    };
  } catch {
    logEvent("error", "llm_tool_call_invalid_json", {
      model: selectedModel,
    });
    return {
      toolArgumentsJson: null,
      isFallback,
      error:
        "Der OKR-Coach konnte gerade keine strukturierte Antwort liefern.",
    };
  }
}
