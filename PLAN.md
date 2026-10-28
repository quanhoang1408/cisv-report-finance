# CISV Delegation Finance – Kế hoạch xây dựng (bản tinh chỉnh)

Ứng dụng PWA giúp Leader đoàn CISV (Village, Step Up, Youth Meeting, Seminar Camp…) ghi chép chi tiêu
của đoàn xuyên suốt 3 giai đoạn **Pre-camp (VND) → In-camp & Side trip (ngoại tệ) → Post-camp (quyết toán)**,
và cho phụ huynh theo dõi tiến trình chi tiêu theo thời gian thực. Chi phí vận hành: **0 VND**.

## 1. Bối cảnh nghiệp vụ CISV (tóm tắt nghiên cứu)

- CISV International tổ chức các chương trình trại quốc tế cho trẻ em/thanh thiếu niên. Với Village (11 tuổi),
  Step Up (14–15), Youth Meeting (12–15 / 16–19) mỗi đoàn (delegation) gồm 1 Leader (≥21 tuổi) đi kèm 2–4 delegate.
- Theo quy định CISV, Leader giữ hộ **pocket money** của các bé và **emergency money** (quỹ y tế/khẩn cấp,
  thường giữ nguyên, chỉ dùng khi có sự cố). Trại thu **camp money** (tiền nộp Camp Bank để tiêu ở camp shop)
  và phí **excursion** do trại tổ chức.
- Chi phí của Leader (vé máy bay, visa, side trip) thông thường do phụ huynh các delegate chia nhau gánh.
- Thực tế từ bảng Excel: đổi tiền nhiều đợt với tỷ giá khác nhau, chia bill linh hoạt (cả đoàn / 1 bé / nhóm nhỏ),
  lệch tiền mặt thực tế so với sổ, cần lưu ảnh hoá đơn để đối chiếu.

## 2. Những gì tinh chỉnh so với bản kế hoạch ban đầu

| Vấn đề | Bản gốc | Bản tinh chỉnh | Lý do |
|---|---|---|---|
| Nguồn dữ liệu | Supabase là trung tâm, offline chỉ là cache | **Local-first**: IndexedDB trên máy Leader là nguồn gốc, cloud chỉ để xuất bản | Chỉ có 1 người ghi (Leader), không cần đồng bộ 2 chiều; app chạy đủ 100% tính năng ngay cả khi không bao giờ có mạng |
| Đồng bộ | 7 bảng + RLS từng bảng | **1 bảng snapshot JSON + 1 RPC kiểm tra PIN** | Giảm 80% code backend, không lo conflict, vẫn miễn phí |
| Mô hình giao dịch | expenses, currency_exchanges, reconciliations rời nhau | **1 sổ cái `transactions`** với 5 loại: thu / chi / đổi tiền / chuyển ví / điều chỉnh | Số dư ví, quỹ, từng bé đều tính từ 1 nguồn, không lệch nhau |
| Số tiền | numeric | **Số nguyên đơn vị nhỏ nhất** (cent, đồng) | Tránh sai số 0.1+0.2; chia đều dồn phần dư về người đầu để tổng khớp tuyệt đối |
| Tỷ giá | 1 cột exchange_rate | **Tỷ giá bình quân gia quyền** tính tự động từ lịch sử đổi tiền + tỷ giá tay (fallback) | Đổi nhiều đợt khác tỷ giá vẫn quy đổi số dư từng bé chính xác |
| Chia bill | expense_splits | Giữ nguyên, nhưng **cả khoản thu cũng có splits** (ai góp bao nhiêu) | Quyết toán cuối chuyến = Σ góp − Σ chia cho từng bé, chính xác tuyệt đối |
| Ảnh hoá đơn | Cloudinary | **Nén ≤100KB lưu IndexedDB, upload Supabase Storage khi xuất bản** | 1 dịch vụ ít hơn, 1GB free chứa >10.000 hoá đơn |
| Xác thực Leader | Chưa nêu | **Supabase magic link** (email) chỉ khi cần xuất bản | Bảo vệ storage/data bằng RLS theo owner, không cần mật khẩu |

## 3. Mô hình dữ liệu (dùng chung cho IndexedDB và snapshot JSON)

- `delegations`: id, name, slug, programme, hostCountry, baseCurrency (VND), bridgeCurrency (USD),
  localCurrency (IDR/INR/…), parentPin, leaderSharesCosts, manualRates {"USD:VND": 25500}
- `members`: id, name, role (leader|delegate), color
- `wallets` (ví vật lý, mỗi ví 1 tiền tệ): Phong bì USD, Ví tiền mặt nội tệ, Tiền mặt VND, Thẻ Leader
- `funds` (rổ ngân sách): PRE_CAMP, SIDE_TRIP, CAMP_MONEY, GIFT, EMERGENCY, PERSONAL(memberId)
- `transactions`: type, date, description, amount, currency, walletId, fundId, splits[{memberId, amount}],
  toWalletId/toAmount/toCurrency (đổi tiền, chuyển ví), receiptId
- `receipts`: blob đã nén, remoteUrl sau khi upload
- `cashCounts`: walletId, date, bookBalance, countedAmount, difference, adjustmentTxnId

Công thức:
- Số dư ví = Σ thu vào − Σ chi ra − Σ đổi ra + Σ đổi vào (theo tiền tệ của ví)
- Số dư quỹ = Σ thu − Σ chi (theo từng tiền tệ, quy đổi ra 1 tiền tệ bằng tỷ giá bình quân)
- Số dư từng bé = Σ phần góp − Σ phần chia (mọi quỹ, mọi tiền tệ)
- Tỷ giá USD→nội tệ = Σ nội tệ nhận được ÷ Σ USD đã đổi

## 4. Tính năng

### Leader (mobile-first, offline 100%)
1. **Quick Add** chi tiêu: số tiền → tiền tệ → quỹ → chọn người chia (chip avatar) → ví trả → chụp bill.
2. **Đổi tiền**: 350 USD → 21.500 IDR, tự tính tỷ giá đợt này và tỷ giá bình quân.
3. **Kiểm két**: nhập tiền đếm được, app báo lệch, 1 chạm tạo bút toán điều chỉnh.
4. **Thành viên**: số dư từng bé (USD + nội tệ + VND), lịch sử chi của bé.
5. **Quỹ**: tiến độ từng rổ tiền.
6. **Cài đặt**: thành viên, ví, quỹ, tỷ giá tay, xuất CSV/JSON, xuất bản cho phụ huynh.

### Phụ huynh (link + PIN, chỉ xem)
- `/p/<slug>` → nhập PIN → Tổng quan đoàn, Con của tôi, Bảng quyết toán, ảnh hoá đơn.

## 5. Hạ tầng miễn phí

| Thành phần | Công nghệ | Free tier |
|---|---|---|
| Frontend PWA | Vite + React 19 + TypeScript + Tailwind v4 | mã nguồn mở |
| Offline | Dexie (IndexedDB) + vite-plugin-pwa (Workbox) | trên máy |
| Cloud | Supabase (Postgres + Auth + Storage) | 500MB DB, 1GB storage |
| Hosting | Vercel / Cloudflare Pages | miễn phí, HTTPS sẵn |

## 6. Lộ trình

- [x] Bước 1: Khởi tạo project, PWA manifest, schema Dexie, module tiền tệ & sổ cái
- [x] Bước 2: Màn hình Leader: Setup đoàn, Quick Add, Đổi tiền, Kiểm két, Thành viên, Quỹ, Giao dịch, Cài đặt
- [x] Bước 3: Màn hình phụ huynh `/p/:slug` (xem local preview, hoặc đọc snapshot từ Supabase)
- [x] Bước 4: SQL Supabase (bảng, RPC, storage policy) + nút Xuất bản, tự đồng bộ khi có mạng
- [x] Bước 4b: Làm lại giao diện theo CISV-Wallet-Design-Spec.md (Quick Add 2 bước + bàn phím số, đếm mệnh giá, waterfall phụ huynh, desktop 2 cột)
- [ ] Bước 5: Deploy Vercel, tạo project Supabase thật và điền `.env`
- [ ] Bước 6: Giao diện tiếng Anh (i18n) cho leader các nước khác, nhập liệu bằng giọng nói, OCR hoá đơn
