import { describe, expect, it } from 'vitest'
import { activitySchema, cents, csv, cumulative, net, previousComparableRange, spending, totals } from './lib'
import type { Activity } from './lib'

const activity = (
  id: string,
  spent: number,
  payout: number,
  fees = 0,
  status: 'settled' | 'pending' = 'settled',
): Activity => ({
  id,
  kind: 'game',
  name: 'Test game',
  category: 'Game session',
  occurred_on: '2026-10-12',
  spent_cents: spent,
  payout_cents: payout,
  fees_cents: fees,
  quantity: 1,
  duration_minutes: null,
  status,
  location: '',
  notes: '',
  image_path: null,
})

describe('financial calculations', () => {
  it('subtracts wagers and fees from gross payouts', () => {
    const a = activity('a', 1000, 1400, 100)
    expect(net(a)).toBe(300)
    expect(totals([a])).toMatchObject({ spent: 1100, payout: 1400, net: 300 })
  })
  it('excludes pending activity from realized totals', () => {
    const a = activity('a', 1000, 5000, 0, 'pending')
    expect(net(a)).toBe(0)
    expect(totals([a])).toMatchObject({ spent: 0, payout: 0, net: 0, count: 1 })
  })
  it('keeps cumulative results in date order', () => {
    const a = activity('a', 1000, 0)
    const b = { ...activity('b', 500, 1500), occurred_on: '2026-10-11' }
    expect(cumulative([a, b]).map((p) => p.balance)).toEqual([1000, 0])
  })
  it('uses one closing balance per day and excludes pending results from the chart', () => {
    expect(
      cumulative([
        activity('a', 500, 0),
        activity('b', 1000, 2000),
        { ...activity('c', 900, 0, 0, 'pending'), kind: 'other' },
      ]),
    ).toEqual([{ date: '2026-10-12', balance: 500, name: 'Daily closing result' }])
  })
  it('compares month-to-date results without rolling a shorter month into the next month', () => {
    expect(previousComparableRange('month', '', '', new Date(2026, 2, 31))).toMatchObject({
      start: '2026-02-01',
      end: '2026-02-28',
    })
  })
  it('compares a custom range with an equally long preceding range', () => {
    expect(previousComparableRange('custom', '2026-10-10', '2026-10-15')).toMatchObject({
      start: '2026-10-04',
      end: '2026-10-09',
    })
    expect(previousComparableRange('all')).toBeNull()
    expect(previousComparableRange('custom', '2026-10-15', '2026-10-10')).toBeNull()
  })
  it('stores decimal input as cents including zero payouts', () => {
    expect(cents('75.50')).toBe(7550)
    expect(cents('2.25')).toBe(225)
    expect(cents('')).toBe(0)
    expect(activitySchema.safeParse({ ...activity('a', 500, 0), kind: 'scratch' }).success).toBe(true)
  })
  it('counts pending wagers toward spending boundaries', () => {
    expect(spending([activity('a', 1000, 0, 100, 'pending')])).toBe(1100)
  })
  it('rejects transfers as gambling activity', () => {
    expect(
      activitySchema.safeParse({ ...activity('a', 1000, 0), kind: 'other', name: 'Bank transfer' }).success,
    ).toBe(false)
  })
  it('neutralizes spreadsheet formulas in exports', () => {
    expect(csv([{ ...activity('a', 1000, 0), notes: '=1+1' }])).toContain('"\'=1+1"')
  })
  it('reserves pending status for other gambling', () => {
    expect(activitySchema.safeParse({ ...activity('a', 1000, 0), status: 'pending' }).success).toBe(false)
  })
})
