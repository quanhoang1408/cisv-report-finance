import { Link } from 'react-router-dom'
import { ArrowLeftRight, Scale, Wallet, type LucideIcon } from 'lucide-react'
import type { Fund, Member, Transaction } from '../db/types'
import type { DelegationData } from '../hooks/useDelegation'
import { netIn, sumIn } from '../lib/ledger'
import { fmt, fmtRate } from '../lib/money'
import { ReceiptThumb } from './Receipt'
import { Avatar, Empty, FUND_ICON, Money, ProgressBar, cn, fmtDateShort } from './ui'

/* ---------- Giao dịch ---------- */

export function txIcon(t: Transaction, funds: Fund[]): LucideIcon {
  if (t.type === 'exchange' || t.type === 'transfer') return ArrowLeftRight
  if (t.type === 'adjustment') return Scale
  if (t.type === 'income') return Wallet
  const f = funds.find((x) => x.id === t.fundId)
  return f ? FUND_ICON[f.type] : Wallet
}

export function txSigned(t: Transaction): number {
  return t.type === 'expense' ? -t.amount : t.amount
}

export function splitNames(t: Transaction, members: Member[]): string {
  if (t.splits.length === 0) return ''
  if (t.splits.length === members.length) return 'cả đoàn'
  const delegates = members.filter((m) => m.role === 'delegate')
  if (t.splits.length === delegates.length && delegates.every((d) => t.splits.some((s) => s.memberId === d.id))) return `${delegates.length} bé`
  return t.splits.map((s) => members.find((m) => m.id === s.memberId)?.name ?? '?').join(', ')
}

/** Hàng khoản chi: thumb · tên + meta · số */
export function TxRow({ t, data, linkTo, memberId }: { t: Transaction; data: DelegationData; linkTo?: string; memberId?: string }) {
  const { funds, members, wallets } = data
  const fund = funds.find((f) => f.id === t.fundId)
  const wallet = wallets.find((w) => w.id === t.walletId)
  const toWallet = wallets.find((w) => w.id === t.toWalletId)
  const share = memberId ? t.splits.find((s) => s.memberId === memberId)?.amount : undefined
  const isXfer = t.type === 'exchange' || t.type === 'transfer'
  const Icon = txIcon(t, funds)
  const shown = share != null ? (t.type === 'expense' ? -share : t.type === 'adjustment' && t.amount < 0 ? -share : share) : txSigned(t)

  const meta = [fmtDateShort(t.date), fund?.name.replace('Pocket money – ', 'Pocket · '), isXfer ? `${wallet?.name ?? ''} → ${toWallet?.name ?? ''}` : splitNames(t, members)].filter(Boolean).join(' · ')

  const body = (
    <div className="flex items-center gap-3 px-5 py-[9px] border-t border-divider">
      {!isXfer && t.type !== 'income' ? <ReceiptThumb receiptId={t.receiptId} remoteUrl={t.receiptUrl} size="list" showMissing /> : <span className="w-10 h-[50px] flex items-center justify-center text-neutral-700"><Icon size={18} /></span>}
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-semibold truncate">{t.description || (isXfer ? 'Đổi tiền' : 'Giao dịch')}</div>
        <div className="text-[12px] text-neutral-700 truncate">{meta}</div>
      </div>
      <div className="text-right shrink-0">
        {t.type === 'exchange' ? (
          <>
            <div className="text-[13px] num">{fmt(t.amount, t.currency)}</div>
            <div className="text-[15px] font-extrabold num">→ {fmt(t.toAmount ?? 0, t.toCurrency ?? t.currency)}</div>
          </>
        ) : (
          <>
            <Money minor={shown} currency={t.currency} className="text-[15px] font-extrabold" />
            {share != null && share !== t.amount && <div className="text-[11px] text-neutral-700 num">/ {fmt(t.amount, t.currency)}</div>}
          </>
        )}
      </div>
    </div>
  )
  return linkTo ? <Link to={linkTo} className="block text-ink hover:bg-ink/5">{body}</Link> : body
}

export function TxList({ data, transactions, link, memberId, emptyText = 'Chưa có giao dịch nào.' }: { data: DelegationData; transactions: Transaction[]; link?: boolean; memberId?: string; emptyText?: string }) {
  if (transactions.length === 0) return <Empty>{emptyText}</Empty>
  return (
    <div className="border-b border-divider">
      {transactions.map((t) => (
        <TxRow key={t.id} t={t} data={data} memberId={memberId} linkTo={link ? `/tx/${t.id}` : undefined} />
      ))}
    </div>
  )
}

/* ---------- Quỹ (FundRow) ---------- */

export function fundStats(data: DelegationData, fund: Fund) {
  const { ledger } = data
  const pc = ledger.fundTotals[fund.id] ?? {}
  const cur = fund.currency
  const inc = sumIn(pc, 'income', cur, ledger.rates) ?? 0
  const exp = sumIn(pc, 'expense', cur, ledger.rates) ?? 0
  const net = netIn(pc, cur, ledger.rates)
  const budget = fund.budget && fund.budget > 0 ? fund.budget : inc
  const pct = budget > 0 ? Math.round((exp / budget) * 100) : 0
  return { pc, cur, inc, exp, net, budget, pct }
}

export function FundRow({ data, fund, link }: { data: DelegationData; fund: Fund; link?: string }) {
  const { cur, exp, net, budget, pct } = fundStats(data, fund)
  const Icon = FUND_ICON[fund.type]
  const member = fund.memberId ? data.members.find((m) => m.id === fund.memberId) : undefined
  const body = (
    <div className="px-5 py-3 border-t border-divider">
      <div className="flex items-center gap-2.5">
        <Icon size={18} className="shrink-0" />
        <span className="flex-1 text-[15px] font-semibold truncate">{member ? `Pocket · ${member.name}` : fund.name}</span>
        <Money minor={net} currency={cur} className="text-[17px] font-extrabold" />
      </div>
      <div className="mt-2"><ProgressBar value={exp} max={budget} /></div>
      <div className="flex justify-between text-[12px] text-neutral-700 mt-1.5 num">
        <span>Đã chi {fmt(exp, cur)} / {fmt(budget, cur)}</span>
        <span>{fund.type === 'EMERGENCY' && exp === 0 ? 'niêm phong' : `${pct}%`}</span>
      </div>
    </div>
  )
  return link ? <Link to={link} className="block text-ink hover:bg-ink/5">{body}</Link> : body
}

/* ---------- Thành viên (PocketRow) ---------- */

export function memberStats(data: DelegationData, member: Member, currency?: string) {
  const { ledger, delegation } = data
  const pc = ledger.memberTotals[member.id] ?? {}
  const cur = currency ?? delegation.localCurrency
  const inc = sumIn(pc, 'income', cur, ledger.rates)
  const exp = sumIn(pc, 'expense', cur, ledger.rates)
  const net = netIn(pc, cur, ledger.rates)
  return { pc, cur, inc, exp, net }
}

export function PocketRow({ data, member, link }: { data: DelegationData; member: Member; link?: string }) {
  const { delegation, ledger } = data
  const { cur, inc, exp, net } = memberStats(data, member)
  const negative = net != null && net < 0
  const netBridge = netIn(ledger.memberTotals[member.id] ?? {}, delegation.bridgeCurrency, ledger.rates)
  const body = (
    <div className="grid grid-cols-[44px_1fr_auto] gap-3 items-center px-5 py-2.5 border-t border-divider">
      <Avatar member={member} />
      <div className="min-w-0">
        <div className="text-[15px] font-semibold truncate">{member.name}{member.role === 'leader' && <span className="text-[11px] text-neutral-700 font-normal ml-1.5">Leader</span>}</div>
        <ProgressBar value={negative ? 0 : (net ?? 0)} max={inc ?? 0} />
        <div className={cn('text-[12px] mt-1 num truncate', negative ? 'neg' : 'text-neutral-700')}>
          {negative ? `Âm ${fmt(Math.abs(netBridge ?? 0), delegation.bridgeCurrency)} · báo phụ huynh` : `Góp ${inc == null ? '—' : fmt(inc, cur)} · chi ${exp == null ? '—' : fmt(exp, cur)}`}
        </div>
      </div>
      <Money minor={net} currency={cur} className="text-[17px] font-extrabold" />
    </div>
  )
  return link ? <Link to={link} className="block text-ink hover:bg-ink/5">{body}</Link> : body
}

/* ---------- Quyết toán ---------- */

export function SettlementTable({ data }: { data: DelegationData }) {
  const { members, ledger, delegation } = data
  const { bridgeCurrency: bridge, baseCurrency: base } = delegation
  return (
    <div className="px-5">
      <table className="w-full text-[14px]">
        <thead>
          <tr className="section-label border-b-2 border-divider">
            <th className="text-left py-2 font-semibold">Thành viên</th>
            <th className="text-right py-2 font-semibold">Góp</th>
            <th className="text-right py-2 font-semibold">Chi</th>
            <th className="text-right py-2 font-semibold">Còn lại</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const pc = ledger.memberTotals[m.id] ?? {}
            const inc = sumIn(pc, 'income', bridge, ledger.rates)
            const exp = sumIn(pc, 'expense', bridge, ledger.rates)
            const net = netIn(pc, bridge, ledger.rates)
            const netBase = netIn(pc, base, ledger.rates)
            return (
              <tr key={m.id} className="border-b border-divider align-top">
                <td className="py-2.5 font-semibold">{m.name}</td>
                <td className="py-2.5 text-right num">{inc == null ? '—' : fmt(inc, bridge)}</td>
                <td className="py-2.5 text-right num">{exp == null ? '—' : fmt(exp, bridge)}</td>
                <td className="py-2.5 text-right">
                  <Money minor={net} currency={bridge} sign className="font-extrabold" />
                  {base !== bridge && <div className="text-[11px] text-neutral-700 num">{netBase == null ? '—' : fmt(netBase, base, { sign: true })}</div>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="text-[12px] text-neutral-700 py-3 leading-relaxed">Số dương: Leader hoàn lại phụ huynh. Số âm: phụ huynh cần chuyển thêm. Quy đổi theo tỷ giá bình quân gia quyền của các lần đổi tiền.</p>
    </div>
  )
}

/** Tóm tắt tỷ giá đang dùng */
export function ratesLine(data: DelegationData): string {
  const { ledger, delegation } = data
  const parts: string[] = []
  const o = ledger.rates.observed[`${delegation.bridgeCurrency}:${delegation.localCurrency}`]
  if (o) parts.push(`tỷ giá BQ ${fmtRate(o.rate)}`)
  else {
    const r = ledger.rates.rate(delegation.bridgeCurrency, delegation.localCurrency)
    if (r && delegation.localCurrency !== delegation.bridgeCurrency) parts.push(`tỷ giá tay ${fmtRate(r)}`)
  }
  const vb = delegation.manualRates?.[`${delegation.bridgeCurrency}:${delegation.baseCurrency}`]
  if (vb) parts.push(`1 ${delegation.bridgeCurrency} = ${fmt(Math.round(vb), delegation.baseCurrency)}`)
  return parts.join(' · ')
}

/** "≈ $256.16 · 6.750.000₫ · tỷ giá BQ 86.03" */
export function approxLine(data: DelegationData, minor: number, currency: string): string {
  const { ledger, delegation } = data
  const out: string[] = []
  for (const c of [delegation.bridgeCurrency, delegation.baseCurrency, delegation.localCurrency]) {
    if (c === currency || out.some((x) => x.endsWith(c))) continue
    const v = ledger.rates.convert(minor, currency, c)
    if (v != null) out.push(fmt(v, c))
  }
  const r = ratesLine(data)
  return (out.length ? '≈ ' + out.join(' · ') : '') + (r ? (out.length ? ' · ' : '') + r : '')
}
