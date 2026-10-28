import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Pencil, Trash2 } from 'lucide-react'
import { db } from '../db/db'
import { TX_TYPE_LABEL, type TxType } from '../db/types'
import { useActiveDelegationId, useDelegationData } from '../hooks/useDelegation'
import { fmt, fmtRate, toMajor } from '../lib/money'
import { Frame, Header, Money, SecondaryButton, SectionLabel, Segmented, Spinner, TopBar, confirmDialog, fmtDate } from '../components/ui'
import { TxList, splitNames } from '../components/shared'
import { ReceiptThumb } from '../components/Receipt'

export function Transactions() {
  const id = useActiveDelegationId()
  const { data, loading } = useDelegationData(id)
  const [params] = useSearchParams()
  const [q, setQ] = useState('')
  const [type, setType] = useState<TxType | 'all'>('all')
  const [fundId, setFundId] = useState('')
  const dateFilter = params.get('date')

  const list = useMemo(() => {
    if (!data) return []
    const s = q.trim().toLowerCase()
    return data.transactions.filter((t) => (type === 'all' || t.type === type) && (!fundId || t.fundId === fundId) && (!dateFilter || t.date === dateFilter) && (!s || t.description.toLowerCase().includes(s) || (t.note ?? '').toLowerCase().includes(s)))
  }, [data, q, type, fundId, dateFilter])

  if (loading || !data) return <Frame nav><Spinner /></Frame>

  const totals: Record<string, number> = {}
  for (const t of list) if (t.type === 'expense') totals[t.currency] = (totals[t.currency] ?? 0) + t.amount

  return (
    <Frame nav>
      <Header label={`${list.length} giao dịch${dateFilter ? ` · ${fmtDate(dateFilter)}` : ''}`} title="Sổ chi" />
      <div className="px-5 space-y-2.5 pb-3">
        <input className="input" placeholder="Tìm theo nội dung" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
          <Segmented small value={type} onChange={setType} options={[{ value: 'all', label: 'Tất cả' }, ...(Object.keys(TX_TYPE_LABEL) as TxType[]).map((t) => ({ value: t, label: TX_TYPE_LABEL[t] }))]} />
        </div>
        <select className="input" value={fundId} onChange={(e) => setFundId(e.target.value)}>
          <option value="">Mọi quỹ</option>
          {data.funds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        {Object.keys(totals).length > 0 && <div className="text-[12px] text-neutral-700 num">Tổng chi: {Object.entries(totals).map(([c, v]) => fmt(v, c)).join(' · ')}</div>}
      </div>
      <TxList data={data} transactions={list} link />
    </Frame>
  )
}

export function TransactionDetail() {
  const id = useActiveDelegationId()
  const { data, loading } = useDelegationData(id)
  const { txId } = useParams()
  const nav = useNavigate()
  const t = useLiveQuery(() => (txId ? db.transactions.get(txId) : undefined), [txId])
  const cashCount = useLiveQuery(() => (txId && id ? db.cashCounts.where('delegationId').equals(id).filter((c) => c.adjustmentTxnId === txId).first() : undefined), [txId, id])

  if (loading || !data || t === undefined) return <Frame><Spinner /></Frame>
  if (!t) return <Frame><TopBar title="Giao dịch" /><p className="p-5 text-[13px] text-neutral-700">Không tìm thấy giao dịch.</p></Frame>

  const { funds, wallets, members } = data
  const fund = funds.find((f) => f.id === t.fundId)
  const wallet = wallets.find((w) => w.id === t.walletId)
  const toWallet = wallets.find((w) => w.id === t.toWalletId)
  const isXfer = t.type === 'exchange' || t.type === 'transfer'

  async function remove() {
    if (!confirmDialog('Xoá giao dịch này?')) return
    await db.transaction('rw', [db.transactions, db.receipts, db.cashCounts], async () => {
      if (t!.receiptId) await db.receipts.delete(t!.receiptId)
      if (cashCount) await db.cashCounts.update(cashCount.id, { adjustmentTxnId: undefined })
      await db.transactions.delete(t!.id)
    })
    nav('/tx', { replace: true })
  }

  const rows: [string, React.ReactNode][] = [
    ['Ngày', fmtDate(t.date)],
    ...(fund ? [['Quỹ', fund.name] as [string, React.ReactNode]] : []),
    ...(wallet ? [[isXfer ? 'Từ ví' : t.type === 'income' ? 'Vào ví' : 'Từ ví', wallet.name] as [string, React.ReactNode]] : []),
    ...(toWallet ? [['Vào ví', toWallet.name] as [string, React.ReactNode]] : []),
    ...(t.type === 'exchange' && t.toAmount && t.toCurrency ? [['Tỷ giá', `1 ${t.currency} = ${fmtRate(toMajor(t.toAmount, t.toCurrency) / toMajor(t.amount, t.currency))} ${t.toCurrency}`] as [string, React.ReactNode]] : []),
    ...(t.splits.length ? [[t.type === 'income' ? 'Người góp' : 'Chia cho', splitNames(t, members)] as [string, React.ReactNode]] : []),
    ...(t.note ? [['Ghi chú', t.note] as [string, React.ReactNode]] : []),
    ...(cashCount ? [['Kiểm két', `Sổ ${fmt(cashCount.bookBalance, t.currency)} · đếm ${fmt(cashCount.countedAmount, t.currency)}`] as [string, React.ReactNode]] : []),
  ]

  return (
    <Frame>
      <TopBar title={TX_TYPE_LABEL[t.type]} meta={fmtDate(t.date)} />
      <div className="px-5 pt-5 pb-4 border-b-2 border-divider">
        <div className="section-label mb-2">{t.description}</div>
        {t.type === 'exchange' ? (
          <div className="text-[36px] leading-none font-extrabold num tracking-[-0.03em]">{fmt(t.amount, t.currency)} <span className="text-neutral-600">→</span> {fmt(t.toAmount ?? 0, t.toCurrency ?? t.currency)}</div>
        ) : (
          <Money minor={t.type === 'expense' ? -t.amount : t.amount} currency={t.currency} sign className="text-hero-sm block" />
        )}
      </div>
      <table className="w-full text-[14px] mx-5" style={{ width: 'calc(100% - 40px)' }}>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-b border-divider"><td className="py-2.5 text-neutral-700 w-28">{k}</td><td className="py-2.5 text-right font-semibold">{v}</td></tr>
          ))}
        </tbody>
      </table>

      {t.splits.length > 0 && (
        <>
          <SectionLabel>{t.type === 'income' ? 'Người góp' : 'Chia cho'}</SectionLabel>
          <div className="px-5">
            {t.splits.map((s) => (
              <div key={s.memberId} className="flex items-center justify-between py-2 border-b border-divider text-[14px]">
                <span className="font-semibold">{members.find((m) => m.id === s.memberId)?.name ?? '?'}</span>
                <span className="num font-extrabold">{fmt(s.amount, t.currency)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {(t.receiptId || t.receiptUrl) && (
        <>
          <SectionLabel>Hoá đơn</SectionLabel>
          <div className="px-5"><ReceiptThumb receiptId={t.receiptId} remoteUrl={t.receiptUrl} size="form" /></div>
        </>
      )}

      <div className="px-5 pt-6 pb-8 grid grid-cols-2 gap-2">
        <Link to={isXfer ? `/exchange/${t.id}` : `/tx/${t.id}/edit`} className="btn-secondary"><Pencil size={18} /><span>Sửa</span></Link>
        <SecondaryButton icon={Trash2} danger onClick={remove}>Xoá</SecondaryButton>
      </div>
    </Frame>
  )
}
