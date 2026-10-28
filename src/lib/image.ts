import imageCompression from 'browser-image-compression'

/** Nén ảnh hoá đơn xuống ≤ ~100KB, tối đa 1280px, để lưu IndexedDB và upload nhanh. */
export async function compressReceipt(file: File): Promise<Blob> {
  try {
    const out = await imageCompression(file, {
      maxSizeMB: 0.1,
      maxWidthOrHeight: 1280,
      useWebWorker: true,
      fileType: 'image/jpeg',
      initialQuality: 0.8,
    })
    return out
  } catch {
    return file
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}
