import { kolkataParts } from '../llm/prompt';
import { setAlarm } from './alarm';
import { createReminder, getSchedule } from './reminder';
import { getWeather } from './weather';

export const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Daily forecast for a city from Open-Meteo. Use for weather questions.',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string' },
          day: { type: 'string', description: 'today, tomorrow, or YYYY-MM-DD' },
        },
        required: ['city', 'day'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_alarm',
      description: 'Set an Android clock alarm. The clock uses the next occurrence of that time.',
      parameters: {
        type: 'object',
        properties: {
          hour: { type: 'integer', minimum: 0, maximum: 23 },
          minute: { type: 'integer', minimum: 0, maximum: 59 },
          label: { type: 'string' },
          date: { type: 'string', description: 'YYYY-MM-DD if the user named a day' },
        },
        required: ['hour', 'minute'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_reminder',
      description: 'Create a 30 minute calendar event with an alarm.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          start_iso: { type: 'string', description: 'ISO datetime with +05:30 offset' },
          minutes_before: { type: 'integer' },
        },
        required: ['title', 'start_iso'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_schedule',
      description: 'Read calendar events for a day and the next event after now.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'today, tomorrow, or YYYY-MM-DD' },
        },
        required: ['date'],
      },
    },
  },
];

function resolveDay(day: string): string {
  const today = kolkataParts().date;
  if (day === 'today') return today;
  if (day === 'tomorrow') {
    const next = new Date(`${today}T12:00:00+05:30`);
    next.setUTCDate(next.getUTCDate() + 1);
    return kolkataParts(next).date;
  }
  return day;
}

export async function runTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  if (name === 'get_weather') {
    return getWeather(String(args.city ?? 'Bangalore'), resolveDay(String(args.day ?? 'today')));
  }
  if (name === 'set_alarm') {
    return setAlarm({
      hour: Number(args.hour),
      minute: Number(args.minute),
      label: args.label ? String(args.label) : undefined,
      date: args.date ? resolveDay(String(args.date)) : undefined,
    });
  }
  if (name === 'create_reminder') {
    return createReminder({
      title: String(args.title ?? 'Reminder'),
      startIso: String(args.start_iso),
      minutesBefore: args.minutes_before == null ? undefined : Number(args.minutes_before),
    });
  }
  if (name === 'get_schedule') {
    return getSchedule(resolveDay(String(args.date ?? 'today')));
  }
  return { error: `Unknown tool ${name}` };
}
