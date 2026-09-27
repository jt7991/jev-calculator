// Adapted from https://docs.typesafe.ai/cookbooks/date_extraction_cookbook
export const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
export const weekdays = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

function choices(options: string[]) {
  const criteria: Record<string, string | null> = {
    none: 'Not stated or not applicable to this date type',
  };
  for (const option of options) criteria[option] = null;
  return criteria;
}
const years = choices(
  Array.from({ length: 151 }, (_, index) => String(1900 + index)),
);
years.out_of_range = 'An explicit year outside 1900 through 2050';

export const dateQuestions = {
  mode: {
    type: 'choice' as const,
    instructions:
      'How is the starting date in text expressed? Absolute means a calendar date naming a month. Relative means now, today, yesterday, tomorrow, the day after tomorrow, or a weekday. None means no date is stated (a time alone has no date).',
    criteria: { absolute: null, relative: null, none: null },
  },
  year: {
    type: 'choice' as const,
    instructions:
      'For an absolute date in text, which year is stated? Select none if missing, or out_of_range if outside the list.',
    criteria: years,
  },
  month: {
    type: 'choice' as const,
    instructions: 'For an absolute date in text, which month is named?',
    criteria: choices(months),
  },
  day: {
    type: 'choice' as const,
    instructions: 'For an absolute date in text, what is the day of the month?',
    criteria: choices(
      Array.from({ length: 31 }, (_, index) => String(index + 1)),
    ),
  },
  day_anchor: {
    type: 'choice' as const,
    instructions:
      'For a relative date in text, which kind of day anchor is written? Any named day of the week, including bare Thursday or next Thursday, selects weekday. Map now and today to today. Do not resolve weekdays into today or tomorrow.',
    criteria: choices([
      'today',
      'yesterday',
      'tomorrow',
      'day_after',
      'weekday',
    ]),
  },
  weekday: {
    type: 'choice' as const,
    instructions: 'If text names a weekday, which weekday?',
    criteria: choices(weekdays),
  },
  week_offset: {
    type: 'choice' as const,
    instructions:
      'For a named weekday in text, select previous for last Tuesday or previous Thursday (the most recent occurrence strictly before today), next for next Tuesday or next week, current for this Tuesday or this week, and none for an unqualified weekday.',
    criteria: choices(['previous', 'current', 'next']),
  },
};
