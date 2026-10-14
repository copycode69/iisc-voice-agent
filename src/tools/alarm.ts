import { startActivityAsync } from 'expo-intent-launcher';
import { kolkataParts } from '../llm/prompt';

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T12:00:00+05:30`);
  next.setUTCDate(next.getUTCDate() + days);
  return kolkataParts(next).date;
}

export async function setAlarm(input: {
  hour: number;
  minute: number;
  label?: string;
  date?: string;
}): Promise<unknown> {
  const now = kolkataParts();
  const [hourNow, minuteNow] = now.isoLocal.slice(11, 16).split(':').map(Number);
  let nextDate = now.date;
  if (input.hour < hourNow || (input.hour === hourNow && input.minute <= minuteNow)) {
    nextDate = addDays(now.date, 1);
  }
  const requested = input.date;
  const matches = !requested || requested === nextDate;

  await startActivityAsync('android.intent.action.SET_ALARM', {
    extra: {
      'android.intent.extra.alarm.HOUR': input.hour,
      'android.intent.extra.alarm.MINUTES': input.minute,
      'android.intent.extra.alarm.MESSAGE': input.label ?? 'Vaani',
      'android.intent.extra.alarm.SKIP_UI': true,
    },
  });

  return {
    ok: true,
    hour: input.hour,
    minute: input.minute,
    label: input.label ?? 'Vaani',
    android_sets: nextDate,
    requested_date: requested ?? null,
    requested_date_matches_next_occurrence: matches,
    note: matches
      ? 'Alarm sent to the Clock app.'
      : `Android sets the next occurrence on ${nextDate}, not the requested date ${requested}.`,
  };
}
