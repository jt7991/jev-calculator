import type { JevClient } from './trace.js';
import {
  attachQuestionPrompts,
  choiceSelection,
  type Selection,
} from './selections.js';
import { TypeSafeClient, type ChoiceResponse } from '@typesafe-ai/sdk';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezonePlugin from 'dayjs/plugin/timezone.js';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import { assessChoice } from './choice.js';
import { dateQuestions, months, weekdays } from './date-questions.js';

dayjs.extend(utc);
dayjs.extend(timezonePlugin);
dayjs.extend(customParseFormat);

export function dateAt(epochMilliseconds: number, zone: string) {
  return zone.startsWith('+') || zone.startsWith('-')
    ? dayjs(epochMilliseconds).utcOffset(zone)
    : dayjs(epochMilliseconds).tz(zone);
}

export type DateContext = { referenceTime: number; timezone: string };
export type DateParts = {
  year: number | null;
  month: number | null;
  day: number | null;
  hour: number | null;
  minute: number | null;
  second: number | null;
  relativeDay: number | null;
  weekday?: number | null;
  weekOffset?: string | null;
  timezone: string | null;
};
const format = 'YYYY-MM-DD HH:mm:ss.SSS';

export class DateInput {
  constructor(private readonly jev: JevClient = new TypeSafeClient()) {}

  async parse(text: string, context: DateContext) {
    if (!text.trim()) throw new Error('Enter a date or time.');
    const zones: Record<string, string | null> = {
      none: 'No timezone or UTC offset provided',
      unsupported: 'An unsupported or ambiguous timezone is provided',
      UTC: 'UTC, GMT, or Z',
    };
    for (const zone of [
      context.timezone,
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'Europe/London',
      'Europe/Paris',
      'Asia/Tokyo',
      'Asia/Kolkata',
      'Australia/Sydney',
    ])
      zones[zone] = zone;
    for (let minutes = -840; minutes <= 840; minutes += 15) {
      if (minutes === 0) continue;
      const label =
        (minutes < 0 ? '-' : '+') +
        String(Math.floor(Math.abs(minutes) / 60)).padStart(2, '0') +
        ':' +
        String(Math.abs(minutes) % 60).padStart(2, '0');
      zones[label] = `Explicit UTC offset ${label}`;
    }
    const questions = {
      ...dateQuestions,
      hour: this.numberQuestion(
        'hour in 24-hour time (3 pm = 15, noon = 12, midnight = 0)',
        0,
        23,
      ),
      minute: this.numberQuestion('minute', 0, 59),
      second: this.numberQuestion(
        'seconds component of the clock time (the third field in HH:mm:ss; HH:mm, noon, and midnight have no seconds provided)',
        0,
        59,
      ),
      timezone: {
        type: 'choice' as const,
        instructions:
          'Which timezone or UTC offset is explicitly provided in text? Do not infer one. Select none if absent and unsupported for a timezone not listed or an ambiguous abbreviation.',
        criteria: zones,
      },
    };
    const response = await this.jev.systemOne({
      model: process.env.TYPESAFE_MODEL || 'jev-1.13.0',
      state: { text },
      questions,
    });
    const parts: DateParts = {
      year: null,
      month: null,
      day: null,
      hour: null,
      minute: null,
      second: null,
      relativeDay: null,
      timezone: null,
    };
    const answers = response.answers;
    attachQuestionPrompts(answers, questions);
    const mode = this.read('mode', answers.mode, questions.mode.criteria);
    if (mode === 'absolute') {
      const month = this.read('month', answers.month, questions.month.criteria);
      const day = this.read('day', answers.day, questions.day.criteria);
      const year = this.read('year', answers.year, questions.year.criteria);
      if (month === null || day === null)
        throw new Error('The calendar date needs a month and day.');
      parts.month = months.indexOf(month) + 1;
      parts.day = Number(day);
      parts.year = year === null ? null : Number(year);
    } else if (mode === 'relative') {
      const anchor = this.read(
        'day_anchor',
        answers.day_anchor,
        questions.day_anchor.criteria,
      );
      if (anchor === 'weekday') {
        const weekday = this.read(
          'weekday',
          answers.weekday,
          questions.weekday.criteria,
        );
        if (weekday === null) throw new Error('The weekday is missing.');
        parts.weekday = weekdays.indexOf(weekday);
        parts.weekOffset = this.read(
          'week_offset',
          answers.week_offset,
          questions.week_offset.criteria,
        );
      } else {
        const offsets: Record<string, number> = {
          yesterday: -1,
          today: 0,
          tomorrow: 1,
          day_after: 2,
        };
        if (anchor === null || !Object.hasOwn(offsets, anchor))
          throw new Error('The relative day is missing.');
        parts.relativeDay = offsets[anchor];
      }
    }
    for (const field of ['hour', 'minute', 'second'] as const) {
      const value = this.read(field, answers[field], questions[field].criteria);
      parts[field] = value === null ? null : Number(value);
    }
    parts.timezone = this.read(
      'timezone',
      answers.timezone,
      questions.timezone.criteria,
    );
    if (
      mode === null &&
      parts.hour === null &&
      parts.minute === null &&
      parts.second === null
    )
      throw new Error('No supported date or time was provided.');
    const selections = this.describe(parts, context);
    const fields = ['mode', 'hour', 'minute', 'second', 'timezone'];
    if (mode === 'absolute') fields.push('year', 'month', 'day');
    if (mode === 'relative') fields.push('day_anchor');
    if (parts.weekday != null) fields.push('weekday', 'week_offset');
    for (const field of fields) {
      const key = field as keyof typeof questions;
      const label =
        field === 'weekday'
          ? 'Weekday'
          : field === 'week_offset'
            ? 'Week'
            : field === 'timezone'
              ? 'Timezone'
              : field;
      const selection = choiceSelection(
        label,
        answers[key],
        questions[key].criteria,
      );
      const existing = selections.find((item) => item.label === label);
      if (existing)
        Object.assign(existing, {
          options: selection.options,
          probability: selection.probability,
          confidence: selection.confidence,
          prompt: selection.prompt,
          callId: selection.callId,
        });
      else selections.unshift(selection);
    }
    return { parts, selections, ...this.resolve(parts, context) };
  }

  resolve(parts: DateParts, context: DateContext) {
    if (
      !Number.isFinite(context.referenceTime) ||
      !dayjs(context.referenceTime).isValid()
    )
      throw new Error('Invalid reference time.');
    const zone = parts.timezone ?? context.timezone;
    const fixedOffset = zone.startsWith('+') || zone.startsWith('-');
    const offset = fixedOffset
      ? (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(4, 6))) *
        (zone.startsWith('-') ? -1 : 1)
      : 0;
    const reference = fixedOffset
      ? dayjs(context.referenceTime).utcOffset(zone)
      : dayjs(context.referenceTime).tz(zone);
    let base = dayjs
      .utc(reference.format(format), format, true)
      .add(parts.relativeDay ?? 0, 'day');
    if (parts.weekday != null) {
      const currentWeekday = (base.day() + 6) % 7;
      let shift = (parts.weekday - currentWeekday + 7) % 7;
      if (parts.weekOffset === 'current')
        shift = parts.weekday - currentWeekday;
      if (parts.weekOffset === 'next')
        shift = parts.weekday - currentWeekday + 7;
      if (parts.weekOffset === 'previous')
        shift = -((currentWeekday - parts.weekday + 7) % 7 || 7);
      base = base.add(shift, 'day');
    }
    const hasTime =
      parts.hour !== null || parts.minute !== null || parts.second !== null;
    if (
      !hasTime &&
      parts.year === null &&
      parts.month === null &&
      parts.day === null &&
      parts.relativeDay === 0
    )
      return { epochMilliseconds: context.referenceTime, timezone: zone };
    const year = parts.year ?? base.year();
    const month = parts.month ?? base.month() + 1;
    const day = parts.day ?? base.date();
    const hour = parts.hour ?? base.hour();
    const minute = parts.minute ?? (hasTime ? 0 : base.minute());
    const second = parts.second ?? (hasTime ? 0 : base.second());
    const millisecond = hasTime ? 0 : base.millisecond();
    const wall = `${year}-${this.pad(month)}-${this.pad(day)} ${this.pad(hour)}:${this.pad(minute)}:${this.pad(second)}.${String(millisecond).padStart(3, '0')}`;
    const calendar = dayjs.utc(wall, format, true);
    if (!calendar.isValid()) throw new Error('Invalid calendar date or time.');
    const result = fixedOffset
      ? calendar.subtract(offset, 'minute')
      : dayjs.tz(wall, zone);
    if (!fixedOffset) {
      if (result.format(format) !== wall)
        throw new Error(
          'This local time does not exist because the clocks change.',
        );
      for (const delta of [-86400000, 86400000]) {
        const otherOffset = dayjs(result.valueOf() + delta)
          .tz(zone)
          .utcOffset();
        const other = calendar.valueOf() - otherOffset * 60000;
        if (
          other !== result.valueOf() &&
          dayjs(other).tz(zone).format(format) === wall
        )
          throw new Error(
            'This local time occurs twice; provide an explicit UTC offset.',
          );
      }
    }
    return { epochMilliseconds: result.valueOf(), timezone: zone };
  }

  describe(parts: DateParts, context: DateContext): Selection[] {
    const selections: Selection[] = [];
    if (parts.relativeDay !== null)
      selections.push({
        label: 'Relative day',
        value: String(parts.relativeDay) + ' days from the reference date',
      });
    if (parts.weekday != null) {
      selections.push({ label: 'Weekday', value: weekdays[parts.weekday] });
      selections.push({
        label: 'Week',
        value: parts.weekOffset ?? 'Next occurrence',
      });
    }
    for (const field of ['year', 'month', 'day'] as const) {
      selections.push({
        label: field,
        value: parts[field] === null ? 'None provided' : String(parts[field]),
      });
    }
    for (const field of ['hour', 'minute', 'second'] as const) {
      selections.push({
        label: field,
        value: parts[field] === null ? 'None provided' : String(parts[field]),
      });
    }
    const hasTime =
      parts.hour !== null || parts.minute !== null || parts.second !== null;
    selections.push({
      label: 'Time defaults',
      value: hasTime
        ? 'Missing hour uses reference hour; missing minutes and seconds use zero.'
        : 'No clock time supplied; preserve the reference clock time.',
    });
    selections.push({
      label: 'Timezone',
      value: parts.timezone ?? context.timezone + ' (request default)',
    });
    return selections;
  }

  private read(
    field: string,
    answer: ChoiceResponse,
    criteria: Record<string, unknown>,
  ): string | null {
    if (
      !answer ||
      answer.type !== 'choice' ||
      !Object.hasOwn(criteria, answer.choice)
    )
      throw new Error(`Invalid ${field} answer.`);
    if (!assessChoice(answer.choice, answer.probabilities).accepted)
      throw new Error(`The ${field} is unclear.`);
    if (answer.choice === 'unsupported' || answer.choice === 'out_of_range')
      throw new Error(`Unsupported ${field}.`);
    return answer.choice === 'none' ? null : answer.choice;
  }

  private numberQuestion(field: string, min: number, max: number) {
    const criteria: Record<string, string | null> = {
      none: 'None provided',
      unsupported: 'Provided but outside the choices or ambiguous',
    };
    for (let value = min; value <= max; value++) {
      criteria[String(value)] = field.startsWith('hour')
        ? `${value % 12 || 12} ${value < 12 ? 'AM' : 'PM'} (${value}:00 in 24-hour time)`
        : null;
    }
    return {
      type: 'choice' as const,
      instructions: field.startsWith('hour')
        ? 'What hour does the time in text represent, in 24-hour format? Interpret AM/PM and named times: 3:30 pm represents hour 15, 3:30 am represents hour 3, noon is 12, and midnight is 0. The selected number need not appear literally in the text. Select none only if no time of day is given. Ignore date numbers and duration amounts.'
        : `What is the ${field} explicitly provided in text? Select none when absent. Do not fill defaults or calculate relative dates. Read only this component of the starting date/time, not adjustment amounts. Do not reuse a value from another component.`,
      criteria,
    };
  }

  private pad(value: number) {
    return String(value).padStart(2, '0');
  }
}
