import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { nanoid } from 'nanoid'
import { Check, Minus, Plus } from 'lucide-react'
import { db, todayISO } from '../db/db'
import { DENOMINATIONS, type CashCount as CashCountRow, type Transaction } from '../db/types'
import { useActiveDelegationId, useDelegationData, type DelegationData } from '../hooks/useDelegation'
import { defaultParticipants } from '../lib/ledger'
import { fmt, fromMajor, splitEqually } from '../lib/money'
import { AmountInput, Frame, Header, PrimaryButton, SectionLabel, Segmented, Spinner, Tag, TextLink, cn, fmtDateShort, fmtTime } from '../components/ui'

export default function CashCount() {
  const id = useActiveDelegationId()
  const { data, loading } = useDelegationData(id)
  if (loading || !data) return <Frame nav><Spinner /></Frame>
  return <Screen data={data} />
}

function Screen({ data }: { data: DelegationData }) {
  const nav = useNavigate()
  const { delegation, wallets, funds, members, ledger, cashCounts, transactions } = data
  const cashWallets = wallets.filter((w) => w.kind === 'cash')
  const [walletId, setWalletId] = useState(cashWallets.find((w) => w.currency === delegation.localCurrency)?.id ?? cashWallets[0]?.id ?? '')
  const wallet = wallets.find((w) => w.id === walletId)
  const cur = wallet?.currency ?? delegation.localCurrency
  const book = ledger.walletBalances[walletId] ?? 0
  const denoms = DENOMINATIONS[cur] ?? []
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loose, setLoose] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [fundId, setFundId] = useState(funds.find((f) => f.type === 'SIDE_TRIP')?.id ?? funds[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [touched, setTouched] = useState(false)

  const counted = useMemo(() => denoms.reduce((s, d) => s + fromMajor(d, cur) * (counts[d] ?? 0), 0) + (loose ?? 0), [denoms, counts, loose, cur])
  const diff = counted - book
  const today = todayISO()
  const todayExpenses = transactions.filter((t) => t.date === today && t.walletId === walletId && t.type === 'expense').length

  function bump(d: number, delta: number) {
    setTouched(true)
    setCounts((c) => ({ ...c, [d]: Math.max(0, (c[d] ?? 0) + delta) }))
  }

  async function save() {
    if (!wallet) return
    setBusy(true)
    try {
      const now = Date.now()
      const cc: CashCountRow = { id: nanoid(10), delegationId: delegation.id, walletId, date: today, bookBalance: book, countedAmount: counted, difference: diff, denominations: counts, looseChange: loose ?? undefined, note: note.trim() || undefined, createdAt: now }
      await db.transaction('rw', [db.cashCounts, db.transactions], async () => {
        if (diff !== 0) {
          const fund = funds.find((f) => f.id === fundId)
          const parts = defaultParticipants(fund, members, delegation)
          const tx: Transaction = {
            id: nanoid(10), delegationId: delegation.id, type: 'adjustment', date: today, createdAt: now, updatedAt: now,
            description: diff < 0 ? `Lệch tiền mặt (thiếu) · ${wallet.name}` : `Lệch tiền mặt (thừa) · ${wallet.name}`,
            note: note.trim() || undefined, amount: diff, currency: cur, walletId, fundId: fund?.id, splits: splitEqually(Math.abs(diff), parts),
          }
          await db.transactions.add(tx)
          cc.adjustmentTxnId = tx.id
        }
        await db.cashCounts.add(cc)
      })
      nav('/', { state: { toast: diff === 0 ? 'Đã lưu kiểm két · khớp sổ' : `Đã ghi điều chỉnh ${fmt(diff, cur, { sign: true })}` } })
    } finally {
      setBusy(false)
    }
  }

  const fundName = funds.find((f) => f.id === fundId)?.name ?? ''
  const now = new Date()

  return (
    <Frame nav>
      <Header label={`${fmtDateShort(today)} · ${now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · ${wallet?.name ?? ''}`.toUpperCase()} title="Kiểm két cuối ngày" />

      {cashWallets.length > 1 && (
        <div className="px-5 pb-3">
          <Segmented small value={walletId} onChange={(v) => { setWalletId(v); setCounts({}); setLoose(null); setTouched(false) }} options={cashWallets.map((w) => ({ value: w.id, label: w.name }))} />
        </div>
      )}

      <div className="grid grid-cols-2 border-t-2 border-divider">
        <div className="px-5 py-3 border-r border-divider">
          <div className="section-label">Theo sổ</div>
          <div className={cn('text-[28px] font-extrabold num', book < 0 && 'neg')}>{fmt(book, cur)}</div>
        </div>
        <div className="px-5 py-3">
          <div className="section-label">Đếm thực tế</div>
          <div className="text-[28px] font-extrabold num">{fmt(counted, cur)}</div>
        </div>
      </div>

      <div className="border-y-2 border-divider px-5 py-4">
        <div className="section-label mb-2">Chênh lệch</div>
        <div className="flex items-end justify-between gap-3">
          <div className={cn('text-hero-sm num', diff !== 0 && 'text-accent-700')}>{touched || loose != null ? fmt(diff, cur, { sign: true }) : '—'}</div>
          {(touched || loose != null) && (
            <Tag variant={diff === 0 ? 'neutral' : 'accent'}>{diff === 0 ? 'Khớp sổ' : diff < 0 ? 'Thiếu so với sổ' : 'Thừa so với sổ'}</Tag>
          )}
        </div>
      </div>

      <SectionLabel right="Thành tiền">Đếm theo mệnh giá</SectionLabel>
      <div className="border-t border-divider">
        {denoms.map((d) => (
          <div key={d} className="grid grid-cols-[64px_1fr_88px] items-center px-5 border-b border-divider">
            <div className="text-[16px] font-extrabold num">{fmt(fromMajor(d, cur), cur, { symbol: false })}</div>
            <div className="flex items-center justify-center gap-3 py-1.5">
              <button type="button" className="w-11 h-11 border border-divider flex items-center justify-center" onClick={() => bump(d, -1)} aria-label="Bớt"><Minus size={16} /></button>
              <input inputMode="numeric" className="w-12 text-center text-[18px] font-extrabold num bg-transparent outline-none" value={counts[d] ?? 0} onChange={(e) => { setTouched(true); setCounts({ ...counts, [d]: Math.max(0, Number(e.target.value.replace(/\D/g, '')) || 0) }) }} />
              <button type="button" className="w-11 h-11 border border-divider flex items-center justify-center" onClick={() => bump(d, 1)} aria-label="Thêm"><Plus size={16} /></button>
            </div>
            <div className="text-right text-[14px] font-semibold num">{fmt(fromMajor(d, cur) * (counts[d] ?? 0), cur)}</div>
          </div>
        ))}
        <div className="grid grid-cols-[64px_1fr_88px] items-center px-5 py-2 border-b border-divider">
          <div className="text-[14px] font-extrabold">Xu & lẻ</div>
          <div className="px-3"><AmountInput value={loose} currency={cur} onChange={setLoose} placeholder="0" /></div>
          <div className="text-right text-[14px] font-semibold num">{fmt(loose ?? 0, cur)}</div>
        </div>
      </div>

      <div className="px-5 pt-4 space-y-3">
        <textarea className="input" placeholder='Ghi chú · VD: "250 + xu lẻ. Có thể quên ghi taxi tối 03/01."' value={note} onChange={(e) => setNote(e.target.value)} />
        {diff !== 0 && (touched || loose != null) && (
          <div>
            <span className="text-[12px] text-neutral-700 block mb-1">Ghi khoản lệch vào quỹ</span>
            <select className="input" value={fundId} onChange={(e) => setFundId(e.target.value)}>
              {funds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
        )}
        <PrimaryButton icon={diff === 0 ? Check : undefined} disabled={busy || !(touched || loose != null)} onClick={save}>
          {busy ? 'Đang lưu…' : diff === 0 ? 'Lưu kiểm két · khớp sổ' : `Ghi bút toán điều chỉnh ${fmt(diff, cur, { sign: true })}`}
        </PrimaryButton>
        {diff !== 0 && (touched || loose != null) && (
          <p className="text-[12px] text-neutral-700">Ghi vào {fundName}, chia đều cho người thuộc quỹ. Số dư các ngày sau không bị xáo trộn.</p>
        )}
        {todayExpenses > 0 && <TextLink to={`/tx?date=${today}`}>Soát lại {todayExpenses} khoản chi hôm nay</TextLink>}
      </div>

      {cashCounts.length > 0 && (
        <>
          <SectionLabel top>Lần kiểm trước</SectionLabel>
          <div className="border-t border-divider mb-6">
            {cashCounts.slice(0, 8).map((c) => {
              const w = wallets.find((x) => x.id === c.walletId)
              return (
                <div key={c.id} className="px-5 py-2.5 border-b border-divider flex items-center justify-between text-[14px]">
                  <div>
                    <span className="font-semibold num">{fmtDateShort(c.date)} · {fmtTime(c.createdAt)}</span>
                    <span className="text-neutral-700"> · {w?.name}</span>
                  </div>
                  <span className={cn('font-semibold num', c.difference !== 0 && 'neg')}>{c.difference === 0 ? 'Khớp sổ' : `${c.difference < 0 ? 'Thiếu' : 'Thừa'} ${fmt(Math.abs(c.difference), w?.currency ?? cur)}${c.adjustmentTxnId ? ' · đã điều chỉnh' : ''}`}</span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </Frame>
  )
}
