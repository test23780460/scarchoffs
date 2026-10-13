import { describe, expect, it } from 'vitest'
import { activitySchema, csv, cumulative, net, spending, totals } from './lib'
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
})
