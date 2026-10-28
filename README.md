# CISV Delegation Finance

PWA ghi chép chi tiêu đoàn CISV cho Leader, hoạt động **offline 100%**, đa tiền tệ, chia bill linh hoạt,
kiểm két cuối ngày, và dashboard chỉ-đọc cho phụ huynh qua link + PIN. Chi phí vận hành: 0 VND.

Xem [PLAN.md](PLAN.md) để hiểu nghiệp vụ, mô hình dữ liệu và các quyết định thiết kế.
Giao diện bám theo [CISV-Wallet-Design-Spec.md](CISV-Wallet-Design-Spec.md) (bản 2a "Sổ cái · màu CISV"):
không bo góc, không bóng, lưới kẻ 2px/1px, font Archivo (tự host trong `public/fonts`), xanh CISV chỉ cho hành động chính.

## Chạy thử trên máy

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # build production vào dist/
npm run preview      # chạy thử bản build (có service worker / PWA)
npm run test:ledger  # kiểm thử công thức tiền tệ & sổ cái
npm run test:e2e     # smoke test giao diện bằng Chrome (cần preview chạy ở cổng 4173)
```

Không cần cấu hình gì thêm: toàn bộ dữ liệu nằm trong IndexedDB của trình duyệt.
Mở trên điện thoại → "Thêm vào màn hình chính" để dùng như app.

## Luồng sử dụng cho Leader

1. **Tạo đoàn**: tên, chương trình, nước đăng cai, tiền tệ (VND / USD / nội tệ), Leader + các bé, mã PIN phụ huynh.
   App tự tạo sẵn các ví (phong bì USD, ví nội tệ, tiền VND, thẻ Leader) và các rổ tiền
   (pre-camp, side trip, camp money, quà tặng, emergency, pocket money từng bé).
2. **Thu vào**: ghi tiền phụ huynh gửi (pocket money từng bé, góp quỹ side trip, emergency…), chọn ai góp.
3. **Đổi tiền**: mỗi lần đổi USD → nội tệ, app tính tỷ giá đợt đó và tỷ giá bình quân gia quyền.
4. **Ghi chi** (nút +): số tiền → nội dung → rổ tiền → chọn người chia (chia đều hoặc nhập tay) → ví trả → chụp bill.
5. **Kiểm két**: nhập tiền mặt đếm được, app báo lệch, 1 chạm tạo bút toán điều chỉnh.
6. **Thành viên**: số dư từng bé và bảng quyết toán (trả lại / thu thêm) quy đổi USD và VND.
7. **Chia sẻ**: gửi link + PIN cho phụ huynh. Bấm "Xuất bản" mỗi tối khi có Wi-Fi.

## Bật tính năng phụ huynh xem từ xa (Supabase, miễn phí)

1. Tạo project tại https://supabase.com (gói Free).
2. Vào **SQL Editor**, dán toàn bộ [supabase/schema.sql](supabase/schema.sql) và Run.
3. Vào **Authentication → Providers → Email**: bật Email, có thể tắt "Confirm email" để link đăng nhập nhanh hơn.
   Vào **Authentication → URL Configuration**: thêm domain app (vd `https://ten-app.vercel.app/**`) vào Redirect URLs.
4. Lấy **Project URL** và **anon public key** (Settings → API), điền vào `.env` theo mẫu `.env.example`.
5. Trong app: Cài đặt → Chia sẻ → nhập email Leader → bấm link trong email → **Xuất bản**.

Bảo mật: bảng snapshot chỉ Leader (đã đăng nhập) ghi được; phụ huynh chỉ đọc qua RPC có kiểm tra PIN
(hash SHA-256). Ảnh hoá đơn nằm trong thư mục riêng của từng Leader, chỉ chủ sở hữu ghi/xoá được.

## Deploy miễn phí lên Vercel

1. Đẩy code lên GitHub.
2. https://vercel.com → New Project → chọn repo. Framework: Vite. Build: `npm run build`. Output: `dist`.
3. Environment Variables: thêm `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (nếu dùng cloud).
4. Deploy → nhận domain `*.vercel.app` có HTTPS, cài được PWA ngay.

Cloudflare Pages cũng dùng được với cùng cấu hình (build `npm run build`, output `dist`).

## Cấu trúc mã

```
src/
  db/        types.ts (mô hình dữ liệu), db.ts (Dexie), seed.ts (tạo đoàn mặc định)
  lib/       money.ts (minor units, parse/format, chia đều), ledger.ts (số dư ví/quỹ/thành viên, tỷ giá),
             snapshot.ts (sao lưu/CSV), supabase.ts (đăng nhập, xuất bản, đọc snapshot), image.ts (nén ảnh)
  hooks/     useDelegation.ts (live data + ledger)
  components/ ui.tsx (layout, input tiền, chip thành viên…), shared.tsx (TxList, FundCard, Settlement…), Receipt.tsx
  pages/     Setup, Home, AddTransaction, Exchange, CashCount, Transactions, Members, Funds, Settings, Share, ParentView
supabase/schema.sql   bảng + RPC + storage policy
```

## Quy tắc tính toán

- Tiền lưu là **số nguyên đơn vị nhỏ nhất** (VND: đồng, USD: cent). Chia đều dồn phần dư về người đầu danh sách
  để tổng luôn khớp.
- **Số dư ví** = thu vào − chi ra − đổi/chuyển ra + đổi/chuyển vào.
- **Số dư từng bé** = Σ phần góp − Σ phần chia (mọi quỹ, mọi tiền tệ), quy đổi qua tỷ giá bình quân của các đợt
  đổi tiền; chưa có đợt nào thì dùng tỷ giá nhập tay trong Cài đặt.
- Mặc định Leader **không** chia phần chi chung (phụ huynh các bé gánh). Bật lại trong Cài đặt nếu cần.
