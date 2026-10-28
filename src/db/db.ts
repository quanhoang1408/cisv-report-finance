import Dexie, { type EntityTable } from 'dexie'
import type { CashCount, Delegation, Fund, Member, Receipt, Transaction, Wallet } from './types'

export class CisvDB extends Dexie {
  delegations!: EntityTable<Delegation, 'id'>
  members!: EntityTable<Member, 'id'>
  wallets!: EntityTable<Wallet, 'id'>
  funds!: EntityTable<Fund, 'id'>
  transactions!: EntityTable<Transaction, 'id'>
  receipts!: EntityTable<Receipt, 'id'>
  cashCounts!: EntityTable<CashCount, 'id'>

  constructor() {
    super('cisv-finance')
    this.version(1).stores({
      delegations: 'id, slug',
      members: 'id, delegationId, [delegationId+sortOrder]',
      wallets: 'id, delegationId',
      funds: 'id, delegationId, memberId',
      transactions: 'id, delegationId, [delegationId+date], fundId, walletId, receiptId',
      receipts: 'id, delegationId, transactionId',
      cashCounts: 'id, delegationId, [delegationId+date]',
    })
  }
}

export const db = new CisvDB()

const ACTIVE_KEY = 'cisv.activeDelegationId'

export function getActiveDelegationId(): string | null {
  return localStorage.getItem(ACTIVE_KEY)
}

export function setActiveDelegationId(id: string | null) {
  if (id) localStorage.setItem(ACTIVE_KEY, id)
  else localStorage.removeItem(ACTIVE_KEY)
  window.dispatchEvent(new Event('cisv:active-changed'))
}

export function todayISO(): string {
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}
