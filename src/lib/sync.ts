/**
 * Trạng thái đồng bộ & tự động xuất bản khi có mạng.
 * Dữ liệu luôn lưu local trước; nếu đã cấu hình Supabase + đã đăng nhập thì tự đẩy lên sau mỗi thay đổi (debounce).
 */
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { cloudEnabled, publishDelegation, supabase } from './supabase'

export type SyncState = { status: 'offline' | 'idle' | 'syncing' | 'error'; message?: string; lastSyncAt?: number }

let state: SyncState = { status: navigator.onLine ? 'idle' : 'offline' }
const listeners = new Set<(s: SyncState) => void>()
function set(next: Partial<SyncState>) {
  state = { ...state, ...next }
  listeners.forEach((l) => l(state))
}

window.addEventListener('online', () => set({ status: 'idle' }))
window.addEventListener('offline', () => set({ status: 'offline' }))

export function useSyncState(): SyncState {
  const [s, setS] = useState(state)
  useEffect(() => {
    listeners.add(setS)
    return () => { listeners.delete(setS) }
  }, [])
  return s
}

export function useOnline(): boolean {
  const [on, setOn] = useState(navigator.onLine)
  useEffect(() => {
    const a = () => setOn(true), b = () => setOn(false)
    window.addEventListener('online', a)
    window.addEventListener('offline', b)
    return () => { window.removeEventListener('online', a); window.removeEventListener('offline', b) }
  }, [])
  return on
}

/** Số giao dịch thay đổi sau lần xuất bản gần nhất ("N chờ") */
export function usePendingCount(delegationId: string | null, publishedAt?: number): number {
  const n = useLiveQuery(async () => {
    if (!delegationId) return 0
    const since = publishedAt ?? 0
    const txs = await db.transactions.where('delegationId').equals(delegationId).toArray()
    return txs.filter((t) => t.updatedAt > since).length
  }, [delegationId, publishedAt])
  return n ?? 0
}

let timer: number | undefined
/** Gọi ở gốc app: tự xuất bản sau 8 giây kể từ thay đổi cuối, khi online + đã đăng nhập. */
export function useAutoSync(delegationId: string | null) {
  const online = useOnline()
  const delegation = useLiveQuery(() => (delegationId ? db.delegations.get(delegationId) : undefined), [delegationId])
  const pending = usePendingCount(delegationId, delegation?.publishedAt)
  useEffect(() => {
    if (!cloudEnabled || !online || !delegationId || pending === 0) return
    window.clearTimeout(timer)
    timer = window.setTimeout(async () => {
      const { data } = await supabase!.auth.getSession()
      if (!data.session) return
      set({ status: 'syncing' })
      try {
        await publishDelegation(delegationId)
        set({ status: 'idle', lastSyncAt: Date.now(), message: undefined })
      } catch (e) {
        set({ status: 'error', message: (e as Error).message })
      }
    }, 8000)
    return () => window.clearTimeout(timer)
  }, [online, delegationId, pending])
}

export async function syncNow(delegationId: string) {
  set({ status: 'syncing' })
  try {
    await publishDelegation(delegationId)
    set({ status: 'idle', lastSyncAt: Date.now(), message: undefined })
  } catch (e) {
    set({ status: 'error', message: (e as Error).message })
    throw e
  }
}
