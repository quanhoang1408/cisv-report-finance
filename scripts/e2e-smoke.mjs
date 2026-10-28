/* Smoke test giao diện bằng Chrome hệ thống.
   Chạy: npm run build && (npx vite preview --port 4173 &) && node scripts/e2e-smoke.mjs */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:4173'
const OUT = process.env.SHOT_DIR ?? 'scripts/shots'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('fonts.g')) errors.push(`console: ${m.text()}`) })

const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true })
const keys = async (s) => { for (const k of s) await page.locator(`button[aria-label="${k}"]`).click() }
const next = () => page.getByRole('button', { name: 'Tiếp: chọn quỹ' }).click()

// 1. Setup
await page.goto(BASE + '/')
await page.waitForURL('**/setup')
await page.getByPlaceholder('VD: Đoàn CISV Hà Nội').fill('Đoàn CISV Hà Nội')
await page.getByPlaceholder('VD: India').fill('Indonesia')
await page.locator('select').nth(1).selectOption('IDR')
await page.getByPlaceholder('VD: 26350').fill('26350')
await page.getByPlaceholder('VD: Quân').fill('Quân')
for (const [i, n] of ['Bách', 'Kiệt', 'Thư', 'Thỏ'].entries()) await page.getByPlaceholder(`Delegate ${i + 1}`).fill(n)
await page.locator('input[maxlength="6"]').fill('1234')
await shot('01-setup')
await page.getByRole('button', { name: 'Tạo đoàn' }).click()
await page.waitForURL(BASE + '/')
await page.getByText('Ví vật lý').waitFor()
await shot('02-home-empty')

// 2. Thu 200 USD pocket Bách
await page.goto(BASE + '/add?type=income')
await page.getByRole('button', { name: '$ USD' }).click()
await keys('200')
await shot('03-quickadd-step1')
await next()
await page.getByPlaceholder('VD: Phụ huynh gửi pocket money').fill('Pocket money Bách')
await page.locator('.grid-cols-3 button', { hasText: 'Pocket · Bách' }).click()
await page.getByRole('button', { name: 'Lưu khoản thu' }).click()
await page.waitForURL(BASE + '/')

// 2b. Thu 750 USD side trip (4 bé)
await page.goto(BASE + '/add?type=income')
await page.getByRole('button', { name: '$ USD' }).click()
await keys('750')
await next()
await page.getByPlaceholder('VD: Phụ huynh gửi pocket money').fill('Góp quỹ side trip')
await page.getByRole('button', { name: 'Lưu khoản thu' }).click()
await page.waitForURL(BASE + '/')

// 3. Đổi 350 USD → 21,500 IDR
await page.goto(BASE + '/exchange')
const amounts = page.locator('input[inputmode="decimal"]')
await amounts.nth(0).fill('350')
await amounts.nth(1).fill('21500')
await shot('04-exchange-form')
await page.getByRole('button', { name: 'Lưu lần đổi' }).click()
await page.waitForURL(BASE + '/')
await page.goto(BASE + '/exchange')
await page.getByText('Các lần đã đổi').waitFor()
await shot('05-exchange')

// 4. Chi 2,000 IDR chơi game: Bách, Kiệt, Thỏ
await page.goto(BASE + '/add')
await keys('2000')
await next()
await page.getByPlaceholder('VD: Chơi game ở khu trò chơi').fill('Chơi game ở khu trò chơi')
await page.getByRole('button', { name: 'Vui chơi' }).click()
await page.locator('.grid-cols-5 button', { hasText: 'Thư' }).click()
await shot('06-quickadd-step2')
await page.getByRole('button', { name: 'Lưu khoản chi' }).click()
await page.waitForURL(BASE + '/')
await page.getByText('Hoàn tác').waitFor()

// 4b. Camp money 3,995 IDR của Bách
await page.goto(BASE + '/add')
await keys('3995')
await next()
await page.getByPlaceholder('VD: Chơi game ở khu trò chơi').fill('Camp money')
await page.locator('.grid-cols-3 button', { hasText: 'Pocket · Bách' }).click()
await page.getByRole('button', { name: 'Lưu khoản chi' }).click()
await page.waitForURL(BASE + '/')
await page.waitForTimeout(300)
await shot('07-home')

// 5. Kiểm két: sổ 15,505 · đếm 10,000 + 5,000 = 15,000 → thiếu 505
await page.goto(BASE + '/count')
await page.locator('button[aria-label="Thêm"]').nth(3).click()
await page.locator('button[aria-label="Thêm"]').nth(4).click()
await page.locator('textarea').fill('xu lẻ')
await shot('08-cashcount')
const adjBtn = page.getByRole('button', { name: /Ghi bút toán điều chỉnh/ })
console.log('cash button:', (await adjBtn.innerText()).trim())
await adjBtn.click()
await page.waitForURL(BASE + '/')

// 6. Members
await page.goto(BASE + '/members')
await page.getByText('Bảng quyết toán').waitFor()
await shot('09-members')
console.log('Bách row:', (await page.locator('table tbody tr', { hasText: 'Bách' }).innerText()).replace(/\s+/g, ' '))
await page.locator('a[href^="/members/"]').first().click()
await page.getByText('Dòng tiền của').waitFor()
await shot('10-member-detail')

// 7. Sổ chi + chi tiết
await page.goto(BASE + '/tx')
await shot('11-tx')
await page.locator('a[href^="/tx/"]').first().click()
await page.getByRole('link', { name: /Sửa/ }).waitFor()
await shot('12-tx-detail')

// 8. Parent view
const slug = await page.evaluate(async () => {
  const req = indexedDB.open('cisv-finance')
  return new Promise((res) => { req.onsuccess = () => { const tx = req.result.transaction('delegations').objectStore('delegations').getAll(); tx.onsuccess = () => res(tx.result[0].slug) } })
})
await page.goto(`${BASE}/p/${slug}`)
await page.locator('input[maxlength="6"]').fill('1234')
await page.getByRole('button', { name: 'Xem sổ quỹ' }).click()
await page.getByText('Tiến độ chi các quỹ').filter({ visible: true }).waitFor()
await shot('13-parent-overview')
await page.getByRole('button', { name: 'Con của tôi' }).click()
await page.getByText('Tạm tính nếu kết thúc hôm nay').filter({ visible: true }).waitFor()
await shot('14-parent-child')
await page.getByRole('button', { name: 'Quyết toán' }).click()
await shot('15-parent-settlement')
await page.setViewportSize({ width: 1280, height: 900 })
await page.reload()
await page.getByText('Tổng quan đoàn').first().waitFor()
await shot('16-parent-desktop')
await page.setViewportSize({ width: 390, height: 844 })

// 9. Settings
await page.goto(BASE + '/settings')
await shot('17-settings')

const manifest = await page.evaluate(async () => (await fetch('/manifest.webmanifest')).ok)
const sw = await page.evaluate(async () => (await fetch('/sw.js')).ok)
console.log('manifest ok:', manifest, '| sw ok:', sw)

await browser.close()
if (errors.length) {
  console.log('❌ Lỗi trình duyệt:\n' + errors.join('\n'))
  process.exit(1)
}
console.log('✅ e2e smoke passed, ảnh trong', OUT)
