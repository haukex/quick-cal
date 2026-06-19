import './styles.css'

import {
  buildCalendarMonths,
  parseDateInput,
  type CalendarDay,
  type CalendarMonth,
  type CalendarWeek,
  type WeekStartsOn,
} from './calendar'

const datesElement = document.querySelector('#dates')
if (!(datesElement instanceof HTMLTextAreaElement)) throw new Error('Missing dates input.')
const datesInput = datesElement

const formatElement = document.querySelector('#date-format')
if (!(formatElement instanceof HTMLInputElement)) throw new Error('Missing date format input.')
const formatInput = formatElement

const feedbackElement = document.querySelector('#input-feedback')
if (!(feedbackElement instanceof HTMLDivElement)) throw new Error('Missing input feedback.')
const feedback = feedbackElement

const statusElement = document.querySelector('#calendar-status')
if (!(statusElement instanceof HTMLParagraphElement)) throw new Error('Missing calendar status.')
const calendarStatus = statusElement

const calendarElement = document.querySelector('#calendar')
if (!(calendarElement instanceof HTMLDivElement)) throw new Error('Missing calendar container.')
const calendar = calendarElement

const WEEKDAY_NAMES = {
  0: [
    ['S', 'Sunday'],
    ['M', 'Monday'],
    ['T', 'Tuesday'],
    ['W', 'Wednesday'],
    ['T', 'Thursday'],
    ['F', 'Friday'],
    ['S', 'Saturday'],
  ],
  1: [
    ['M', 'Monday'],
    ['T', 'Tuesday'],
    ['W', 'Wednesday'],
    ['T', 'Thursday'],
    ['F', 'Friday'],
    ['S', 'Saturday'],
    ['S', 'Sunday'],
  ],
} as const

function makeElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName)
  if (className !== undefined) element.className = className
  if (text !== undefined) element.textContent = text
  return element
}

function selectedWeekStart(): WeekStartsOn {
  const selected = document.querySelector('input[name="week-start"]:checked')
  return selected instanceof HTMLInputElement && selected.value === '0' ? 0 : 1
}

function setFeedback(messages: readonly string[]): void {
  feedback.replaceChildren()
  feedback.hidden = messages.length === 0
  if (messages.length === 0) return

  const heading = makeElement('p', 'input-feedback__heading', 'Please fix the following:')
  const list = makeElement('ul')
  for (const message of messages) list.append(makeElement('li', undefined, message))
  feedback.append(heading, list)
}

function setCalendarStatus(message: string): void {
  calendar.replaceChildren()
  calendarStatus.textContent = message
  calendarStatus.hidden = false
}

function renderDay(day: CalendarDay): HTMLTableCellElement {
  const cell = makeElement('td', day.inMonth ? 'day' : 'day day--outside')
  if (!day.inMonth) {
    cell.setAttribute('aria-hidden', 'true')
    return cell
  }

  const occurrenceText = day.occurrences === 1
    ? ', selected once'
    : day.occurrences > 1
      ? `, selected ${day.occurrences} times`
      : ''
  cell.setAttribute('aria-label', `${day.label}${occurrenceText}`)
  if (day.occurrences > 0) {
    const times = day.occurrences === 1 ? 'time' : 'times'
    cell.title = `${day.dateKey} — appears ${day.occurrences} ${times} in the list`
  } else {
    cell.title = day.dateKey
  }

  const dayNumber = makeElement('span', 'day__number', String(day.dayNumber))
  if (day.occurrences === 1) dayNumber.classList.add('day__number--single')
  if (day.occurrences > 1) dayNumber.classList.add('day__number--multiple')
  cell.append(dayNumber)
  return cell
}

function renderWeek(week: CalendarWeek): HTMLTableRowElement {
  const row = makeElement('tr')
  const highlightClass = week.highlight === null ? '' : ` week-number--${week.highlight}`
  const weekClass = `week-number${highlightClass}`
  const weekNumber = makeElement('th', weekClass, String(week.isoWeek))
  weekNumber.scope = 'row'
  const selectedDays = week.highlight === 'single'
    ? ' — 1 selected day'
    : week.highlight === 'multiple'
      ? ` — ${week.selectedDayCount} selected days`
      : week.highlight === 'gap'
        ? ' — 0 selected days'
        : ''
  weekNumber.title = `WK ${String(week.isoWeek)}${selectedDays}`
  const highlightLabel = week.highlight === 'single'
    ? ', one selected day'
    : week.highlight === 'multiple'
      ? `, ${week.selectedDayCount} selected days`
      : week.highlight === 'gap'
        ? ', no selected days'
        : ''
  weekNumber.setAttribute('aria-label', `Week ${week.isoWeek}${highlightLabel}`)
  row.append(weekNumber, ...week.days.map(renderDay))
  return row
}

function renderMonth(month: CalendarMonth, weekStartsOn: WeekStartsOn): HTMLElement {
  const article = makeElement('article', 'month')
  const table = makeElement('table')
  const captionClass = month.hasSelection ? 'month__title month__title--selected' : 'month__title'
  table.append(makeElement('caption', captionClass, month.title))

  const header = makeElement('thead')
  const headerRow = makeElement('tr')
  const weekHeading = makeElement('th', 'week-heading', 'Wk')
  weekHeading.scope = 'col'
  weekHeading.title = 'ISO 8601 week number'
  weekHeading.setAttribute('aria-label', 'ISO 8601 week number')
  headerRow.append(weekHeading)

  for (const [letter, name] of WEEKDAY_NAMES[weekStartsOn]) {
    const weekday = makeElement('th', 'weekday', letter)
    weekday.scope = 'col'
    weekday.title = name
    weekday.setAttribute('aria-label', name)
    headerRow.append(weekday)
  }
  header.append(headerRow)

  const body = makeElement('tbody')
  body.append(...month.weeks.map(renderWeek))
  table.append(header, body)
  article.append(table)
  return article
}

function render(): void {
  const parsed = parseDateInput(datesInput.value, formatInput.value)
  const messages: string[] = []

  if (parsed.formatError !== null) messages.push(`Date format: ${parsed.formatError}`)
  for (const error of parsed.errors) {
    messages.push(`Line ${error.line} (“${error.value}”): ${error.message}`)
  }

  if (messages.length > 0) {
    setFeedback(messages)
    setCalendarStatus('The calendar cannot be rendered until the input errors are corrected.')
    return
  }

  const weekStartsOn = selectedWeekStart()
  const result = buildCalendarMonths(parsed.dates, parsed.occurrences, weekStartsOn)
  if (result.rangeError !== null) {
    setFeedback([result.rangeError])
    setCalendarStatus('The requested date range is too large to render.')
    return
  }

  setFeedback([])
  if (result.months.length === 0) {
    setCalendarStatus('Enter at least one date to build a calendar.')
    return
  }

  calendarStatus.hidden = true
  calendar.replaceChildren(...result.months.map(month => renderMonth(month, weekStartsOn)))
}

const COMMIT_INPUT_TYPES = new Set([
  // https://w3c.github.io/input-events/#interface-InputEvent-Attributes
  'insertLineBreak',
  'insertParagraph',
  'insertFromPaste',
  'insertFromDrop',
  'deleteByCut',
  'historyUndo',
  'historyRedo',
])

datesInput.addEventListener('input', event => {
  if (event instanceof InputEvent && COMMIT_INPUT_TYPES.has(event.inputType)) render()
})
datesInput.addEventListener('change', render)
formatInput.addEventListener('change', render)
for (const radio of document.querySelectorAll('input[name="week-start"]')) {
  radio.addEventListener('change', render)
}

render()
