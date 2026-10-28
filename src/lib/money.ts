/**
 * Tiền được lưu dưới dạng SỐ NGUYÊN ở đơn vị nhỏ nhất (minor units):
 *  - VND, IDR, JPY, KRW: 0 chữ số thập phân → 1 = 1 đồng
 *  - USD, EUR, INR, THB …: 2 chữ số thập phân → 100 = 1 đô
 * Tránh hoàn toàn sai số dấu phẩy động khi cộng/chia.
 */

export interface CurrencyInfo {
  code: string
  name: string
  symbol: string
  decimals: number
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'VND', name: 'Việt Nam Đồng', symbol: '₫', decimals: 0 },
  { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2 },
  { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2 },
  { code: 'GBP', name: 'British Pound', symbol: '£', decimals: 2 },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', decimals: 0 },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimals: 2 },
  { code: 'THB', name: 'Thai Baht', symbol: '฿', decimals: 2 },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱', decimals: 2 },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', decimals: 2 },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', decimals: 2 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimals: 0 },
  { code: 'KRW', name: 'Korean Won', symbol: '₩', decimals: 0 },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', decimals: 2 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimals: 2 },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', decimals: 2 },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', decimals: 2 },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', decimals: 2 },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$', decimals: 2 },
  { code: 'ARS', name: 'Argentine Peso', symbol: 'AR$', decimals: 2 },
  { code: 'CLP', name: 'Chilean Peso', symbol: 'CL$', decimals: 0 },
  { code: 'COP', name: 'Colombian Peso', symbol: 'CO$', decimals: 0 },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', decimals: 2 },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', decimals: 2 },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr', decimals: 2 },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', decimals: 2 },
  { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč', decimals: 2 },
  { code: 'PLN', name: 'Polish Złoty', symbol: 'zł', decimals: 2 },
  { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft', decimals: 0 },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺', decimals: 2 },
  { code: 'EGP', name: 'Egyptian Pound', symbol: 'E£', decimals: 2 },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', decimals: 2 },
  { code: 'ILS', name: 'Israeli Shekel', symbol: '₪', decimals: 2 },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', decimals: 2 },
  { code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'Rs', decimals: 2 },
  { code: 'NPR', name: 'Nepalese Rupee', symbol: 'Rs', decimals: 2 },
  { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳', decimals: 2 },
  { code: 'TWD', name: 'New Taiwan Dollar', symbol: 'NT$', decimals: 0 },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', decimals: 2 },
  { code: 'ISK', name: 'Icelandic Króna', symbol: 'kr', decimals: 0 },
  { code: 'CRC', name: 'Costa Rican Colón', symbol: '₡', decimals: 0 },
  { code: 'GTQ', name: 'Guatemalan Quetzal', symbol: 'Q', decimals: 2 },
]

const byCode = new Map(CURRENCIES.map((c) => [c.code, c]))

export function currencyInfo(code: string): CurrencyInfo {
  return byCode.get(code) ?? { code, name: code, symbol: code, decimals: 2 }
}

export function decimalsOf(code: string): number {
  return currencyInfo(code).decimals
}

/** Chuyển chuỗi người dùng nhập ("12.5", "12,5", "1.200.000") thành minor units. */
export function parseAmount(input: string, currency: string): number | null {
  if (input == null) return null
  let s = String(input).trim().replace(/\s/g, '')
  if (!s) return null
  const d = decimalsOf(currency)
  // Chuẩn hoá dấu: nếu có cả '.' và ',' thì dấu cuối cùng là thập phân
  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  if (lastDot >= 0 && lastComma >= 0) {
    const decSep = lastDot > lastComma ? '.' : ','
    const thouSep = decSep === '.' ? ',' : '.'
    s = s.split(thouSep).join('').replace(decSep, '.')
  } else if (lastComma >= 0) {
    // chỉ có dấu phẩy: nếu phần sau dấu phẩy là 3 chữ số và tiền 0 thập phân → phân cách nghìn
    const after = s.length - lastComma - 1
    if (d === 0 || (after === 3 && (s.match(/,/g) ?? []).length >= 1 && after !== d)) {
      s = s.split(',').join('')
    } else {
      s = s.replace(',', '.')
    }
  } else if (lastDot >= 0 && d === 0) {
    s = s.split('.').join('')
  }
  if (!/^-?\d*(\.\d*)?$/.test(s)) return null
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return Math.round(n * 10 ** d)
}

/** minor units → số thực (để nhập vào input hoặc tính tỷ giá). */
export function toMajor(minor: number, currency: string): number {
  return minor / 10 ** decimalsOf(currency)
}

export function fromMajor(major: number, currency: string): number {
  return Math.round(major * 10 ** decimalsOf(currency))
}

const fmtCache = new Map<string, Intl.NumberFormat>()

/** VND định dạng kiểu Việt "6.750.000₫"; tiền khác ký hiệu đứng trước "₹22,037", "$256.16". */
function numberFormat(currency: string): Intl.NumberFormat {
  const info = currencyInfo(currency)
  const key = `${currency}:${info.decimals}`
  let f = fmtCache.get(key)
  if (!f) {
    f = new Intl.NumberFormat(currency === 'VND' ? 'vi-VN' : 'en-US', { minimumFractionDigits: info.decimals, maximumFractionDigits: info.decimals })
    fmtCache.set(key, f)
  }
  return f
}

export const MINUS = '−' // U+2212, theo spec

/** Định dạng minor units thành chuỗi hiển thị, ví dụ 123456 USD → "$1,234.56"; -1200000 VND → "−1.200.000₫". */
export function fmt(minor: number, currency: string, opts: { sign?: boolean; symbol?: boolean } = {}): string {
  const info = currencyInfo(currency)
  const num = numberFormat(currency).format(Math.abs(toMajor(minor, currency)))
  let s: string
  if (opts.symbol === false) s = num
  else if (currency === 'VND') s = `${num}₫`
  else s = `${info.symbol}${num}`
  if (minor < 0) s = MINUS + s
  else if (opts.sign && minor > 0) s = '+' + s
  return s
}

/** Định dạng chuỗi đang gõ trên bàn phím số: "12345.6" → "12,345.6" (giữ nguyên phần thập phân đang gõ). */
export function fmtTyping(text: string, currency: string): string {
  if (!text) return '0'
  const [int, dec] = text.split('.')
  const intFmt = int ? numberFormat(currency === 'VND' ? 'VND' : 'JPY').format(Number(int)) : '0'
  return dec !== undefined ? `${intFmt}.${dec}` : intFmt
}

export function fmtRate(rate: number): string {
  if (!Number.isFinite(rate)) return '—'
  if (rate >= 100) return rate.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (rate >= 1) return rate.toLocaleString('en-US', { maximumFractionDigits: 3 })
  return rate.toLocaleString('en-US', { maximumFractionDigits: 6 })
}

/**
 * Chia đều `total` (minor units) cho n người. Phần dư (do làm tròn) dồn vào những người đầu danh sách,
 * đảm bảo tổng các phần = total tuyệt đối.
 */
export function splitEqually(total: number, memberIds: string[]): { memberId: string; amount: number }[] {
  const n = memberIds.length
  if (n === 0) return []
  const sign = total < 0 ? -1 : 1
  const abs = Math.abs(total)
  const base = Math.floor(abs / n)
  let remainder = abs - base * n
  return memberIds.map((memberId) => {
    const extra = remainder > 0 ? 1 : 0
    if (remainder > 0) remainder--
    return { memberId, amount: sign * (base + extra) }
  })
}
