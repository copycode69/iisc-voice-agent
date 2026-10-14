export type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};

export type ToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

export type HinglishScript = 'devanagari' | 'mixed';

export type ProviderConfig = {
  id: 'groq' | 'gemini';
  baseUrl: string;
  model: string;
  apiKey: string;
};

export function kolkataParts(date = new Date()): { isoLocal: string; weekday: string; date: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const dateStr = `${get('year')}-${get('month')}-${get('day')}`;
  return {
    isoLocal: `${dateStr}T${get('hour')}:${get('minute')}:${get('second')}+05:30`,
    weekday: get('weekday'),
    date: dateStr,
  };
}

export function buildSystemPrompt(now = new Date(), hinglishScript: HinglishScript = 'devanagari'): string {
  const { isoLocal, weekday } = kolkataParts(now);
  const hinglish =
    hinglishScript === 'devanagari'
      ? 'For Hinglish/Hindi replies write the WHOLE reply in Devanagari, including common English words (अलार्म, मीटिंग, रिमाइंडर, कैलेंडर, वेदर), and say times the Indian way (सुबह 7 बजे, शाम 5 बजे). Keep only proper names that have no common Hindi spelling in English letters. Example: "ठीक है, मैंने कल सुबह 7 बजे का अलार्म लगा दिया है।"'
      : 'For Hinglish replies write Hindi words in Devanagari and keep English words (meeting, alarm, reminder, PM, Bangalore, weather) in English letters, e.g. "ठीक है, मैंने कल सुबह 7 बजे का alarm set कर दिया है।"';
  return [
    `You are "Vaani", a fast, friendly phone voice assistant for India. Current date/time: ${isoLocal}, timezone Asia/Kolkata,`,
    `weekday ${weekday}. Default city: Bangalore.`,
    'Reply in the SAME language style the user used: English → English; Hinglish/Hindi → Hinglish.',
    'Your reply is SPOKEN aloud, so: 1–2 short sentences, no markdown, no lists, no emojis, no URLs.',
    hinglish,
    'Use tools for weather, alarms, reminders and the calendar. Never invent weather or events. If a time is ambiguous, assume the',
    'next future occurrence and say it. Confirm actions briefly.',
  ].join(' ');
}
