import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowLeftRight, ArrowRight, Check, CloudOff, Delete, Gift, House, Info, LayoutGrid, List, Lock, Plane, Plus,
  RefreshCw, Scale, Tent, Wallet, X, CreditCard, Landmark, Mail, type LucideIcon,
} from 'lucide-react'
import type { Fund, FundType, Member, Wallet as WalletT } from '../db/types'
import { CURRENCIES, currencyInfo, fmt, parseAmount, toMajor } from '../lib/money'

export function cn(...xs: (string | false | null | undefined)[]): string {
  return xs.filter(Boolean).join(' ')
}

/* ============ Layout ============ */

/** Khung màn hình mobile 390px, căn giữa trên desktop */
export function Frame({ children, nav, className }: { children: ReactNode; nav?: boolean; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-[480px] min-h-screen bg-paper flex flex-col', nav && 'pb-[78px]', className)}>{children}</div>
}

/** Header: label nhỏ + H1 26px (L1, L5, L6, P1, P2) */
export function Header({ label, title, right, back }: { label?: ReactNode; title: ReactNode; right?: ReactNode; back?: string | boolean }) {
  const nav = useNavigate()
  return (
    <div className="px-5 pt-4 pb-3 flex items-start gap-3">
      {back && (
        <button className="w-11 h-11 -ml-3 -mt-1 flex items-center justify-center shrink-0" aria-label="Quay lại" onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))}>
          <ArrowLeft size={22} />
        </button>
      )}
      <div className="flex-1 min-w-0">
        {label && <div className="section-label mb-1.5">{label}</div>}
        <h1 className="text-[26px] leading-[1.15] font-extrabold text-ink">{title}</h1>
      </div>
      {right && <div className="shrink-0 pt-0.5">{right}</div>}
    </div>
  )
}

/** Top bar cho form: X · tiêu đề 16px/800 · phụ chú phải */
export function TopBar({ title, meta, onClose, back }: { title: string; meta?: ReactNode; onClose?: () => void; back?: () => void }) {
  const nav = useNavigate()
  return (
    <div className="h-14 flex items-center px-2 border-b-2 border-divider">
      <button className="w-11 h-11 flex items-center justify-center" aria-label={back ? 'Quay lại' : 'Đóng'} onClick={back ?? onClose ?? (() => nav(-1))}>
        {back ? <ArrowLeft size={22} /> : <X size={22} />}
      </button>
      <div className="flex-1 text-[16px] font-extrabold px-1">{title}</div>
      {meta && <div className="text-[12px] text-neutral-700 pr-3 num">{meta}</div>}
    </div>
  )
}

export function SectionLabel({ children, right, top }: { children: ReactNode; right?: ReactNode; top?: boolean }) {
  return (
    <div className={cn('flex items-end justify-between px-5 pt-5 pb-2.5', top && 'rule-2')}>
      <span className="section-label">{children}</span>
      {right && <span className="section-label">{right}</span>}
    </div>
  )
}

/** HeroNumber: label → số hero → dòng quy đổi */
export function HeroNumber({ label, value, sub, size = 'lg', negative, suffix }: { label: ReactNode; value: ReactNode; sub?: ReactNode; size?: 'xl' | 'lg' | 'md' | 'sm'; negative?: boolean; suffix?: ReactNode }) {
  const cls = { xl: 'text-hero-xl', lg: 'text-hero-lg', md: 'text-hero-md', sm: 'text-hero-sm' }[size]
  return (
    <div className="rule-2 px-5 pt-[18px] pb-5 flex flex-col gap-2">
      <div className="section-label">{label}</div>
      <div className={cn(cls, 'num break-all', negative ? 'text-accent-700' : 'text-ink')}>
        {value}
        {suffix && <span className="text-[17px] font-semibold text-neutral-700 ml-2 tracking-normal">{suffix}</span>}
      </div>
      {sub && <div className="text-[13px] text-neutral-700 num">{sub}</div>}
    </div>
  )
}

/** ActionSplit: 2 nút ngang */
export function ActionSplit({ items }: { items: { label: string; icon: LucideIcon; to?: string; onClick?: () => void }[] }) {
  return (
    <div className="grid grid-cols-2 border-y-2 border-divider">
      {items.map((it, i) => {
        const inner = (
          <>
            <it.icon size={18} />
            <span className="text-[14px] font-semibold">{it.label}</span>
          </>
        )
        const cls = cn('h-[52px] px-5 flex items-center gap-2.5 hover:bg-ink/7', i > 0 && 'border-l-2 border-divider')
        return it.to ? <Link key={it.label} to={it.to} className={cn(cls, 'text-ink')}>{inner}</Link> : <button key={it.label} className={cls} onClick={it.onClick}>{inner}</button>
      })}
    </div>
  )
}

/** WalletCell: lưới 3 cột */
export function WalletCells({ cells }: { cells: { icon: LucideIcon; name: string; value: ReactNode; note?: ReactNode; negative?: boolean }[] }) {
  return (
    <div className="grid grid-cols-3 border-t border-divider">
      {cells.map((c, i) => (
        <div key={i} className={cn('px-3 py-3 min-w-0', i % 3 !== 0 && 'border-l border-divider', i >= 3 && 'border-t border-divider')}>
          <c.icon size={18} />
          <div className="text-[11px] text-neutral-700 mt-1.5 truncate">{c.name}</div>
          <div className={cn('text-[18px] font-extrabold num truncate', c.negative && 'neg')}>{c.value}</div>
          {c.note && <div className="text-[11px] text-neutral-700 truncate">{c.note}</div>}
        </div>
      ))}
    </div>
  )
}

export function ProgressBar({ value, max, fill = 'bg-ink', height = 4 }: { value: number; max: number; fill?: string; height?: number }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div className="w-full bg-neutral-300" style={{ height }}>
      <div className={cn('h-full', fill)} style={{ width: `${pct}%` }} />
    </div>
  )
}

/* ============ Tab bar ============ */

export function TabBar() {
  const { pathname } = useLocation()
  const tabs = [
    { to: '/', label: 'Tổng quan', icon: LayoutGrid },
    { to: '/tx', label: 'Sổ chi', icon: List },
    null,
    { to: '/exchange', label: 'Đổi tiền', icon: ArrowLeftRight },
    { to: '/count', label: 'Kiểm két', icon: Scale },
  ]
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-paper safe-bottom">
      <div className="mx-auto max-w-[480px] grid grid-cols-5 h-[78px] border-t-2 border-ink">
        {tabs.map((t) =>
          t === null ? (
            <Link key="fab" to="/add" className="flex items-start justify-center pt-2" aria-label="Khoản chi mới">
              <span className="w-[58px] h-[50px] bg-accent text-paper flex items-center justify-center hover:bg-accent-600 active:bg-accent-700"><Plus size={26} /></span>
            </Link>
          ) : (
            <Link
              key={t.to}
              to={t.to}
              className={cn('pt-3 pl-3.5 flex flex-col gap-1.5', isActive(pathname, t.to) ? 'text-ink font-semibold' : 'text-neutral-700')}
              style={isActive(pathname, t.to) ? { boxShadow: 'inset 0 3px 0 #0057B8' } : undefined}
            >
              <t.icon size={20} />
              <span className="text-[11px]">{t.label}</span>
            </Link>
          ),
        )}
      </div>
    </nav>
  )
}
function isActive(pathname: string, to: string): boolean {
  return pathname === to || (to !== '/' && pathname.startsWith(to))
}

/* ============ Controls ============ */

export function Segmented<T extends string>({ options, value, onChange, small, className }: { options: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; small?: boolean; className?: string }) {
  return (
    <div className={cn('inline-flex border border-divider', className)}>
      {options.map((o, idx) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'flex items-center justify-center whitespace-nowrap',
            small ? 'h-8 px-2.5 text-[12px]' : 'h-[38px] px-3.5 text-[13px]',
            idx > 0 && 'border-l border-divider',
            o.value === value ? 'bg-accent text-paper font-extrabold' : 'text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Chip({ selected, icon: Icon, children, onClick }: { selected?: boolean; icon?: LucideIcon; children: ReactNode; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn('chip', selected && 'chip-selected')}>
      {Icon && <Icon size={14} />}
      {children}
    </button>
  )
}

export function Tag({ variant = 'neutral', icon: Icon, children, className }: { variant?: 'accent' | 'neutral'; icon?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <span className={cn('tag', variant === 'accent' ? 'tag-accent' : 'tag-neutral', className)}>
      {Icon && <Icon size={13} />}
      {children}
    </span>
  )
}

export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <div className="info-note">
      <Info size={15} className="shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  )
}

export function PrimaryButton({ children, icon: Icon = ArrowRight, small, className, ...rest }: { children: ReactNode; icon?: LucideIcon | null; small?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={cn('btn-primary', small && 'btn-primary-sm', className)} {...rest}>
      <span>{children}</span>
      {Icon && <Icon size={20} />}
    </button>
  )
}

export function SecondaryButton({ children, icon: Icon, className, danger, ...rest }: { children: ReactNode; icon?: LucideIcon; danger?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={cn('btn-secondary', danger && 'btn-danger', className)} {...rest}>
      {Icon && <Icon size={18} />}
      <span>{children}</span>
    </button>
  )
}

export function TextLink({ to, onClick, children }: { to?: string; onClick?: () => void; children: ReactNode }) {
  const inner = (
    <>
      <span>{children}</span>
      <ArrowRight size={16} />
    </>
  )
  return to ? <Link to={to} className="text-link">{inner}</Link> : <button type="button" onClick={onClick} className="text-link">{inner}</button>
}

export function Field({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: ReactNode }) {
  return (
    <div>
      <div className="section-label mb-2">{label}</div>
      {children}
      {hint && <p className="text-[12px] text-neutral-700 mt-1.5 leading-relaxed">{hint}</p>}
    </div>
  )
}

export function Spinner() {
  return <div className="flex justify-center py-10"><RefreshCw size={22} className="spin text-neutral-600" /></div>
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="px-5 py-4 text-[13px] text-neutral-700">
      <p>{children}</p>
      {action}
    </div>
  )
}

export function Toast({ msg, action }: { msg: string | null; action?: { label: string; onClick: () => void } }) {
  if (!msg) return null
  return (
    <div className="fixed bottom-[90px] inset-x-0 z-40 flex justify-center px-5 pointer-events-none">
      <div className="pointer-events-auto bg-ink text-paper text-[13px] px-4 h-11 flex items-center gap-4 max-w-[440px] w-full justify-between">
        <span className="truncate">{msg}</span>
        {action && <button className="font-extrabold text-accent-300 shrink-0" onClick={action.onClick}>{action.label}</button>}
      </div>
    </div>
  )
}

export function useToast(): [string | null, (m: string, ms?: number) => void, () => void] {
  const [msg, setMsg] = useState<string | null>(null)
  const t = useRef<number | undefined>(undefined)
  const show = (m: string, ms = 2500) => {
    setMsg(m)
    window.clearTimeout(t.current)
    t.current = window.setTimeout(() => setMsg(null), ms)
  }
  const hide = () => { window.clearTimeout(t.current); setMsg(null) }
  return [msg, show, hide]
}

/* ============ Money ============ */

export function Money({ minor, currency, sign, className = '' }: { minor: number | null | undefined; currency: string; sign?: boolean; className?: string }) {
  if (minor == null) return <span className={cn('text-neutral-600', className)}>—</span>
  return <span className={cn('num', minor < 0 && 'neg', className)}>{fmt(minor, currency, { sign })}</span>
}

/** Ô nhập tiền (52px, 22px/800). Trả về minor units. */
export function AmountInput({ value, currency, onChange, autoFocus, placeholder = '0', className = '' }: { value: number | null; currency: string; onChange: (v: number | null) => void; autoFocus?: boolean; placeholder?: string; className?: string }) {
  const [text, setText] = useState(value == null ? '' : String(toMajor(value, currency)))
  const lastEmitted = useRef(value)
  const lastCurrency = useRef(currency)
  const textRef = useRef(text)
  textRef.current = text
  useEffect(() => {
    if (currency !== lastCurrency.current) {
      lastCurrency.current = currency
      const v = parseAmount(textRef.current, currency)
      lastEmitted.current = v
      onChange(v)
      return
    }
    if (value !== lastEmitted.current) {
      setText(value == null ? '' : String(toMajor(value, currency)))
      lastEmitted.current = value
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, currency])
  const info = currencyInfo(currency)
  return (
    <div className={cn('relative', className)}>
      <input
        inputMode="decimal"
        autoFocus={autoFocus}
        className="input input-amount pr-12"
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          const v = parseAmount(e.target.value, currency)
          lastEmitted.current = v
          onChange(v)
        }}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-neutral-700">{info.symbol}</span>
    </div>
  )
}

export function CurrencySelect({ value, onChange, options, className = '' }: { value: string; onChange: (c: string) => void; options?: string[]; className?: string }) {
  const list = options ?? CURRENCIES.map((c) => c.code)
  return (
    <select className={cn('input', className)} value={value} onChange={(e) => onChange(e.target.value)}>
      {list.map((c) => (
        <option key={c} value={c}>{c} – {currencyInfo(c).name}</option>
      ))}
    </select>
  )
}

/** Bàn phím số dính đáy: 1-9 / . 0 ⌫ */
export function Keypad({ onKey, allowDecimal }: { onKey: (k: string) => void; allowDecimal: boolean }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del']
  return (
    <div className="grid grid-cols-3 border-t-2 border-ink bg-paper select-none">
      {keys.map((k, idx) => (
        <button
          key={k}
          type="button"
          disabled={k === '.' && !allowDecimal}
          onPointerDown={(e) => { e.preventDefault(); onKey(k) }}
          className={cn('h-[68px] pl-6 flex items-center text-[28px] font-semibold text-ink active:bg-ink/7 disabled:text-neutral-500', idx % 3 !== 2 && 'border-r border-divider', idx < 9 && 'border-b border-divider')}
          aria-label={k === 'del' ? 'Xoá' : k}
        >
          {k === 'del' ? <Delete size={24} /> : k}
        </button>
      ))}
    </div>
  )
}

/* ============ Members / funds ============ */

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(-2).map((w) => w[0]?.toUpperCase()).join('')
}

export function Avatar({ member, size = 44 }: { member: Member; size?: number }) {
  return (
    <span className="inline-flex items-center justify-center bg-surface text-ink font-extrabold shrink-0" style={{ width: size, height: size, fontSize: Math.round(size * 0.28) }}>
      {initials(member.name)}
    </span>
  )
}

/** MemberTile: lưới 5 cột, ô 60px; dưới ô là phần chia */
export function MemberTiles({ members, selected, onToggle, shares, currency }: { members: Member[]; selected: Set<string>; onToggle: (id: string) => void; shares?: Record<string, number>; currency?: string }) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {members.map((m) => {
        const on = selected.has(m.id)
        return (
          <div key={m.id} className="min-w-0">
            <button type="button" onClick={() => onToggle(m.id)} className={cn('relative w-full h-[60px] px-2 py-[7px] flex flex-col justify-end items-start border border-divider text-left', on && 'bg-ink text-paper border-ink')}>
              {on && <Check size={14} className="absolute top-1.5 right-1.5 text-accent-400" />}
              {m.role === 'leader' && <span className={cn('text-[10px] leading-none mb-1', on ? 'text-neutral-400' : 'text-neutral-700')}>Leader</span>}
              <span className="text-[13px] font-extrabold leading-none truncate w-full">{m.name}</span>
            </button>
            <div className={cn('text-[12px] font-semibold num mt-1 truncate', on ? 'text-ink' : 'text-neutral-600')}>
              {on && shares && currency && shares[m.id] != null ? fmt(shares[m.id], currency) : '—'}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export const FUND_ICON: Record<FundType, LucideIcon> = {
  PRE_CAMP: House,
  SIDE_TRIP: Plane,
  CAMP_MONEY: Tent,
  GIFT: Gift,
  EMERGENCY: Lock,
  PERSONAL: Wallet,
  OTHER: LayoutGrid,
}

export function WALLET_ICON(w: WalletT): LucideIcon {
  if (w.kind === 'card') return CreditCard
  if (w.kind === 'bank') return Landmark
  return w.currency === 'USD' || w.currency === 'EUR' ? Mail : Wallet
}

/** FundGrid: lưới 3 cột, ô 58px */
export function FundGrid({ funds, value, onChange, members }: { funds: Fund[]; value: string; onChange: (f: Fund) => void; members: Member[] }) {
  return (
    <div className="grid grid-cols-3 border-t border-l border-divider">
      {funds.map((f) => {
        const Icon = FUND_ICON[f.type]
        const on = f.id === value
        const m = f.memberId ? members.find((x) => x.id === f.memberId) : undefined
        const label = f.type === 'PERSONAL' && m ? `Pocket · ${m.name}` : f.name
        return (
          <button key={f.id} type="button" onClick={() => onChange(f)} className={cn('h-[58px] px-2.5 py-2 flex flex-col justify-between items-start border-r border-b border-divider text-left', on && 'bg-ink text-paper', f.type === 'EMERGENCY' && !on && 'text-neutral-600')}>
            <Icon size={16} />
            <span className={cn('text-[12px] leading-tight truncate w-full', on ? 'font-extrabold' : 'font-semibold')}>{label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
export function fmtDateShort(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}
export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

export function confirmDialog(msg: string): boolean {
  return window.confirm(msg)
}

export function OfflineTag({ pending }: { pending: number }) {
  return <Tag variant="accent" icon={CloudOff}>Offline{pending > 0 ? ` · ${pending} chờ` : ''}</Tag>
}
