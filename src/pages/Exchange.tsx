import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { nanoid } from 'nanoid'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check } from 'lucide-react'
import { db, todayISO } from '../db/db'
import type { Transaction } from '../db/types'
import { useActiveDelegationId, useDelegationData, type DelegationData } from '../hooks/useDelegation'
import { netIn, sumIn } from '../lib/ledger'
import { currencyInfo, fmt, fmtRate, fromMajor, toMajor } from '../lib/money'
import { AmountInput, Frame, Header, HeroNumber, PrimaryButton, SectionLabel, Spinner, TopBar, cn, fmtDateShort } from '../components/ui'
import { ReceiptCapture, ReceiptThumb } from '../components/Receipt'

export default function Exchange() {
  const id = useActiveDelegationId()
  const { data, loading } = useDelegationData(id)
  const { txId } = useParams()
  const existing = useLiveQuery(() => (txId ? db.transactions.get(txId) : undefined), [txId])
  if (loading || !data || (txId && existing === undefined)) return <Frame nav><Spinner /></Frame>
  return <ExchangeScreen data={data} existing={existing ?? undefined} />
}

function ExchangeScreen({ data, existing }: { data: DelegationData; existing?: Transaction }) {
  const nav = useNavigate()
  const { delegation, wallets, ledger, funds, members, transactions } = data
  const { bridgeCurrency: bridge, localCurrency: local } = delegation
  const defaultFrom = wallets.find((w) => w.currency === bridge && w.kind === 'cash') ?? wallets[0]
  const defaultTo = wallets.find((w) => w.currency === local && w.kind === 'cash') ?? wallets[1] ?? wallets[0]
  const [fromId, setFromId] = useState(existing?.walletId ?? defaultFrom?.id ?? '')
  const [toId, setToId] = useState(existing?.toWalletId ?? defaultTo?.id ?? '')
  const [amount, setAmount] = useState<number | null>(existing?.amount ?? null)
  const [toAmount, setToAmount] = useState<number | null>(existing?.toAmount ?? null)
  const [date, setDate] = useState(existing?.date ?? todayISO())
  const [place, setPlace] = useState(existing?.description ?? '')
  const [blob, setBlob] = useState<Blob | null>(null)
  const existingReceipt = useLiveQuery(() => (existing?.receiptId ? db.receipts.get(existing.receiptId) : undefined), [existing?.receiptId])
  useEffect(() => { if (existingReceipt?.blob) setBlob(existingReceipt.blob) }, [existingReceipt?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const from = wallets.find((w) => w.id === fromId)
  const to = wallets.find((w) => w.id === toId)
  const isTransfer = !!from && !!to && from.currency === to.currency
  useEffect(() => { if (isTransfer && amount != null) setToAmount(amount) }, [isTransfer, amount])

  const exchanges = useMemo(() => transactions.filter((t) => t.type === 'exchange' && t.currency === bridge && t.toCurrency === local).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt)), [transactions, bridge, local])
  const obs = ledger.rates.observed[`${bridge}:${local}`]
  const avg = obs?.rate ?? ledger.rates.rate(bridge, local)
  const sumFrom = exchanges.reduce((s, t) => s + t.amount, 0)
  const sumTo = exchanges.reduce((s, t) => s + (t.toAmount ?? 0), 0)

  const rateThis = from && to && amount && toAmount ? toMajor(toAmount, to.currency) / toMajor(amount, from.currency) : null
  const isPair = from?.currency === bridge && to?.currency === local && !isTransfer
  const avgAfter = isPair && amount && toAmount
    ? (() => {
        const baseFrom = existing ? sumFrom - existing.amount : sumFrom
        const baseTo = existing ? sumTo - (existing.toAmount ?? 0) : sumTo
        return (toMajor(baseTo + toAmount, local)) / (toMajor(baseFrom + amount, bridge))
      })()
    : null

  // Pocket $/bé → nội tệ
  const delegates = members.filter((m) => m.role === 'delegate')
  const pocketUsd = delegates.map((m) => { const f = funds.find((x) => x.type === 'PERSONAL' && x.memberId === m.id); return f ? sumIn(ledger.fundTotals[f.id] ?? {}, 'income', bridge, ledger.rates) ?? 0 : 0 })
  const pocketPer = pocketUsd.length ? Math.round(pocketUsd.reduce((a, b) => a + b, 0) / pocketUsd.length) : 0
  const pocketLocalMinor = avg ? ledger.rates.convert(pocketPer, bridge, local) : null
  const pocketAfter = avgAfter ? fromMajor(toMajor(pocketPer, bridge) * avgAfter, local) : null

  const emergency = funds.find((f) => f.type === 'EMERGENCY')
  const emergencyUsd = emergency ? netIn(ledger.fundTotals[emergency.id] ?? {}, bridge, ledger.rates) : null
  const envelope = from ? ledger.walletBalances[from.id] ?? 0 : 0

  async function save() {
    setErr('')
    if (!from || !to) return setErr('Chọn ví')
    if (from.id === to.id) return setErr('Ví nguồn và ví đích phải khác nhau')
    if (!amount || amount <= 0) return setErr('Nhập số tiền đưa ra')
    if (!toAmount || toAmount <= 0) return setErr('Nhập số tiền nhận về')
    setBusy(true)
    try {
      const now = Date.now()
      const txIdNew = existing?.id ?? nanoid(10)
      let receiptId = existing?.receiptId
      await db.transaction('rw', [db.transactions, db.receipts], async () => {
        if (blob && blob !== existingReceipt?.blob) {
          if (receiptId) await db.receipts.delete(receiptId)
          receiptId = nanoid(10)
          await db.receipts.add({ id: receiptId, delegationId: delegation.id, transactionId: txIdNew, blob, mime: blob.type || 'image/jpeg', size: blob.size, createdAt: now })
        }
        if (!blob && receiptId) { await db.receipts.delete(receiptId); receiptId = undefined }
        const tx: Transaction = {
          id: txIdNew, delegationId: delegation.id, type: isTransfer ? 'transfer' : 'exchange', date,
          createdAt: existing?.createdAt ?? now, updatedAt: now,
          description: place.trim() || (isTransfer ? `Chuyển ${from.name} → ${to.name}` : `Đổi ${from.currency} → ${to.currency}`),
          amount, currency: from.currency, walletId: from.id, toWalletId: to.id, toAmount, toCurrency: to.currency, splits: [],
          receiptId, receiptUrl: receiptId === existing?.receiptId ? existing?.receiptUrl : undefined,
        }
        await db.transactions.put(tx)
      })
      if (existing) nav(`/tx/${txIdNew}`, { replace: true })
      else { setAmount(null); setToAmount(null); setPlace(''); setBlob(null); nav('/', { state: { toast: `Đã lưu lần đổi · ${fmt(amount, from.currency)} → ${fmt(toAmount, to.currency)}`, undoTxId: txIdNew } }) }
    } finally {
      setBusy(false)
    }
  }

  const walletSelect = (value: string, onChange: (v: string) => void) => (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      {wallets.map((w) => <option key={w.id} value={w.id}>{w.name} · {fmt(ledger.walletBalances[w.id] ?? 0, w.currency)}</option>)}
    </select>
  )

  return (
    <Frame nav>
      {existing ? <TopBar title="Sửa lần đổi" /> : <Header label={`Ví · ${exchanges.length} lần đổi`} title={`Đổi tiền ${bridge} → ${local}`} />}

      <HeroNumber
        label="Tỷ giá bình quân gia quyền"
        size="md"
        value={avg ? `${currencyInfo(local).symbol}${fmtRate(avg)}` : '—'}
        suffix={`/ 1 ${bridge}`}
        sub={obs ? `= ${fmt(sumTo, local)} ÷ ${fmt(sumFrom, bridge)} · tự tính lại sau mỗi lần đổi` : avg ? 'Tỷ giá nhập tay trong Cài đặt · sẽ thay bằng tỷ giá thực sau lần đổi đầu' : 'Chưa có lần đổi nào'}
      />

      <div className="grid grid-cols-2 border-b border-divider">
        <div className="px-5 py-3 border-r border-divider">
          <div className="section-label">Còn trong {from?.name ?? 'ví'}</div>
          <div className={cn('text-[22px] font-extrabold num', envelope < 0 && 'neg')}>{from ? fmt(envelope, from.currency) : '—'}</div>
          {emergencyUsd != null && emergencyUsd > 0 && from?.currency === bridge && <div className="text-[11px] text-neutral-700">{fmt(emergencyUsd, bridge)} khẩn cấp không đổi</div>}
        </div>
        <div className="px-5 py-3">
          <div className="section-label">Pocket {fmt(pocketPer, bridge)}/bé quy ra</div>
          <div className="text-[22px] font-extrabold num">{pocketLocalMinor != null ? fmt(pocketLocalMinor, local) : '—'}</div>
          <div className="text-[11px] text-neutral-700">theo tỷ giá BQ</div>
        </div>
      </div>

      <SectionLabel>Lần đổi mới · {fmtDateShort(date)}</SectionLabel>
      <div className="px-5 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div><span className="text-[12px] text-neutral-700 block mb-1">Từ ví</span>{walletSelect(fromId, setFromId)}</div>
          <div><span className="text-[12px] text-neutral-700 block mb-1">Vào ví</span>{walletSelect(toId, setToId)}</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><span className="text-[12px] text-neutral-700 block mb-1">Đưa ra</span>{from && <AmountInput value={amount} currency={from.currency} onChange={setAmount} autoFocus={!existing} />}</div>
          <div><span className="text-[12px] text-neutral-700 block mb-1">Nhận về</span>{to && <AmountInput value={toAmount} currency={to.currency} onChange={setToAmount} />}</div>
        </div>
        {isTransfer && <p className="text-[12px] text-neutral-700">Cùng loại tiền → chuyển ví, không có tỷ giá.</p>}
        <table className="w-full text-[13px]">
          <tbody>
            {!isTransfer && (
              <tr className="border-t border-divider"><td className="py-2 text-neutral-700">Tỷ giá lần này</td><td className="py-2 text-right font-extrabold num">{rateThis ? fmtRate(rateThis) : '—'}</td></tr>
            )}
            {isPair && (
              <>
                <tr className="border-t border-divider"><td className="py-2 text-neutral-700">Bình quân sau khi lưu</td><td className="py-2 text-right font-extrabold num">{avg ? fmtRate(avg) : '—'} → {avgAfter ? fmtRate(avgAfter) : '—'}</td></tr>
                <tr className="border-t border-divider"><td className="py-2 text-neutral-700">Pocket mỗi bé</td><td className="py-2 text-right font-extrabold num">{pocketLocalMinor != null ? fmt(pocketLocalMinor, local) : '—'} → {pocketAfter != null ? fmt(pocketAfter, local) : '—'}</td></tr>
              </>
            )}
            <tr className="border-t border-divider"><td className="py-2 text-neutral-700 align-middle">Nơi đổi</td><td className="py-1.5 text-right"><input className="input !h-9 text-right" placeholder="Money changer trong trại" value={place} onChange={(e) => setPlace(e.target.value)} /></td></tr>
            <tr className="border-t border-b border-divider"><td className="py-2 text-neutral-700 align-middle">Ngày</td><td className="py-1.5 text-right"><input type="date" className="input !h-9 text-right" value={date} onChange={(e) => setDate(e.target.value)} /></td></tr>
          </tbody>
        </table>
        <div><span className="text-[12px] text-neutral-700 block mb-1">Biên lai</span><ReceiptCapture blob={blob} onChange={setBlob} /></div>
        {from && amount != null && envelope < amount && <p className="text-[12px] neg">Ví {from.name} đang có {fmt(envelope, from.currency)}, ít hơn số tiền đưa ra.</p>}
        {err && <p className="text-[13px] neg">{err}</p>}
        <PrimaryButton icon={Check} disabled={busy} onClick={save}>{busy ? 'Đang lưu…' : existing ? 'Lưu thay đổi' : 'Lưu lần đổi'}</PrimaryButton>
      </div>

      {exchanges.length > 0 && (
        <>
          <SectionLabel top>Các lần đã đổi</SectionLabel>
          <div className="px-5 pb-6">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="section-label border-b-2 border-divider"><th className="text-left py-2 font-semibold">#</th><th className="text-left py-2 font-semibold">Lần đổi</th><th className="text-right py-2 font-semibold">Tỷ giá</th></tr>
              </thead>
              <tbody>
                {exchanges.map((t, i) => (
                  <tr key={t.id} className="border-b border-divider cursor-pointer hover:bg-ink/5" onClick={() => nav(`/tx/${t.id}`)}>
                    <td className="py-2 pr-2 text-neutral-700 num align-top">{String(i + 1).padStart(2, '0')}</td>
                    <td className="py-2 align-top">
                      <div className="font-semibold num">{fmt(t.amount, t.currency)} → {fmt(t.toAmount ?? 0, t.toCurrency ?? local)}</div>
                      <div className="text-[12px] text-neutral-700 flex items-center gap-2">{fmtDateShort(t.date)} · {t.description}<ReceiptThumb receiptId={t.receiptId} remoteUrl={t.receiptUrl} size="table" /></div>
                    </td>
                    <td className="py-2 text-right font-extrabold num align-top">{t.toAmount ? fmtRate(toMajor(t.toAmount, t.toCurrency ?? local) / toMajor(t.amount, t.currency)) : '—'}</td>
                  </tr>
                ))}
                <tr className="border-b-2 border-divider font-extrabold">
                  <td className="py-2" />
                  <td className="py-2 num">Tổng {fmt(sumFrom, bridge)} → {fmt(sumTo, local)}</td>
                  <td className="py-2 text-right num text-accent-700">{obs ? fmtRate(obs.rate) : '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </Frame>
  )
}
