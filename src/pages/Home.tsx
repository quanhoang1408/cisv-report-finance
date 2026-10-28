import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeftRight, RefreshCw, Scale, Settings } from 'lucide-react'
import { db, setActiveDelegationId } from '../db/db'
import { useActiveDelegationId, useDelegationData, type DelegationData } from '../hooks/useDelegation'
import { netIn, sumIn } from '../lib/ledger'
import { fmt } from '../lib/money'
import { usePendingCount, useSyncState } from '../lib/sync'
import { cloudEnabled } from '../lib/supabase'
import { ActionSplit, Frame, Header, HeroNumber, OfflineTag, SectionLabel, Spinner, Tag, TextLink, Toast, WALLET_ICON, WalletCells, fmtTime, useToast } from '../components/ui'
import { FundRow, PocketRow, approxLine } from '../components/shared'

export default function Home() {
  const id = useActiveDelegationId()
  const allDelegations = useLiveQuery(() => db.delegations.toArray(), [])
  const { data, loading, missing } = useDelegationData(id)

  useEffect(() => {
    if (!id && allDelegations && allDelegations.length > 0) setActiveDelegationId(allDelegations[0].id)
  }, [id, allDelegations])

  if (!id) {
    if (allDelegations === undefined || allDelegations.length > 0) return <Spinner />
    return <Navigate to="/setup" replace />
  }
  if (missing) return <Navigate to="/setup" replace />
  if (loading || !data) return <Frame nav><Spinner /></Frame>
  return <HomeBody data={data} />
}

function SyncTag({ data }: { data: DelegationData }) {
  const sync = useSyncState()
  const pending = usePendingCount(data.delegation.id, data.delegation.publishedAt)
  if (sync.status === 'offline') return <OfflineTag pending={pending} />
  if (sync.status === 'syncing') return <Tag variant="neutral" icon={RefreshCw}>Đang đồng bộ…</Tag>
  if (sync.status === 'error') return <Link to="/share"><Tag variant="accent">Lỗi đồng bộ · thử lại</Tag></Link>
  if (!cloudEnabled) return <Link to="/share"><Tag variant="neutral">Chỉ lưu trên máy</Tag></Link>
  const at = sync.lastSyncAt ?? data.delegation.publishedAt
  return <Link to="/share"><Tag variant={pending > 0 ? 'accent' : 'neutral'}>{at ? `Đã đồng bộ ${fmtTime(at)}` : 'Chưa đồng bộ'}{pending > 0 ? ` · ${pending} chờ` : ''}</Tag></Link>
}

function HomeBody({ data }: { data: DelegationData }) {
  const { delegation, wallets, funds, members, ledger } = data
  const nav = useNavigate()
  const location = useLocation()
  const [toast, showToast, hideToast] = useToast()
  const [undoId, setUndoId] = useState<string | null>(null)

  useEffect(() => {
    const st = location.state as { toast?: string; undoTxId?: string } | null
    if (st?.toast) {
      showToast(st.toast, 5000)
      setUndoId(st.undoTxId ?? null)
      nav('.', { replace: true, state: null })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state])

  const local = delegation.localCurrency
  const localCash = wallets.filter((w) => w.kind === 'cash' && w.currency === local)
  const localTotal = localCash.reduce((s, w) => s + (ledger.walletBalances[w.id] ?? 0), 0)
  const otherWallets = wallets.filter((w) => !localCash.includes(w))
  const delegates = members.filter((m) => m.role === 'delegate')
  const shared = funds.filter((f) => f.type !== 'PERSONAL')
  const emergency = funds.find((f) => f.type === 'EMERGENCY')
  const emergencyNet = emergency ? netIn(ledger.fundTotals[emergency.id] ?? {}, delegation.bridgeCurrency, ledger.rates) : null
  const preCamp = funds.find((f) => f.type === 'PRE_CAMP')
  const preCampNet = preCamp ? netIn(ledger.fundTotals[preCamp.id] ?? {}, delegation.baseCurrency, ledger.rates) : null

  // Pocket money mỗi bé (nếu đều nhau)
  const pocketIncomes = delegates.map((m) => {
    const f = funds.find((x) => x.type === 'PERSONAL' && x.memberId === m.id)
    return f ? sumIn(ledger.fundTotals[f.id] ?? {}, 'income', delegation.bridgeCurrency, ledger.rates) ?? 0 : 0
  })
  const samePocket = pocketIncomes.length > 0 && pocketIncomes.every((v) => v === pocketIncomes[0]) && pocketIncomes[0] > 0

  const cells = otherWallets.map((w) => {
    const bal = ledger.walletBalances[w.id] ?? 0
    let note: string | undefined
    if (w.currency === delegation.bridgeCurrency && w.kind === 'cash' && emergencyNet && emergencyNet > 0) note = `gồm ${fmt(emergencyNet, delegation.bridgeCurrency)} khẩn cấp`
    else if (w.kind === 'card' && bal < 0) note = 'đoàn đang nợ Leader'
    else if (w.currency === delegation.baseCurrency && preCampNet != null && preCamp) note = preCampNet >= 0 ? 'Pre-camp còn dư' : 'Pre-camp vượt'
    return { icon: WALLET_ICON(w), name: w.name, value: fmt(bal, w.currency), note, negative: bal < 0 }
  })

  async function undo() {
    if (!undoId) return
    const t = await db.transactions.get(undoId)
    if (t?.receiptId) await db.receipts.delete(t.receiptId)
    await db.transactions.delete(undoId)
    setUndoId(null)
    hideToast()
    showToast('Đã hoàn tác')
  }

  return (
    <Frame nav>
      <Header
        label={`${delegation.programme} ${delegation.hostCountry} ${delegation.year}`.toUpperCase()}
        title={delegation.name}
        right={
          <div className="flex items-center gap-2">
            <SyncTag data={data} />
            <Link to="/settings" className="w-11 h-11 -mr-3 flex items-center justify-center text-ink" aria-label="Cài đặt"><Settings size={20} /></Link>
          </div>
        }
      />

      <HeroNumber label={`Tiền mặt trong ví · theo sổ${localCash.length > 1 ? ` · ${localCash.length} ví` : ''}`} value={fmt(localTotal, local)} sub={approxLine(data, localTotal, local)} negative={localTotal < 0} />

      <ActionSplit items={[{ label: 'Đổi tiền', icon: ArrowLeftRight, to: '/exchange' }, { label: 'Kiểm két', icon: Scale, to: '/count' }]} />

      {cells.length > 0 && (
        <>
          <SectionLabel>Ví vật lý</SectionLabel>
          <WalletCells cells={cells} />
        </>
      )}

      <SectionLabel right="Còn lại" top>Quỹ ngân sách</SectionLabel>
      <div className="border-b border-divider">
        {shared.map((f) => <FundRow key={f.id} data={data} fund={f} link={`/funds/${f.id}`} />)}
      </div>

      {delegates.length > 0 && (
        <>
          <SectionLabel right="Còn lại" top>Pocket money{samePocket ? ` · ${fmt(pocketIncomes[0], delegation.bridgeCurrency)}/bé` : ''}</SectionLabel>
          <div className="border-b border-divider">
            {delegates.map((m) => <PocketRow key={m.id} data={data} member={m} link={`/members/${m.id}`} />)}
          </div>
        </>
      )}

      <div className="px-5 py-3 flex flex-col">
        <TextLink to="/members">Quyết toán & thành viên</TextLink>
        <TextLink to="/share">Chia sẻ cho phụ huynh</TextLink>
        <TextLink to="/add?type=income">Ghi tiền phụ huynh gửi</TextLink>
      </div>

      {data.transactions.length === 0 && (
        <div className="mx-5 mb-6 info-note flex-col gap-1">
          <b>Bắt đầu thế nào?</b>
          <span>1. "Ghi tiền phụ huynh gửi": pocket money từng bé, quỹ side trip, emergency.</span>
          <span>2. Sang nước bạn: "Đổi tiền" mỗi lần đổi {delegation.bridgeCurrency} → {local}.</span>
          <span>3. Mỗi khoản chi: bấm + , nhập tiền, chọn quỹ, chọn người, chụp bill.</span>
          <span>4. Tối về: "Kiểm két" đối chiếu tiền mặt.</span>
        </div>
      )}

      <Toast msg={toast} action={undoId ? { label: 'Hoàn tác', onClick: undo } : undefined} />
    </Frame>
  )
}
