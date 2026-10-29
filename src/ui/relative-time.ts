// Date relative courte, en français : « à l'instant », « il y a 2 h », puis la date.

import { strings } from './strings';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;

const relative = new Intl.RelativeTimeFormat('fr', { style: 'short', numeric: 'always' });
const absolute = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' });

export function relativeTime(time: number, now = Date.now()): string {
  const elapsed = Math.max(0, now - time);
  if (elapsed < MINUTE) return strings.time.justNow;
  if (elapsed < HOUR) return relative.format(-Math.floor(elapsed / MINUTE), 'minute');
  if (elapsed < DAY) return relative.format(-Math.floor(elapsed / HOUR), 'hour');
  if (elapsed < MONTH) return relative.format(-Math.floor(elapsed / DAY), 'day');
  return absolute.format(time);
}
