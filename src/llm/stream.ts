import { fetch } from 'expo/fetch';
import type { ChatMessage, ProviderConfig, ToolCall } from './prompt';

export type StreamDelta = {
  text: string;
  toolCalls: ToolCall[];
  finishReason: string | null;
};

type PartialCall = { id: string; name: string; arguments: string };

type StreamError = { message?: string };

type StreamJson = {
  error?: StreamError | string;
  choices?: Array<{
    finish_reason?: string | null;
    delta?: {
      content?: string | null;
      reasoning?: string | null;
      reasoning_content?: string | null;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
  }>;
};

/**
 * Extra body fields for Groq reasoning models.
 * https://console.groq.com/docs/reasoning
 * gpt-oss accepts reasoning_effort low|medium|high (default medium) and include_reasoning.
 * It does not accept reasoning_format. Qwen 3 accepts reasoning_effort "none" to skip thinking,
 * and reasoning_format "hidden" so reasoning is not returned. Never sent to Gemini.
 */
export function modelExtras(provider: 'groq' | 'gemini', model: string): Record<string, unknown> {
  if (provider !== 'groq') return {};
  if (model.startsWith('openai/gpt-oss')) {
    return { reasoning_effort: 'low', include_reasoning: false };
  }
  if (model.includes('qwen3')) {
    return { reasoning_effort: 'none', reasoning_format: 'hidden' };
  }
  return {};
}

/**
 * OpenAI-compatible SSE parser. Groq and Gemini both emit `data: {json}` lines.
 * Tool-call fragments are joined by index before the caller runs them.
 * Reasoning fields are ignored so they are never spoken.
 */
export async function streamChat(options: {
  provider: ProviderConfig;
  messages: ChatMessage[];
  tools?: unknown[];
  maxTokens: number;
  onText?: (delta: string) => void;
  signal?: AbortSignal;
}): Promise<StreamDelta> {
  const response = await fetch(`${options.provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.provider.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.provider.model,
      messages: options.messages,
      tools: options.tools,
      temperature: 0.3,
      max_tokens: options.maxTokens,
      stream: true,
      ...modelExtras(options.provider.id, options.provider.model),
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`LLM ${response.status}: ${detail.slice(0, 280)}`);
  }
  if (!response.body) throw new Error('This response has no stream.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let finishReason: string | null = null;
  const calls = new Map<number, PartialCall>();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      let json: StreamJson;
      try {
        json = JSON.parse(data) as StreamJson;
      } catch {
        continue;
      }
      if (json.error) {
        const message = typeof json.error === 'string' ? json.error : json.error.message;
        throw new Error(message || 'The model stream returned an error.');
      }
      const choice = json.choices?.[0];
      if (!choice) continue;
      if (choice.finish_reason) finishReason = choice.finish_reason;
      const delta = choice.delta;
      if (delta?.content) {
        text += delta.content;
        options.onText?.(delta.content);
      }
      for (const call of delta?.tool_calls ?? []) {
        const index = call.index ?? 0;
        const current = calls.get(index) ?? { id: '', name: '', arguments: '' };
        if (call.id) current.id = call.id;
        if (call.function?.name) current.name += call.function.name;
        if (call.function?.arguments) current.arguments += call.function.arguments;
        calls.set(index, current);
      }
    }
  }

  const toolCalls: ToolCall[] = [...calls.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, call]) => ({
      id: call.id || `call_${call.name}`,
      type: 'function' as const,
      function: { name: call.name, arguments: call.arguments || '{}' },
    }));

  return { text, toolCalls, finishReason };
}

export async function warmProvider(provider: ProviderConfig): Promise<void> {
  if (!provider.apiKey) return;
  await fetch(`${provider.baseUrl}/models`, {
    headers: { Authorization: `Bearer ${provider.apiKey}` },
  });
}
