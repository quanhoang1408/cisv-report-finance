import { Link, useParams } from 'react-router-dom'
import { useActiveDelegationId, useDelegationData, type DelegationData } from '../hooks/useDelegation'
import type { Member, Transaction } from '../db/types'
import { netIn } from '../lib/ledger'
import { fmt, fmtRate } from '../lib/money'
import { Frame, Header, HeroNumber, SectionLabel, Spinner, Tag, TextLink, cn, fmtDateShort } from '../components/ui'
import { PocketRow, SettlementTable, TxList, approxLine, ratesLine, splitNames } from '../components/shared'
import { ReceiptThumb } from '../components/Receipt'

export function Members() {
  const id = useActiveDelegationId()
  const { data, loading } = useDelegationData(id)
  if (loading || !data) return <Frame nav><Spinner /></Frame>
  return (
    <Frame nav>
      <Header label={`${data.members.length} thành viên`} title="Thành viên & quyết toán" />
      <SectionLabel right="Còn lại" top>Số dư từng người</SectionLabel>
      <div className="border-b border-divider">
        {data.members.map((m) => <PocketRow key={m.id} data={data} member={m} link={`/members/${m.id}`} />)}
      </div>
      <SectionLabel top>Bảng quyết toán</SectionLabel>
      <SettlementTable data={data} />
      <div className="px-5 text-[12px] text-neutral-700 pb-6">{ratesLine(data)}</div>
    </Frame>
  )
}

export function MemberDetail() {
  const id = useActiveDelegationId()
  const { data, loading } = useDelegationData(id)
  const { memberId } = useParams()
  if (loading || !data) return <Frame nav><Spinner /></Frame>
  const member = data.members.find((m) => m.id === memberId)
  if (!member) return <Frame nav><Header title="Thành viên" back="/members" /><p className="px-5 text-[13px] text-neutral-700">Không tìm thấy.</p></Frame>
  const personalFund = data.funds.find((f) => f.type === 'PERSONAL' && f.memberId === member.id)
  return (
    <Frame nav>
      <Header label={member.role === 'leader' ? 'Leader' : 'Delegate'} title={member.name} back="/members" />
      <MemberPanel data={data} member={member} link />
      {personalFund && (
        <div className="px-5 py-3 flex flex-col">
          <TextLink to={`/add?type=income&fund=${personalFund.id}`}>Ghi tiền phụ huynh gửi thêm</TextLink>
          <TextLink to={`/add?type=expense&fund=${personalFund.id}`}>Ghi khoản chi riêng</TextLink>
        </div>
      )}
    </Frame>
  )
}

/** Phân loại dòng tiền của 1 bé thành các bước waterfall (P2) */
export function memberFlow(data: DelegationData, member: Member) {
  const { transactions, funds, delegation, ledger } = data
  const cur = delegation.localCurrency
  const conv = (minor: number, c: string) => ledger.rates.convert(minor, c, cur)
  let income = 0, incomeOk = true
  let camp = 0, personal = 0, shared = 0, adjust = 0
  const personalTxs: Transaction[] = []
  for (const t of transactions) {
    const s = t.splits.find((x) => x.memberId === member.id)
    if (!s) continue
    const v = conv(s.amount, t.currency)
    if (v == null) { incomeOk = false; continue }
    const fund = funds.find((f) => f.id === t.fundId)
    if (t.type === 'income') income += v
    else if (t.type === 'adjustment') adjust += t.amount < 0 ? -v : v
    else if (fund?.type === 'CAMP_MONEY') camp += v
    else if (fund?.type === 'PERSONAL') { personal += v; personalTxs.push(t) }
    else { shared += v; if (t.splits.length < data.members.filter((m) => m.role === 'delegate').length) personalTxs.push(t) }
  }
  const remaining = netIn(ledger.memberTotals[member.id] ?? {}, cur, ledger.rates)
  return { cur, income, incomeOk, camp, personal, shared, adjust, personalTxs, remaining }
}

/** Dùng chung cho Leader (link) và phụ huynh (read-only) */
export function MemberPanel({ data, member, link }: { data: DelegationData; member: Member; link?: boolean }) {
  const { delegation, ledger, members } = data
  const flow = memberFlow(data, member)
  const { cur } = flow
  const bridge = delegation.bridgeCurrency
  const obs = ledger.rates.observed[`${bridge}:${cur}`]
  const negative = flow.remaining != null && flow.remaining < 0
  const netBridge = netIn(ledger.memberTotals[member.id] ?? {}, bridge, ledger.rates)
  const netBase = netIn(ledger.memberTotals[member.id] ?? {}, delegation.baseCurrency, ledger.rates)
  const txs = data.transactions.filter((t) => t.splits.some((s) => s.memberId === member.id))

  // waterfall
  const steps: { label: string; sub: string; value: number; kind: 'in' | 'out' }[] = [
    { label: 'Bố mẹ gửi', sub: obs ? `quy đổi theo tỷ giá BQ ${fmtRate(obs.rate)}` : 'tổng các khoản góp', value: flow.income, kind: 'in' },
    ...(flow.camp ? [{ label: 'Camp Money & Excursion', sub: 'nộp Camp Bank / trại tổ chức', value: -flow.camp, kind: 'out' as const }] : []),
    ...(flow.personal ? [{ label: 'Mua sắm cá nhân', sub: `${flow.personalTxs.filter((t) => data.funds.find((f) => f.id === t.fundId)?.type === 'PERSONAL').length} khoản`, value: -flow.personal, kind: 'out' as const }] : []),
    ...(flow.shared ? [{ label: 'Phần chia quỹ chung', sub: 'side trip, quà, pre-camp…', value: -flow.shared, kind: 'out' as const }] : []),
    ...(flow.adjust ? [{ label: 'Điều chỉnh kiểm két', sub: 'phần chia lệch tiền mặt', value: flow.adjust, kind: flow.adjust < 0 ? 'out' as const : 'in' as const }] : []),
  ]
  const total = flow.income || 1
  let running = flow.income

  return (
    <>
      <HeroNumber
        label="Pocket money còn lại"
        size="md"
        value={flow.remaining == null ? '—' : fmt(flow.remaining, cur)}
        negative={negative}
        sub={flow.remaining == null ? 'thiếu tỷ giá' : approxLine(data, flow.remaining, cur).replace(/ · tỷ giá.*$/, '')}
      />
      {negative && netBridge != null && (
        <div className="px-5 pb-3 -mt-2"><Tag variant="accent">Đang âm · cần nạp thêm {fmt(Math.abs(netBridge), bridge)}{netBase != null ? ` ≈ ${fmt(Math.abs(netBase), delegation.baseCurrency)}` : ''}</Tag></div>
      )}

      <SectionLabel top>Dòng tiền của {member.name}</SectionLabel>
      <div className="px-5">
        {steps.map((s, i) => {
          const before = running
          running += s.value
          const remainPct = Math.max(0, Math.min(100, (Math.max(running, 0) / total) * 100))
          const cutPct = s.kind === 'out' ? Math.max(0, Math.min(100 - remainPct, (Math.abs(s.value) / total) * 100)) : 0
          void before
          return (
            <div key={i} className="py-2.5 border-t border-divider">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold truncate">{s.label}</div>
                  <div className="text-[11px] text-neutral-700 truncate">{s.sub}</div>
                </div>
                <span className={cn('text-[16px] font-extrabold num shrink-0', s.value < 0 && 'neg')}>{fmt(s.value, cur, { sign: true })}</span>
              </div>
              <div className="h-1.5 bg-neutral-200 mt-2 flex">
                <div className="h-full bg-ink" style={{ width: `${remainPct}%` }} />
                <div className="h-full bg-accent-300" style={{ width: `${cutPct}%` }} />
              </div>
            </div>
          )
        })}
        <div className="py-3 border-t-2 border-b-2 border-divider flex items-center justify-between">
          <span className="text-[14px] font-extrabold">Còn lại</span>
          <span className={cn('text-[18px] font-extrabold num', negative && 'neg')}>{flow.remaining == null ? '—' : fmt(flow.remaining, cur)}</span>
        </div>
      </div>

      {flow.personalTxs.length > 0 && (
        <>
          <SectionLabel>Mua sắm cá nhân · {flow.personalTxs.length} khoản</SectionLabel>
          <div className="border-t border-divider">
            {flow.personalTxs.map((t) => {
              const s = t.splits.find((x) => x.memberId === member.id)!
              const row = (
                <div className="grid grid-cols-[40px_1fr_auto] gap-3 items-center px-5 py-2 border-b border-divider">
                  <span className="text-[12px] text-neutral-700 num">{fmtDateShort(t.date)}</span>
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold truncate flex items-center gap-1.5">{t.description}<ReceiptThumb receiptId={t.receiptId} remoteUrl={t.receiptUrl} size="table" /></div>
                    {t.splits.length > 1 && <div className="text-[11px] text-neutral-700 truncate">chia {t.splits.length}: {splitNames(t, members)} · tổng {fmt(t.amount, t.currency)}</div>}
                  </div>
                  <span className="text-[15px] font-extrabold num">{fmt(s.amount, t.currency)}</span>
                </div>
              )
              return link ? <Link key={t.id} to={`/tx/${t.id}`} className="block text-ink hover:bg-ink/5">{row}</Link> : <div key={t.id}>{row}</div>
            })}
          </div>
        </>
      )}

      <SectionLabel top>Tất cả giao dịch liên quan · {txs.length}</SectionLabel>
      <TxList data={data} transactions={txs} link={link} memberId={member.id} />
    </>
  )
}
