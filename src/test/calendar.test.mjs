import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  MAX_MONTHS,
  buildCalendarMonths,
  parseDateInput,
} from '../calendar.ts'

const TODAY = new Date(2026, 5, 18, 12)

function validInput(input, dateFormat) {
  const result = parseDateInput(input, dateFormat, TODAY)
  assert.equal(result.formatError, null)
  assert.deepEqual(result.errors, [])
  return result
}

describe('parseDateInput', () => {
  it('uses date-fns formats and ignores blank lines', () => {
    const iso = validInput('\n2024-01-05\n', 'yyyy-MM-dd')
    const european = validInput('5.1.2024', 'd.M.yyyy')
    const american = validInput('01/05/2024', 'MM/dd/yyyy')

    assert.deepEqual([...iso.occurrences.keys()], ['2024-01-05'])
    assert.deepEqual([...european.occurrences.keys()], ['2024-01-05'])
    assert.deepEqual([...american.occurrences.keys()], ['2024-01-05'])
  })

  it('resolves two-digit years to the latest non-future year', () => {
    const result = validInput('06/18/26\n06/18/27\n06/18/00\n06/18/99', 'MM/dd/yy')

    assert.deepEqual([...result.occurrences.keys()], [
      '2026-06-18',
      '1927-06-18',
      '2000-06-18',
      '1999-06-18',
    ])
  })

  it('counts duplicate dates', () => {
    const result = validInput('2024-02-29\n2024-02-29', 'yyyy-MM-dd')
    assert.equal(result.occurrences.get('2024-02-29'), 2)
    assert.equal(result.dates.length, 2)
  })

  it('reports impossible dates by line', () => {
    const result = parseDateInput('2024-02-29\n2023-02-29', 'yyyy-MM-dd', TODAY)

    assert.equal(result.formatError, null)
    assert.equal(result.errors.length, 1)
    assert.equal(result.errors[0]?.line, 2)
    assert.equal(result.errors[0]?.value, '2023-02-29')
  })

  it('reports malformed or protected date-fns formats', () => {
    const result = parseDateInput('2024-01-05', 'YYYY-MM-DD', TODAY)

    assert.notEqual(result.formatError, null)
    assert.equal(result.dates.length, 0)
  })
})

describe('buildCalendarMonths', () => {
  it('builds the inclusive month range and marks selected months', () => {
    const parsed = validInput('2024-01-31\n2024-03-01', 'yyyy-MM-dd')
    const result = buildCalendarMonths(parsed.dates, parsed.occurrences, 1)

    assert.equal(result.rangeError, null)
    assert.deepEqual(result.months.map(month => month.key), [
      '2024-01',
      '2024-02',
      '2024-03',
    ])
    assert.deepEqual(result.months.map(month => month.hasSelection), [true, false, true])
  })

  it('uses ISO weeks across the ISO week-year boundary', () => {
    const parsed = validInput('2020-12-31\n2021-01-01', 'yyyy-MM-dd')
    const result = buildCalendarMonths(parsed.dates, parsed.occurrences, 1)
    const january = result.months.find(month => month.key === '2021-01')
    const selectedWeek = january?.weeks.find(week => week.hasSelection)

    assert.equal(selectedWeek?.isoWeek, 53)
  })

  it('labels Sunday-first rows using the row Thursday', () => {
    const parsed = validInput('2021-01-01', 'yyyy-MM-dd')
    const result = buildCalendarMonths(parsed.dates, parsed.occurrences, 0)
    const firstWeek = result.months[0]?.weeks[0]

    assert.equal(firstWeek?.days[0]?.dateKey, '2020-12-27')
    assert.equal(firstWeek?.isoWeek, 53)
    assert.equal(firstWeek?.hasSelection, true)
  })

  it('allows 600 months and rejects 601 months', () => {
    const accepted = validInput('2000-01-01\n2049-12-01', 'yyyy-MM-dd')
    const rejected = validInput('2000-01-01\n2050-01-01', 'yyyy-MM-dd')

    assert.equal(
      buildCalendarMonths(accepted.dates, accepted.occurrences, 1).months.length,
      MAX_MONTHS,
    )
    assert.match(
      buildCalendarMonths(rejected.dates, rejected.occurrences, 1).rangeError ?? '',
      /601 months/u,
    )
  })
})
