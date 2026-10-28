import { nanoid } from 'nanoid'
import { db, setActiveDelegationId } from './db'
import { MEMBER_COLORS, type Delegation, type Fund, type Member, type Wallet } from './types'
import { currencyInfo } from '../lib/money'

export interface NewDelegationInput {
  name: string
  programme: string
  hostCountry: string
  year: number
  localCurrency: string
  baseCurrency: string
  bridgeCurrency: string
  parentPin: string
  leaderName: string
  delegateNames: string[]
  usdToBase?: number
}

export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40)
}

export async function createDelegation(input: NewDelegationInput): Promise<string> {
  const now = Date.now()
  const id = nanoid(10)
  const slug = `${slugify(input.name) || 'doan'}-${nanoid(6).toLowerCase()}`
  const manualRates: Record<string, number> = {}
  if (input.usdToBase && input.usdToBase > 0) manualRates[`${input.bridgeCurrency}:${input.baseCurrency}`] = input.usdToBase

  const delegation: Delegation = {
    id,
    name: input.name,
    slug,
    programme: input.programme,
    hostCountry: input.hostCountry,
    year: input.year,
    baseCurrency: input.baseCurrency,
    bridgeCurrency: input.bridgeCurrency,
    localCurrency: input.localCurrency,
    parentPin: input.parentPin,
    leaderSharesCosts: false,
    manualRates,
    createdAt: now,
    updatedAt: now,
    publishToken: nanoid(24),
  }

  const members: Member[] = [
    { id: nanoid(8), delegationId: id, name: input.leaderName || 'Leader', role: 'leader', color: '#334155', sortOrder: 0 },
    ...input.delegateNames
      .map((n) => n.trim())
      .filter(Boolean)
      .map((name, i) => ({
        id: nanoid(8),
        delegationId: id,
        name,
        role: 'delegate' as const,
        color: MEMBER_COLORS[i % MEMBER_COLORS.length],
        sortOrder: i + 1,
      })),
  ]

  const local = currencyInfo(input.localCurrency)
  const wallets: Wallet[] = [
    { id: nanoid(8), delegationId: id, name: `Phong bì ${input.bridgeCurrency}`, currency: input.bridgeCurrency, kind: 'cash', sortOrder: 0 },
    { id: nanoid(8), delegationId: id, name: `Ví tiền mặt ${local.code}`, currency: local.code, kind: 'cash', sortOrder: 1 },
    { id: nanoid(8), delegationId: id, name: `Tiền mặt ${input.baseCurrency}`, currency: input.baseCurrency, kind: 'cash', sortOrder: 2 },
    { id: nanoid(8), delegationId: id, name: 'Thẻ / tài khoản Leader', currency: input.baseCurrency, kind: 'card', sortOrder: 3 },
  ]
  if (input.localCurrency === input.bridgeCurrency) wallets.splice(1, 1)

  const funds: Fund[] = [
    { id: nanoid(8), delegationId: id, name: 'Side Trip', type: 'SIDE_TRIP', currency: input.localCurrency, sortOrder: 0 },
    { id: nanoid(8), delegationId: id, name: 'Camp Money', type: 'CAMP_MONEY', currency: input.localCurrency, sortOrder: 1 },
    { id: nanoid(8), delegationId: id, name: 'Quà tặng', type: 'GIFT', currency: input.localCurrency, sortOrder: 2 },
    { id: nanoid(8), delegationId: id, name: 'Pre-camp', type: 'PRE_CAMP', currency: input.baseCurrency, sortOrder: 3 },
    { id: nanoid(8), delegationId: id, name: 'Khẩn cấp', type: 'EMERGENCY', currency: input.bridgeCurrency, sortOrder: 4 },
    ...members
      .filter((m) => m.role === 'delegate')
      .map((m, i) => ({
        id: nanoid(8),
        delegationId: id,
        name: `Pocket money – ${m.name}`,
        type: 'PERSONAL' as const,
        memberId: m.id,
        currency: input.bridgeCurrency,
        sortOrder: 10 + i,
      })),
  ]

  await db.transaction('rw', [db.delegations, db.members, db.wallets, db.funds], async () => {
    await db.delegations.add(delegation)
    await db.members.bulkAdd(members)
    await db.wallets.bulkAdd(wallets)
    await db.funds.bulkAdd(funds)
  })
  setActiveDelegationId(id)
  return id
}

export async function deleteDelegation(id: string) {
  await db.transaction('rw', [db.delegations, db.members, db.wallets, db.funds, db.transactions, db.receipts, db.cashCounts], async () => {
    await db.members.where('delegationId').equals(id).delete()
    await db.wallets.where('delegationId').equals(id).delete()
    await db.funds.where('delegationId').equals(id).delete()
    await db.transactions.where('delegationId').equals(id).delete()
    await db.receipts.where('delegationId').equals(id).delete()
    await db.cashCounts.where('delegationId').equals(id).delete()
    await db.delegations.delete(id)
  })
}
