/* Kiểm thử nhanh logic tiền tệ & sổ cái theo kịch bản thực tế. Chạy: node --experimental-strip-types scripts/ledger-test.ts */
import assert from 'node:assert/strict'
import { parseAmount, splitEqually, fmt, fmtTyping, toMajor } from '../src/lib/money.ts'
import { computeLedger, defaultParticipants, netIn, sumIn } from '../src/lib/ledger.ts'
import type { Delegation, Fund, Member, Transaction, Wallet } from '../src/db/types.ts'

// ---- money ----
assert.equal(parseAmount('12.5', 'USD'), 1250)
assert.equal(parseAmount('12,5', 'USD'), 1250)
assert.equal(parseAmount('1,234.56', 'USD'), 123456)
assert.equal(parseAmount('1.234,56', 'EUR'), 123456)
assert.equal(parseAmount('1.200.000', 'VND'), 1200000)
assert.equal(parseAmount('1,200,000', 'VND'), 1200000)
assert.equal(parseAmount('21500', 'IDR'), 21500)
assert.equal(parseAmount('abc', 'USD'), null)
assert.equal(fmt(123456, 'USD'), '$1,234.56')
assert.equal(fmt(-1200000, 'VND'), '−1.200.000₫')
assert.equal(fmt(22037, 'INR'), '₹220.37')
assert.equal(fmt(21500, 'IDR'), 'Rp21,500')
assert.equal(fmtTyping('12345.6', 'USD'), '12,345.6')
assert.equal(fmtTyping('', 'IDR'), '0')
assert.deepEqual(splitEqually(2000, ['a', 'b', 'c']), [{ memberId: 'a', amount: 667 }, { memberId: 'b', amount: 667 }, { memberId: 'c', amount: 666 }])
assert.equal(splitEqually(2000, ['a', 'b', 'c']).reduce((s, x) => s + x.amount, 0), 2000)
assert.deepEqual(splitEqually(100, []), [])

// ---- ledger: kịch bản Village Indonesia ----
const d: Delegation = {
  id: 'd', name: 'Test', slug: 'test', programme: 'Village', hostCountry: 'Indonesia', year: 2026,
  baseCurrency: 'VND', bridgeCurrency: 'USD', localCurrency: 'IDR', parentPin: '1234', leaderSharesCosts: false,
  manualRates: { 'USD:VND': 25000 }, createdAt: 0, updatedAt: 0,
}
const [quan, bach, kiet, thu, tho]: Member[] = ['Quân', 'Bách', 'Kiệt', 'Thư', 'Thỏ'].map((name, i) => ({
  id: name, delegationId: 'd', name, role: i === 0 ? 'leader' : 'delegate', color: '#000', sortOrder: i,
}))
const members = [quan, bach, kiet, thu, tho]
const usdWallet: Wallet = { id: 'usd', delegationId: 'd', name: 'Phong bì USD', currency: 'USD', kind: 'cash', sortOrder: 0 }
const idrWallet: Wallet = { id: 'idr', delegationId: 'd', name: 'Ví IDR', currency: 'IDR', kind: 'cash', sortOrder: 1 }
const wallets = [usdWallet, idrWallet]
const sideTrip: Fund = { id: 'side', delegationId: 'd', name: 'Side trip', type: 'SIDE_TRIP', currency: 'IDR', sortOrder: 0 }
const pocket = (m: Member): Fund => ({ id: `pm-${m.id}`, delegationId: 'd', name: `PM ${m.name}`, type: 'PERSONAL', memberId: m.id, currency: 'USD', sortOrder: 1 })
const funds = [sideTrip, pocket(bach), pocket(kiet), pocket(thu), pocket(tho)]
const delegates = [bach, kiet, thu, tho]

assert.deepEqual(defaultParticipants(sideTrip, members, d), ['Bách', 'Kiệt', 'Thư', 'Thỏ'])
assert.deepEqual(defaultParticipants(pocket(bach), members, d), ['Bách'])

let n = 0
const tx = (p: Partial<Transaction>): Transaction => ({
  id: String(++n), delegationId: 'd', type: 'expense', date: '2026-01-01', createdAt: n, updatedAt: n, description: '', amount: 0, currency: 'IDR', splits: [], ...p,
})
const txs: Transaction[] = [
  // Phụ huynh gửi 750 USD side trip (chia đều 4 bé) + 200 USD pocket money mỗi bé
  tx({ type: 'income', amount: 75000, currency: 'USD', walletId: 'usd', fundId: 'side', splits: splitEqually(75000, delegates.map((m) => m.id)) }),
  ...delegates.map((m) => tx({ type: 'income', amount: 20000, currency: 'USD', walletId: 'usd', fundId: `pm-${m.id}`, splits: [{ memberId: m.id, amount: 20000 }] })),
  // Đổi 2 đợt với tỷ giá khác nhau: 350 USD → 21,500 IDR ; 100 USD → 6,000 IDR
  tx({ type: 'exchange', amount: 35000, currency: 'USD', walletId: 'usd', toWalletId: 'idr', toAmount: 21500, toCurrency: 'IDR' }),
  tx({ type: 'exchange', amount: 10000, currency: 'USD', walletId: 'usd', toWalletId: 'idr', toAmount: 6000, toCurrency: 'IDR' }),
  // Chi chung: taxi 2,800 IDR chia 4 bé
  tx({ amount: 2800, walletId: 'idr', fundId: 'side', splits: splitEqually(2800, delegates.map((m) => m.id)) }),
  // Chơi game 2,000 IDR chỉ Bách, Kiệt, Thỏ
  tx({ amount: 2000, walletId: 'idr', fundId: 'side', splits: splitEqually(2000, ['Bách', 'Kiệt', 'Thỏ']) }),
  // Camp money 3,995 IDR của riêng Bách từ pocket money
  tx({ amount: 3995, walletId: 'idr', fundId: 'pm-Bách', splits: [{ memberId: 'Bách', amount: 3995 }] }),
  // Điều chỉnh: đếm két thiếu 1,837 IDR, tính vào side trip chia 4 bé
  tx({ type: 'adjustment', amount: -1837, walletId: 'idr', fundId: 'side', splits: splitEqually(1837, delegates.map((m) => m.id)) }),
]

const L = computeLedger(d, members, wallets, funds, txs)

// Ví
assert.equal(L.walletBalances.usd, 75000 + 80000 - 35000 - 10000) // 1,100 USD
assert.equal(L.walletBalances.idr, 21500 + 6000 - 2800 - 2000 - 3995 - 1837) // 16,868 IDR

// Tỷ giá bình quân gia quyền: 27,500 IDR / 450 USD = 61.111…
const r = L.rates.rate('USD', 'IDR')!
assert.ok(Math.abs(r - 27500 / 450) < 1e-9, `rate ${r}`)
assert.ok(Math.abs(L.rates.rate('IDR', 'VND')! - 25000 / (27500 / 450)) < 1e-6)

// Quỹ side trip: thu 750 USD, chi 2800+2000+1837 IDR
const side = L.fundTotals.side
assert.equal(side.USD.income, 75000)
assert.equal(side.IDR.expense, 2800 + 2000 + 1837)

// Bách: góp 187.5 + 200 USD; chi 700 + 667 + 3995 + 460 IDR (phần dư chia đều dồn người đầu: 1837/4 = 459.25 → 460)
const bachPc = L.memberTotals['Bách']
assert.equal(bachPc.USD.income, 18750 + 20000)
assert.equal(bachPc.IDR.expense, 700 + 667 + 3995 + 460)
const bachNetUsd = netIn(bachPc, 'USD', L.rates)!
const expected = Math.round((387.5 - (700 + 667 + 3995 + 460) / r) * 100)
assert.equal(bachNetUsd, expected)
// Thư không chơi game
assert.equal(L.memberTotals['Thư'].IDR.expense, 700 + 459)
// Leader không bị chia
assert.equal(L.memberTotals['Quân'].IDR, undefined)
// Tổng chi được chia của 4 bé = tổng chi ví IDR
const totalSplit = delegates.reduce((s, m) => s + (L.memberTotals[m.id].IDR?.expense ?? 0), 0)
assert.equal(totalSplit, 2800 + 2000 + 3995 + 1837)
// sumIn quy đổi ra VND có giá trị
assert.ok(sumIn(bachPc, 'expense', 'VND', L.rates)! > 0)

console.log('✅ ledger-test passed')
console.log('   Ví USD:', fmt(L.walletBalances.usd, 'USD'), '| Ví IDR:', fmt(L.walletBalances.idr, 'IDR'))
console.log('   Tỷ giá bình quân 1 USD =', r.toFixed(3), 'IDR')
for (const m of delegates) {
  const pc = L.memberTotals[m.id]
  console.log(`   ${m.name.padEnd(5)} còn lại ${fmt(netIn(pc, 'USD', L.rates)!, 'USD')} ≈ ${fmt(netIn(pc, 'VND', L.rates)!, 'VND')} (chi IDR ${toMajor(pc.IDR?.expense ?? 0, 'IDR')})`)
}
