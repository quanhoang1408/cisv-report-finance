import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Eye, LayoutGrid, RefreshCw, Scale, User } from 'lucide-react'
import { db } from '../db/db'
import type { Delegation, Member, Snapshot } from '../db/types'
import { sortTransactions, useDelegationData, type DelegationData } from '../hooks/useDelegation'
import { computeLedger } from '../lib/ledger'
import { fmt } from '../lib/money'
import { cloudEnabled, fetchPublished } from '../lib/supabase'
import { FUND_ICON, PrimaryButton, ProgressBar, SectionLabel, Spinner, Tag, cn, fmtDateShort, fmtTime } from '../components/ui'
import { SettlementTable, TxRow, fundStats, ratesLine, splitNames } from '../components/shared'
import { ReceiptThumb } from '../components/Receipt'
import { MemberPanel } from './Members'

type Tab = 'overview' | 'child' | 'settlement'

export default function ParentView() {
  const { slug = '' } = useParams()
  const storageKey = `cisv.parent.${slug}`
  const stored = localStorage.getItem(storageKey)
  const storedOk = stored ? (JSON.parse(stored) as { pin: string; at: number }) : null
  const valid = storedOk && Date.now() - storedOk.at < 30 * 86400000 ? storedOk.pin : ''
  const [pin, setPin] = useState(valid)
  const [entered, setEntered] = useState(!!valid)
  const [remote, setRemote] = useState<Snapshot | null | undefined>(undefined)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const local = useLiveQuery(() => db.delegations.where('slug').equals(slug).first(), [slug])
  const localOk = !!local && entered && local.parentPin === pin
  const { data: localData } = useDelegationData(localOk ? local!.id : null)

  useEffect(() => {
    if (!entered || local === undefined) return
    if (local && local.parentPin === pin) { localStorage.setItem(storageKey, JSON.stringify({ pin, at: Date.now() })); return }
    if (!cloudEnabled) {
      setErr(local ? 'Sai mã PIN' : 'Không tìm thấy đoàn trên thiết bị này và chưa cấu hình cloud.')
      setEntered(false)
      return
    }
    setBusy(true)
    fetchPublished(slug, pin)
      .then((snap) => {
        if (!snap) { setErr('Sai mã PIN hoặc đoàn chưa được xuất bản.'); setEntered(false); localStorage.removeItem(storageKey) }
        else { setRemote(snap); localStorage.setItem(storageKey, JSON.stringify({ pin, at: Date.now() })) }
      })
      .catch((e) => { setErr((e as Error).message); setEntered(false) })
      .finally(() => setBusy(false))
  }, [entered, local, pin, slug, storageKey])

  const remoteData = useMemo<DelegationData | null>(() => {
    if (!remote) return null
    const delegation = { ...remote.delegation, parentPin: '' } as Delegation
    const txs = sortTransactions(remote.transactions)
    return { delegation, members: remote.members, wallets: remote.wallets, funds: remote.funds, transactions: txs, cashCounts: remote.cashCounts ?? [], ledger: computeLedger(delegation, remote.members, remote.wallets, remote.funds, txs) }
  }, [remote])

  const data = localOk ? localData : remoteData

  if (!entered || !data) {
    return (
      <div className="min-h-screen flex items-start justify-center">
        <form
          className="w-full max-w-[480px] px-5 pt-10"
          onSubmit={(e) => { e.preventDefault(); setErr(''); setEntered(true) }}
        >
          <div className="section-label mb-2">Sổ quỹ đoàn · chỉ xem</div>
          <h1 className="text-[26px] leading-[1.15] font-extrabold">{local?.name ?? 'CISV Delegation Finance'}</h1>
          <p className="text-[13px] text-neutral-700 mt-2 mb-6">Nhập mã PIN Leader đã gửi trong nhóm để xem chi tiêu của đoàn.</p>
          {entered && busy ? <Spinner /> : (
            <>
              <input className="input !h-[64px] text-[32px] font-extrabold tracking-[0.4em] num" inputMode="numeric" maxLength={6} autoFocus value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="••••" />
              {err && <p className="text-[13px] neg mt-2">{err}</p>}
              <div className="mt-4"><PrimaryButton disabled={pin.length < 4}>Xem sổ quỹ</PrimaryButton></div>
            </>
          )}
        </form>
      </div>
    )
  }

  return <ParentDashboard data={data} preview={localOk} updatedAt={remote?.exportedAt} />
}

/* ================= Dashboard ================= */

function ParentDashboard({ data, preview, updatedAt }: { data: DelegationData; preview: boolean; updatedAt?: number }) {
  const [tab, setTab] = useState<Tab>('overview')
  const [childId, setChildId] = useState<string>('')
  const { delegation, members } = data
  const delegates = members.filter((m) => m.role === 'delegate')
  const child = members.find((m) => m.id === childId) ?? delegates[0]
  const syncLine = preview ? 'Xem trước trên máy Leader · dữ liệu local' : updatedAt ? `Leader đồng bộ lúc ${fmtTime(updatedAt)} ${fmtDateShort(new Date(updatedAt).toISOString().slice(0, 10))} (giờ máy bạn)` : ''
  const tabs: { key: Tab; label: string; icon: typeof Eye }[] = [{ key: 'overview', label: 'Cả đoàn', icon: LayoutGrid }, { key: 'child', label: 'Con của tôi', icon: User }, { key: 'settlement', label: 'Quyết toán', icon: Scale }]

  const header = (
    <div className="px-5 pt-4 pb-3">
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <span className="section-label">{`${delegation.programme} ${delegation.hostCountry} ${delegation.year}`}</span>
        <Tag icon={Eye}>Chỉ xem</Tag>
      </div>
      <h1 className="text-[26px] leading-[1.15] font-extrabold">{delegation.name}</h1>
      {syncLine && <div className="text-[12px] text-neutral-700 flex items-center gap-1.5 mt-1.5"><RefreshCw size={13} />{syncLine}</div>}
    </div>
  )

  const childTabs = (
    <div className="grid border-y-2 border-divider" style={{ gridTemplateColumns: `repeat(${Math.max(delegates.length, 1)}, 1fr)` }}>
      {delegates.map((m, i) => (
        <button key={m.id} onClick={() => setChildId(m.id)} className={cn('h-[46px] text-[14px] truncate px-2', i > 0 && 'border-l border-divider', child?.id === m.id ? 'font-extrabold' : 'text-neutral-700')} style={child?.id === m.id ? { boxShadow: 'inset 0 -3px 0 #0057B8' } : undefined}>{m.name}</button>
      ))}
    </div>
  )

  const childPanel = child ? (
    <>
      <div className="px-5 pt-4 pb-2"><div className="section-label mb-1.5">Con của tôi</div><h2 className="text-[26px] leading-[1.15] font-extrabold">{child.name}</h2></div>
      {childTabs}
      <MemberPanel data={data} member={child} />
      <Estimate data={data} member={child} />
    </>
  ) : <p className="px-5 py-4 text-[13px] text-neutral-700">Chưa có delegate.</p>

  return (
    <div className="min-h-screen">
      {/* Desktop ≥1024 */}
      <div className="hidden lg:block">
        <nav className="h-16 border-b-2 border-divider px-8 flex items-center gap-8">
          <div className="text-[18px] font-extrabold">Sổ quỹ · {delegation.name} <span className="text-[13px] font-normal text-neutral-700 ml-2">{delegation.programme} {delegation.hostCountry} {delegation.year}</span></div>
          <div className="flex-1" />
          {syncLine && <span className="text-[12px] text-neutral-700 flex items-center gap-1.5"><RefreshCw size={13} />{syncLine}</span>}
          <Tag icon={Eye}>Chỉ xem</Tag>
        </nav>
        <div className="grid grid-cols-[1fr_400px] min-h-[calc(100vh-64px)]">
          <div className="border-r-2 border-divider">
            <div className="px-8 pt-8 pb-4"><div className="section-label mb-2">Tổng quan đoàn</div><h1 className="text-[36px] leading-[1.1] font-extrabold">Tổng quan đoàn</h1></div>
            <Overview data={data} desktop />
            <div className="px-8 pt-6 pb-10"><div className="section-label mb-3">Quyết toán tạm tính</div><SettlementTable data={data} /><div className="text-[12px] text-neutral-700 pt-2">{ratesLine(data)}</div></div>
          </div>
          <div>{childPanel}</div>
        </div>
      </div>

      {/* Mobile */}
      <div className="lg:hidden mx-auto max-w-[480px] pb-[74px]">
        {header}
        {tab === 'overview' && <Overview data={data} />}
        {tab === 'child' && childPanel}
        {tab === 'settlement' && (
          <>
            <SectionLabel top>Bảng quyết toán tạm tính</SectionLabel>
            <SettlementTable data={data} />
            <div className="px-5 text-[12px] text-neutral-700">{ratesLine(data)}</div>
            <div className="mx-5 mt-4 info-note flex-col gap-1">
              <span><b>Cách đọc:</b> "Góp" là tổng tiền phụ huynh đã gửi Leader (pocket money, quỹ chung, camp money…). "Chi" là phần chi được chia cho bé, kể cả phần chia đều các khoản chung.</span>
              <span>Số liệu do Leader cập nhật, có thể thay đổi cho đến khi chốt sổ cuối chuyến đi.</span>
            </div>
          </>
        )}
        <nav className="fixed bottom-0 inset-x-0 z-30 bg-paper safe-bottom">
          <div className="mx-auto max-w-[480px] grid grid-cols-3 h-[74px] border-t-2 border-ink">
            {tabs.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)} className={cn('pt-3 pl-3.5 flex flex-col items-start gap-1.5', tab === t.key ? 'text-ink font-semibold' : 'text-neutral-700')} style={tab === t.key ? { boxShadow: 'inset 0 3px 0 #0057B8' } : undefined}>
                <t.icon size={20} />
                <span className="text-[11px]">{t.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>
    </div>
  )
}

const FUND_NOTE: Record<string, string> = {
  PRE_CAMP: 'Bonding, National Night, visa, đồ chuẩn bị',
  SIDE_TRIP: 'Ăn, ở, đi lại, vé tham quan',
  GIFT: 'Host Family, staff, thầy cô',
  CAMP_MONEY: 'nộp Camp Bank · trừ Pocket từng bé',
  EMERGENCY: 'chỉ mở khi có sự cố',
  OTHER: '',
}

function Overview({ data, desktop }: { data: DelegationData; desktop?: boolean }) {
  const [showAll, setShowAll] = useState(false)
  const { funds, transactions, delegation, ledger, members } = data
  const shared = funds.filter((f) => f.type !== 'PERSONAL')
  const expenses = transactions.filter((t) => t.type === 'expense')
  const ranked = [...expenses].sort((a, b) => (ledger.rates.convert(b.amount, b.currency, delegation.localCurrency) ?? 0) - (ledger.rates.convert(a.amount, a.currency, delegation.localCurrency) ?? 0))
  const shown = showAll ? expenses : ranked.slice(0, 8)
  const px = desktop ? 'px-8' : 'px-5'

  const fundCards = shared.map((f) => {
    const { cur, exp, budget, pct } = fundStats(data, f)
    const Icon = FUND_ICON[f.type]
    const bridgeExp = cur !== delegation.bridgeCurrency && f.type === 'SIDE_TRIP' ? ledger.rates.convert(exp, cur, delegation.bridgeCurrency) : null
    const bridgeBudget = bridgeExp != null ? ledger.rates.convert(budget, cur, delegation.bridgeCurrency) : null
    return (
      <div key={f.id} className={cn('py-3', desktop ? 'px-5' : 'border-t border-divider ' + px)}>
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-semibold flex items-center gap-2"><Icon size={16} />{f.name}</span>
          <span className="text-[13px] font-extrabold num">{f.type === 'EMERGENCY' && exp === 0 ? 'niêm phong' : `${pct}%`}</span>
        </div>
        <div className="num mt-1"><span className="text-[22px] font-extrabold">{fmt(exp, cur)}</span><span className="text-[12px] text-neutral-700"> / {fmt(budget, cur)}</span></div>
        {bridgeExp != null && bridgeBudget != null && <div className="text-[12px] text-neutral-700 num">{fmt(bridgeExp, delegation.bridgeCurrency)} / {fmt(bridgeBudget, delegation.bridgeCurrency)}</div>}
        <div className="mt-2"><ProgressBar value={exp} max={budget} /></div>
        <div className="text-[12px] text-neutral-700 mt-1.5">{FUND_NOTE[f.type] ?? ''}</div>
      </div>
    )
  })

  return (
    <>
      {desktop ? (
        <div className="mx-8 grid grid-cols-4 border-2 border-divider divide-x-2 divide-divider">{fundCards}</div>
      ) : (
        <>
          <SectionLabel top>Tiến độ chi các quỹ</SectionLabel>
          <div className="border-b border-divider">{fundCards}</div>
        </>
      )}

      <div className={cn('flex items-end justify-between pt-6 pb-2.5', px)}>
        <span className="section-label">Khoản chi lớn & hoá đơn</span>
        {expenses.length > 8 && <button className="text-[12px] font-extrabold text-accent-700" onClick={() => setShowAll(!showAll)}>{showAll ? 'Thu gọn' : `Tất cả ${expenses.length} khoản`}</button>}
      </div>
      {desktop ? (
        <table className="mx-8 text-[14px]" style={{ width: 'calc(100% - 64px)' }}>
          <thead><tr className="section-label border-b-2 border-divider"><th className="text-left py-2 font-semibold w-14">Ngày</th><th className="text-left py-2 font-semibold">Khoản chi</th><th className="text-left py-2 font-semibold">Quỹ</th><th className="text-left py-2 font-semibold">Chia cho</th><th className="text-right py-2 font-semibold w-[120px]">Số tiền</th><th className="text-left py-2 pl-4 font-semibold w-[120px]">Hoá đơn</th></tr></thead>
          <tbody>
            {shown.map((t) => (
              <tr key={t.id} className="border-b border-divider">
                <td className="py-2.5 num text-neutral-700">{fmtDateShort(t.date)}</td>
                <td className="py-2.5 font-semibold">{t.description}</td>
                <td className="py-2.5 text-neutral-700">{funds.find((f) => f.id === t.fundId)?.name.replace('Pocket money – ', 'Pocket · ')}</td>
                <td className="py-2.5 text-neutral-700">{splitNames(t, members)}</td>
                <td className="py-2.5 text-right font-extrabold num">{fmt(t.amount, t.currency)}</td>
                <td className="py-2.5 pl-4">{t.receiptId || t.receiptUrl ? <span className="flex items-center gap-2"><ReceiptThumb receiptId={t.receiptId} remoteUrl={t.receiptUrl} size="table" />Xem ảnh</span> : <span className="neg flex items-center gap-1.5"><ReceiptThumb showMissing size="table" />Chưa có ảnh</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="border-b border-divider">
          {shown.length === 0 && <p className="px-5 py-3 text-[13px] text-neutral-700">Chưa có khoản chi nào.</p>}
          {shown.map((t) => <TxRow key={t.id} t={t} data={data} />)}
        </div>
      )}
    </>
  )
}

/** Khối "TẠM TÍNH NẾU KẾT THÚC HÔM NAY" */
function Estimate({ data, member }: { data: DelegationData; member: Member }) {
  const { ledger, delegation } = data
  const pc = ledger.memberTotals[member.id] ?? {}
  const { bridgeCurrency: bridge, baseCurrency: base } = delegation
  // Gộp: nội tệ → tiền cầu nối; tiền ở nhà giữ riêng
  let bridgeNet = 0, baseNet = 0, ok = true
  for (const [c, t] of Object.entries(pc)) {
    const net = t.income - t.expense
    if (c === base) baseNet += net
    else { const v = ledger.rates.convert(net, c, bridge); if (v == null) ok = false; else bridgeNet += v }
  }
  const totalBase = ledger.rates.convert(bridgeNet, bridge, base)
  const parts = [bridgeNet !== 0 ? fmt(bridgeNet, bridge) : null, baseNet !== 0 ? fmt(baseNet, base) : null].filter(Boolean)
  const vb = delegation.manualRates?.[`${bridge}:${base}`]
  return (
    <div className="mx-5 my-5 bg-surface px-4 py-3.5">
      <div className="section-label mb-2">Tạm tính nếu kết thúc hôm nay</div>
      {!ok ? <p className="text-[13px] text-neutral-700">Thiếu tỷ giá để quy đổi.</p> : (
        <>
          <div className="text-[15px] font-semibold">{bridgeNet + baseNet >= 0 ? 'Leader hoàn lại ' : 'Phụ huynh chuyển thêm '}<span className={cn('font-extrabold num', (bridgeNet < 0 || baseNet < 0) && 'neg')}>{parts.length ? parts.map((p) => p!.replace('−', '')).join(' + ') : fmt(0, bridge)}</span></div>
          <div className="text-[12px] text-neutral-700 mt-1 num">
            {totalBase != null && base !== bridge ? `≈ ${fmt(Math.abs(totalBase + baseNet), base)} · ` : ''}gồm pocket dư, phần quỹ chung dư, khẩn cấp chưa dùng, pre-camp dư.{vb ? ` 1 ${bridge} = ${fmt(Math.round(vb), base)}.` : ''}
          </div>
          {bridgeNet < 0 && <div className="text-[12px] text-neutral-700 mt-1">Khoản âm có thể nạp ngay, hoặc trừ vào phần quỹ chung còn dư khi quyết toán.</div>}
        </>
      )}
    </div>
  )
}
