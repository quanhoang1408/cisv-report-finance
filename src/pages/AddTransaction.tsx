import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { nanoid } from 'nanoid'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, CloudOff, Gift, Gamepad2, House, LayoutGrid, ShoppingBag, Ticket, Utensils, CarTaxiFront, type LucideIcon } from 'lucide-react'
import { db, todayISO } from '../db/db'
import { CATEGORIES, type Fund, type Transaction, type TxType } from '../db/types'
import { useActiveDelegationId, useDelegationData, type DelegationData } from '../hooks/useDelegation'
import { defaultParticipants } from '../lib/ledger'
import { currencyInfo, decimalsOf, fmt, fmtTyping, parseAmount, splitEqually, toMajor } from '../lib/money'
import { useOnline } from '../lib/sync'
import { AmountInput, Chip, Frame, FundGrid, InfoNote, Keypad, MemberTiles, PrimaryButton, SectionLabel, Segmented, Spinner, TopBar, cn } from '../components/ui'
import { ReceiptCapture } from '../components/Receipt'

const CAT_ICON: Record<string, LucideIcon> = { food: Utensils, taxi: CarTaxiFront, ticket: Ticket, shop: ShoppingBag, play: Gamepad2, hotel: House, gift: Gift, other: LayoutGrid }

export default function AddTransaction() {
  const id = useActiveDelegationId()
  const { data, loading } = useDelegationData(id)
  const { txId } = useParams()
  const existing = useLiveQuery(() => (txId ? db.transactions.get(txId) : undefined), [txId])
  if (loading || !data || (txId && existing === undefined)) return <Frame><Spinner /></Frame>
  if (txId && !existing) return <Frame><TopBar title="Giao dịch" /><p className="p-5 text-[13px] text-neutral-700">Không tìm thấy giao dịch.</p></Frame>
  return <TxForm data={data} existing={existing ?? undefined} />
}

type SplitMode = 'all' | 'delegates' | 'pick'

function TxForm({ data, existing }: { data: DelegationData; existing?: Transaction }) {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const online = useOnline()
  const { delegation, members, wallets, funds, transactions, ledger } = data
  const delegates = members.filter((m) => m.role === 'delegate')

  const [step, setStep] = useState<1 | 2>(existing ? 2 : 1)
  const [type, setType] = useState<TxType>(existing?.type ?? ((params.get('type') as TxType) || 'expense'))
  const [date, setDate] = useState(existing?.date ?? todayISO())
  const initialFund = funds.find((f) => f.id === (existing?.fundId ?? params.get('fund'))) ?? funds.find((f) => f.type === 'SIDE_TRIP') ?? funds[0]
  const [fundId, setFundId] = useState<string>(initialFund?.id ?? '')
  const fund = funds.find((f) => f.id === fundId)

  // Tiền tệ mặc định = tiền tệ ví dùng nhiều nhất trong 10 giao dịch gần đây, hoặc tiền nước đăng cai
  const defaultCurrency = useMemo(() => {
    if (existing) return existing.currency
    if (params.get('fund')) return initialFund?.currency ?? delegation.localCurrency
    const recent = transactions.filter((t) => t.type === 'expense').slice(0, 10)
    const count: Record<string, number> = {}
    for (const t of recent) count[t.currency] = (count[t.currency] ?? 0) + 1
    const best = Object.entries(count).sort((a, b) => b[1] - a[1])[0]
    return best?.[0] ?? delegation.localCurrency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [currency, setCurrency] = useState(defaultCurrency)
  const [typed, setTyped] = useState(existing ? String(toMajor(Math.abs(existing.amount), existing.currency)) : '')
  const amount = useMemo(() => parseAmount(typed, currency), [typed, currency])
  const [adjSign, setAdjSign] = useState<1 | -1>(existing && existing.type === 'adjustment' && existing.amount < 0 ? -1 : 1)
  const [description, setDescription] = useState(existing?.description ?? '')
  const [category, setCategory] = useState(existing?.category ?? '')
  const [note, setNote] = useState(existing?.note ?? '')
  const [walletId, setWalletId] = useState<string>(existing?.walletId ?? '')
  const [selected, setSelected] = useState<Set<string>>(new Set(existing ? existing.splits.map((s) => s.memberId) : defaultParticipants(initialFund, members, delegation)))
  const [customSplit, setCustomSplit] = useState(existing ? !isEqualSplit(existing) : false)
  const [custom, setCustom] = useState<Record<string, number | null>>(existing ? Object.fromEntries(existing.splits.map((s) => [s.memberId, s.amount])) : {})
  const [blob, setBlob] = useState<Blob | null>(null)
  const [removeReceipt, setRemoveReceipt] = useState(false)
  const existingReceipt = useLiveQuery(() => (existing?.receiptId ? db.receipts.get(existing.receiptId) : undefined), [existing?.receiptId])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (existingReceipt?.blob && !blob && !removeReceipt) setBlob(existingReceipt.blob)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingReceipt?.id])

  const currencyOptions = Array.from(new Set([delegation.localCurrency, delegation.bridgeCurrency, delegation.baseCurrency, ...wallets.map((w) => w.currency)]))
  const walletOptions = useMemo(() => wallets.filter((w) => w.currency === currency), [wallets, currency])
  useEffect(() => {
    if (!walletOptions.find((w) => w.id === walletId)) {
      const recentWallet = transactions.find((t) => t.currency === currency && t.walletId)?.walletId
      setWalletId(walletOptions.find((w) => w.id === recentWallet)?.id ?? walletOptions[0]?.id ?? '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletOptions])
  const wallet = wallets.find((w) => w.id === walletId)

  // Lặp lại: 3 khoản hay dùng nhất cùng tiền tệ
  const repeats = useMemo(() => {
    const map = new Map<string, { desc: string; amount: number; count: number; category?: string; fundId?: string }>()
    for (const t of transactions) {
      if (t.type !== 'expense' || t.currency !== currency || !t.description) continue
      const k = t.description.trim().toLowerCase()
      const e = map.get(k)
      if (e) e.count++
      else map.set(k, { desc: t.description.trim(), amount: t.amount, count: 1, category: t.category, fundId: t.fundId })
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 3)
  }, [transactions, currency])

  function pickFund(f: Fund) {
    if (f.type === 'EMERGENCY' && f.id !== fundId && !existing) {
      if (!window.confirm('Dùng quỹ khẩn cấp? Quỹ này chỉ mở khi có sự cố và cần ghi chú lý do.')) return
    }
    setFundId(f.id)
    if (!existing) setSelected(new Set(defaultParticipants(f, members, delegation)))
  }

  const splitMode: SplitMode = selected.size === members.length ? 'all' : delegates.length > 0 && selected.size === delegates.length && delegates.every((d) => selected.has(d.id)) ? 'delegates' : 'pick'
  function setMode(m: SplitMode) {
    if (m === 'all') setSelected(new Set(members.map((x) => x.id)))
    else if (m === 'delegates') setSelected(new Set(delegates.map((x) => x.id)))
    else setSelected(new Set())
  }

  const participantList = members.filter((m) => selected.has(m.id))
  const splits = useMemo(() => {
    if (amount == null) return []
    if (!customSplit) return splitEqually(amount, participantList.map((m) => m.id))
    return participantList.map((m) => ({ memberId: m.id, amount: custom[m.id] ?? 0 }))
  }, [amount, customSplit, custom, participantList])
  const splitSum = splits.reduce((a, s) => a + s.amount, 0)
  const splitOk = amount == null || splits.length === 0 || splitSum === amount
  const shares = Object.fromEntries(splits.map((s) => [s.memberId, s.amount]))
  const remainder = amount != null && participantList.length > 1 ? amount % participantList.length : 0

  function key(k: string) {
    setTyped((t) => {
      if (k === 'del') return t.slice(0, -1)
      if (k === '.') return t.includes('.') || decimalsOf(currency) === 0 ? t : (t || '0') + '.'
      const [, dec] = t.split('.')
      if (dec !== undefined && dec.length >= decimalsOf(currency)) return t
      if (t === '0') return k
      if (t.replace('.', '').length >= 12) return t
      return t + k
    })
  }

  const typeLabel = type === 'income' ? 'Khoản thu mới' : type === 'adjustment' ? 'Điều chỉnh' : 'Khoản chi mới'
  const approx = amount != null && amount > 0
    ? [delegation.bridgeCurrency, delegation.baseCurrency, delegation.localCurrency]
        .filter((c, idx, arr) => c !== currency && arr.indexOf(c) === idx)
        .map((c) => { const v = ledger.rates.convert(amount, currency, c); return v == null ? null : fmt(v, c) })
        .filter(Boolean)
        .join(' · ')
    : ''

  async function save() {
    setErr('')
    if (amount == null || amount <= 0) return setErr('Nhập số tiền')
    if (!splitOk) return setErr(`Tổng phần chia (${fmt(splitSum, currency)}) phải bằng số tiền (${fmt(amount, currency)})`)
    if ((fund?.type === 'PERSONAL' || fund?.type === 'CAMP_MONEY') && type === 'expense' && selected.size === 0) return setErr('Chọn ít nhất 1 bé')
    if (fund?.type === 'EMERGENCY' && !note.trim()) return setErr('Quỹ khẩn cấp: bắt buộc ghi chú lý do')
    setBusy(true)
    try {
      const now = Date.now()
      let receiptId = existing?.receiptId
      const txIdNew = existing?.id ?? nanoid(10)
      await db.transaction('rw', [db.transactions, db.receipts], async () => {
        if (removeReceipt && receiptId) {
          await db.receipts.delete(receiptId)
          receiptId = undefined
        }
        if (blob && blob !== existingReceipt?.blob) {
          if (receiptId) await db.receipts.delete(receiptId)
          receiptId = nanoid(10)
          await db.receipts.add({ id: receiptId, delegationId: delegation.id, transactionId: txIdNew, blob, mime: blob.type || 'image/jpeg', size: blob.size, createdAt: now })
        }
        const tx: Transaction = {
          id: txIdNew,
          delegationId: delegation.id,
          type,
          date,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          description: description.trim() || CATEGORIES.find((c) => c.key === category)?.label || (type === 'income' ? 'Thu vào' : type === 'adjustment' ? 'Điều chỉnh' : 'Chi tiêu'),
          category: category || undefined,
          note: note.trim() || undefined,
          amount: type === 'adjustment' ? adjSign * amount : amount,
          currency,
          walletId: walletId || undefined,
          fundId: fundId || undefined,
          splits: splits.map((s) => ({ memberId: s.memberId, amount: Math.abs(s.amount) })),
          receiptId,
          receiptUrl: receiptId === existing?.receiptId ? existing?.receiptUrl : undefined,
        }
        await db.transactions.put(tx)
      })
      const fundLabel = fund ? (fund.type === 'PERSONAL' ? 'Pocket' : fund.name) : ''
      const toast = `Đã lưu · ${fmt(amount, currency)}${fundLabel ? ` · ${fundLabel}` : ''}${splits.length > 1 ? ` ÷ ${splits.length}` : ''}`
      if (existing) nav(`/tx/${existing.id}`, { replace: true })
      else nav('/', { replace: true, state: { toast, undoTxId: txIdNew } })
    } finally {
      setBusy(false)
    }
  }

  const stepper = (
    <div className="grid grid-cols-3 border-y-2 border-divider">
      {[['1', 'Số tiền'], ['2', 'Quỹ'], ['3', 'Người']].map(([n, label], idx) => {
        const current = (step === 1 && idx === 0) || (step === 2 && idx === 2)
        const done = step === 2 && idx < 2
        return (
          <div key={n} className={cn('px-5 py-[11px] text-[12px] flex items-center gap-1.5', idx > 0 && 'border-l border-divider', current ? 'font-extrabold' : 'text-neutral-700')} style={current ? { boxShadow: 'inset 0 3px 0 #0057B8' } : undefined}>
            {done ? <Check size={14} /> : <span>{n}</span>}
            {label}
          </div>
        )
      })}
    </div>
  )

  /* ---------- Bước 1: số tiền ---------- */
  if (step === 1) {
    const now = new Date()
    return (
      <Frame className="!min-h-screen">
        <TopBar title={typeLabel} meta={`${now.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} · ${now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`} onClose={() => nav(-1)} />
        {!existing && (
          <div className="px-5 py-2.5 flex items-center justify-between gap-2 border-b border-divider">
            <Segmented small value={type} onChange={(v) => { setType(v); if (v === 'income') setSelected(new Set(defaultParticipants(fund, members, delegation))) }} options={[{ value: 'expense', label: 'Chi ra' }, { value: 'income', label: 'Thu vào' }, { value: 'adjustment', label: 'Điều chỉnh' }]} />
            <input type="date" className="input !w-auto !h-8 text-[12px] !px-2" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        )}
        {stepper}
        <div className="px-5 pt-4">
          <Segmented value={currency} onChange={setCurrency} options={currencyOptions.map((c) => ({ value: c, label: `${currencyInfo(c).symbol} ${c}` }))} />
        </div>
        <div className="px-5 pt-5 pb-4 flex-1">
          {type === 'adjustment' && (
            <Segmented small className="mb-3" value={adjSign === 1 ? 'plus' : 'minus'} onChange={(v) => setAdjSign(v === 'plus' ? 1 : -1)} options={[{ value: 'minus', label: 'Thiếu tiền' }, { value: 'plus', label: 'Thừa tiền' }]} />
          )}
          <div className="flex items-end gap-1">
            <span className={cn('text-hero-xl num break-all', !typed && 'text-neutral-400')}>{fmtTyping(typed, currency)}</span>
            <span className="w-[3px] h-[64px] bg-accent mb-1 animate-pulse" />
          </div>
          <div className="text-[13px] text-neutral-700 mt-3 num min-h-5">{approx ? `≈ ${approx}` : currencyInfo(currency).name}</div>
        </div>
        <div className="grid grid-cols-2 border-t-2 border-divider">
          <label className="px-5 py-3 border-r border-divider block">
            <span className="section-label block mb-1">{type === 'income' ? 'Nhận vào' : 'Trả từ'}</span>
            {walletOptions.length > 0 ? (
              <select className="w-full bg-transparent text-[14px] font-semibold outline-none" value={walletId} onChange={(e) => setWalletId(e.target.value)}>
                {walletOptions.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            ) : (
              <span className="text-[13px] neg">Chưa có ví {currency}</span>
            )}
          </label>
          <div className="px-5 py-3">
            <ReceiptCapture compact blob={blob} onChange={(b) => { setBlob(b); if (!b && existing?.receiptId) setRemoveReceipt(true) }} />
          </div>
        </div>
        {repeats.length > 0 && type === 'expense' && (
          <div className="px-5 py-3 border-t border-divider flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="section-label shrink-0">Lặp lại</span>
            {repeats.map((r) => (
              <button key={r.desc} type="button" className="quick-chip" onClick={() => { setTyped(String(toMajor(r.amount, currency))); setDescription(r.desc); if (r.category) setCategory(r.category); if (r.fundId) { const f = funds.find((x) => x.id === r.fundId); if (f) pickFund(f) } }}>
                {r.desc} {fmt(r.amount, currency)}
              </button>
            ))}
          </div>
        )}
        <div className="sticky bottom-0 bg-paper">
          <Keypad onKey={key} allowDecimal={decimalsOf(currency) > 0} />
          <div className="safe-bottom">
            <PrimaryButton disabled={!amount || amount <= 0} onClick={() => setStep(2)}>Tiếp: chọn quỹ</PrimaryButton>
          </div>
        </div>
      </Frame>
    )
  }

  /* ---------- Bước 2: quỹ + người ---------- */
  const fundHint: Record<string, string> = {
    PERSONAL: 'Trừ vào tiền riêng của từng bé được chọn.',
    CAMP_MONEY: 'Tiền nộp trại / excursion, trừ vào pocket của từng bé.',
    SIDE_TRIP: 'Khoản chung của đoàn, mặc định chia đều.',
    PRE_CAMP: 'Chi tại Việt Nam trước chuyến đi.',
    GIFT: 'Quà host family, staff, chapter.',
    EMERGENCY: 'Chỉ dùng khi có sự cố. Bắt buộc ghi chú.',
    OTHER: '',
  }
  const nShown = selected.size

  return (
    <Frame>
      <TopBar title={typeLabel} back={() => setStep(1)} />
      {stepper}

      <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-divider">
        <div>
          <div className="section-label mb-1">{wallet ? `${type === 'income' ? 'Vào' : 'Từ'} ${wallet.name}` : 'Số tiền'}</div>
          <button type="button" className="text-[44px] leading-none font-extrabold num tracking-[-0.03em]" onClick={() => setStep(1)}>{amount != null ? fmt(type === 'adjustment' ? adjSign * amount : amount, currency) : '—'}</button>
        </div>
        <ReceiptCapture compact blob={blob} onChange={(b) => { setBlob(b); if (!b && existing?.receiptId) setRemoveReceipt(true) }} />
      </div>

      <SectionLabel>Nội dung</SectionLabel>
      <div className="px-5 space-y-2.5">
        <input className="input" placeholder={type === 'income' ? 'VD: Phụ huynh gửi pocket money' : 'VD: Chơi game ở khu trò chơi'} value={description} onChange={(e) => setDescription(e.target.value)} />
        {type === 'expense' && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-5 px-5">
            {CATEGORIES.map((c) => (
              <Chip key={c.key} icon={CAT_ICON[c.key]} selected={category === c.key} onClick={() => setCategory(category === c.key ? '' : c.key)}>{c.label}</Chip>
            ))}
          </div>
        )}
        {(fund?.type === 'EMERGENCY' || note || existing?.note) && (
          <input className="input" placeholder="Ghi chú lý do (bắt buộc với quỹ khẩn cấp)" value={note} onChange={(e) => setNote(e.target.value)} />
        )}
      </div>

      <SectionLabel>Quỹ</SectionLabel>
      <div className="px-5">
        <FundGrid funds={funds} value={fundId} onChange={pickFund} members={members} />
        {fund && fundHint[fund.type] && <p className="text-[12px] text-neutral-700 mt-2">{fundHint[fund.type]}</p>}
      </div>

      <div className="flex items-end justify-between px-5 pt-5 pb-2.5">
        <span className="section-label">{type === 'income' ? 'Ai góp' : 'Chia cho'} · {nShown} người</span>
        <Segmented small value={splitMode} onChange={setMode} options={[{ value: 'all', label: 'Cả đoàn' }, { value: 'delegates', label: `${delegates.length} bé` }, { value: 'pick', label: 'Chọn' }]} />
      </div>
      <div className="px-5 space-y-3">
        <MemberTiles members={members} selected={selected} onToggle={(mid) => { const s = new Set(selected); if (s.has(mid)) s.delete(mid); else s.add(mid); setSelected(s) }} shares={shares} currency={currency} />
        {participantList.length > 1 && amount != null && !customSplit && remainder !== 0 && (
          <InfoNote>{fmt(amount, currency)} ÷ {participantList.length} không chia hết — phần lẻ {fmt(remainder, currency)} tự dồn cho người đầu, tổng luôn khớp hoá đơn.</InfoNote>
        )}
        {participantList.length === 0 && <InfoNote>Không chia cho ai: khoản này chỉ ảnh hưởng ví và quỹ, không tính vào số dư cá nhân.</InfoNote>}
        {participantList.length > 1 && amount != null && (
          <button type="button" className="text-link !min-h-0" onClick={() => setCustomSplit(!customSplit)}>{customSplit ? 'Quay lại chia đều' : 'Nhập tay từng người'}</button>
        )}
        {customSplit && (
          <div className="space-y-2">
            {participantList.map((m) => (
              <div key={m.id} className="flex items-center gap-2">
                <span className="w-20 truncate text-[14px] font-semibold">{m.name}</span>
                <AmountInput value={custom[m.id] ?? null} currency={currency} onChange={(v) => setCustom({ ...custom, [m.id]: v })} className="flex-1" />
              </div>
            ))}
            <div className={cn('text-[13px] text-right num', splitOk ? 'text-ink' : 'neg')}>Tổng {fmt(splitSum, currency)} / {fmt(amount ?? 0, currency)}</div>
          </div>
        )}
      </div>

      {existing && (
        <div className="px-5 pt-4">
          <span className="section-label block mb-2">Ngày</span>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      )}

      {err && <p className="px-5 pt-3 text-[13px] neg">{err}</p>}
      <div className="px-5 pt-5 pb-6 space-y-2">
        <PrimaryButton icon={Check} disabled={busy} onClick={save}>{busy ? 'Đang lưu…' : existing ? 'Lưu thay đổi' : type === 'income' ? 'Lưu khoản thu' : 'Lưu khoản chi'}</PrimaryButton>
        <div className="text-[12px] text-neutral-700 flex items-center gap-1.5">
          <CloudOff size={13} />{online ? 'Lưu trên máy · tự đồng bộ khi đã đăng nhập cloud' : 'Đang offline · lưu trên máy, tự đồng bộ khi có Wi-Fi'}
        </div>
      </div>
    </Frame>
  )
}

function isEqualSplit(t: Transaction): boolean {
  if (t.splits.length <= 1) return true
  const eq = splitEqually(Math.abs(t.amount), t.splits.map((s) => s.memberId))
  return eq.every((s, i) => s.amount === t.splits[i].amount)
}
