import { useEffect, useRef, useState } from 'react'
import { Camera, Image as ImageIcon, ImageOff, X, Check, RotateCcw } from 'lucide-react'
import { compressReceipt } from '../lib/image'
import { useReceiptUrl } from '../hooks/useDelegation'
import { PrimaryButton, SecondaryButton, cn } from './ui'

function kb(n: number) {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`
}

/** Nút chụp / chọn ảnh hoá đơn (L4). Trả về blob đã nén. */
export function ReceiptCapture({ blob, onChange, compact }: { blob: Blob | null; onChange: (b: Blob | null) => void; compact?: boolean }) {
  const camRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<{ original: File; compressed: Blob } | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [sheetUrl, setSheetUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!blob) { setPreview(null); return }
    const u = URL.createObjectURL(blob)
    setPreview(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  useEffect(() => {
    if (!pending) { setSheetUrl(null); return }
    const u = URL.createObjectURL(pending.compressed)
    setSheetUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [pending])

  async function handle(file?: File) {
    if (!file) return
    setBusy(true)
    try {
      setPending({ original: file, compressed: await compressReceipt(file) })
    } finally {
      setBusy(false)
    }
  }

  const inputs = (
    <>
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { handle(e.target.files?.[0]); e.target.value = '' }} />
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { handle(e.target.files?.[0]); e.target.value = '' }} />
    </>
  )

  const sheet = pending && (
    <div className="fixed inset-0 z-50 bg-ink text-paper flex flex-col">
      <div className="h-14 flex items-center px-2">
        <button className="w-11 h-11 flex items-center justify-center" onClick={() => setPending(null)} aria-label="Đóng"><X size={22} /></button>
        <div className="flex-1 text-[16px] font-extrabold">Chụp hoá đơn</div>
      </div>
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        {sheetUrl && <img src={sheetUrl} alt="Hoá đơn" className="max-h-full max-w-full object-contain" />}
      </div>
      <div className="bg-paper text-ink px-5 pt-4 safe-bottom">
        <div className="text-[13px] text-neutral-700 num">{pending.original.name}</div>
        <div className="grid grid-cols-2 border-y border-divider my-3">
          <div className="py-2.5 pr-3">
            <div className="section-label">Ảnh gốc</div>
            <div className="text-[22px] font-extrabold num line-through text-neutral-600">{kb(pending.original.size)}</div>
          </div>
          <div className="py-2.5 pl-3 border-l border-divider">
            <div className="section-label">Sau nén</div>
            <div className="text-[22px] font-extrabold num">{kb(pending.compressed.size)}</div>
          </div>
        </div>
        <div className="h-1 bg-neutral-300 mb-3"><div className="h-full bg-ink" style={{ width: `${Math.min(100, (pending.compressed.size / pending.original.size) * 100)}%` }} /></div>
        <p className="text-[12px] text-neutral-700 mb-3">Nén ngay trên máy, lưu offline cùng khoản chi. Tự tải lên khi có mạng.</p>
        <div className="grid grid-cols-2 gap-2 pb-4">
          <SecondaryButton icon={RotateCcw} onClick={() => { setPending(null); camRef.current?.click() }}>Chụp lại</SecondaryButton>
          <PrimaryButton small icon={Check} onClick={() => { onChange(pending.compressed); setPending(null) }}>Dùng ảnh này</PrimaryButton>
        </div>
      </div>
    </div>
  )

  if (compact) {
    return (
      <>
        {inputs}
        <button type="button" onClick={() => camRef.current?.click()} className="flex items-center gap-2.5 text-left w-full">
          {preview ? <img src={preview} alt="Hoá đơn" className="w-[46px] h-[58px] object-cover border border-divider" /> : <span className="w-[46px] h-[58px] border border-divider flex items-center justify-center text-neutral-600"><ImageOff size={18} /></span>}
          <span>
            <span className="section-label block mb-1">Hoá đơn</span>
            <span className="text-[14px] font-semibold flex items-center gap-1.5"><Camera size={16} />{busy ? 'Đang nén…' : preview ? `${kb(blob!.size)} · đổi ảnh` : 'Chụp bill'}</span>
          </span>
        </button>
        {sheet}
      </>
    )
  }

  return (
    <div>
      {inputs}
      {preview ? (
        <div className="flex items-start gap-3">
          <img src={preview} alt="Hoá đơn" className="w-[92px] h-[116px] object-cover border border-divider" />
          <div className="flex-1 space-y-2">
            <div className="text-[13px] num">{kb(blob!.size)} · đã nén</div>
            <SecondaryButton icon={RotateCcw} onClick={() => camRef.current?.click()}>Chụp lại</SecondaryButton>
            <SecondaryButton icon={X} onClick={() => onChange(null)}>Bỏ ảnh</SecondaryButton>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <SecondaryButton icon={Camera} disabled={busy} onClick={() => camRef.current?.click()}>{busy ? 'Đang nén…' : 'Chụp bill'}</SecondaryButton>
          <SecondaryButton icon={ImageIcon} disabled={busy} onClick={() => fileRef.current?.click()}>Chọn ảnh</SecondaryButton>
        </div>
      )}
      {sheet}
    </div>
  )
}

/** ReceiptThumb: 40×50 (list) / 46×58 (form) / 24×30 (bảng). Không ảnh → icon image-off. */
export function ReceiptThumb({ receiptId, remoteUrl, size = 'list', showMissing }: { receiptId?: string; remoteUrl?: string; size?: 'list' | 'form' | 'table' | 'large'; showMissing?: boolean }) {
  const url = useReceiptUrl(receiptId, remoteUrl)
  const [open, setOpen] = useState(false)
  const dims = { list: 'w-10 h-[50px]', form: 'w-[46px] h-[58px]', table: 'w-6 h-[30px]', large: 'w-full h-auto max-h-[60vh]' }[size]
  if (!url) {
    if (!showMissing) return null
    return <span className={cn(dims, 'flex items-center justify-center text-neutral-600 shrink-0')}><ImageOff size={size === 'table' ? 14 : 18} /></span>
  }
  return (
    <>
      <button type="button" onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(true) }} className={cn(dims, 'shrink-0 overflow-hidden border border-divider bg-neutral-200')}>
        <img src={url} alt="Hoá đơn" className="w-full h-full object-cover" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-ink flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <img src={url} alt="Hoá đơn" className="max-w-full max-h-full object-contain" />
          <button className="absolute top-3 right-3 w-11 h-11 flex items-center justify-center text-paper" aria-label="Đóng"><X size={22} /></button>
        </div>
      )}
    </>
  )
}
