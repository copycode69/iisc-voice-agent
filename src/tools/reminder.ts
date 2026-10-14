import * as Calendar from 'expo-calendar';
import { kolkataParts } from '../llm/prompt';

async function writableCalendarId(): Promise<string> {
  const permission = await Calendar.requestCalendarPermissionsAsync();
  if (permission.status !== 'granted') throw new Error('Calendar permission was denied.');
  const calendars = await Calendar.getCalendarsAsync();
  const writable = calendars.filter((calendar) => calendar.allowsModifications);
  const chosen = writable.find((calendar) => calendar.isPrimary) ?? writable[0];
  if (!chosen) throw new Error('No writable calendar on this phone.');
  return chosen.id;
}

export async function createReminder(input: {
  title: string;
  startIso: string;
  minutesBefore?: number;
}): Promise<unknown> {
  const calendarId = await writableCalendarId();
  const start = new Date(input.startIso);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const minutes = input.minutesBefore ?? 10;
  const id = await Calendar.createEventAsync(calendarId, {
    title: input.title,
    startDate: start,
    endDate: end,
    timeZone: 'Asia/Kolkata',
    alarms: [{ relativeOffset: -minutes, method: Calendar.AlarmMethod.ALARM }],
  });
  return {
    ok: true,
    event_id: id,
    title: input.title,
    start: input.startIso,
    end: end.toISOString(),
    alarm_minutes_before: minutes,
  };
}

function kolkataClock(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00';
  return `${get('hour')}:${get('minute')}`;
}

export async function getSchedule(date: string): Promise<unknown> {
  const permission = await Calendar.requestCalendarPermissionsAsync();
  if (permission.status !== 'granted') throw new Error('Calendar permission was denied.');
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const start = new Date(`${date}T00:00:00+05:30`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const ids = calendars.map((calendar) => calendar.id);
  const titleById = new Map(calendars.map((calendar) => [calendar.id, calendar.title]));
  const events = ids.length === 0 ? [] : await Calendar.getEventsAsync(ids, start, end);
  const seen = new Set<string>();
  const mapped = events
    .filter((event) => {
      if (seen.has(event.id)) return false;
      seen.add(event.id);
      return true;
    })
    .map((event) => {
      const eventStart = new Date(event.startDate);
      const eventEnd = new Date(event.endDate);
      return {
        id: event.id,
        title: event.title,
        calendar: titleById.get(event.calendarId) ?? '',
        all_day: event.allDay,
        start: eventStart.toISOString(),
        end: eventEnd.toISOString(),
        start_local: kolkataClock(eventStart),
        end_local: kolkataClock(eventEnd),
      };
    })
    .sort((a, b) => a.start.localeCompare(b.start));
  const now = Date.now();
  const next = mapped.find((event) => !event.all_day && new Date(event.start).getTime() > now) ?? null;
  return {
    date,
    timezone: 'Asia/Kolkata',
    now: kolkataParts().isoLocal,
    events: mapped,
    next_event: next,
  };
}
