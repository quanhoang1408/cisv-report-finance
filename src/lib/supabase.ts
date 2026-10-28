import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { db } from '../db/db'
import type { Snapshot } from '../db/types'
import { buildSnapshot } from './snapshot'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null
export const cloudEnabled = supabase != null

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function signInWithEmail(email: string) {
  if (!supabase) throw new Error('Chưa cấu hình Supabase')
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + '/share' } })
  if (error) throw error
}

/** Đăng nhập bằng mã số trong email (thay cho bấm link: dùng được trong PWA iOS, không bị máy quét email "ăn" mất link) */
export async function verifyEmailCode(email: string, token: string) {
  if (!supabase) throw new Error('Chưa cấu hình Supabase')
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
  if (error) throw error
}

export async function signOut() {
  await supabase?.auth.signOut()
}

/**
 * Xuất bản đoàn cho phụ huynh:
 * 1. Upload các ảnh hoá đơn chưa có remoteUrl lên Storage (bucket "receipts")
 * 2. Gói snapshot (không có PIN) và upsert vào bảng published_delegations cùng pin_hash
 */
export async function publishDelegation(delegationId: string, onProgress?: (msg: string) => void) {
  if (!supabase) throw new Error('Chưa cấu hình Supabase')
  const { data: sess } = await supabase.auth.getSession()
  const uid = sess.session?.user.id
  if (!uid) throw new Error('Cần đăng nhập trước khi xuất bản')

  const delegation = await db.delegations.get(delegationId)
  if (!delegation) throw new Error('Không tìm thấy đoàn')

  const txs = await db.transactions.where('delegationId').equals(delegationId).toArray()
  const pending = txs.filter((t) => t.receiptId && !t.receiptUrl)
  let i = 0
  for (const t of pending) {
    i++
    onProgress?.(`Đang tải ảnh hoá đơn ${i}/${pending.length}…`)
    const r = await db.receipts.get(t.receiptId!)
    if (!r) continue
    const path = `${uid}/${delegationId}/${r.id}.jpg`
    const { error } = await supabase.storage.from('receipts').upload(path, r.blob, { upsert: true, contentType: r.mime || 'image/jpeg' })
    if (error) throw new Error(`Upload ảnh thất bại: ${error.message}`)
    const { data } = supabase.storage.from('receipts').getPublicUrl(path)
    await db.transactions.update(t.id, { receiptUrl: data.publicUrl })
    await db.receipts.update(r.id, { remoteUrl: data.publicUrl })
  }

  onProgress?.('Đang đẩy dữ liệu…')
  const snap = await buildSnapshot(delegationId, { forParents: true })
  const pin_hash = await sha256Hex(`${delegation.slug}:${delegation.parentPin}`)
  const { error } = await supabase.from('published_delegations').upsert(
    { id: delegationId, owner: uid, slug: delegation.slug, pin_hash, data: snap, updated_at: new Date().toISOString() },
    { onConflict: 'id' },
  )
  if (error) throw new Error(`Xuất bản thất bại: ${error.message}`)
  await db.delegations.update(delegationId, { publishedAt: Date.now() })
}

export async function fetchPublished(slug: string, pin: string): Promise<Snapshot | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('get_published_delegation', { p_slug: slug, p_pin: pin })
  if (error) throw new Error(error.message)
  return (data as Snapshot | null) ?? null
}
