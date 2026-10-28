import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { nanoid } from 'nanoid'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download, FileSpreadsheet, Plus, Share2, Trash2, Upload, X } from 'lucide-react'
import { db, setActiveDelegationId } from '../db/db'
import { FUND_TYPE_LABEL, MEMBER_COLORS, type Fund, type FundType, type Member, type Wallet, type WalletKind } from '../db/types'
import { deleteDelegation } from '../db/seed'
import { useActiveDelegationId, useDelegationData, type DelegationData } from '../hooks/useDelegation'
import { exportBackup, exportCsv, importSnapshotFile } from '../lib/snapshot'
import { AmountInput, CurrencySelect, Field, Frame, Header, PrimaryButton, SecondaryButton, SectionLabel, Spinner, TextLink, Toast, WALLET_ICON, confirmDialog, useToast } from '../components/ui'

export default function Settings() {
  const id = useActiveDelegationId()
  const { data, loading } = useDelegationData(id)
  if (loading || !data) return <Frame nav><Spinner /></Frame>
  return <SettingsBody data={data} />
}

function SettingsBody({ data }: { data: DelegationData }) {
  const nav = useNavigate()
  const { delegation, members, wallets, funds } = data
  const [toast, showToast] = useToast()
  const allDelegations = useLiveQuery(() => db.delegations.toArray(), [])

  const [name, setName] = useState(delegation.name)
  const [hostCountry, setHostCountry] = useState(delegation.hostCountry)
  const [pin, setPin] = useState(delegation.parentPin)
  const [rateBase, setRateBase] = useState(String(delegation.manualRates?.[`${delegation.bridgeCurrency}:${delegation.baseCurrency}`] ?? ''))
  const [rateLocal, setRateLocal] = useState(String(delegation.manualRates?.[`${delegation.bridgeCurrency}:${delegation.localCurrency}`] ?? ''))

  async function saveDelegation() {
    if (!/^\d{4,6}$/.test(pin)) return showToast('PIN phải 4–6 số')
    const manualRates = { ...(delegation.manualRates ?? {}) }
    const kb = `${delegation.bridgeCurrency}:${delegation.baseCurrency}`
    const kl = `${delegation.bridgeCurrency}:${delegation.localCurrency}`
    const rb = Number(rateBase.replace(/[^\d.]/g, ''))
    const rl = Number(rateLocal.replace(/[^\d.]/g, ''))
    if (rb > 0) manualRates[kb] = rb; else delete manualRates[kb]
    if (rl > 0) manualRates[kl] = rl; else delete manualRates[kl]
    await db.delegations.update(delegation.id, { name: name.trim() || delegation.name, hostCountry, parentPin: pin, manualRates, updatedAt: Date.now() })
    showToast('Đã lưu')
  }

  const [newMember, setNewMember] = useState('')
  async function addMember() {
    const n = newMember.trim()
    if (!n) return
    const m: Member = { id: nanoid(8), delegationId: delegation.id, name: n, role: 'delegate', color: MEMBER_COLORS[members.length % MEMBER_COLORS.length], sortOrder: members.length }
    await db.transaction('rw', [db.members, db.funds], async () => {
      await db.members.add(m)
      await db.funds.add({ id: nanoid(8), delegationId: delegation.id, name: `Pocket money – ${n}`, type: 'PERSONAL', memberId: m.id, currency: delegation.bridgeCurrency, sortOrder: 10 + members.length })
    })
    setNewMember('')
  }
  async function renameMember(m: Member, n: string) {
    if (!n.trim() || n === m.name) return
    await db.members.update(m.id, { name: n.trim() })
    const pf = funds.find((f) => f.type === 'PERSONAL' && f.memberId === m.id)
    if (pf) await db.funds.update(pf.id, { name: `Pocket money – ${n.trim()}` })
  }
  async function removeMember(m: Member) {
    if (data.transactions.some((t) => t.splits.some((s) => s.memberId === m.id))) return showToast('Thành viên đã có giao dịch, không xoá được')
    if (!confirmDialog(`Xoá ${m.name}?`)) return
    await db.transaction('rw', [db.members, db.funds], async () => {
      await db.funds.where('memberId').equals(m.id).delete()
      await db.members.delete(m.id)
    })
  }

  const [newWallet, setNewWallet] = useState({ name: '', currency: delegation.localCurrency, kind: 'cash' as WalletKind })
  async function addWallet() {
    if (!newWallet.name.trim()) return
    const w: Wallet = { id: nanoid(8), delegationId: delegation.id, name: newWallet.name.trim(), currency: newWallet.currency, kind: newWallet.kind, sortOrder: wallets.length }
    await db.wallets.add(w)
    setNewWallet({ ...newWallet, name: '' })
  }
  async function removeWallet(w: Wallet) {
    if (data.transactions.some((t) => t.walletId === w.id || t.toWalletId === w.id)) return showToast('Ví đã có giao dịch, không xoá được')
    if (!confirmDialog(`Xoá ví ${w.name}?`)) return
    await db.wallets.delete(w.id)
  }

  const [newFund, setNewFund] = useState({ name: '', type: 'OTHER' as FundType, currency: delegation.localCurrency })
  async function addFund() {
    if (!newFund.name.trim()) return
    const f: Fund = { id: nanoid(8), delegationId: delegation.id, name: newFund.name.trim(), type: newFund.type, currency: newFund.currency, sortOrder: funds.length }
    await db.funds.add(f)
    setNewFund({ ...newFund, name: '' })
  }
  async function removeFund(f: Fund) {
    if (data.transactions.some((t) => t.fundId === f.id)) return showToast('Quỹ đã có giao dịch, không xoá được')
    if (!confirmDialog(`Xoá quỹ ${f.name}?`)) return
    await db.funds.delete(f.id)
  }

  async function removeDelegation() {
    if (!confirmDialog(`XOÁ TOÀN BỘ dữ liệu đoàn "${delegation.name}" trên máy này? Hãy sao lưu trước!`)) return
    if (!confirmDialog('Chắc chắn? Không thể hoàn tác.')) return
    await deleteDelegation(delegation.id)
    const rest = (allDelegations ?? []).filter((d) => d.id !== delegation.id)
    setActiveDelegationId(rest[0]?.id ?? null)
    nav('/', { replace: true })
  }

  const rowCls = 'flex items-center gap-2 px-5 py-2 border-b border-divider'
  const inlineInput = 'flex-1 min-w-0 bg-transparent outline-none text-[15px] font-semibold py-1'
  const xBtn = (onClick: () => void) => <button className="w-11 h-11 -mr-3 flex items-center justify-center text-neutral-700" onClick={onClick} aria-label="Xoá"><X size={18} /></button>

  return (
    <Frame nav>
      <Header label="Cài đặt" title={delegation.name} back="/" />

      <SectionLabel top>Đoàn</SectionLabel>
      <div className="px-5 space-y-3">
        <Field label="Tên đoàn"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Nước đăng cai"><input className="input" value={hostCountry} onChange={(e) => setHostCountry(e.target.value)} /></Field>
        <Field label="Mã PIN phụ huynh"><input className="input tracking-[0.4em] font-extrabold num" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`1 ${delegation.bridgeCurrency} = ? ${delegation.baseCurrency}`}><input className="input num" inputMode="decimal" value={rateBase} onChange={(e) => setRateBase(e.target.value)} placeholder="26350" /></Field>
          {delegation.localCurrency !== delegation.bridgeCurrency && (
            <Field label={`1 ${delegation.bridgeCurrency} = ? ${delegation.localCurrency}`} hint="Chỉ dùng khi chưa có lần đổi nào"><input className="input num" inputMode="decimal" value={rateLocal} onChange={(e) => setRateLocal(e.target.value)} /></Field>
          )}
        </div>
        <label className="flex items-start gap-3 text-[13px] py-1">
          <input type="checkbox" className="w-5 h-5 mt-0.5 accent-accent" checked={delegation.leaderSharesCosts} onChange={(e) => db.delegations.update(delegation.id, { leaderSharesCosts: e.target.checked })} />
          <span>Leader cũng chia phần các khoản chi chung (mặc định: phụ huynh các bé gánh phần Leader)</span>
        </label>
        <PrimaryButton small icon={null} onClick={saveDelegation}>Lưu</PrimaryButton>
      </div>

      <SectionLabel top>Thành viên</SectionLabel>
      <div className="border-t border-divider">
        {members.map((m) => (
          <div key={m.id} className={rowCls}>
            <input className={inlineInput} defaultValue={m.name} onBlur={(e) => renameMember(m, e.target.value)} />
            <span className="text-[11px] text-neutral-700 uppercase tracking-wide">{m.role}</span>
            {m.role === 'delegate' && xBtn(() => removeMember(m))}
          </div>
        ))}
        <div className="flex gap-2 px-5 py-3">
          <input className="input" placeholder="Tên delegate mới" value={newMember} onChange={(e) => setNewMember(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addMember()} />
          <button className="h-11 w-11 shrink-0 bg-accent text-paper flex items-center justify-center" onClick={addMember} aria-label="Thêm"><Plus size={20} /></button>
        </div>
      </div>

      <SectionLabel top>Ví vật lý</SectionLabel>
      <div className="border-t border-divider">
        {wallets.map((w) => {
          const Icon = WALLET_ICON(w)
          return (
            <div key={w.id} className={rowCls}>
              <Icon size={18} className="text-neutral-700" />
              <input className={inlineInput} defaultValue={w.name} onBlur={(e) => e.target.value.trim() && db.wallets.update(w.id, { name: e.target.value.trim() })} />
              <span className="text-[12px] text-neutral-700">{w.currency}</span>
              {xBtn(() => removeWallet(w))}
            </div>
          )
        })}
        <div className="px-5 py-3 space-y-2">
          <input className="input" placeholder="Tên ví mới (VD: Thẻ Visa của Leader)" value={newWallet.name} onChange={(e) => setNewWallet({ ...newWallet, name: e.target.value })} />
          <div className="grid grid-cols-[1fr_auto_44px] gap-2">
            <CurrencySelect value={newWallet.currency} onChange={(c) => setNewWallet({ ...newWallet, currency: c })} />
            <select className="input !w-auto" value={newWallet.kind} onChange={(e) => setNewWallet({ ...newWallet, kind: e.target.value as WalletKind })}>
              <option value="cash">Tiền mặt</option><option value="card">Thẻ</option><option value="bank">Tài khoản</option>
            </select>
            <button className="h-11 w-11 bg-accent text-paper flex items-center justify-center" onClick={addWallet} aria-label="Thêm"><Plus size={20} /></button>
          </div>
        </div>
      </div>

      <SectionLabel top>Quỹ ngân sách</SectionLabel>
      <div className="border-t border-divider" id="funds">
        {funds.map((f) => <FundRowEdit key={f.id} fund={f} onRemove={() => removeFund(f)} />)}
        <div className="px-5 py-3 space-y-2">
          <input className="input" placeholder="Tên quỹ mới (VD: Quỹ đồng phục)" value={newFund.name} onChange={(e) => setNewFund({ ...newFund, name: e.target.value })} />
          <div className="grid grid-cols-[1fr_1fr_44px] gap-2">
            <select className="input" value={newFund.type} onChange={(e) => setNewFund({ ...newFund, type: e.target.value as FundType })}>
              {(Object.keys(FUND_TYPE_LABEL) as FundType[]).filter((t) => t !== 'PERSONAL').map((t) => <option key={t} value={t}>{FUND_TYPE_LABEL[t]}</option>)}
            </select>
            <CurrencySelect value={newFund.currency} onChange={(c) => setNewFund({ ...newFund, currency: c })} />
            <button className="h-11 w-11 bg-accent text-paper flex items-center justify-center" onClick={addFund} aria-label="Thêm"><Plus size={20} /></button>
          </div>
        </div>
      </div>

      <SectionLabel top>Sao lưu & chia sẻ</SectionLabel>
      <div className="px-5 space-y-2">
        <Link to="/share" className="btn-primary btn-primary-sm"><span>Chia sẻ cho phụ huynh / đồng bộ cloud</span><Share2 size={20} /></Link>
        <SecondaryButton icon={Download} onClick={() => exportBackup(delegation.id)}>Sao lưu JSON (kèm PIN)</SecondaryButton>
        <SecondaryButton icon={FileSpreadsheet} onClick={() => exportCsv(delegation.id)}>Xuất CSV cho Excel</SecondaryButton>
        <label className="btn-secondary cursor-pointer"><Upload size={18} /><span>Khôi phục từ JSON</span>
          <input type="file" accept=".json,application/json" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { await importSnapshotFile(f); showToast('Đã khôi phục') } catch (ex) { showToast((ex as Error).message) } }} />
        </label>
        <p className="text-[12px] text-neutral-700 leading-relaxed">Dữ liệu nằm trong trình duyệt điện thoại. Sao lưu JSON định kỳ (gửi vào Zalo của chính mình) để phòng mất máy. Ảnh hoá đơn chỉ được giữ lâu dài qua đồng bộ cloud.</p>
      </div>

      <SectionLabel top>Các đoàn trên máy này</SectionLabel>
      <div className="border-t border-divider">
        {(allDelegations ?? []).map((d) => (
          <button key={d.id} className={`w-full text-left px-5 py-2.5 border-b border-divider flex items-center text-[15px] ${d.id === delegation.id ? 'font-extrabold' : ''}`} onClick={() => { setActiveDelegationId(d.id); nav('/') }}>
            <span className="flex-1">{d.name}</span>
            {d.id === delegation.id && <span className="text-[11px] text-neutral-700">đang mở</span>}
          </button>
        ))}
        <div className="px-5"><TextLink to="/setup">Tạo đoàn mới</TextLink></div>
      </div>
      <div className="px-5 pt-4 pb-8">
        <SecondaryButton icon={Trash2} danger onClick={removeDelegation}>Xoá đoàn này khỏi máy</SecondaryButton>
        <p className="text-center text-[11px] text-neutral-600 pt-6">CISV Delegation Finance · v0.2</p>
      </div>
      <Toast msg={toast} />
    </Frame>
  )
}

function FundRowEdit({ fund, onRemove }: { fund: Fund; onRemove: () => void }) {
  const [budget, setBudget] = useState<number | null>(fund.budget ?? null)
  return (
    <div className="px-5 py-2 border-b border-divider">
      <div className="flex items-center gap-2">
        <input className="flex-1 min-w-0 bg-transparent outline-none text-[15px] font-semibold py-1" defaultValue={fund.name} onBlur={(e) => e.target.value.trim() && db.funds.update(fund.id, { name: e.target.value.trim() })} />
        <span className="text-[12px] text-neutral-700">{fund.currency}</span>
        {fund.type !== 'PERSONAL' && <button className="w-11 h-11 -mr-3 flex items-center justify-center text-neutral-700" onClick={onRemove} aria-label="Xoá"><X size={18} /></button>}
      </div>
      <div className="flex items-center gap-2 text-[12px] text-neutral-700 pb-1">
        <span className="shrink-0">Ngân sách dự kiến</span>
        <AmountInput value={budget} currency={fund.currency} onChange={(v) => { setBudget(v); db.funds.update(fund.id, { budget: v ?? undefined }) }} className="w-44 [&_input]:!h-9 [&_input]:!text-[14px]" placeholder="tuỳ chọn" />
      </div>
    </div>
  )
}
