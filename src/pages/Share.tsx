import { useEffect, useState } from 'react'
import { Copy, Eye, LogOut, Send, UploadCloud } from 'lucide-react'
import { useActiveDelegationId, useDelegationData } from '../hooks/useDelegation'
import { cloudEnabled, signInWithEmail, signOut, supabase, verifyEmailCode } from '../lib/supabase'
import { syncNow, usePendingCount, useSyncState } from '../lib/sync'
import { Field, Frame, Header, PrimaryButton, SecondaryButton, SectionLabel, Spinner, TextLink, Toast, fmtTime, useToast } from '../components/ui'

export default function Share() {
  const id = useActiveDelegationId()
  const { data, loading } = useDelegationData(id)
  const [toast, showToast] = useToast()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [sent, setSent] = useState(false)
  const sync = useSyncState()
  const pending = usePendingCount(id, data?.delegation.publishedAt)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSessionEmail(data.session?.user.email ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSessionEmail(s?.user.email ?? null))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (loading || !data) return <Frame nav><Spinner /></Frame>
  const { delegation } = data
  const link = `${window.location.origin}/p/${delegation.slug}`
  const message = `Sổ quỹ đoàn ${delegation.name}\n${link}\nMã PIN: ${delegation.parentPin}`

  async function copy(text: string, label: string) {
    try { await navigator.clipboard.writeText(text); showToast(`Đã copy ${label}`) } catch { showToast('Không copy được, hãy chọn và copy thủ công') }
  }
  async function share() {
    if (navigator.share) { try { await navigator.share({ title: delegation.name, text: message }) } catch { /* huỷ */ } } else copy(message, 'nội dung')
  }
  async function login(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true)
    try { await signInWithEmail(email.trim()); setSent(true) } catch (ex) { setErr((ex as Error).message) } finally { setBusy(false) }
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true)
    try { await verifyEmailCode(email.trim(), code) } catch (ex) { setErr((ex as Error).message) } finally { setBusy(false) }
  }
  async function publish() {
    setErr(''); setBusy(true)
    try { await syncNow(delegation.id); showToast('Đã xuất bản') } catch (ex) { setErr((ex as Error).message) } finally { setBusy(false) }
  }

  return (
    <Frame nav>
      <Header label="Phụ huynh · chỉ xem" title="Chia sẻ sổ quỹ" back="/" />
      <SectionLabel top>Link & mã PIN</SectionLabel>
      <div className="px-5 space-y-3">
        <p className="text-[13px] text-neutral-700">Gửi link + mã PIN vào nhóm Zalo / WhatsApp của đoàn. Phụ huynh không cần tài khoản, không sửa được gì.</p>
        <div className="bg-surface px-3 py-2.5 text-[13px] break-all num">{link}</div>
        <div className="flex items-center justify-between border-y border-divider py-3">
          <span className="section-label">Mã PIN</span>
          <span className="text-[28px] font-extrabold tracking-[0.3em] num">{delegation.parentPin}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <SecondaryButton icon={Copy} onClick={() => copy(message, 'link + PIN')}>Copy</SecondaryButton>
          <PrimaryButton small icon={Send} onClick={share}>Gửi</PrimaryButton>
        </div>
        <TextLink to={`/p/${delegation.slug}`}>Xem trước giao diện phụ huynh</TextLink>
      </div>

      <SectionLabel top>Đồng bộ lên cloud</SectionLabel>
      <div className="px-5 space-y-3 pb-8">
        {!cloudEnabled ? (
          <div className="text-[13px] text-neutral-700 space-y-2 leading-relaxed">
            <p>Chưa cấu hình Supabase: link ở trên chỉ mở được trên chính điện thoại này (chế độ xem trước).</p>
            <p>Để phụ huynh xem từ xa, làm theo README: tạo project Supabase miễn phí, chạy <code>supabase/schema.sql</code>, điền <code>VITE_SUPABASE_URL</code> và <code>VITE_SUPABASE_ANON_KEY</code> rồi deploy lại.</p>
          </div>
        ) : sessionEmail ? (
          <>
            <div className="text-[13px]">Đăng nhập: <b>{sessionEmail}</b></div>
            <div className="text-[12px] text-neutral-700">
              {delegation.publishedAt ? `Lần xuất bản gần nhất: ${fmtTime(delegation.publishedAt)} ${new Date(delegation.publishedAt).toLocaleDateString('vi-VN')}` : 'Chưa xuất bản lần nào'}
              {pending > 0 ? ` · ${pending} thay đổi chờ` : ''}
              {sync.status === 'error' ? ` · lỗi: ${sync.message}` : ''}
            </div>
            <PrimaryButton icon={UploadCloud} disabled={busy || sync.status === 'syncing'} onClick={publish}>{busy || sync.status === 'syncing' ? 'Đang xuất bản…' : 'Xuất bản dữ liệu mới nhất'}</PrimaryButton>
            <p className="text-[12px] text-neutral-700">Khi có mạng, app tự xuất bản sau mỗi thay đổi. Nút này để đẩy ngay lập tức.</p>
            <SecondaryButton icon={LogOut} onClick={signOut}>Đăng xuất</SecondaryButton>
          </>
        ) : sent ? (
          <form onSubmit={verify} className="space-y-3">
            <Field label="Mã đăng nhập" hint={<>Đã gửi email tới <b>{email}</b>. Nhập mã số trong email, hoặc bấm link trong email bằng chính trình duyệt này.</>}>
              <input className="input num" inputMode="numeric" autoComplete="one-time-code" required minLength={6} maxLength={10} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="123456" />
            </Field>
            <PrimaryButton disabled={busy || code.length < 6}>Xác nhận</PrimaryButton>
            <SecondaryButton type="button" onClick={() => { setSent(false); setCode(''); setErr('') }}>Gửi lại / đổi email</SecondaryButton>
          </form>
        ) : (
          <form onSubmit={login} className="space-y-3">
            <Field label="Email của Leader" hint="Nhận link đăng nhập qua email, không cần mật khẩu.">
              <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="leader@example.com" />
            </Field>
            <PrimaryButton disabled={busy}>Gửi link đăng nhập</PrimaryButton>
          </form>
        )}
        {err && <p className="text-[13px] neg">{err}</p>}
        <div className="info-note"><Eye size={15} className="shrink-0 mt-0.5" /><span>Phụ huynh chỉ đọc. Ảnh hoá đơn được đẩy lên cùng dữ liệu, PIN được băm SHA-256 trước khi lưu.</span></div>
      </div>
      <Toast msg={toast} />
    </Frame>
  )
}
