export const BUSINESS_TIME_ZONE = 'Asia/Shanghai';

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric', month: '2-digit', day: '2-digit',
});

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: BUSINESS_TIME_ZONE,
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function businessDate(instant: Date = new Date()) {
  const parts = dateFormatter.formatToParts(instant);
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function businessTime(instant: Date = new Date()) {
  return timeFormatter.format(instant);
}

// Date-only keys are calendar values; UTC arithmetic avoids the viewer's device time zone.
export function shiftDay(date: string, amount: number) {
  const [year, month, day] = date.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + amount));
  return shifted.toISOString().slice(0, 10);
}

export function dayDistance(earlier: string, later: string) {
  const asUtcDay = (date: string) => {
    const [year, month, day] = date.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((asUtcDay(later) - asUtcDay(earlier)) / 86400000);
}

export function cardStreak(dates: string[], today: string, startDate: string) {
  const checked = new Set(dates.filter((date) => date >= startDate && date <= today));
  if (checked.has(today)) {
    let streak = 0;
    for (let day = today; checked.has(day); day = shiftDay(day, -1)) streak += 1;
    return { streak, missed: 0, pendingToday: false };
  }

  const yesterday = shiftDay(today, -1);
  if (checked.has(yesterday)) return { streak: 0, missed: 0, pendingToday: true };

  const lastCheckIn = [...checked].sort().at(-1);
  const missed = lastCheckIn
    ? Math.max(dayDistance(lastCheckIn, today) - 1, 0)
    : Math.max(dayDistance(startDate, today), 0);
  return { streak: 0, missed, pendingToday: false };
}
