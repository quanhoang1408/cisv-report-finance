import { db, setActiveDelegationId } from '../db/db'
import type { Snapshot, Transaction } from '../db/types'
import { fmt } from './money'
import { nanoid } from 'nanoid'

export async function buildSnapshot(delegationId: string, opts: { forParents?: boolean } = {}): Promise<Snapshot> {
  const delegation = await db.delegations.get(delegationId)
  if (!delegation) throw new Error('Không tìm thấy đoàn')
  const [members, wallets, funds, transactions, cashCounts] = await Promise.all([
    db.members.where('delegationId').equals(delegationId).sortBy('sortOrder'),
    db.wallets.where('delegationId').equals(delegationId).sortBy('sortOrder'),
    db.funds.where('delegationId').equals(delegationId).sortBy('sortOrder'),
    db.transactions.where('delegationId').equals(delegationId).toArray(),
    db.cashCounts.where('delegationId').equals(delegationId).toArray(),
  ])
  const { parentPin: _pin, publishToken: _tok, ...pub } = delegation
  void _pin
  void _tok
  const txs: Transaction[] = opts.forParents ? transactions.map((t) => ({ ...t, receiptId: t.receiptUrl ? undefined : t.receiptId })) : transactions
  return { version: 1, exportedAt: Date.now(), delegation: pub, members, wallets, funds, transactions: txs, cashCounts }
}

/** Sao lưu đầy đủ (kèm PIN, token) ra file JSON */
export async function exportBackup(delegationId: string) {
  const snap = await buildSnapshot(delegationId)
  const delegation = await db.delegations.get(delegationId)
  const payload = { ...snap, delegation, backup: true }
  download(`${delegation?.slug ?? 'cisv'}-backup-${snap.exportedAt}.json`, JSON.stringify(payload, null, 2), 'application/json')
}

export async function importSnapshotFile(file: File) {
  const text = await file.text()
  const snap = JSON.parse(text) as Snapshot & { delegation: Snapshot['delegation'] & { parentPin?: string; publishToken?: string } }
  if (!snap?.delegation?.id || !Array.isArray(snap.members)) throw new Error('Sai định dạng')
  const d = snap.delegation
  await db.transaction('rw', [db.delegations, db.members, db.wallets, db.funds, db.transactions, db.cashCounts], async () => {
    await db.delegations.put({ ...d, parentPin: d.parentPin ?? '0000', publishToken: d.publishToken ?? nanoid(24) })
    await db.members.bulkPut(snap.members)
    await db.wallets.bulkPut(snap.wallets)
    await db.funds.bulkPut(snap.funds)
    await db.transactions.bulkPut(snap.transactions)
    await db.cashCounts.bulkPut(snap.cashCounts ?? [])
  })
  setActiveDelegationId(d.id)
}

export async function exportCsv(delegationId: string) {
  const snap = await buildSnapshot(delegationId)
  const m = new Map(snap.members.map((x) => [x.id, x.name]))
  const f = new Map(snap.funds.map((x) => [x.id, x.name]))
  const w = new Map(snap.wallets.map((x) => [x.id, x.name]))
  const rows: string[][] = [['Ngày', 'Loại', 'Mô tả', 'Số tiền', 'Tiền tệ', 'Quỹ', 'Ví', 'Ví nhận', 'Tiền nhận', 'Chia cho', 'Ghi chú', 'Hoá đơn']]
  const sorted = [...snap.transactions].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt))
  for (const t of sorted) {
    rows.push([
      t.date,
      t.type,
      t.description,
      fmt(t.type === 'expense' ? -t.amount : t.amount, t.currency, { symbol: false }),
      t.currency,
      f.get(t.fundId ?? '') ?? '',
      w.get(t.walletId ?? '') ?? '',
      w.get(t.toWalletId ?? '') ?? '',
      t.toAmount != null ? fmt(t.toAmount, t.toCurrency ?? t.currency, { symbol: false }) : '',
      t.splits.map((s) => `${m.get(s.memberId) ?? '?'}: ${fmt(s.amount, t.currency, { symbol: false })}`).join('; '),
      t.note ?? '',
      t.receiptUrl ?? (t.receiptId ? 'có ảnh' : ''),
    ])
  }
  const csv = '﻿' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  download(`${snap.delegation.slug}-giao-dich.csv`, csv, 'text/csv;charset=utf-8')
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
