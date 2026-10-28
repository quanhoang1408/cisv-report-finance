export type MemberRole = 'leader' | 'delegate'

export type FundType = 'PRE_CAMP' | 'SIDE_TRIP' | 'CAMP_MONEY' | 'GIFT' | 'EMERGENCY' | 'PERSONAL' | 'OTHER'

export type WalletKind = 'cash' | 'card' | 'bank'

export type TxType = 'income' | 'expense' | 'exchange' | 'transfer' | 'adjustment'

export interface Delegation {
  id: string
  name: string
  slug: string
  programme: string
  hostCountry: string
  year: number
  baseCurrency: string // VND
  bridgeCurrency: string // USD
  localCurrency: string // tiền nước đăng cai
  parentPin: string
  /** Leader có chia phần chi tiêu chung hay không (mặc định: không, phụ huynh gánh) */
  leaderSharesCosts: boolean
  /** Tỷ giá nhập tay, dùng khi chưa có giao dịch đổi tiền. Key "USD:VND" → 25500 (major units) */
  manualRates: Record<string, number>
  createdAt: number
  updatedAt: number
  publishedAt?: number
  publishToken?: string
}

export interface Member {
  id: string
  delegationId: string
  name: string
  role: MemberRole
  color: string
  sortOrder: number
}

export interface Wallet {
  id: string
  delegationId: string
  name: string
  currency: string
  kind: WalletKind
  sortOrder: number
}

export interface Fund {
  id: string
  delegationId: string
  name: string
  type: FundType
  memberId?: string // PERSONAL
  currency: string // tiền tệ mặc định khi nhập
  budget?: number // minor units, tuỳ chọn
  sortOrder: number
}

export interface Split {
  memberId: string
  amount: number // minor units, cùng tiền tệ với giao dịch
}

export interface Transaction {
  id: string
  delegationId: string
  type: TxType
  date: string // YYYY-MM-DD
  createdAt: number
  updatedAt: number
  description: string
  category?: string
  note?: string
  /** income/expense: số tiền (>0). adjustment: có dấu (+ thừa, − thiếu). exchange/transfer: số tiền đi ra khỏi ví nguồn */
  amount: number
  currency: string
  walletId?: string
  fundId?: string
  /** exchange / transfer */
  toWalletId?: string
  toAmount?: number
  toCurrency?: string
  /** income/expense/adjustment: phần chia cho từng người, tổng = |amount| */
  splits: Split[]
  receiptId?: string
  receiptUrl?: string
}

export interface Receipt {
  id: string
  delegationId: string
  transactionId?: string
  blob: Blob
  mime: string
  size: number
  remoteUrl?: string
  createdAt: number
}

export interface CashCount {
  id: string
  delegationId: string
  walletId: string
  date: string
  bookBalance: number
  countedAmount: number
  difference: number
  /** số tờ theo mệnh giá (major units) → count */
  denominations?: Record<string, number>
  looseChange?: number
  note?: string
  adjustmentTxnId?: string
  createdAt: number
}

export const CATEGORIES: { key: string; label: string }[] = [
  { key: 'food', label: 'Ăn uống' },
  { key: 'taxi', label: 'Taxi' },
  { key: 'ticket', label: 'Vé' },
  { key: 'shop', label: 'Camp shop' },
  { key: 'play', label: 'Vui chơi' },
  { key: 'hotel', label: 'Khách sạn' },
  { key: 'gift', label: 'Quà' },
  { key: 'other', label: 'Khác' },
]

/** Mệnh giá tiền giấy phổ biến (major units) để đếm két */
export const DENOMINATIONS: Record<string, number[]> = {
  VND: [500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000],
  USD: [100, 50, 20, 10, 5, 2, 1],
  EUR: [500, 200, 100, 50, 20, 10, 5],
  GBP: [50, 20, 10, 5],
  INR: [2000, 500, 200, 100, 50, 20, 10],
  IDR: [100000, 50000, 20000, 10000, 5000, 2000, 1000],
  THB: [1000, 500, 100, 50, 20],
  PHP: [1000, 500, 200, 100, 50, 20],
  MYR: [100, 50, 20, 10, 5, 1],
  SGD: [100, 50, 10, 5, 2],
  JPY: [10000, 5000, 2000, 1000],
  KRW: [50000, 10000, 5000, 1000],
  CNY: [100, 50, 20, 10, 5, 1],
  AUD: [100, 50, 20, 10, 5],
  NZD: [100, 50, 20, 10, 5],
  CAD: [100, 50, 20, 10, 5],
  BRL: [200, 100, 50, 20, 10, 5, 2],
  MXN: [1000, 500, 200, 100, 50, 20],
  SEK: [1000, 500, 200, 100, 50, 20],
  NOK: [1000, 500, 200, 100, 50],
  DKK: [1000, 500, 200, 100, 50],
  CHF: [1000, 200, 100, 50, 20, 10],
  LKR: [5000, 1000, 500, 100, 50, 20],
  NPR: [1000, 500, 100, 50, 20, 10],
  TWD: [1000, 500, 100],
  HKD: [1000, 500, 100, 50, 20, 10],
}

/** Dữ liệu gói lại để xuất bản cho phụ huynh / sao lưu */
export interface Snapshot {
  version: 1
  exportedAt: number
  delegation: Omit<Delegation, 'parentPin' | 'publishToken'>
  members: Member[]
  wallets: Wallet[]
  funds: Fund[]
  transactions: Transaction[]
  cashCounts: CashCount[]
}

export const FUND_TYPE_LABEL: Record<FundType, string> = {
  PRE_CAMP: 'Pre-camp (tại VN)',
  SIDE_TRIP: 'Side Trip / quỹ chung',
  CAMP_MONEY: 'Camp Money & Excursion',
  GIFT: 'Quà tặng',
  EMERGENCY: 'Khẩn cấp',
  PERSONAL: 'Pocket money cá nhân',
  OTHER: 'Khác',
}

export const FUND_TYPE_ICON: Record<FundType, string> = {
  PRE_CAMP: '🇻🇳',
  SIDE_TRIP: '🧳',
  CAMP_MONEY: '🏕️',
  GIFT: '🎁',
  EMERGENCY: '🚨',
  PERSONAL: '👛',
  OTHER: '📦',
}

export const TX_TYPE_LABEL: Record<TxType, string> = {
  income: 'Thu vào',
  expense: 'Chi ra',
  exchange: 'Đổi tiền',
  transfer: 'Chuyển ví',
  adjustment: 'Điều chỉnh',
}

export const MEMBER_COLORS = ['#0d9488', '#2563eb', '#db2777', '#d97706', '#7c3aed', '#dc2626', '#059669', '#4f46e5']
