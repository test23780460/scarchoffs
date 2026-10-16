import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Activity as ActivityIcon,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Check,
  CircleMinus,
  Coins,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Cloud,
  Download,
  Gamepad2,
  Goal,
  LayoutDashboard,
  LayoutGrid,
  List,
  LockKeyhole,
  LogOut,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Ticket,
  Trash2,
  WalletCards,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  activitySchema,
  cents,
  cloudEnabled,
  csv,
  cumulative,
  localDate,
  money,
  net,
  periodStart,
  prettyDate,
  previousComparableRange,
  realized,
  signedMoney,
  spending,
  startOfWeek,
  supabase,
  totals,
} from './lib'
import type { Activity, Kind, Limits } from './lib'
import { Button } from './components/ui/button'
import { MoneyInput } from './components/MoneyInput'

type Page = 'overview' | 'scratch' | 'game' | 'other' | 'history' | 'analytics' | 'limits' | 'settings'
type Period = 'week' | 'month' | 'year' | 'all' | 'custom'
type Draft = Omit<Activity, 'id' | 'user_id' | 'created_at'>
const today = () => localDate(new Date())
const blank = (kind: Kind = 'scratch'): Draft => ({
  kind,
  name: '',
  category: kind === 'scratch' ? 'Scratch-off' : kind === 'game' ? 'Game session' : 'Other',
  occurred_on: today(),
  spent_cents: 0,
  payout_cents: 0,
  fees_cents: 0,
  quantity: 1,
  duration_minutes: null,
  status: 'settled',
  location: '',
  notes: '',
  image_path: null,
})
const nav: { id: Page; label: string; icon: LucideIcon; section: 'workspace' | 'manage' }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, section: 'workspace' },
  { id: 'scratch', label: 'Scratch-offs', icon: Ticket, section: 'workspace' },
  { id: 'game', label: 'Game sessions', icon: Gamepad2, section: 'workspace' },
  { id: 'other', label: 'Other gambling', icon: WalletCards, section: 'workspace' },
  { id: 'history', label: 'Activity history', icon: ActivityIcon, section: 'manage' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, section: 'manage' },
  { id: 'limits', label: 'Spending limits', icon: Goal, section: 'manage' },
  { id: 'settings', label: 'Settings', icon: Settings2, section: 'manage' },
]
const kindMeta: Record<Kind, { label: string; icon: LucideIcon; className: string }> = {
  scratch: { label: 'Scratch-offs', icon: Ticket, className: 'gold' },
  game: { label: 'Game sessions', icon: Gamepad2, className: 'purple' },
  other: { label: 'Other gambling', icon: WalletCards, className: 'mint' },
}
const sectionCopy: Record<Page, { eyebrow: string; title: string; description: string }> = {
  overview: {
    eyebrow: 'YOUR PERSONAL LEDGER',
    title: 'Your play, in perspective.',
    description: 'Every ticket, every session. All of your numbers in one place.',
  },
  scratch: {
    eyebrow: 'TICKET LEDGER',
    title: 'Scratch-offs',
    description: 'Every ticket purchase and prize, kept in one place.',
  },
  game: {
    eyebrow: 'SESSION JOURNAL',
    title: 'Game sessions',
    description: 'Understand the cost and outcome of each recorded session.',
  },
  other: {
    eyebrow: 'FLEXIBLE RECORDS',
    title: 'Other gambling',
    description: 'Track the activities that do not fit anywhere else.',
  },
  history: {
    eyebrow: 'COMPLETE RECORD',
    title: 'Activity history',
    description: 'Find, review, and update every entry in your ledger.',
  },
  analytics: {
    eyebrow: 'DEEPER CONTEXT',
    title: 'Analytics',
    description: 'Explore trends behind your recorded activity.',
  },
  limits: {
    eyebrow: 'STAY INFORMED',
    title: 'Spending limits',
    description: 'Set personal spending boundaries and monitor your progress.',
  },
  settings: { eyebrow: 'YOUR ACCOUNT', title: 'Settings', description: 'Manage your data and account.' },
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <div className="brand-mark">
        <span />
        <span />
        <span />
      </div>
      {!compact && (
        <div className="brand-word">
          Play<span>Ledger</span>
          <small>YOUR PERSONAL LEDGER</small>
        </div>
      )}
    </div>
  )
}
function IconBubble({ kind, size = 'normal' }: { kind: Kind; size?: 'normal' | 'large' }) {
  const MetaIcon = kindMeta[kind].icon
  return (
    <span className={`icon-bubble ${kindMeta[kind].className} ${size}`}>
      <MetaIcon size={size === 'large' ? 23 : 18} strokeWidth={1.8} />
    </span>
  )
}
function Delta({ value, large = false }: { value: number; large?: boolean }) {
  return (
    <span
      className={`delta ${value < 0 ? 'negative' : value > 0 ? 'positive' : 'neutral'} ${large ? 'large' : ''}`}
    >
      {signedMoney(value)}
    </span>
  )
}
function Outcome({ activity }: { activity: Activity }) {
  const result =
    activity.status === 'pending'
      ? 'Pending'
      : activity.payout_cents === 0
        ? activity.kind === 'scratch'
          ? 'No prize'
          : 'No payout'
        : net(activity) > 0
          ? 'Net gain'
          : net(activity) === 0
            ? 'Break even'
            : 'Net loss'
  const tone =
    activity.status === 'pending'
      ? 'pending'
      : net(activity) > 0
        ? 'gain'
        : net(activity) < 0
          ? 'loss'
          : 'even'
  return (
    <span className={`outcome ${tone}`}>
      <i />
      {result}
    </span>
  )
}
function ActivityResult({ activity }: { activity: Activity }) {
  return activity.status === 'pending' ? (
    <span className="pending-result" aria-label="Pending result">
      —
    </span>
  ) : (
    <Delta value={net(activity)} />
  )
}
function Empty({
  icon: Icon = Sparkles,
  title,
  body,
  action,
  onAction,
}: {
  icon?: LucideIcon
  title: string
  body: string
  action?: string
  onAction?: () => void
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon size={23} strokeWidth={1.5} />
      </span>
      <h3>{title}</h3>
      <p>{body}</p>
      {action && (
        <button className="button secondary" onClick={onAction}>
          <Plus size={16} />
          {action}
        </button>
      )}
    </div>
  )
}
function Stat({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <strong className={tone || ''}>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  )
}
function ChartTooltip({
  active,
  payload,
  label,
  mode = 'money',
}: {
  active?: boolean
  payload?: { value: number; name: string; color?: string }[]
  label?: string
  mode?: 'money' | 'count'
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <small>{label && /^\d{4}-/.test(label) ? prettyDate(label) : label}</small>
      {payload.map((p, i) => (
        <div key={i}>
          <i style={{ background: p.color || '#c3e88d' }} />
          {p.name}
          <strong>{mode === 'money' ? money(p.value) : p.value}</strong>
        </div>
      ))}
    </div>
  )
}
function PerformanceChart({ items, height = 270 }: { items: Activity[]; height?: number }) {
  const gradientId = useId().replaceAll(':', '')
  const points = cumulative(items)
  if (!points.length)
    return (
      <div className="chart-empty" style={{ height }}>
        <div className="chart-empty-line" />
        <div className="chart-empty-message">
          <BarChart3 size={24} strokeWidth={1.5} />
          <strong>Your story starts with one entry</strong>
          <span>Record an activity to see your results take shape.</span>
        </div>
      </div>
    )
  const startDate = new Date(`${points[0].date}T12:00:00`)
  startDate.setDate(startDate.getDate() - 1)
  const data = [{ date: localDate(startDate), balance: 0, name: 'Start' }, ...points]
  const negative = data[data.length - 1].balance < 0
  return (
    <div style={{ height }} className="chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 13, right: 9, left: -7, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={negative ? '#ed948b' : '#c3e88d'} stopOpacity="0.19" />
              <stop offset="100%" stopColor={negative ? '#ed948b' : '#c3e88d'} stopOpacity="0" />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#33382f" strokeDasharray="3 6" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="#89937f"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            minTickGap={30}
            tickFormatter={(v: string) =>
              new Date(`${v}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            }
          />
          <YAxis
            domain={[(min: number) => Math.min(0, min), (max: number) => Math.max(0, max)]}
            stroke="#89937f"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            tickFormatter={(v: number) => `${v < 0 ? '−' : ''}$${Math.abs(v / 100).toFixed(0)}`}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#8d9d7d', strokeDasharray: '3 4' }} />
          <Area
            type="monotone"
            dataKey="balance"
            name="Net result"
            stroke={negative ? '#ed948b' : '#c3e88d'}
            strokeWidth={2.5}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 5, fill: negative ? '#ed948b' : '#c3e88d', stroke: '#191e16', strokeWidth: 3 }}
          />
          <ReferenceLine y={0} stroke="#69746b" strokeDasharray="4 5" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function Auth({ onReady, recovery = false }: { onReady: () => void; recovery?: boolean }) {
  const [mode, setMode] = useState<'login' | 'register' | 'reset' | 'update'>(recovery ? 'update' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setMessage('')
    try {
      if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${location.origin}${location.pathname}`,
        })
        if (error) throw error
        setMessage('Check your email for a reset link.')
      } else if (mode === 'register') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${location.origin}${location.pathname}` },
        })
        if (error) throw error
        setMessage('Check your email to confirm your account, then sign in.')
      } else if (mode === 'update') {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        setMessage('Password updated. You can continue to your ledger.')
        onReady()
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        onReady()
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="auth-layout">
      <div className="auth-left">
        <Brand />
        <div>
          <span className="eyebrow">PERSONAL FINANCIAL CLARITY</span>
          <h1>
            Keep the record.
            <br />
            <em>See the whole picture.</em>
          </h1>
          <p>
            Track your gambling spending and payouts in one private, thoughtful ledger. Know exactly where
            your numbers stand.
          </p>
          <div className="auth-features">
            <span>
              <ShieldCheck size={16} /> Private by design
            </span>
            <span>
              <BarChart3 size={16} /> Clear financial trends
            </span>
          </div>
        </div>
        <small>PlayLedger is a recordkeeping tool. It does not offer gambling or predict outcomes.</small>
      </div>
      <div className="auth-right">
        <form className="auth-card" onSubmit={submit}>
          <div className="mobile-brand">
            <Brand />
          </div>
          <span className="eyebrow">WELCOME TO PLAYLEDGER</span>
          <h2>
            {mode === 'login'
              ? 'Sign in to your ledger'
              : mode === 'register'
                ? 'Create your account'
                : mode === 'update'
                  ? 'Choose a new password'
                  : 'Reset your password'}
          </h2>
          <p>
            {mode === 'reset'
              ? 'We’ll send a reset link to your email.'
              : mode === 'update'
                ? 'Enter a new password to finish recovery.'
                : 'Your activity stays yours.'}
          </p>
          {mode !== 'update' && (
            <label>
              Email address
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </label>
          )}
          {mode !== 'reset' && (
            <label>
              {mode === 'update' ? 'New password' : 'Password'}
              <input
                type="password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </label>
          )}
          {message && <div className="form-message">{message}</div>}
          <button className="button primary full" disabled={busy}>
            {busy
              ? 'Please wait…'
              : mode === 'login'
                ? 'Sign in'
                : mode === 'register'
                  ? 'Create account'
                  : mode === 'update'
                    ? 'Update password'
                    : 'Send reset link'}
            <ArrowRight size={16} />
          </button>
          <div className="auth-links">
            {mode === 'login' ? (
              <>
                <button type="button" onClick={() => setMode('register')}>
                  Create account
                </button>
                <button type="button" onClick={() => setMode('reset')}>
                  Forgot password?
                </button>
              </>
            ) : mode !== 'update' ? (
              <button type="button" onClick={() => setMode('login')}>
                Back to sign in
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  )
}

function EntryDialog({
  open,
  onOpenChange,
  initial,
  defaultKind,
  onSave,
  suggestions,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  initial: Activity | null
  defaultKind: Kind
  onSave: (draft: Draft, id?: string, file?: File) => Promise<void>
  suggestions: Activity[]
}) {
  const nameRef = useRef<HTMLInputElement>(null)
  const [payoutMode, setPayoutMode] = useState<'none' | 'payout'>('none')
  const [notice, setNotice] = useState('')
  const [draft, setDraft] = useState<Draft>(blank(defaultKind))
  const [detailed, setDetailed] = useState(false)
  const [file, setFile] = useState<File | undefined>()
  const [imageUrl, setImageUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (open) {
      setDraft(initial ? { ...initial } : blank(defaultKind))
      setDetailed(
        Boolean(
          initial?.notes ||
          initial?.fees_cents ||
          initial?.image_path ||
          initial?.location ||
          initial?.duration_minutes,
        ),
      )
      setPayoutMode(initial?.payout_cents ? 'payout' : 'none')
      setNotice('')
      setFile(undefined)
      setError('')
    }
  }, [open, initial, defaultKind])
  useEffect(() => {
    setImageUrl('')
    if (!open || !initial?.image_path || !supabase) return
    let active = true
    supabase.storage
      .from('ticket-images')
      .createSignedUrl(initial.image_path, 60)
      .then(({ data }) => {
        if (active && data?.signedUrl) setImageUrl(data.signedUrl)
      })
    return () => {
      active = false
    }
  }, [open, initial?.image_path])
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }))
  async function submit(e: FormEvent) {
    e.preventDefault()
    const addAnother = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'another'
    const result = activitySchema.safeParse(draft)
    if (!result.success) {
      setError(result.error.issues[0]?.message || 'Check your entry.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onSave(result.data, initial?.id, file)
      if (addAnother && !initial) {
        setDraft({ ...blank(draft.kind), occurred_on: draft.occurred_on })
        setPayoutMode('none')
        setFile(undefined)
        setDetailed(false)
        setNotice(`${draft.name} saved. Ready for your next entry.`)
        nameRef.current?.focus()
      } else onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this entry.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="entry-dialog">
          <div className="dialog-heading">
            <div>
              <span className="eyebrow">{initial ? 'UPDATE RECORD' : 'NEW RECORD'}</span>
              <Dialog.Title>{initial ? 'Edit activity' : 'Add activity'}</Dialog.Title>
              <Dialog.Description>A quick record today. A clearer picture over time.</Dialog.Description>
            </div>
            <Dialog.Close className="icon-button" aria-label="Close">
              <X size={19} />
            </Dialog.Close>
          </div>
          <form onSubmit={submit} className="entry-form">
            <div className="segment kind-segment">
              {(['scratch', 'game', 'other'] as Kind[]).map((k) => (
                <button
                  type="button"
                  className={draft.kind === k ? 'active' : ''}
                  key={k}
                  aria-pressed={draft.kind === k}
                  onClick={() => {
                    setPayoutMode('none')
                    setDraft((d) =>
                      d.kind === k
                        ? d
                        : {
                            ...d,
                            kind: k,
                            category: blank(k).category,
                            status: 'settled',
                            payout_cents: 0,
                            quantity: 1,
                            duration_minutes: k === 'game' ? d.duration_minutes : null,
                            image_path: k === 'scratch' ? d.image_path : null,
                          },
                    )
                  }}
                >
                  {k === 'scratch' ? (
                    <Ticket size={16} />
                  ) : k === 'game' ? (
                    <Gamepad2 size={16} />
                  ) : (
                    <WalletCards size={16} />
                  )}{' '}
                  {kindMeta[k].label}
                </button>
              ))}
            </div>
            {notice && (
              <div className="entry-notice" role="status">
                <Check size={16} />
                {notice}
              </div>
            )}
            <div className="form-grid">
              <label className={draft.kind === 'scratch' ? '' : 'span-2'}>
                {draft.kind === 'scratch'
                  ? 'Ticket name'
                  : draft.kind === 'game'
                    ? 'Game name'
                    : 'Activity name'}
                <input
                  ref={nameRef}
                  autoFocus
                  list="entry-name-suggestions"
                  value={draft.name}
                  onChange={(e) => {
                    set('name', e.target.value)
                    setNotice('')
                  }}
                  placeholder={
                    draft.kind === 'scratch'
                      ? 'e.g. Golden Ticket'
                      : draft.kind === 'game'
                        ? 'e.g. Poker'
                        : 'e.g. Sports wager'
                  }
                  required
                  maxLength={100}
                />
              </label>
              {draft.kind === 'scratch' && (
                <label>
                  Date
                  <input
                    type="date"
                    value={draft.occurred_on}
                    max={today()}
                    onChange={(e) => set('occurred_on', e.target.value)}
                    required
                  />
                </label>
              )}
              <datalist id="entry-name-suggestions">
                {[...new Set(suggestions.filter((a) => a.kind === draft.kind).map((a) => a.name))].map(
                  (name) => (
                    <option value={name} key={name} />
                  ),
                )}
              </datalist>
              {draft.kind === 'scratch' && (
                <fieldset className="ticket-outcome span-2">
                  <legend>Ticket result</legend>
                  <div>
                    <button
                      type="button"
                      className={payoutMode === 'none' ? 'selected' : ''}
                      aria-pressed={payoutMode === 'none'}
                      onClick={() => {
                        setPayoutMode('none')
                        set('payout_cents', 0)
                      }}
                    >
                      <CircleMinus size={17} />
                      <span>
                        No prize<small>$0 returned</small>
                      </span>
                      {payoutMode === 'none' && <Check size={15} />}
                    </button>
                    <button
                      type="button"
                      className={payoutMode === 'payout' ? 'selected' : ''}
                      aria-pressed={payoutMode === 'payout'}
                      onClick={() => setPayoutMode('payout')}
                    >
                      <Coins size={17} />
                      <span>
                        Payout received<small>Enter the total prize</small>
                      </span>
                      {payoutMode === 'payout' && <Check size={15} />}
                    </button>
                  </div>
                </fieldset>
              )}
              <div className="cost-field">
                <div className="cost-with-quantity">
                  <label>
                    Amount {draft.kind === 'scratch' ? 'per ticket' : 'wagered'}
                    <MoneyInput
                      label={draft.kind === 'scratch' ? 'Price per ticket' : 'Amount wagered'}
                      value={
                        draft.kind === 'scratch'
                          ? Math.round(draft.spent_cents / draft.quantity)
                          : draft.spent_cents
                      }
                      onChange={(value) =>
                        set('spent_cents', value * (draft.kind === 'scratch' ? draft.quantity : 1))
                      }
                      required
                    />
                  </label>
                  {draft.kind === 'scratch' && (
                    <label>
                      Tickets
                      <input
                        aria-label="Number purchased"
                        type="number"
                        min="1"
                        max="100000"
                        value={draft.quantity}
                        onChange={(e) => {
                          const q = Math.max(1, Number(e.target.value))
                          setDraft((d) => ({
                            ...d,
                            quantity: q,
                            spent_cents: Math.round(d.spent_cents / d.quantity) * q,
                          }))
                        }}
                        required
                      />
                    </label>
                  )}
                </div>
                {draft.kind === 'scratch' && (
                  <span className="price-shortcuts">
                    {[1, 2, 5, 10, 20, 30].map((price) => (
                      <button
                        type="button"
                        key={price}
                        className={draft.spent_cents / draft.quantity === price * 100 ? 'selected' : ''}
                        onClick={() => set('spent_cents', price * 100 * draft.quantity)}
                      >
                        ${price}
                      </button>
                    ))}
                  </span>
                )}
              </div>
              <label>
                {draft.kind === 'scratch' ? 'Total prize' : 'Gross payout (if any)'}
                <MoneyInput
                  label="Gross payout"
                  value={draft.payout_cents}
                  onChange={(value) => set('payout_cents', value)}
                  disabled={draft.kind === 'scratch' && payoutMode === 'none'}
                />
                <small>
                  {draft.kind === 'scratch'
                    ? payoutMode === 'none'
                      ? 'No prize. Recorded as $0.'
                      : 'Total returned for all tickets in this entry.'
                    : 'Total amount received, including returned stakes.'}
                </small>
              </label>
              {draft.kind !== 'scratch' && (
                <label>
                  Date
                  <input
                    type="date"
                    value={draft.occurred_on}
                    max={today()}
                    onChange={(e) => set('occurred_on', e.target.value)}
                    required
                  />
                </label>
              )}
              {draft.kind === 'other' && (
                <label>
                  Status
                  <select
                    value={draft.status}
                    onChange={(e) => set('status', e.target.value as 'pending' | 'settled')}
                  >
                    <option value="settled">Settled</option>
                    <option value="pending">Pending</option>
                  </select>
                </label>
              )}
            </div>
            <button type="button" className="detail-toggle" onClick={() => setDetailed(!detailed)}>
              <SlidersHorizontal size={15} />
              {detailed ? 'Hide details' : 'Add details'}
              <ChevronDown size={14} className={detailed ? 'flip' : ''} />
            </button>
            {detailed && (
              <div className="form-grid detail-fields">
                <label>
                  Category
                  <input
                    value={draft.category}
                    onChange={(e) => set('category', e.target.value)}
                    maxLength={60}
                    placeholder="Category"
                  />
                </label>
                <label>
                  Fees
                  <MoneyInput
                    label="Fees"
                    value={draft.fees_cents}
                    onChange={(value) => set('fees_cents', value)}
                  />
                </label>
                {draft.kind === 'game' && (
                  <label>
                    Duration (minutes)
                    <input
                      type="number"
                      min="0"
                      value={draft.duration_minutes ?? ''}
                      onChange={(e) =>
                        set('duration_minutes', e.target.value ? Number(e.target.value) : null)
                      }
                    />
                  </label>
                )}
                {draft.kind === 'scratch' && (
                  <>
                    <label>
                      Location
                      <input
                        value={draft.location}
                        onChange={(e) => set('location', e.target.value)}
                        maxLength={120}
                        placeholder="Optional"
                      />
                    </label>
                    <label className="span-2">
                      Ticket image
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        disabled={!cloudEnabled}
                        onChange={(e) => setFile(e.target.files?.[0])}
                      />
                      <small>
                        {cloudEnabled
                          ? 'Private upload, up to 5 MB.'
                          : 'Cloud account required for image uploads.'}
                      </small>
                      {imageUrl && (
                        <a href={imageUrl} target="_blank" rel="noopener noreferrer">
                          View current ticket image
                        </a>
                      )}
                    </label>
                  </>
                )}
                <label className="span-2">
                  Notes
                  <textarea
                    rows={3}
                    value={draft.notes}
                    onChange={(e) => set('notes', e.target.value)}
                    maxLength={2000}
                    placeholder="Optional context about this activity"
                  />
                </label>
              </div>
            )}
            <div className="entry-summary">
              <span>
                {draft.status === 'pending'
                  ? 'Pending — excluded from realized totals'
                  : 'Calculated net result'}
              </span>
              <span className="entry-total-detail">
                <small>
                  {money(draft.spent_cents + draft.fees_cents)} cost · {money(draft.payout_cents)} returned
                </small>
                {draft.status === 'pending' ? (
                  <span className="pending-result">—</span>
                ) : (
                  <Delta value={draft.payout_cents - draft.spent_cents - draft.fees_cents} />
                )}
              </span>
            </div>
            {error && <div className="form-error">{error}</div>}
            <div className="dialog-actions">
              <Dialog.Close type="button" className="button ghost">
                Cancel
              </Dialog.Close>
              {!initial && (
                <button
                  type="submit"
                  value="another"
                  className="button secondary save-another"
                  disabled={busy}
                >
                  Save + add another
                </button>
              )}
              <button type="submit" value="save" className="button primary" disabled={busy}>
                {busy ? 'Saving…' : initial ? 'Save changes' : 'Add to ledger'}
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function App() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [authLoading, setAuthLoading] = useState(cloudEnabled)
  const [recovery, setRecovery] = useState(false)
  const [items, setItems] = useState<Activity[]>([])
  const [limits, setLimits] = useState<Limits>({ weekly_cents: null, monthly_cents: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [page, setPage] = useState<Page>(
    () => nav.find((n) => `#${n.id}` === location.hash)?.id || 'overview',
  )
  const [searchRequested, setSearchRequested] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(() => matchMedia('(max-width: 650px)').matches)
  const [entryOpen, setEntryOpen] = useState(false)
  const [editing, setEditing] = useState<Activity | null>(null)
  const [entryKind, setEntryKind] = useState<Kind>('scratch')
  const [period, setPeriod] = useState<Period>('month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'newest' | 'oldest' | 'name' | 'spend' | 'net'>('newest')
  const [filterKind, setFilterKind] = useState<'all' | Kind>('all')
  const [gameFilter, setGameFilter] = useState('all')
  const [pageNumber, setPageNumber] = useState(1)

  useEffect(() => {
    const query = matchMedia('(max-width: 650px)')
    const update = () => {
      setIsMobile(query.matches)
      if (!query.matches) setMobileOpen(false)
    }
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    if (mobileOpen) document.getElementById('mobile-close')?.focus()
  }, [mobileOpen])

  useEffect(() => {
    if (!supabase) {
      try {
        setItems(JSON.parse(localStorage.getItem('playledger:activities') || '[]'))
        setLimits(
          JSON.parse(
            localStorage.getItem('playledger:limits') || '{"weekly_cents":null,"monthly_cents":null}',
          ),
        )
      } catch {
        setError('Local data could not be loaded.')
      }
      setLoading(false)
      return
    }
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ? { id: data.user.id, email: data.user.email } : null)
      setAuthLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      setUser(session?.user ? { id: session.user.id, email: session.user.email } : null)
      setAuthLoading(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!supabase || !user) return
    let cancelled = false
    setLoading(true)
    setItems([])
    setLimits({ weekly_cents: null, monthly_cents: null })
    const client = supabase
    async function load() {
      try {
        const records: Activity[] = []
        for (let offset = 0; ; offset += 1000) {
          const { data, error } = await client
            .from('activities')
            .select('*')
            .eq('user_id', user!.id)
            .order('occurred_on', { ascending: false })
            .order('id', { ascending: false })
            .range(offset, offset + 999)
          if (error) throw error
          if (cancelled) return
          records.push(...(data as Activity[]))
          if (data.length < 1000) break
        }
        const settings = await client.from('user_settings').select('*').eq('user_id', user!.id).maybeSingle()
        if (settings.error) throw settings.error
        if (cancelled) return
        setItems(records)
        if (settings.data)
          setLimits({ weekly_cents: settings.data.weekly_cents, monthly_cents: settings.data.monthly_cents })
      } catch (error) {
        if (!cancelled)
          setError(
            error instanceof Error
              ? error.message
              : 'Your records could not be loaded. Refresh to try again.',
          )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [user?.id])
  useEffect(() => {
    if (!cloudEnabled && !loading) {
      localStorage.setItem('playledger:activities', JSON.stringify(items))
      localStorage.setItem('playledger:limits', JSON.stringify(limits))
    }
  }, [items, limits, loading])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 3500)
    return () => clearTimeout(timer)
  }, [toast])
  const filtered = useMemo(
    () =>
      items.filter(
        (a) =>
          (period === 'all' ||
            (period === 'custom'
              ? (!customStart || a.occurred_on >= customStart) && (!customEnd || a.occurred_on <= customEnd)
              : a.occurred_on >= periodStart(period))) &&
          (page !== 'history' || filterKind === 'all' || a.kind === filterKind) &&
          (page !== 'game' || gameFilter === 'all' || a.kind !== 'game' || a.name === gameFilter),
      ),
    [items, period, customStart, customEnd, filterKind, gameFilter, page],
  )
  const summary = totals(filtered)
  const allSummary = totals(items)
  const category = (kind: Kind) => filtered.filter((a) => a.kind === kind)
  const last = [...filtered].sort(
    (a, b) => b.occurred_on.localeCompare(a.occurred_on) || b.id.localeCompare(a.id),
  )
  const openAdd = (kind: Kind = 'scratch') => {
    setEditing(null)
    setEntryKind(kind)
    setEntryOpen(true)
  }
  const openEdit = (a: Activity) => {
    setEditing(a)
    setEntryKind(a.kind)
    setEntryOpen(true)
  }
  const go = (p: Page) => {
    setPage(p)
    if (location.hash !== `#${p}`) location.hash = p
    setMobileOpen(false)
    setSearch('')
    setPageNumber(1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const openSearch = () => {
    go('history')
    setPeriod('all')
    setFilterKind('all')
    setSearchRequested(true)
  }
  useEffect(() => {
    const onHashChange = () => {
      const next = nav.find((n) => `#${n.id}` === location.hash)?.id
      if (next) {
        setPage(next)
        setMobileOpen(false)
      }
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])
  useEffect(() => {
    if (searchRequested && page === 'history' && !loading) {
      document.getElementById('history-search')?.focus()
      setSearchRequested(false)
    }
  }, [page, searchRequested, loading])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && mobileOpen) {
        setMobileOpen(false)
        requestAnimationFrame(() => document.getElementById('mobile-menu-toggle')?.focus())
        return
      }
      const target = event.target as HTMLElement
      if (
        (cloudEnabled && !user) ||
        entryOpen ||
        target.closest('input, textarea, select, [contenteditable="true"]') ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      )
        return
      if (event.key === 'n' || event.key === 'N') {
        event.preventDefault()
        openAdd(page === 'game' ? 'game' : page === 'other' ? 'other' : 'scratch')
      }
      if (event.key === '/') {
        event.preventDefault()
        openSearch()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [page, entryOpen, user, mobileOpen])
  async function save(draft: Draft, id?: string, file?: File) {
    let image_path = draft.image_path
    if (file) {
      if (file.size > 5_000_000) throw new Error('Image must be under 5 MB.')
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
        throw new Error('Choose a JPG, PNG, or WebP image.')
      if (!supabase || !user) throw new Error('Ticket images require a connected Supabase account.')
      const path = `${user.id}/${crypto.randomUUID()}.${file.type.split('/')[1]}`
      const { error } = await supabase.storage.from('ticket-images').upload(path, file, { upsert: false })
      if (error) throw error
      image_path = path
    }
    const record = { ...draft, image_path }
    if (supabase && user) {
      const query = id
        ? supabase.from('activities').update(record).eq('id', id).select().single()
        : supabase
            .from('activities')
            .insert({ ...record, user_id: user.id })
            .select()
            .single()
      const { data, error } = await query
      if (error) throw error
      setItems((current) =>
        id ? current.map((a) => (a.id === id ? (data as Activity) : a)) : [data as Activity, ...current],
      )
    } else {
      const entry: Activity = { ...record, id: id || crypto.randomUUID() }
      setItems((current) => (id ? current.map((a) => (a.id === id ? entry : a)) : [entry, ...current]))
    }
    setToast(id ? 'Activity updated' : 'Activity added to your ledger')
  }
  async function remove(a: Activity) {
    if (!confirm(`Delete “${a.name}” from your ledger? This cannot be undone.`)) return
    try {
      if (supabase && user) {
        if (a.image_path) {
          const { error: imageError } = await supabase.storage.from('ticket-images').remove([a.image_path])
          if (imageError) throw imageError
        }
        const { error } = await supabase.from('activities').delete().eq('id', a.id)
        if (error) throw error
      }
      setItems((current) => current.filter((x) => x.id !== a.id))
      setToast('Activity deleted')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete activity.')
    }
  }
  async function saveLimits(next: Limits) {
    if (supabase && user) {
      const { error } = await supabase.from('user_settings').upsert({ user_id: user.id, ...next })
      if (error) throw error
    }
    setLimits(next)
    setToast('Spending limits saved')
  }
  function exportCsv() {
    const blob = new Blob([csv(items)], { type: 'text/csv;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `playledger-export-${today()}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
    setToast('CSV export downloaded')
  }
  async function deleteAll() {
    if (
      !confirm(
        'Delete all PlayLedger activity, ticket images, and spending limits? Your shared login will remain available. This cannot be undone.',
      )
    )
      return
    try {
      if (supabase && user) {
        while (true) {
          const { data: images, error: listError } = await supabase.storage
            .from('ticket-images')
            .list(user.id, { limit: 100 })
          if (listError) throw listError
          if (!images?.length) break
          const { error: removeError } = await supabase.storage
            .from('ticket-images')
            .remove(images.map((image) => `${user.id}/${image.name}`))
          if (removeError) throw removeError
        }
        const { error: a } = await supabase.from('activities').delete().eq('user_id', user.id)
        const { error: s } = await supabase.from('user_settings').delete().eq('user_id', user.id)
        if (a || s) throw a || s
      }
      setItems([])
      setLimits({ weekly_cents: null, monthly_cents: null })
      setToast('Your PlayLedger data was deleted')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete data.')
    }
  }
  async function signOut() {
    await supabase?.auth.signOut()
    setUser(null)
    setItems([])
  }

  if (authLoading)
    return (
      <div className="loading-screen">
        <Brand />
        <div className="skeleton wide" />
        <div className="skeleton" />
      </div>
    )
  if (cloudEnabled && (recovery || !user))
    return <Auth recovery={recovery} onReady={() => setRecovery(false)} />
  const pageInfo = sectionCopy[page]
  return (
    <div className={`app-shell ${collapsed ? 'collapsed' : ''}`}>
      <aside
        className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}
        inert={isMobile && !mobileOpen}
        aria-hidden={isMobile && !mobileOpen}
      >
        <div className="sidebar-top">
          <Brand compact={collapsed && !isMobile} />
          <button
            className="sidebar-collapse icon-button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          </button>
          <button
            className="mobile-close icon-button"
            id="mobile-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>
        <div className="sidebar-rule" />
        <nav>
          {(['workspace', 'manage'] as const).map((section) => (
            <div className="nav-group" key={section}>
              <span className="nav-label">
                {section === 'workspace' ? 'YOUR LEDGER' : 'INSIGHTS & SETTINGS'}
              </span>
              {nav
                .filter((n) => n.section === section)
                .map((n) => (
                  <button
                    key={n.id}
                    className={`nav-item ${page === n.id ? 'active' : ''}`}
                    onClick={() => go(n.id)}
                    title={n.label}
                    aria-current={page === n.id ? 'page' : undefined}
                  >
                    <n.icon size={18} strokeWidth={1.8} />
                    <span>{n.label}</span>
                    {page === n.id && <i />}
                  </button>
                ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-note">
            <ShieldCheck size={16} />
            <span>Your numbers stay yours.</span>
          </div>
          <button className="account-chip" onClick={() => go('settings')}>
            <span className="avatar">{user?.email?.[0]?.toUpperCase() || 'P'}</span>
            <span className="account-text">
              <strong>{user?.email?.split('@')[0] || 'Local preview'}</strong>
              <small>{cloudEnabled ? 'Private account' : 'This browser only'}</small>
            </span>
            <MoreHorizontal size={16} />
          </button>
        </div>
      </aside>
      {mobileOpen && (
        <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />
      )}
      <div className="main-shell" inert={isMobile && mobileOpen}>
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu icon-button"
              id="mobile-menu-toggle"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <span className="breadcrumb">
              <span className="breadcrumb-parent">My workspace</span> <ChevronRight size={14} />{' '}
              <b>{nav.find((n) => n.id === page)?.label}</b>
            </span>
          </div>
          <div className="topbar-right">
            <button className="topbar-search" onClick={openSearch} aria-label="Search your ledger">
              <Search size={16} />
              <span>Search your ledger</span>
              <kbd>/</kbd>
            </button>
            {!cloudEnabled && (
              <span className="preview-badge">
                <span /> LOCAL PREVIEW
              </span>
            )}
            <button
              className="button primary quick-add"
              aria-label="Add activity"
              onClick={() => openAdd(page === 'game' ? 'game' : page === 'other' ? 'other' : 'scratch')}
            >
              <Plus size={17} /> <span>New record</span>
              <kbd>N</kbd>
            </button>
            <button
              className="top-avatar"
              onClick={() => go('settings')}
              title="Settings"
              aria-label="Open settings"
            >
              {user?.email?.[0]?.toUpperCase() || 'P'}
            </button>
          </div>
        </header>
        <main className="content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">{pageInfo.eyebrow}</span>
              <h1>{pageInfo.title}</h1>
              <p>{pageInfo.description}</p>
            </div>
            {page !== 'settings' && page !== 'limits' && (
              <div className="heading-actions">
                <div className="period-tabs" role="group" aria-label="Date range shortcuts">
                  {(
                    [
                      ['week', 'Week'],
                      ['month', 'Month'],
                      ['year', 'Year'],
                      ['all', 'All time'],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      className={period === value ? 'active' : ''}
                      aria-pressed={period === value}
                      onClick={() => setPeriod(value)}
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    className={period === 'custom' ? 'active custom-tab' : 'custom-tab'}
                    onClick={() => setPeriod('custom')}
                    aria-label="Choose custom dates"
                    aria-pressed={period === 'custom'}
                  >
                    <CalendarDays size={16} />
                  </button>
                </div>
                <select
                  className="period-select mobile-period"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as Period)}
                  aria-label="Date range"
                >
                  <option value="week">This week</option>
                  <option value="month">This month</option>
                  <option value="year">This year</option>
                  <option value="all">All time</option>
                  <option value="custom">Custom range</option>
                </select>
                {period === 'custom' && (
                  <div className="custom-range">
                    <input
                      type="date"
                      value={customStart}
                      max={customEnd || today()}
                      onChange={(e) => setCustomStart(e.target.value)}
                      aria-label="Start date"
                    />
                    <span>to</span>
                    <input
                      type="date"
                      value={customEnd}
                      min={customStart}
                      max={today()}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      aria-label="End date"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
          {error && (
            <div className="error-banner">
              <CircleHelp size={17} />
              <span>{error}</span>
              <button onClick={() => setError('')} aria-label="Dismiss error">
                <X size={16} />
              </button>
            </div>
          )}
          {loading ? (
            <div className="loading-content">
              <div className="skeleton hero-skel" />
              <div className="skeleton row-skel" />
              <div className="skeleton row-skel" />
            </div>
          ) : (
            <>
              {page === 'overview' && (
                <Overview
                  items={filtered}
                  allItems={items}
                  summary={summary}
                  recent={last.slice(0, 6)}
                  limits={limits}
                  comparison={previousComparableRange(period, customStart, customEnd)}
                  onAdd={openAdd}
                  onGo={go}
                  onEdit={openEdit}
                />
              )}
              {(page === 'scratch' || page === 'game' || page === 'other') && (
                <CategoryPage
                  key={page}
                  kind={page}
                  items={category(page)}
                  allItems={items.filter((a) => a.kind === page)}
                  onAdd={openAdd}
                  onEdit={openEdit}
                  onSave={save}
                  onDelete={remove}
                  gameFilter={gameFilter}
                  setGameFilter={setGameFilter}
                />
              )}
              {page === 'history' && (
                <History
                  items={filtered}
                  allItems={items}
                  search={search}
                  setSearch={setSearch}
                  sort={sort}
                  setSort={setSort}
                  filterKind={filterKind}
                  setFilterKind={setFilterKind}
                  pageNumber={pageNumber}
                  setPageNumber={setPageNumber}
                  onAdd={openAdd}
                  onEdit={openEdit}
                  onSave={save}
                  onDelete={remove}
                  onExport={exportCsv}
                />
              )}
              {page === 'analytics' && <Analytics items={filtered} allItems={items} onAdd={openAdd} />}
              {page === 'limits' && <LimitsPage items={items} limits={limits} onSave={saveLimits} />}
              {page === 'settings' && (
                <Settings
                  email={user?.email}
                  cloud={cloudEnabled}
                  total={allSummary.count}
                  onExport={exportCsv}
                  onDeleteAll={deleteAll}
                  onSignOut={signOut}
                />
              )}
            </>
          )}
          <footer className="footer">
            <span>PLAYLEDGER / YOUR PLAY. YOUR NUMBERS.</span>
            <span>Recordkeeping and financial awareness. No outcome predictions.</span>
          </footer>
        </main>
      </div>
      <EntryDialog
        open={entryOpen}
        onOpenChange={setEntryOpen}
        initial={editing}
        defaultKind={entryKind}
        suggestions={items}
        onSave={save}
      />
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
    </div>
  )
}

function Overview({
  items,
  allItems,
  summary,
  recent,
  limits,
  comparison,
  onAdd,
  onGo,
  onEdit,
}: {
  items: Activity[]
  allItems: Activity[]
  summary: ReturnType<typeof totals>
  recent: Activity[]
  limits: Limits
  comparison: ReturnType<typeof previousComparableRange>
  onAdd: (k: Kind) => void
  onGo: (p: Page) => void
  onEdit: (a: Activity) => void
}) {
  const selectedSpend = spending(items)
  const pending = items.filter((a) => a.status === 'pending')
  const previous = comparison
    ? allItems.filter((a) => a.occurred_on >= comparison.start && a.occurred_on <= comparison.end)
    : []
  const change = summary.net - totals(previous).net
  const month = new Date().toLocaleDateString('en-US', { month: 'long' })
  const monthItems = allItems.filter((a) => a.occurred_on >= periodStart('month'))
  const monthSpend = spending(monthItems)
  const budget = limits.monthly_cents
  const ratio = budget ? Math.min(100, (monthSpend / budget) * 100) : 0
  const overBudget = budget !== null && monthSpend > budget
  const mix = (['scratch', 'game', 'other'] as Kind[]).map((kind) => {
    const entries = items.filter((a) => a.kind === kind)
    return { kind, entries, cost: spending(entries), net: totals(entries).net }
  })
  return (
    <div className="dashboard-grid">
      <section className="surface result-panel">
        <div className="result-topline">
          <span>
            <i /> RESULTS AT A GLANCE
          </span>
          <span className="record-count">
            {items.length} {items.length === 1 ? 'record' : 'records'}
          </span>
        </div>
        <div className="result-intro">
          <div>
            <span className="result-label">Your net result</span>
            <div
              className={`result-number ${summary.net < 0 ? 'negative' : summary.net > 0 ? 'positive' : ''}`}
            >
              {signedMoney(summary.net)}
            </div>
            <div className="period-comparison">
              {comparison && previous.length ? (
                <>
                  <span className={change < 0 ? 'negative' : change > 0 ? 'positive' : ''}>
                    {change < 0 ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                    {signedMoney(change)}
                  </span>
                  <small>{comparison.label}</small>
                </>
              ) : (
                <small>
                  {summary.count
                    ? 'Payouts received, less the cost of settled activity.'
                    : 'A fresh start. Your first record will begin the picture.'}
                </small>
              )}
            </div>
          </div>
          <div className="result-mark" aria-hidden="true">
            <BarChart3 size={30} strokeWidth={1.3} />
          </div>
        </div>
        <div className="result-metrics">
          <Stat label="AMOUNT SPENT" value={money(selectedSpend)} />
          <Stat label="PAYOUTS RECEIVED" value={money(summary.payout)} />
          <Stat
            label="SETTLED RETURN RATE"
            value={summary.spent ? `${summary.returnRate.toFixed(1)}%` : '—'}
          />
        </div>
        <div className="result-chart">
          <PerformanceChart items={items} height={242} />
        </div>
        <div className="result-foot">
          <span>
            <i /> Cumulative net result
          </span>
          <small>
            {pending.length
              ? `${pending.length} pending · ${money(spending(pending))} excluded from net & return rate`
              : 'Settled activity · fees included'}
          </small>
        </div>
      </section>

      <section className="surface activity-mix">
        <div className="section-head">
          <div>
            <h2>Where it went</h2>
            <p>Spending across your activities</p>
          </div>
          <WalletCards size={18} className="muted-icon" />
        </div>
        <div className="mix-total">
          {money(selectedSpend)}
          <span>total recorded cost</span>
        </div>
        <div
          className={`mix-stacked ${selectedSpend ? '' : 'empty'}`}
          aria-label={selectedSpend ? 'Spending distribution' : 'No recorded spending'}
        >
          {mix.map((m) => (
            <i
              key={m.kind}
              className={kindMeta[m.kind].className}
              style={{ flexGrow: m.cost || (selectedSpend ? 0 : 1) }}
            />
          ))}
        </div>
        <div className="mix-list">
          {mix.map((m) => (
            <button key={m.kind} onClick={() => onGo(m.kind)} className="mix-row">
              <IconBubble kind={m.kind} />
              <span>
                <strong>{kindMeta[m.kind].label}</strong>
                <small>
                  {m.entries.length} {m.entries.length === 1 ? 'record' : 'records'}
                </small>
              </span>
              <span className="mix-amount">
                <b>{money(m.cost)}</b>
                <small>
                  {selectedSpend ? `${Math.round((m.cost / selectedSpend) * 100)}%` : '0%'} of spending
                </small>
              </span>
            </button>
          ))}
        </div>
        <button className="panel-link" onClick={() => onGo('analytics')}>
          Explore your analytics <ArrowUpRight size={16} />
        </button>
      </section>

      <section className="surface recent-surface">
        <div className="section-head">
          <div className="title-with-count">
            <h2>Recent activity</h2>
            <span>{items.length}</span>
          </div>
          <button className="text-link" onClick={() => onGo('history')}>
            View ledger <ArrowRight size={15} />
          </button>
        </div>
        {recent.length ? (
          <div className="recent-list">
            <div className="recent-labels">
              <span>ACTIVITY</span>
              <span>COST</span>
              <span>PAYOUT</span>
              <span>NET RESULT</span>
            </div>
            {recent.map((a) => (
              <button key={a.id} className="recent-row" onClick={() => onEdit(a)}>
                <IconBubble kind={a.kind} />
                <span className="recent-name">
                  <strong>{a.name}</strong>
                  <small>
                    {prettyDate(a.occurred_on)} ·{' '}
                    {a.kind === 'scratch'
                      ? `${a.quantity} ${a.quantity === 1 ? 'ticket' : 'tickets'}`
                      : kindMeta[a.kind].label}
                  </small>
                </span>
                <span className="recent-amount">{money(a.spent_cents + a.fees_cents)}</span>
                <span className="recent-amount">
                  {a.status === 'pending' ? 'Pending' : money(a.payout_cents)}
                </span>
                <ActivityResult activity={a} />
              </button>
            ))}
          </div>
        ) : (
          <Empty
            icon={Ticket}
            title="Make your first entry"
            body="A ticket that lost counts, too. Record what you spent and what came back."
            action="Add your first activity"
            onAction={() => onAdd('scratch')}
          />
        )}
      </section>

      <section className="surface budget-overview">
        <div className="section-head">
          <div>
            <h2>A little perspective</h2>
            <p>{month}'s spending</p>
          </div>
          <Goal size={19} className="muted-icon" />
        </div>
        <div className="budget-visual">
          <div
            className={`budget-ring ${overBudget ? 'over' : ''}`}
            style={{
              background: `conic-gradient(${overBudget ? '#ed8e85' : '#c3e88d'} ${ratio}%, #30352f 0)`,
            }}
          >
            <div>
              {budget ? (
                <>
                  <strong>
                    {Math.round((monthSpend / budget) * 100)}
                    <small>%</small>
                  </strong>
                  <span>of your limit</span>
                </>
              ) : (
                <Goal size={28} strokeWidth={1.2} />
              )}
            </div>
          </div>
          <div className="budget-amount">
            <strong>{money(monthSpend)}</strong>
            <span>{budget ? `of ${money(budget)} monthly limit` : 'spent this month'}</span>
          </div>
        </div>
        <div className="budget-message">
          <ShieldCheck size={17} />
          <p>
            {budget ? (
              <>
                <strong>
                  {money(Math.abs(budget - monthSpend))} {overBudget ? 'over your limit' : 'remaining'}
                </strong>
                <span>Includes all wagers and fees this month.</span>
              </>
            ) : (
              <>
                <strong>Give your spending a boundary.</strong>
                <span>Set a monthly limit to keep your budget in view.</span>
              </>
            )}
          </p>
        </div>
        <button className="panel-link" onClick={() => onGo('limits')}>
          {budget ? 'Manage spending limits' : 'Set a spending limit'}
          <ArrowUpRight size={16} />
        </button>
      </section>
      <div className="dashboard-note">
        <LockKeyhole size={14} />
        <span>Your private record. A clearer view of the money behind the play.</span>
        <span>YOUR PLAY. YOUR NUMBERS.</span>
      </div>
    </div>
  )
}

function CategoryPage({
  kind,
  items,
  allItems,
  onAdd,
  onEdit,
  onSave,
  onDelete,
  gameFilter,
  setGameFilter,
}: {
  kind: Kind
  items: Activity[]
  allItems: Activity[]
  onAdd: (k: Kind) => void
  onEdit: (a: Activity) => void
  onSave: (draft: Draft, id?: string) => Promise<void>
  onDelete: (a: Activity) => void
  gameFilter: string
  setGameFilter: (s: string) => void
}) {
  const t = totals(items)
  const [query, setQuery] = useState('')
  const [outcome, setOutcome] = useState('all')
  const [view, setView] = useState<'cards' | 'list'>(kind === 'scratch' ? 'cards' : 'list')
  const [recordPage, setRecordPage] = useState(1)
  useEffect(() => setRecordPage(1), [query, outcome, items.map((a) => a.id).join(','), gameFilter])
  const [order, setOrder] = useState('newest')
  const names = [...new Set(allItems.map((a) => a.name))].sort()
  const visible = [...items]
    .filter(
      (a) =>
        (kind !== 'game' || gameFilter === 'all' || a.name === gameFilter) &&
        (outcome === 'all' || (outcome === 'none' ? a.payout_cents === 0 : a.payout_cents > 0)) &&
        `${a.name} ${a.category} ${a.location}`.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      order === 'name'
        ? a.name.localeCompare(b.name)
        : order === 'spent'
          ? b.spent_cents + b.fees_cents - a.spent_cents - a.fees_cents
          : b.occurred_on.localeCompare(a.occurred_on),
    )
  const pages = Math.max(1, Math.ceil(visible.length / 12))
  const currentPage = Math.min(recordPage, pages)
  const shown = visible.slice((currentPage - 1) * 12, currentPage * 12)
  const grouped = [...new Set(items.map((a) => a.name))]
    .map((name) => ({ name, entries: items.filter((a) => a.name === name) }))
    .sort((a, b) => totals(b.entries).spent - totals(a.entries).spent)
  return (
    <>
      <div className={`category-quickbar ${kindMeta[kind].className}`}>
        <div>
          <IconBubble kind={kind} />
          <span>
            <strong>
              {kind === 'scratch'
                ? 'Every ticket has a place here.'
                : kind === 'game'
                  ? 'Keep the details of each session.'
                  : 'Keep an accurate record of every wager.'}
            </strong>
            <small>
              {kind === 'scratch'
                ? 'Prize or no prize, record it in a few seconds.'
                : kind === 'game'
                  ? 'Buy-ins, payouts, fees, and time. Together.'
                  : 'Separate settled results from pending activity.'}
            </small>
          </span>
        </div>
        <Button onClick={() => onAdd(kind)}>
          <Plus size={16} />
          {kind === 'scratch' ? 'Record tickets' : kind === 'game' ? 'Log a session' : 'Add activity'}
        </Button>
      </div>
      <div className="metric-strip">
        <Stat
          label={kind === 'scratch' ? 'TICKETS PURCHASED' : 'RECORDED ACTIVITIES'}
          value={String(kind === 'scratch' ? items.reduce((n, a) => n + a.quantity, 0) : items.length)}
          note={
            kind === 'scratch'
              ? `${items.length} purchase ${items.length === 1 ? 'record' : 'records'}`
              : undefined
          }
        />
        <Stat label="AMOUNT SPENT" value={money(spending(items))} />
        <Stat label="GROSS PAYOUTS" value={money(t.payout)} />
        <Stat
          label="NET RESULT"
          value={signedMoney(t.net)}
          tone={t.net < 0 ? 'negative' : t.net > 0 ? 'positive' : 'neutral'}
        />
        {kind === 'scratch' && (
          <Stat
            label="PURCHASES WITH A PRIZE"
            value={String(items.filter((a) => a.status === 'settled' && a.payout_cents > 0).length)}
            note={`${items.filter((a) => a.status === 'settled' && a.payout_cents === 0).length} without a prize`}
          />
        )}
      </div>
      {kind === 'game' && names.length > 0 && (
        <section className="surface game-profiles">
          <div className="section-head">
            <div>
              <span className="eyebrow">GAME PROFILES</span>
              <h2>Choose a game</h2>
            </div>
            <button className="text-link" onClick={() => setGameFilter('all')}>
              View all
            </button>
          </div>
          <div className="game-pills">
            {names.map((name) => {
              const s = totals(allItems.filter((a) => a.name === name))
              return (
                <button
                  className={gameFilter === name ? 'active' : ''}
                  key={name}
                  onClick={() => setGameFilter(name)}
                >
                  <Gamepad2 size={16} />
                  <span>{name}</span>
                  <small>{s.count} sessions</small>
                  <Delta value={s.net} />
                </button>
              )
            })}
          </div>
        </section>
      )}
      <section className="surface record-section">
        <div className="section-head">
          <div>
            <span className="eyebrow">ALL RECORDS</span>
            <h2>
              {kind === 'scratch'
                ? 'Ticket history'
                : kind === 'game'
                  ? 'Session history'
                  : 'Activity records'}
            </h2>
          </div>
          <div className="table-tools">
            <label className="search-box">
              <Search size={16} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search records"
                aria-label="Search records"
              />
            </label>
            <select
              value={order}
              onChange={(e) => {
                setOrder(e.target.value)
                setRecordPage(1)
              }}
              aria-label="Sort records"
            >
              <option value="newest">Newest first</option>
              <option value="name">Name A–Z</option>
              <option value="spent">Highest cost</option>
            </select>
          </div>
        </div>
        {kind === 'scratch' && (
          <div className="record-controls">
            <div className="outcome-filters" role="group" aria-label="Ticket outcome filter">
              {[
                ['all', 'All tickets'],
                ['none', 'No prize'],
                ['payout', 'Payout received'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={outcome === value ? 'active' : ''}
                  aria-pressed={outcome === value}
                  onClick={() => setOutcome(value)}
                >
                  {label}
                  <span>
                    {
                      items.filter(
                        (a) =>
                          value === 'all' || (value === 'none' ? a.payout_cents === 0 : a.payout_cents > 0),
                      ).length
                    }
                  </span>
                </button>
              ))}
            </div>
            <div className="view-switch" role="group" aria-label="Record layout">
              <button
                aria-label="Card view"
                aria-pressed={view === 'cards'}
                className={view === 'cards' ? 'active' : ''}
                onClick={() => setView('cards')}
              >
                <LayoutGrid size={16} />
              </button>
              <button
                aria-label="Table view"
                aria-pressed={view === 'list'}
                className={view === 'list' ? 'active' : ''}
                onClick={() => setView('list')}
              >
                <List size={17} />
              </button>
            </div>
          </div>
        )}
        {visible.length ? (
          <>
            {view === 'cards' ? (
              <TicketCards items={shown} onEdit={onEdit} onDelete={onDelete} />
            ) : (
              <ActivityTable items={shown} onEdit={onEdit} onSave={onSave} onDelete={onDelete} />
            )}
            <div className="pagination">
              <span>
                {visible.length} {visible.length === 1 ? 'record' : 'records'} · {currentPage} of {pages}
              </span>
              <div>
                <button
                  aria-label="Previous records"
                  disabled={currentPage === 1}
                  onClick={() => setRecordPage(currentPage - 1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  aria-label="Next records"
                  disabled={currentPage === pages}
                  onClick={() => setRecordPage(currentPage + 1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <Empty
            icon={kindMeta[kind].icon}
            title={query || outcome !== 'all' ? 'No matching records' : 'Your first record starts here'}
            body={
              query || outcome !== 'all'
                ? 'Try a different search or outcome filter.'
                : 'Add what you spent and what came back. A $0 payout is a complete record.'
            }
            action={!query && outcome === 'all' ? 'Add an entry' : undefined}
            onAction={() => onAdd(kind)}
          />
        )}
      </section>
      <div className="two-column">
        <section className="surface category-trend">
          <div className="section-head">
            <div>
              <span className="eyebrow">RECORDED RESULTS</span>
              <h2>
                {kind === 'game' && gameFilter !== 'all' ? `${gameFilter} over time` : 'Results over time'}
              </h2>
              <p>Cumulative settled net result</p>
            </div>
          </div>
          <PerformanceChart items={items} height={230} />
        </section>
        <section className="surface category-detail">
          <div className="section-head">
            <div>
              <span className="eyebrow">BY NAME</span>
              <h2>
                {kind === 'scratch'
                  ? 'Ticket breakdown'
                  : kind === 'game'
                    ? 'Session summary'
                    : 'Activity types'}
              </h2>
            </div>
          </div>
          {grouped.length ? (
            <div className="breakdown-list">
              {grouped.slice(0, 5).map((g) => {
                const s = totals(g.entries)
                return (
                  <div key={g.name}>
                    <div>
                      <strong>{g.name}</strong>
                      <small>
                        {g.entries.length} {g.entries.length === 1 ? 'record' : 'records'}
                      </small>
                    </div>
                    <span>{money(s.spent)} spent</span>
                    <Delta value={s.net} />
                  </div>
                )
              })}
            </div>
          ) : (
            <Empty
              title="No breakdown yet"
              body="Add an entry to see the names and amounts that make up this category."
            />
          )}
        </section>
      </div>
    </>
  )
}

function TicketCards({
  items,
  onEdit,
  onDelete,
}: {
  items: Activity[]
  onEdit: (activity: Activity) => void
  onDelete: (activity: Activity) => void
}) {
  return (
    <div className="ticket-grid">
      {items.map((a) => (
        <article className="ticket-card" key={a.id}>
          <div className="ticket-card-top">
            <div className="ticket-denomination">
              <Ticket size={21} strokeWidth={1.5} />
              <span>
                {money(a.spent_cents / a.quantity)}
                <small>per ticket</small>
              </span>
            </div>
            <Outcome activity={a} />
          </div>
          <button className="ticket-card-name" onClick={() => onEdit(a)}>
            <h3>{a.name}</h3>
            <span>
              {prettyDate(a.occurred_on)} · {a.quantity} {a.quantity === 1 ? 'ticket' : 'tickets'}
            </span>
          </button>
          <div className="ticket-card-values">
            <span>
              <small>TOTAL COST</small>
              <b>{money(a.spent_cents + a.fees_cents)}</b>
            </span>
            <span>
              <small>PAYOUT</small>
              <b>{money(a.payout_cents)}</b>
            </span>
            <span>
              <small>NET RESULT</small>
              <ActivityResult activity={a} />
            </span>
          </div>
          <div className="ticket-card-actions">
            <span>{a.location || (a.notes ? 'Note attached' : 'Scratch-off')}</span>
            <button onClick={() => onEdit(a)} aria-label={`Edit ${a.name}`}>
              Edit record <ArrowUpRight size={14} />
            </button>
            <button className="delete-action" onClick={() => onDelete(a)} aria-label={`Delete ${a.name}`}>
              <Trash2 size={14} />
            </button>
          </div>
        </article>
      ))}
    </div>
  )
}

function ActivityTable({
  items,
  onEdit,
  onSave,
  onDelete,
}: {
  items: Activity[]
  onEdit: (a: Activity) => void
  onSave: (draft: Draft, id?: string) => Promise<void>
  onDelete: (a: Activity) => void
}) {
  const [rowId, setRowId] = useState<string | null>(null)
  const [row, setRow] = useState<Activity | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof Activity>(key: K, value: Activity[K]) =>
    setRow((r) => (r ? { ...r, [key]: value } : r))
  async function commit() {
    if (!row) return
    const result = activitySchema.safeParse(row)
    if (!result.success) {
      setError(result.error.issues[0]?.message || 'Check the row.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave(result.data, row.id)
      setRowId(null)
      setRow(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save row.')
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>ACTIVITY</th>
            <th>DATE</th>
            <th>RESULT</th>
            <th className="numeric">COST</th>
            <th className="numeric">PAYOUT</th>
            <th className="numeric">NET</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {items.map((a) =>
            rowId === a.id && row ? (
              <tr key={a.id} className="editing-row">
                <td>
                  <input
                    aria-label="Activity name"
                    value={row.name}
                    onChange={(e) => set('name', e.target.value)}
                    maxLength={100}
                  />
                </td>
                <td>
                  <input
                    aria-label="Activity date"
                    type="date"
                    value={row.occurred_on}
                    onChange={(e) => set('occurred_on', e.target.value)}
                  />
                </td>
                <td>
                  {row.kind === 'other' ? (
                    <select
                      aria-label="Status"
                      value={row.status}
                      onChange={(e) => set('status', e.target.value as Activity['status'])}
                    >
                      <option value="settled">Settled</option>
                      <option value="pending">Pending</option>
                    </select>
                  ) : (
                    <span className="status settled">settled</span>
                  )}
                </td>
                <td className="numeric">
                  <MoneyInput
                    label="Wager amount"
                    value={row.spent_cents}
                    onChange={(value) => set('spent_cents', value)}
                  />
                </td>
                <td className="numeric">
                  <MoneyInput
                    label="Gross payout"
                    value={row.payout_cents}
                    onChange={(value) => set('payout_cents', value)}
                  />
                </td>
                <td className="numeric">
                  <Delta value={net(row)} />
                </td>
                <td>
                  <div className="row-actions">
                    <button disabled={saving} onClick={commit} aria-label={`Save ${a.name}`}>
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setRowId(null)
                        setRow(null)
                        setError('')
                      }}
                      aria-label="Cancel inline edit"
                    >
                      Cancel
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={a.id}>
                <td>
                  <div className="table-name">
                    <IconBubble kind={a.kind} />
                    <span>
                      <strong>{a.name}</strong>
                      <small>
                        {a.category || kindMeta[a.kind].label}
                        {a.quantity > 1 ? ` · ${a.quantity} tickets` : ''}
                      </small>
                    </span>
                  </div>
                </td>
                <td>{prettyDate(a.occurred_on)}</td>
                <td>
                  <Outcome activity={a} />
                </td>
                <td className="numeric">{money(a.spent_cents + a.fees_cents)}</td>
                <td className="numeric">{a.status === 'settled' ? money(a.payout_cents) : '—'}</td>
                <td className="numeric">
                  <ActivityResult activity={a} />
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      onClick={() => {
                        setRowId(a.id)
                        setRow({ ...a })
                        setError('')
                      }}
                      aria-label={`Quick edit ${a.name}`}
                    >
                      Edit
                    </button>
                    <button onClick={() => onEdit(a)} aria-label={`Open details for ${a.name}`}>
                      Details
                    </button>
                    <button
                      className="delete-action"
                      onClick={() => onDelete(a)}
                      aria-label={`Delete ${a.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ),
          )}
          {error && (
            <tr className="table-error">
              <td colSpan={7}>{error}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function History({
  items,
  allItems,
  search,
  setSearch,
  sort,
  setSort,
  filterKind,
  setFilterKind,
  pageNumber,
  setPageNumber,
  onAdd,
  onEdit,
  onSave,
  onDelete,
  onExport,
}: {
  items: Activity[]
  allItems: Activity[]
  search: string
  setSearch: (v: string) => void
  sort: 'newest' | 'oldest' | 'name' | 'spend' | 'net'
  setSort: (v: 'newest' | 'oldest' | 'name' | 'spend' | 'net') => void
  filterKind: 'all' | Kind
  setFilterKind: (v: 'all' | Kind) => void
  pageNumber: number
  setPageNumber: (v: number) => void
  onAdd: (k: Kind) => void
  onEdit: (a: Activity) => void
  onSave: (draft: Draft, id?: string) => Promise<void>
  onDelete: (a: Activity) => void
  onExport: () => void
}) {
  const visible = [...items]
    .filter((a) => `${a.name} ${a.category} ${a.notes}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) =>
      sort === 'oldest'
        ? a.occurred_on.localeCompare(b.occurred_on)
        : sort === 'name'
          ? a.name.localeCompare(b.name)
          : sort === 'spend'
            ? b.spent_cents + b.fees_cents - a.spent_cents - a.fees_cents
            : sort === 'net'
              ? net(b) - net(a)
              : b.occurred_on.localeCompare(a.occurred_on),
    )
  const size = 12
  const pages = Math.max(1, Math.ceil(visible.length / size))
  const current = Math.min(pageNumber, pages)
  return (
    <>
      <div className="history-intro">
        <div>
          <strong>{allItems.length}</strong>
          <span>total records</span>
          <i /> <strong>{money(totals(items).spent)}</strong>
          <span>spent in this view</span>
        </div>
        <button className="button secondary" onClick={onExport}>
          <Download size={16} /> Export CSV
        </button>
      </div>
      <section className="surface record-section">
        <div className="history-toolbar">
          <label className="search-box wide">
            <Search size={17} />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPageNumber(1)
              }}
              id="history-search"
              placeholder="Search activities, categories, notes…"
              aria-label="Search activities"
            />
          </label>
          <div className="table-tools">
            <select
              value={filterKind}
              onChange={(e) => {
                setFilterKind(e.target.value as 'all' | Kind)
                setPageNumber(1)
              }}
              aria-label="Filter category"
            >
              <option value="all">All categories</option>
              <option value="scratch">Scratch-offs</option>
              <option value="game">Game sessions</option>
              <option value="other">Other gambling</option>
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              aria-label="Sort history"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name">Name A–Z</option>
              <option value="spend">Highest cost</option>
              <option value="net">Highest net</option>
            </select>
          </div>
        </div>
        {visible.length ? (
          <>
            <ActivityTable
              items={visible.slice((current - 1) * size, current * size)}
              onEdit={onEdit}
              onSave={onSave}
              onDelete={onDelete}
            />
            <div className="pagination">
              <span>
                Showing {(current - 1) * size + 1}–{Math.min(current * size, visible.length)} of{' '}
                {visible.length}
              </span>
              <div>
                <button
                  disabled={current === 1}
                  onClick={() => setPageNumber(current - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={17} />
                </button>
                <span>
                  {current} / {pages}
                </span>
                <button
                  disabled={current === pages}
                  onClick={() => setPageNumber(current + 1)}
                  aria-label="Next page"
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <Empty
            icon={Search}
            title={search ? 'No results found' : 'No entries to show'}
            body={
              search
                ? 'Try another search or category.'
                : 'Your records will appear here as you add activity.'
            }
            action={!search ? 'Add an activity' : undefined}
            onAction={() => onAdd('scratch')}
          />
        )}
      </section>
    </>
  )
}

function ActivityCalendar({ items }: { items: Activity[] }) {
  const end = startOfWeek(new Date())
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(end)
    d.setDate(d.getDate() - (35 - i))
    const date = localDate(d)
    const entries = items.filter((a) => a.occurred_on === date)
    return { date, day: d.getDate(), count: entries.length, cost: totals(entries).spent }
  })
  return (
    <section className="surface calendar-panel">
      <div className="section-head">
        <div>
          <span className="eyebrow">06 / ACTIVITY CALENDAR</span>
          <h2>Recent activity days</h2>
          <p>Six calendar weeks of recorded entries</p>
        </div>
        <span className="calendar-key">
          FEWER <i />
          <i />
          <i />
          <i /> MORE
        </span>
      </div>
      <div className="calendar-weekdays">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="calendar-grid">
        {days.map((d) => (
          <div
            key={d.date}
            className={`calendar-day level-${Math.min(d.count, 4)}`}
            title={`${prettyDate(d.date)} · ${d.count} ${d.count === 1 ? 'entry' : 'entries'} · ${money(d.cost)} spent`}
          >
            <span>{d.day}</span>
          </div>
        ))}
      </div>
      <p className="calendar-caption">Color shows the number of records, not the value of outcomes.</p>
    </section>
  )
}

function Analytics({
  items,
  allItems,
  onAdd,
}: {
  items: Activity[]
  allItems: Activity[]
  onAdd: (k: Kind) => void
}) {
  const t = totals(items)
  const byKind = (['scratch', 'game', 'other'] as Kind[]).map((k) => ({
    name: kindMeta[k].label,
    spent: totals(items.filter((a) => a.kind === k)).spent,
    payout: totals(items.filter((a) => a.kind === k)).payout,
    net: totals(items.filter((a) => a.kind === k)).net,
  }))
  const months = [...new Set(items.map((a) => a.occurred_on.slice(0, 7)))].sort().map((month) => {
    const m = totals(items.filter((a) => a.occurred_on.startsWith(month)))
    return {
      name: new Date(`${month}-15T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      spent: m.spent,
      payout: m.payout,
      net: m.net,
    }
  })
  const weekCounts = [...Array(12)].map((_, i) => {
    const date = startOfWeek(new Date())
    date.setDate(date.getDate() - (11 - i) * 7)
    const end = new Date(date)
    end.setDate(end.getDate() + 7)
    const week = allItems.filter((a) => a.occurred_on >= localDate(date) && a.occurred_on < localDate(end))
    return {
      name: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      spent: totals(week).spent,
      payout: totals(week).payout,
    }
  })
  const sessions = items.filter((a) => a.kind === 'game' && realized(a))
  const distribution = [
    { name: 'Loss', value: sessions.filter((a) => net(a) < 0).length, fill: '#ed948b' },
    { name: 'Even', value: sessions.filter((a) => net(a) === 0).length, fill: '#8694a5' },
    { name: 'Gain', value: sessions.filter((a) => net(a) > 0).length, fill: '#c3e88d' },
  ]
  return (
    <>
      {!items.length ? (
        <Empty
          icon={BarChart3}
          title="Insights need a starting point"
          body="Once you record activity, your actual spending and results will appear here. No sample numbers are used."
          action="Add your first activity"
          onAction={() => onAdd('scratch')}
        />
      ) : (
        <>
          <div className="analytics-summary">
            <Stat
              label="NET RESULT"
              value={signedMoney(t.net)}
              tone={t.net < 0 ? 'negative' : t.net > 0 ? 'positive' : 'neutral'}
            />
            <Stat label="TOTAL COST" value={money(t.spent)} />
            <Stat label="GROSS PAYOUTS" value={money(t.payout)} />
            <Stat label="RETURN RATE" value={`${t.returnRate.toFixed(1)}%`} />
          </div>
          <section className="surface analytics-main">
            <div className="section-head">
              <div>
                <span className="eyebrow">01 / PERFORMANCE</span>
                <h2>Net result over time</h2>
                <p>Running total of settled payouts minus costs</p>
              </div>
            </div>
            <PerformanceChart items={items} height={320} />
          </section>
          <div className="two-column analytics-columns">
            <section className="surface">
              <div className="section-head">
                <div>
                  <span className="eyebrow">02 / COMPOSITION</span>
                  <h2>Cost versus payout</h2>
                  <p>Across each category</p>
                </div>
              </div>
              <div className="analytics-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byKind} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <CartesianGrid stroke="#33382f" strokeDasharray="3 6" horizontal={false} />
                    <XAxis
                      type="number"
                      tickFormatter={(v: number) => `$${Math.round(v / 100)}`}
                      stroke="#89937f"
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={100}
                      stroke="#a6b1be"
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="spent" name="Cost" fill="#697891" radius={[0, 3, 3, 0]} barSize={11} />
                    <Bar dataKey="payout" name="Payout" fill="#c3e88d" radius={[0, 3, 3, 0]} barSize={11} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-key">
                <span>
                  <i className="cost" /> Cost
                </span>
                <span>
                  <i className="payout" /> Gross payout
                </span>
              </div>
            </section>
            <section className="surface">
              <div className="section-head">
                <div>
                  <span className="eyebrow">03 / COMPARISON</span>
                  <h2>Monthly movement</h2>
                  <p>Recorded spending and returns</p>
                </div>
              </div>
              <div className="analytics-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={months} margin={{ left: -16, right: 8 }}>
                    <CartesianGrid stroke="#33382f" strokeDasharray="3 6" vertical={false} />
                    <XAxis dataKey="name" stroke="#89937f" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis
                      tickFormatter={(v: number) => `$${Math.round(v / 100)}`}
                      stroke="#89937f"
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="spent" name="Cost" fill="#697891" radius={[3, 3, 0, 0]} barSize={16} />
                    <Line dataKey="payout" name="Payout" stroke="#c3e88d" strokeWidth={2} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-key">
                <span>
                  <i className="cost" /> Cost
                </span>
                <span>
                  <i className="payout" /> Gross payout
                </span>
              </div>
            </section>
          </div>
          <div className="two-column analytics-columns">
            <section className="surface">
              <div className="section-head">
                <div>
                  <span className="eyebrow">04 / RECENT PATTERN</span>
                  <h2>Weekly spending</h2>
                  <p>Last 12 calendar weeks, including the current week</p>
                </div>
              </div>
              <div className="analytics-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekCounts} margin={{ left: -15, right: 8 }}>
                    <CartesianGrid stroke="#33382f" strokeDasharray="3 6" vertical={false} />
                    <XAxis
                      dataKey="name"
                      stroke="#89937f"
                      tickLine={false}
                      axisLine={false}
                      fontSize={10}
                      interval={2}
                    />
                    <YAxis
                      tickFormatter={(v: number) => `$${Math.round(v / 100)}`}
                      stroke="#89937f"
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="spent" name="Cost" fill="#8b91ff" radius={[3, 3, 0, 0]} barSize={19} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="surface">
              <div className="section-head">
                <div>
                  <span className="eyebrow">05 / SESSIONS</span>
                  <h2>Game session outcomes</h2>
                  <p>Counts of settled results, without prediction</p>
                </div>
              </div>
              {sessions.length ? (
                <div className="distribution">
                  <ResponsiveContainer width="100%" height={195}>
                    <BarChart data={distribution} margin={{ left: -15, right: 12 }}>
                      <CartesianGrid stroke="#33382f" strokeDasharray="3 6" vertical={false} />
                      <XAxis
                        dataKey="name"
                        stroke="#a6b1be"
                        tickLine={false}
                        axisLine={false}
                        fontSize={11}
                      />
                      <YAxis
                        allowDecimals={false}
                        stroke="#89937f"
                        tickLine={false}
                        axisLine={false}
                        fontSize={11}
                      />
                      <Tooltip content={<ChartTooltip mode="count" />} />
                      <Bar dataKey="value" name="Sessions" radius={[3, 3, 0, 0]} barSize={45}>
                        {distribution.map((d) => (
                          <Cell key={d.name} fill={d.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <p>Past outcomes do not indicate future results.</p>
                </div>
              ) : (
                <Empty
                  icon={Gamepad2}
                  title="No game sessions yet"
                  body="Session outcome counts appear after you log a settled session."
                />
              )}
            </section>
          </div>
          <ActivityCalendar items={items} />
          <div className="calculation-note">
            <CircleHelp size={17} />
            <span>
              Net result = gross payouts − wagers − fees. Pending activities are excluded from realized
              totals. Return rate = gross payouts ÷ total cost.
            </span>
          </div>
        </>
      )}
    </>
  )
}

function LimitsPage({
  items,
  limits,
  onSave,
}: {
  items: Activity[]
  limits: Limits
  onSave: (l: Limits) => Promise<void>
}) {
  const [weekly, setWeekly] = useState(limits.weekly_cents === null ? '' : String(limits.weekly_cents / 100))
  const [monthly, setMonthly] = useState(
    limits.monthly_cents === null ? '' : String(limits.monthly_cents / 100),
  )
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    setWeekly(limits.weekly_cents === null ? '' : String(limits.weekly_cents / 100))
    setMonthly(limits.monthly_cents === null ? '' : String(limits.monthly_cents / 100))
  }, [limits])
  const weekStart = localDate(startOfWeek(new Date()))
  const monthStart = periodStart('month')
  const weeklySpent = spending(items.filter((a) => a.occurred_on >= weekStart))
  const monthlySpent = spending(items.filter((a) => a.occurred_on >= monthStart))
  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const next = {
      weekly_cents: weekly === '' ? null : cents(weekly),
      monthly_cents: monthly === '' ? null : cents(monthly),
    }
    if (
      (next.weekly_cents !== null && next.weekly_cents <= 0) ||
      (next.monthly_cents !== null && next.monthly_cents <= 0)
    ) {
      setError('Limits must be greater than zero.')
      return
    }
    setBusy(true)
    try {
      await onSave(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save limits.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <div className="limits-intro">
        <div className="limits-icon">
          <Goal size={26} />
        </div>
        <div>
          <span className="eyebrow">FINANCIAL SELF-MONITORING</span>
          <h2>Make space for your boundaries.</h2>
          <p>
            Limits track recorded wagers and fees, including pending activities. Payouts never increase your
            remaining allowance.
          </p>
        </div>
      </div>
      <div className="limits-grid">
        {[
          { name: 'Weekly', spent: weeklySpent, limit: limits.weekly_cents, start: weekStart },
          { name: 'Monthly', spent: monthlySpent, limit: limits.monthly_cents, start: monthStart },
        ].map((x) => {
          const ratio = x.limit ? x.spent / x.limit : 0
          return (
            <div className="surface limit-card" key={x.name}>
              <div className="limit-title">
                <span>{x.name.toUpperCase()} LIMIT</span>
                <CalendarDays size={18} />
              </div>
              <strong>
                {money(x.spent)} <small>spent</small>
              </strong>
              <div className="limit-progress">
                <i
                  style={{ width: `${Math.min(100, ratio * 100)}%` }}
                  className={ratio >= 1 ? 'over' : ratio >= 0.8 ? 'near' : ''}
                />
              </div>
              <div className="limit-meta">
                <span>{x.limit ? `${money(Math.max(0, x.limit - x.spent))} remaining` : 'No limit set'}</span>
                <span>{x.limit ? `of ${money(x.limit)}` : `Since ${prettyDate(x.start)}`}</span>
              </div>
              {x.limit && ratio >= 0.8 && (
                <div className={`limit-warning ${ratio >= 1 ? 'over' : ''}`}>
                  {ratio >= 1
                    ? 'Your recorded spending has reached this limit.'
                    : 'You are approaching this limit.'}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <form className="surface limit-form" onSubmit={submit}>
        <div className="section-head">
          <div>
            <span className="eyebrow">YOUR BOUNDARIES</span>
            <h2>Configure spending limits</h2>
            <p>Leave either field blank to turn off that limit.</p>
          </div>
        </div>
        <div className="limit-inputs">
          <label>
            Weekly limit
            <span className="money-input">
              <b>$</b>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={weekly}
                onChange={(e) => setWeekly(e.target.value)}
                placeholder="Not set"
              />
            </span>
          </label>
          <label>
            Monthly limit
            <span className="money-input">
              <b>$</b>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={monthly}
                onChange={(e) => setMonthly(e.target.value)}
                placeholder="Not set"
              />
            </span>
          </label>
        </div>
        {error && <div className="form-error">{error}</div>}
        <button className="button primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save limits'}
          <ArrowRight size={16} />
        </button>
      </form>
      <div className="calculation-note">
        <LockKeyhole size={17} />
        <span>Limits are for awareness. They do not block activity or adjust when payouts occur.</span>
      </div>
    </>
  )
}

function Settings({
  email,
  cloud,
  total,
  onExport,
  onDeleteAll,
  onSignOut,
}: {
  email?: string
  cloud: boolean
  total: number
  onExport: () => void
  onDeleteAll: () => void
  onSignOut: () => void
}) {
  return (
    <div className="settings-layout">
      <section className="surface settings-card">
        <div className="section-head">
          <div>
            <span className="eyebrow">ACCOUNT</span>
            <h2>Your workspace</h2>
          </div>
          <span className="settings-icon">
            <ShieldCheck size={20} />
          </span>
        </div>
        <div className="setting-row">
          <div>
            <strong>Storage</strong>
            <p>
              {cloud
                ? 'Encrypted connection to your Supabase project'
                : 'Local preview — saved in this browser only'}
            </p>
          </div>
          <span className={`storage-tag ${cloud ? 'cloud' : ''}`}>
            {cloud ? <Cloud size={14} /> : <WalletCards size={14} />}{' '}
            {cloud ? 'Cloud connected' : 'Local preview'}
          </span>
        </div>
        <div className="setting-row">
          <div>
            <strong>Account</strong>
            <p>{email || 'No account connected'}</p>
          </div>
          {cloud && (
            <button className="text-link" onClick={onSignOut}>
              Sign out <LogOut size={15} />
            </button>
          )}
        </div>
        <div className="setting-row">
          <div>
            <strong>Records</strong>
            <p>{total} activities in your ledger</p>
          </div>
        </div>
      </section>
      <section className="surface settings-card">
        <div className="section-head">
          <div>
            <span className="eyebrow">YOUR DATA</span>
            <h2>Export & control</h2>
          </div>
        </div>
        <div className="setting-row">
          <div>
            <strong>Download your ledger</strong>
            <p>Export all records as a CSV file, including amounts in integer cents.</p>
          </div>
          <Button variant="secondary" onClick={onExport}>
            <Download size={16} /> Export CSV
          </Button>
        </div>
        <div className="setting-row">
          <div>
            <strong>Delete PlayLedger data</strong>
            <p>
              Permanently remove all records, ticket images, and spending limits. Your shared login stays
              available.
            </p>
          </div>
          <Button variant="danger" onClick={onDeleteAll}>
            <Trash2 size={16} /> Delete data
          </Button>
        </div>
      </section>
      <div className="settings-note">
        <CircleHelp size={17} />
        <span>
          PlayLedger records the information you enter. It does not connect to gambling providers or verify
          their statements.
        </span>
      </div>
    </div>
  )
}

export default App
