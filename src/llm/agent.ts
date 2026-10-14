import type { ChatMessage, HinglishScript, ProviderConfig } from './prompt';
import { buildSystemPrompt } from './prompt';
import { streamChat } from './stream';
import { runTool, TOOLS } from '../tools';

export type AgentResult = {
  text: string;
  toolMs: number;
  firstTokenAt: number | null;
};

function abortError(): Error {
  const error = new Error('Aborted');
  error.name = 'AbortError';
  return error;
}

export async function runAgent(options: {
  provider: ProviderConfig;
  history: ChatMessage[];
  userText: string;
  hinglishScript: HinglishScript;
  signal?: AbortSignal;
  onText: (delta: string) => void;
}): Promise<AgentResult> {
  const started = performance.now();
  let firstTokenAt: number | null = null;
  const mark = (delta: string) => {
    if (options.signal?.aborted) return;
    if (firstTokenAt == null && delta) firstTokenAt = performance.now();
    options.onText(delta);
  };

  const prior = options.history
    .filter((message) => (message.role === 'user' || message.role === 'assistant') && !message.tool_calls && !message.tool_call_id)
    .slice(-12);
  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(new Date(), options.hinglishScript) },
    ...prior,
    { role: 'user', content: options.userText },
  ];

  let toolMs = 0;
  let spoken = '';

  for (let round = 0; round < 3; round += 1) {
    if (options.signal?.aborted) throw abortError();
    const allowTools = round < 2;
    const result = await streamChat({
      provider: options.provider,
      messages,
      tools: allowTools ? TOOLS : undefined,
      maxTokens: round === 0 ? 300 : 150,
      onText: mark,
      signal: options.signal,
    });
    if (allowTools && result.toolCalls.length > 0) {
      const toolStarted = performance.now();
      const results = await Promise.all(
        result.toolCalls.map(async (call) => {
          let parsed: Record<string, unknown> = {};
          try {
            parsed = JSON.parse(call.function.arguments) as Record<string, unknown>;
          } catch {
            parsed = {};
          }
          const value = await runTool(call.function.name, parsed).catch((error: unknown) => ({
            error: error instanceof Error ? error.message : 'Tool failed',
          }));
          return { call, value };
        }),
      );
      toolMs += performance.now() - toolStarted;
      if (options.signal?.aborted) throw abortError();
      messages.push({
        role: 'assistant',
        content: result.text,
        tool_calls: result.toolCalls,
      });
      for (const item of results) {
        messages.push({
          role: 'tool',
          tool_call_id: item.call.id,
          content: JSON.stringify(item.value),
        });
      }
      continue;
    }
    spoken = result.text;
    break;
  }

  return { text: spoken, toolMs, firstTokenAt: firstTokenAt ?? (spoken ? started : null) };
}
