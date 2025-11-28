/**
 * Calculate start and end dates for the next full week
 * Returns dates starting from next Monday 00:00:00 UTC (or current if today is Monday 00:00:00)
 */
export function calculateNextWeekDates(): { startsAt: Date; endsAt: Date } {
  const now = new Date();
  const minutes = now.getMinutes();
  const floorInterval = Math.floor(minutes / 10) * 10;
  const startsAt = new Date(now);
  startsAt.setMinutes(floorInterval, 0, 0);
  const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);

  return { startsAt, endsAt };
}

/**
 * Calculate start and end dates for the current week period
 * Returns dates from last Monday to next Monday
 */
export function calculateCurrentWeekDates(): { startsAt: Date; endsAt: Date } {
  const now = new Date();
  const currentDayOfWeek = now.getUTCDay();
  const daysSinceMonday = (currentDayOfWeek + 6) % 7;

  const mondayTimestamp = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - daysSinceMonday,
    0,
    0,
    0,
    0,
  );
  const startsAt = new Date(mondayTimestamp);
  const endsAt = new Date(mondayTimestamp + 7 * 24 * 60 * 60 * 1000);

  return { startsAt, endsAt };
}

/**
 * Calculate start and end dates for the next full month
 * Returns dates starting from next month 1st 00:00:00 UTC (or current if today is 1st 00:00:00)
 */
export function calculateNextMonthDates(): { startsAt: Date; endsAt: Date } {
  const now = new Date();
  const minutes = now.getMinutes();
  const floorInterval = Math.floor(minutes / 10) * 10;
  const startsAt = new Date(now);
  startsAt.setMinutes(floorInterval, 0, 0);
  const endsAt = new Date(startsAt.getTime() + 50 * 60 * 1000);

  return { startsAt, endsAt };
}

/**
 * Calculate start and end dates for the current month period
 * Returns dates from current month 1st to next month 1st
 */
export function calculateCurrentMonthDates(): { startsAt: Date; endsAt: Date } {
  const now = new Date();

  const startsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const endsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));

  return { startsAt, endsAt };
}
