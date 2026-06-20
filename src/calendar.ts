import * as d from 'date-fns'

export const SUNDAY = 0
export const MONDAY = 1

export type WeekStartsOn = typeof SUNDAY | typeof MONDAY

export interface InputError {
  readonly line: number
  readonly value: string
  readonly message: string
}

export interface ParsedDateInput {
  readonly dates: readonly Date[]
  readonly occurrences: ReadonlyMap<string, number>
  readonly errors: readonly InputError[]
  readonly formatError: string | null
}

export interface CalendarDay {
  readonly dateKey: string
  readonly dayNumber: number
  readonly label: string
  readonly inMonth: boolean
  readonly occurrences: number
}

export interface CalendarWeek {
  readonly isoWeek: number
  readonly selectedDayCount: number
  readonly highlight: CalendarWeekHighlight
  readonly days: readonly CalendarDay[]
}

export type CalendarWeekHighlight = 'single' | 'multiple' | 'gap' | null

export interface CalendarMonth {
  readonly key: string
  readonly title: string
  readonly hasSelection: boolean
  readonly weeks: readonly CalendarWeek[]
}

export interface CalendarBuildResult {
  readonly months: readonly CalendarMonth[]
  readonly rangeError: string | null
}

export const MAX_MONTHS = 600

const FORMAT_SAMPLE = new Date(2000, 10, 22, 12)

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The format could not be parsed.'
}

function validateFormat(dateFormat: string, referenceDate: Date): string | null {
  if (dateFormat.trim().length === 0) {
    return 'Enter a date format.'
  }

  try {
    const sampleText = d.format(FORMAT_SAMPLE, dateFormat)
    const sampleDate = d.parse(sampleText, dateFormat, referenceDate)
    return d.isValid(sampleDate) ? null : 'The date format cannot produce a valid date.'
  } catch (error: unknown) {
    return errorMessage(error)
  }
}

/**
 * Parse user input with date-fns. Moving the reference date back 49 years makes
 * the `yy` window end at the current year instead of extending into the future.
 */
export function parseDateInput(
  input: string,
  dateFormat: string,
  today: Date = new Date(),
): ParsedDateInput {
  const referenceDate = d.subYears(d.startOfDay(today), 49)
  const formatError = validateFormat(dateFormat, referenceDate)

  if (formatError !== null) {
    return {
      dates: [],
      occurrences: new Map<string, number>(),
      errors: [],
      formatError,
    }
  }

  const dates: Date[] = []
  const occurrences = new Map<string, number>()
  const errors: InputError[] = []

  for (const [index, rawLine] of input.split(/\r?\n/u).entries()) {
    const value = rawLine.trim()
    if (value.length === 0) continue

    try {
      const date = d.parse(value, dateFormat, referenceDate)
      if (!d.isValid(date)) {
        errors.push({
          line: index + 1,
          value,
          message: `Does not match “${dateFormat}” or is not a valid date.`,
        })
        continue
      }

      const dateKey = d.format(date, 'yyyy-MM-dd')
      dates.push(date)
      occurrences.set(dateKey, (occurrences.get(dateKey) ?? 0) + 1)
    } catch (error: unknown) {
      return {
        dates: [],
        occurrences: new Map<string, number>(),
        errors: [],
        formatError: errorMessage(error),
      }
    }
  }

  return { dates, occurrences, errors, formatError: null }
}

function buildWeek(
  weekStart: Date,
  month: Date,
  weekStartsOn: WeekStartsOn,
  occurrences: ReadonlyMap<string, number>,
  firstSelectedWeek: Date,
  lastSelectedWeek: Date,
): CalendarWeek {
  const dates = Array.from({ length: 7 }, (_, index) => d.addDays(weekStart, index))
  const thursdayOffset = weekStartsOn === SUNDAY ? 4 : 3
  const days = dates.map(date => {
    const dateKey = d.format(date, 'yyyy-MM-dd')
    return {
      dateKey,
      dayNumber: d.getDate(date),
      label: d.format(date, 'EEEE, MMMM d, yyyy'),
      inMonth: d.isSameMonth(date, month),
      occurrences: occurrences.get(dateKey) ?? 0,
    }
  })

  const selectedDayCount = days.filter(day => day.occurrences > 0).length
  const highlight = selectedDayCount === 1
    ? 'single'
    : selectedDayCount > 1
      ? 'multiple'
      : d.isAfter(weekStart, firstSelectedWeek) && d.isBefore(weekStart, lastSelectedWeek)
        ? 'gap'
        : null

  return {
    isoWeek: d.getISOWeek(d.addDays(weekStart, thursdayOffset)),
    selectedDayCount,
    highlight,
    days,
  }
}

export function buildCalendarMonths(
  dates: readonly Date[],
  occurrences: ReadonlyMap<string, number>,
  weekStartsOn: WeekStartsOn,
  maxMonths = MAX_MONTHS,
): CalendarBuildResult {
  if (dates.length === 0) return { months: [], rangeError: null }

  const firstDate = d.min(Array.from(dates))
  const lastDate = d.max(Array.from(dates))
  const firstMonth = d.startOfMonth(firstDate)
  const lastMonth = d.startOfMonth(lastDate)
  const monthCount = d.differenceInCalendarMonths(lastMonth, firstMonth) + 1

  if (monthCount > maxMonths) {
    return {
      months: [],
      rangeError: `The selected range spans ${monthCount} months; the maximum is ${maxMonths}.`,
    }
  }

  const weekOptions = { weekStartsOn }
  const firstSelectedWeek = d.startOfWeek(firstDate, weekOptions)
  const lastSelectedWeek = d.startOfWeek(lastDate, weekOptions)
  const months = d.eachMonthOfInterval({ start: firstMonth, end: lastMonth }).map(month => {
    const gridStart = d.startOfWeek(d.startOfMonth(month), weekOptions)
    const gridEnd = d.endOfWeek(d.endOfMonth(month), weekOptions)
    const weeks = d.eachWeekOfInterval(
      { start: gridStart, end: gridEnd },
      weekOptions,
    ).map(weekStart => buildWeek(
      weekStart,
      month,
      weekStartsOn,
      occurrences,
      firstSelectedWeek,
      lastSelectedWeek,
    ))

    return {
      key: d.format(month, 'yyyy-MM'),
      title: d.format(month, 'MMMM yyyy'),
      hasSelection: dates.some(date => d.isSameMonth(date, month)),
      weeks,
    }
  })

  return { months, rangeError: null }
}
