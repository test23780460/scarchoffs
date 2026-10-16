import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

export type Kind = 'scratch' | 'game' | 'other'
export type Status = 'settled' | 'pending'
export type Activity = {
  id: string
  user_id?: string
  kind: Kind
  name: string
  category: string
  occurred_on: string
  spent_cents: number
  payout_cents: number
  fees_cents: number
  quantity: number
  duration_minutes: number | null
  status: Status
  location: string
  notes: string
  image_path: string | null
  created_at?: string
}
export type Limits = { weekly_cents: number | null; monthly_cents: number | null }

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const cloudEnabled = Boolean(url && key)
export const supabase = cloudEnabled ? createClient(url!, key!) : null

export const activitySchema = z
  .object({
    kind: z.enum(['scratch', 'game', 'other']),
    name: z.string().trim().min(1, 'Enter a name').max(100),
    category: z.string().trim().max(60),
    occurred_on: z.iso.date(),
    spent_cents: z.number().int().min(0).max(100000000000),
    payout_cents: z.number().int().min(0).max(100000000000),
    fees_cents: z.number().int().min(0).max(100000000000),
    quantity: z.number().int().min(1).max(100000),
    duration_minutes: z.number().int().min(0).max(100000).nullable(),
    status: z.enum(['settled', 'pending']),
    location: z.string().trim().max(120),
    notes: z.string().trim().max(2000),
    image_path: z.string().nullable(),
  })
  .refine(
    (a) => a.kind !== 'other' || !/\b(deposit|withdrawal|transfer)\b/i.test(`${a.name} ${a.category}`),
    { message: 'Record wagers and payouts, not deposits, withdrawals, or transfers.', path: ['name'] },
  )
  .refine((a) => a.status === 'settled' || a.kind === 'other', {
    message: 'Pending status is available for other gambling only.',
    path: ['status'],
  })

export const cents = (value: string | number) => Math.round(Number(value || 0) * 100)
export const money = (value: number, digits = 2) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value / 100)
export const signedMoney = (value: number) =>
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${money(Math.abs(value))}`
export const net = (a: Activity) =>
  a.status === 'settled' ? a.payout_cents - a.spent_cents - a.fees_cents : 0
export const realized = (a: Activity) => a.status === 'settled'
export const spending = (items: Activity[]) => items.reduce((n, a) => n + a.spent_cents + a.fees_cents, 0)
export const totals = (items: Activity[]) => {
  const settled = items.filter(realized)
  const spent = settled.reduce((n, a) => n + a.spent_cents + a.fees_cents, 0)
  const payout = settled.reduce((n, a) => n + a.payout_cents, 0)
  return {
    spent,
    payout,
    net: payout - spent,
    count: items.length,
    returnRate: spent ? (payout / spent) * 100 : 0,
  }
}
export const startOfWeek = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}
export const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const prettyDate = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
export const periodStart = (period: string, now = new Date()) => {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (period === 'week') return localDate(startOfWeek(d))
  if (period === 'month') return localDate(new Date(d.getFullYear(), d.getMonth(), 1))
  if (period === 'year') return localDate(new Date(d.getFullYear(), 0, 1))
  return '0000-01-01'
}
export const cumulative = (items: Activity[]) => {
  let balance = 0
  const daily = new Map<string, number>()
  for (const a of [...items].filter(realized).sort((a, b) => a.occurred_on.localeCompare(b.occurred_on))) {
    balance += net(a)
    daily.set(a.occurred_on, balance)
  }
  return [...daily].map(([date, balance]) => ({ date, balance, name: 'Daily closing result' }))
}
export const previousComparableRange = (period: string, start = '', end = '', now = new Date()) => {
  const year = now.getFullYear(),
    month = now.getMonth(),
    day = now.getDate()
  if (period === 'month') {
    const lastDay = new Date(year, month, 0).getDate()
    return {
      start: localDate(new Date(year, month - 1, 1)),
      end: localDate(new Date(year, month - 1, Math.min(day, lastDay))),
      label: 'vs last month to date',
    }
  }
  if (period === 'year') {
    const lastDay = new Date(year - 1, month + 1, 0).getDate()
    return {
      start: localDate(new Date(year - 1, 0, 1)),
      end: localDate(new Date(year - 1, month, Math.min(day, lastDay))),
      label: 'vs last year to date',
    }
  }
  if (period === 'week') {
    const beginning = startOfWeek(now)
    beginning.setDate(beginning.getDate() - 7)
    const finish = new Date(year, month, day - 7)
    return { start: localDate(beginning), end: localDate(finish), label: 'vs last week to date' }
  }
  if (period === 'custom' && start && end && start <= end) {
    const duration = (Date.parse(end) - Date.parse(start)) / 86400000 + 1
    const beginning = new Date(`${start}T12:00:00`)
    const finish = new Date(beginning)
    beginning.setDate(beginning.getDate() - duration)
    finish.setDate(finish.getDate() - 1)
    return { start: localDate(beginning), end: localDate(finish), label: 'vs previous period' }
  }
  return null
}
export const csv = (items: Activity[]) => {
  const columns: (keyof Activity)[] = [
    'occurred_on',
    'kind',
    'name',
    'category',
    'status',
    'quantity',
    'spent_cents',
    'payout_cents',
    'fees_cents',
    'duration_minutes',
    'location',
    'notes',
  ]
  const quote = (v: unknown) => {
    const value = String(v ?? '')
    return `"${(/^[=+\-@]/.test(value) ? `'${value}` : value).replaceAll('"', '""')}"`
  }
  return [columns.join(','), ...items.map((a) => columns.map((k) => quote(a[k])).join(','))].join('\r\n')
}
