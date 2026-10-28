import type { Delegation, Fund, Member, Transaction, Wallet } from '../db/types'
import { fromMajor, toMajor } from './money'

export interface CurrencyTotals {
  income: number
  expense: number
}

export type PerCurrency = Record<string, CurrencyTotals>

export interface RateTable {
  /** tỷ giá 1 from = ? to (major units); null nếu không xác định được */
  rate(from: string, to: string): number | null
  /** quy đổi minor units from → minor units to; null nếu không có tỷ giá */
  convert(minor: number, from: string, to: string): number | null
  /** Tỷ giá bình quân gia quyền thực tế từ lịch sử đổi tiền */
  observed: Record<string, { from: string; to: string; sumFrom: number; sumTo: number; rate: number; count: number }>
}

export interface Ledger {
  walletBalances: Record<string, number>
  fundTotals: Record<string, PerCurrency>
  memberTotals: Record<string, PerCurrency>
  rates: RateTable
  /** tổng số dư từng tiền tệ trên toàn bộ ví */
  cashByCurrency: Record<string, number>
}

function add(pc: PerCurrency, currency: string, key: keyof CurrencyTotals, amount: number) {
  const t = (pc[currency] ??= { income: 0, expense: 0 })
  t[key] += amount
}

export function buildRateTable(transactions: Transaction[], delegation: Delegation): RateTable {
  const observed: RateTable['observed'] = {}
  for (const t of transactions) {
    if (t.type !== 'exchange' || !t.toCurrency || !t.toAmount) continue
    const key = `${t.currency}:${t.toCurrency}`
    const o = (observed[key] ??= { from: t.currency, to: t.toCurrency, sumFrom: 0, sumTo: 0, rate: 0, count: 0 })
    o.sumFrom += toMajor(t.amount, t.currency)
    o.sumTo += toMajor(t.toAmount, t.toCurrency)
    o.count++
  }
  for (const o of Object.values(observed)) o.rate = o.sumFrom > 0 ? o.sumTo / o.sumFrom : 0

  const manual = delegation.manualRates ?? {}

  function direct(from: string, to: string): number | null {
    if (from === to) return 1
    const o = observed[`${from}:${to}`]
    if (o && o.rate > 0) return o.rate
    const r = observed[`${to}:${from}`]
    if (r && r.rate > 0) return 1 / r.rate
    const m = manual[`${from}:${to}`]
    if (m && m > 0) return m
    const mr = manual[`${to}:${from}`]
    if (mr && mr > 0) return 1 / mr
    return null
  }

  function rate(from: string, to: string): number | null {
    const d = direct(from, to)
    if (d != null) return d
    // đi vòng qua tiền cầu nối (USD) hoặc tiền gốc (VND)
    for (const via of [delegation.bridgeCurrency, delegation.baseCurrency, delegation.localCurrency]) {
      if (via === from || via === to) continue
      const a = direct(from, via)
      const b = direct(via, to)
      if (a != null && b != null) return a * b
    }
    return null
  }

  function convert(minor: number, from: string, to: string): number | null {
    if (from === to) return minor
    const r = rate(from, to)
    if (r == null) return null
    return fromMajor(toMajor(minor, from) * r, to)
  }

  return { rate, convert, observed }
}

export function computeLedger(
  delegation: Delegation,
  members: Member[],
  wallets: Wallet[],
  funds: Fund[],
  transactions: Transaction[],
): Ledger {
  const walletBalances: Record<string, number> = {}
  for (const w of wallets) walletBalances[w.id] = 0
  const fundTotals: Record<string, PerCurrency> = {}
  for (const f of funds) fundTotals[f.id] = {}
  const memberTotals: Record<string, PerCurrency> = {}
  for (const m of members) memberTotals[m.id] = {}

  const bumpWallet = (id: string | undefined, delta: number) => {
    if (!id) return
    walletBalances[id] = (walletBalances[id] ?? 0) + delta
  }

  for (const t of transactions) {
    switch (t.type) {
      case 'income': {
        bumpWallet(t.walletId, t.amount)
        if (t.fundId) add((fundTotals[t.fundId] ??= {}), t.currency, 'income', t.amount)
        for (const s of t.splits) add((memberTotals[s.memberId] ??= {}), t.currency, 'income', s.amount)
        break
      }
      case 'expense': {
        bumpWallet(t.walletId, -t.amount)
        if (t.fundId) add((fundTotals[t.fundId] ??= {}), t.currency, 'expense', t.amount)
        for (const s of t.splits) add((memberTotals[s.memberId] ??= {}), t.currency, 'expense', s.amount)
        break
      }
      case 'exchange':
      case 'transfer': {
        bumpWallet(t.walletId, -t.amount)
        bumpWallet(t.toWalletId, t.toAmount ?? t.amount)
        break
      }
      case 'adjustment': {
        bumpWallet(t.walletId, t.amount)
        const key: keyof CurrencyTotals = t.amount >= 0 ? 'income' : 'expense'
        if (t.fundId) add((fundTotals[t.fundId] ??= {}), t.currency, key, Math.abs(t.amount))
        for (const s of t.splits) add((memberTotals[s.memberId] ??= {}), t.currency, key, Math.abs(s.amount))
        break
      }
    }
  }

  const cashByCurrency: Record<string, number> = {}
  for (const w of wallets) {
    cashByCurrency[w.currency] = (cashByCurrency[w.currency] ?? 0) + (walletBalances[w.id] ?? 0)
  }

  return { walletBalances, fundTotals, memberTotals, rates: buildRateTable(transactions, delegation), cashByCurrency }
}

/** Số dư ròng (thu − chi) của một PerCurrency, quy đổi về `to`. Trả về null nếu thiếu tỷ giá. */
export function netIn(pc: PerCurrency, to: string, rates: RateTable): number | null {
  let total = 0
  for (const [cur, t] of Object.entries(pc)) {
    const c = rates.convert(t.income - t.expense, cur, to)
    if (c == null) return null
    total += c
  }
  return total
}

export function sumIn(pc: PerCurrency, key: keyof CurrencyTotals, to: string, rates: RateTable): number | null {
  let total = 0
  for (const [cur, t] of Object.entries(pc)) {
    const c = rates.convert(t[key], cur, to)
    if (c == null) return null
    total += c
  }
  return total
}

/** Danh sách người mặc định chia tiền cho một quỹ. */
export function defaultParticipants(fund: Fund | undefined, members: Member[], delegation: Delegation): string[] {
  if (fund?.type === 'PERSONAL' && fund.memberId) return [fund.memberId]
  return members
    .filter((m) => m.role === 'delegate' || delegation.leaderSharesCosts)
    .map((m) => m.id)
}

export function memberName(members: Member[], id: string): string {
  return members.find((m) => m.id === id)?.name ?? '?'
}
