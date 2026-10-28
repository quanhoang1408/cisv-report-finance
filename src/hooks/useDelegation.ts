import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getActiveDelegationId } from '../db/db'
import type { CashCount, Delegation, Fund, Member, Transaction, Wallet } from '../db/types'
import { computeLedger, type Ledger } from '../lib/ledger'

export interface DelegationData {
  delegation: Delegation
  members: Member[]
  wallets: Wallet[]
  funds: Fund[]
  transactions: Transaction[]
  cashCounts: CashCount[]
  ledger: Ledger
}

export function useActiveDelegationId(): string | null {
  const [id, setId] = useState(getActiveDelegationId())
  useEffect(() => {
    const h = () => setId(getActiveDelegationId())
    window.addEventListener('cisv:active-changed', h)
    return () => window.removeEventListener('cisv:active-changed', h)
  }, [])
  return id
}

export function sortTransactions(list: Transaction[]): Transaction[] {
  return [...list].sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1))
}

/** Tải toàn bộ dữ liệu của 1 đoàn từ IndexedDB (live) và tính sổ cái. */
export function useDelegationData(id: string | null): { data: DelegationData | null; loading: boolean; missing: boolean } {
  const delegation = useLiveQuery(() => (id ? db.delegations.get(id) : undefined), [id])
  const members = useLiveQuery(() => (id ? db.members.where('delegationId').equals(id).sortBy('sortOrder') : []), [id])
  const wallets = useLiveQuery(() => (id ? db.wallets.where('delegationId').equals(id).sortBy('sortOrder') : []), [id])
  const funds = useLiveQuery(() => (id ? db.funds.where('delegationId').equals(id).sortBy('sortOrder') : []), [id])
  const transactions = useLiveQuery(() => (id ? db.transactions.where('delegationId').equals(id).toArray() : []), [id])
  const cashCounts = useLiveQuery(() => (id ? db.cashCounts.where('delegationId').equals(id).toArray() : []), [id])

  const loading = id != null && (delegation === undefined || !members || !wallets || !funds || !transactions || !cashCounts)

  const data = useMemo<DelegationData | null>(() => {
    if (!id || !delegation || !members || !wallets || !funds || !transactions || !cashCounts) return null
    const txs = sortTransactions(transactions)
    return {
      delegation,
      members,
      wallets,
      funds,
      transactions: txs,
      cashCounts: [...cashCounts].sort((a, b) => b.createdAt - a.createdAt),
      ledger: computeLedger(delegation, members, wallets, funds, txs),
    }
  }, [id, delegation, members, wallets, funds, transactions, cashCounts])

  return { data, loading, missing: id != null && !loading && delegation == null }
}

export function useReceiptUrl(receiptId?: string, remoteUrl?: string): string | null {
  const receipt = useLiveQuery(() => (receiptId ? db.receipts.get(receiptId) : undefined), [receiptId])
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (receipt?.blob) {
      const u = URL.createObjectURL(receipt.blob)
      setUrl(u)
      return () => URL.revokeObjectURL(u)
    }
    setUrl(remoteUrl ?? receipt?.remoteUrl ?? null)
  }, [receipt, remoteUrl])
  return url
}
