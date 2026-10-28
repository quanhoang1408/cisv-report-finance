# Ví Đoàn CISV — Design Spec (bản 2a "Sổ cái · màu CISV")

> **Dành cho AI coding (Cursor / Claude Code / Lovable / Bolt).** File này là đặc tả thiết kế hi-fi, đủ để dựng lại UI pixel-perfect. Stack mục tiêu: React (Vite hoặc Next.js) + TailwindCSS + shadcn/ui + Dexie (offline) + Supabase. **Không bo góc, không đổ bóng, không gradient** — mọi cấu trúc được tạo bằng lưới, đường kẻ 2px/1px và độ đậm của chữ.

---

## 1. Nguyên tắc thiết kế

1. **Sổ cái (ledger):** màn hình đọc như bảng kế toán — hàng ngăn bằng đường kẻ, số căn phải, chữ số `tabular-nums`.
2. **Lưới lộ rõ:** khối chính ngăn bằng **đường kẻ 2px**, hàng con ngăn bằng **1px**. Không dùng card nổi, không shadow.
3. **Bo góc = 0** ở mọi nơi (nút, input, tag, avatar, ảnh).
4. **Căn trái tuyệt đối:** tiêu đề, nội dung, và **nhãn trong nút** (nút rộng thì nhãn nằm trái, icon nằm phải — `justify-between`).
5. **Màu tiết chế:** gần như toàn bộ là mực đen trên nền trắng lạnh. **Xanh CISV chỉ dùng cho:** nút hành động chính, nút `+`, tab đang chọn (vạch 3px), ô nhập đang focus, số âm / cảnh báo.
6. **Con số là anh hùng:** mỗi màn có một con số lớn (48–84px, weight 800) cho thông tin quan trọng nhất.
7. **Mobile-first, ngón cái:** vùng chạm tối thiểu 44×44px; nút chính cao 56px; bàn phím số phím cao 68px.

---

## 2. Design tokens

### 2.1 Màu

| Token | Hex | Dùng cho |
|---|---|---|
| `ink` (text) | `#0F1114` | Chữ, số, đường kẻ đậm, nền khối chọn |
| `paper` (bg) | `#F7F8FA` | Nền màn hình |
| `surface` | `#EDEFF2` | Ô input, ô ghi chú, avatar, chip "lặp lại" |
| `divider` | `rgba(15,17,20,.40)` | Mọi đường kẻ (2px khối lớn, 1px hàng) |
| `accent` | `#0057B8` | Xanh CISV — nút chính, FAB, tab active, focus |

**Ramp xanh (accent):**
`100 #EAF2FC` · `200 #D3E3F8` · `300 #A9C8F0` · `400 #6FA0E3` · `500 #2D73D2` · `600 #004A9E` (hover nút chính) · `700 #003F87` (pressed; chữ link; **số âm**) · `800 #08356C` (chữ trên nền accent-100) · `900 #0C2448`

**Ramp xám lạnh (neutral):**
`100 #F5F6F8` · `200 #E6E8EC` · `300 #D1D5DB` (track progress) · `400 #B3B8C0` · `500 #959BA4` · `600 #767C85` (chữ disabled / "—") · `700 #5A5F67` (**chữ phụ, label**) · `800 #3F4349` · `900 #2A2D32`

**Quy tắc ngữ nghĩa:**
- Số âm / thiếu tiền: chữ `accent-700`, kèm tag nền `accent-100` chữ `accent-800`. (Không dùng đỏ.)
- Trạng thái Offline: tag nền `accent-100`, chữ `accent-800`, icon `cloud-off`.
- Hóa đơn thiếu ảnh: chữ `accent-700` + icon `image-off`.
- Chữ trên nền `accent`: luôn `paper` (#F7F8FA).

> `#0057B8` là màu tạm — thay bằng mã màu thương hiệu chính thức của CISV nếu có; giữ nguyên cách phân bậc ramp.

### 2.2 Chữ

- **Font duy nhất:** `Archivo` (Google Fonts), weights **400 / 600 / 800**. Fallback `system-ui, sans-serif`.
- Mọi con số tiền: `font-variant-numeric: tabular-nums`.

| Vai trò | Size / line-height | Weight | Tracking | Màu |
|---|---|---|---|---|
| Số hero — Quick Add | 84px / 0.95 | 800 | -0.04em | ink |
| Số hero — Trang chủ | 60px / 0.95 | 800 | -0.03em | ink |
| Số hero — Đổi tiền, Phụ huynh | 56px / 0.95 | 800 | -0.03em | ink (âm: accent-700) |
| Số hero — Chênh lệch két | 48px / 0.95 | 800 | -0.03em | accent-700 |
| Số phụ (tổng ở form chia) | 44px / 1 | 800 | -0.03em | ink |
| Tiêu đề màn (H1) | 26px / 1.15 | 800 | 0 | ink |
| Tên đoàn ở trang chủ | 22px / 1.15 | 800 | 0 | ink |
| Tiêu đề desktop | 36px / 1.1 | 800 | 0 | ink |
| Giá trị hàng / số dư | 17px | 800 | 0 | ink |
| Tiêu đề hàng | 15px (danh sách) / 14px (bảng) | 600 | 0 | ink |
| Nhãn nút chính | 16px | 800 | 0 | paper |
| **Section label** | 11px | 600 | 0.08em, UPPERCASE | neutral-700 |
| Meta / phụ chú | 12–13px / 1.5 | 400 | 0 | neutral-700 |
| Nhãn tab bar | 11px | 600 active / 400 | 0 | ink active / neutral-700 |
| Nhãn khung frame (dev only) | 11px mono | 600 | — | — |

### 2.3 Khoảng cách & kích thước

- Đơn vị 4px. Padding ngang màn hình mobile: **20px**. Desktop: **32px**.
- Hàng danh sách: `padding: 12px 20px` (quỹ), `10px 20px` (pocket, lịch sử), `9px 20px` (khoản chi).
- Khoảng giữa khối section: label section có `padding: 20px 20px 10px`.
- Mobile frame thiết kế: **390 × ≥844**. Status bar 44px. Desktop frame: **1280px**.
- Đường kẻ: khối lớn `2px solid divider`; hàng `1px solid divider`; tab bar & bàn phím có **kẻ trên 2px màu ink** (đậm hơn divider).
- Radius: **0**. Shadow: **none**.

### 2.4 Icon
- **Lucide** (`lucide-react`), stroke mặc định. Size: 18px trong hàng/nút, 20px tab bar, 22px nút đóng/quay lại, 26px FAB.
- Bộ icon dùng: `layout-grid, list, plus, arrow-left-right, scale, wallet, mail, credit-card, landmark, plane, tent, gift, house, lock, camera, image, image-off, x, arrow-left, arrow-right, check, info, cloud-off, refresh-cw, eye, users, user, receipt, utensils, car-taxi-front, ticket, shopping-bag, gamepad-2, rotate-ccw, zap-off, minus, delete, signal, wifi, wifi-off, battery-*`.

### 2.5 Tailwind config (dán vào `tailwind.config.ts`)

```ts
export default {
  theme: {
    borderRadius: { none: '0', DEFAULT: '0' },
    boxShadow: { none: 'none' },
    extend: {
      fontFamily: { sans: ['Archivo', 'system-ui', 'sans-serif'] },
      colors: {
        ink: '#0F1114',
        paper: '#F7F8FA',
        surface: '#EDEFF2',
        divider: 'rgba(15,17,20,.40)',
        accent: {
          DEFAULT: '#0057B8',
          100: '#EAF2FC', 200: '#D3E3F8', 300: '#A9C8F0', 400: '#6FA0E3', 500: '#2D73D2',
          600: '#004A9E', 700: '#003F87', 800: '#08356C', 900: '#0C2448',
        },
        neutral: {
          100: '#F5F6F8', 200: '#E6E8EC', 300: '#D1D5DB', 400: '#B3B8C0', 500: '#959BA4',
          600: '#767C85', 700: '#5A5F67', 800: '#3F4349', 900: '#2A2D32',
        },
      },
      fontSize: {
        label: ['11px', { lineHeight: '1', letterSpacing: '0.08em', fontWeight: '600' }],
        'hero-xl': ['84px', { lineHeight: '0.95', letterSpacing: '-0.04em', fontWeight: '800' }],
        'hero-lg': ['60px', { lineHeight: '0.95', letterSpacing: '-0.03em', fontWeight: '800' }],
        'hero-md': ['56px', { lineHeight: '0.95', letterSpacing: '-0.03em', fontWeight: '800' }],
        'hero-sm': ['48px', { lineHeight: '0.95', letterSpacing: '-0.03em', fontWeight: '800' }],
      },
    },
  },
}
```

CSS gốc (`globals.css`):
```css
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;800&display=swap');
body { background:#F7F8FA; color:#0F1114; font-family:Archivo,system-ui,sans-serif; font-size:15px; line-height:1.55; }
* { border-radius:0 !important; }
.num { font-variant-numeric: tabular-nums; }
:focus-visible { outline:2px solid #0057B8; outline-offset:2px; }
::selection { background: rgba(0,87,184,.25); }
a { color:#003F87; } a:hover { color:#004A9E; }
```
shadcn/ui: đặt `--radius: 0`, `--primary` = accent, `--background` = paper, `--foreground` = ink, `--muted` = surface, `--border` = divider.

---

## 3. Component library

| Component | Spec |
|---|---|
| **StatusBar** (chỉ mockup) | 44px, `padding 0 22px 0 26px`, 14px/600. |
| **SectionLabel** | 11px/600 uppercase tracking .08em neutral-700; có thể có nhãn cột phải cùng style (vd "Còn lại"). Đặt trong `padding: 20px 20px 10px`, hàng đầu danh sách có `border-top 1px`. |
| **HeroNumber** | label (SectionLabel) → số hero → dòng quy đổi 13px neutral-700 (`≈ $256.16 · 6.750.000₫ · tỷ giá BQ 86.03`). Khối có `border-top 2px`, padding `18px 20px 20px`, gap 8px. |
| **ActionSplit** (2 nút ngang) | Grid 2 cột, mỗi ô 52px, `padding 0 20px`, icon 18px + nhãn 14px/600, cột 2 có `border-left 2px`. Khối có `border-top/bottom 2px`. |
| **WalletCell** (ví vật lý) | Grid 3 cột, ngăn `border-left 1px`. Mỗi ô: icon 18px → tên 11px neutral-700 → số 18px/800 → ghi chú 11px neutral-700. |
| **FundRow** | Hàng: icon 18px + tên 15px/600 (flex 1) + số dư 17px/800 phải. Dưới: **ProgressBar** 4px (track neutral-300, fill ink). Dưới nữa: 2 meta 12px hai đầu ("Đã chi ₹26,130 / ₹58,523" · "còn lại"). |
| **PocketRow** | Grid `44px 1fr auto`, gap 12: avatar vuông 44×44 nền surface, tên viết tắt 12px/800; giữa progress 4px + meta 12px; phải số dư 17px/800. Âm → số & meta màu accent-700, progress 0%. |
| **TabBar (Leader)** | Cao 78px, grid 5 cột, `border-top 2px ink`. Tab: icon 20px trên, nhãn 11px, căn trái `padding 12px 0 0 14px`. Active: **vạch trên 3px accent** (`box-shadow: inset 0 3px 0 accent`), chữ ink 600. Cột giữa: **FAB vuông 58×50 nền accent, icon plus 26px trắng**. Tabs: Tổng quan · Sổ chi · (+) · Đổi tiền · Kiểm két. |
| **TabBar (Phụ huynh)** | 74px, 3 cột, cùng style: Cả đoàn · Con của tôi · Quyết toán. |
| **Stepper** (Quick Add) | Grid 3 cột, `border-top/bottom 2px`, ô `padding 11px 20px`, 12px. Bước hiện tại: 800 + vạch trên 3px accent. Bước xong: icon check + neutral-700. |
| **Segmented** | Viền 1px divider, ô cao 38px `padding 0 14px` 13px; ô chọn nền accent chữ paper 800; ngăn ô `border-left 1px`. (Nhỏ: 6px 9px, 12px.) |
| **Chip** | Cao 32px `padding 0 10px` 12px, icon 14 + nhãn, viền 1px divider. Chọn: nền ink chữ paper 600. |
| **QuickChip** ("Lặp lại") | `padding 6px 10px` nền surface 12px/600 — chạm để điền nhanh số tiền + nội dung. |
| **FundGrid** | Grid 3 cột, viền ô 1px (kẻ lưới), ô cao 58px `padding 8px 10px`, icon 16 trên / nhãn 12px/600 dưới. Chọn: nền ink chữ paper 800. Khóa (Khẩn cấp): chữ neutral-600, icon lock. |
| **MemberTile** | Grid 5 cột gap 6px. Ô 60px `padding 7px 8px`, tên 13px/800 dưới-trái. Leader có nhãn nhỏ "Leader" 10px. Chọn: nền ink chữ paper + icon check 14px màu accent-400 góc trên. Dưới ô: phần chia 12px/600 tabular, không chọn hiện "—" neutral-600. |
| **InfoNote** | Nền surface, `padding 10px 12px`, icon info 15px + 12px/1.5 neutral-800. |
| **PrimaryButton** | Cao **56px** (52px trong form phụ), nền accent, chữ paper 16px/800, `padding 0 18px`, `justify-between`: nhãn trái, icon phải 20px. Hover accent-600, pressed accent-700, disabled opacity .45. |
| **SecondaryButton** | Cao 52px, viền 1px divider, nhãn 14px/800 + icon trái. Hover nền ink 7%. |
| **TextLink action** | 44px cao, 14px/800 accent-700 + arrow-right. |
| **Input** | Cao 44px (text) / 52px (số tiền, 22px/800), nền surface, viền 1px divider. Focus/đang nhập: **viền 2px accent**. |
| **Tag** | `padding 5px 10px` 12px/600; accent: nền accent-100 chữ accent-800; neutral: nền neutral-200 chữ neutral-800. |
| **Keypad** | Grid 3 cột × 4 hàng: `1 2 3 / 4 5 6 / 7 8 9 / . 0 ⌫`. Phím 68px, số 28px/600 căn trái `padding-left 24px`, kẻ phải + dưới 1px divider; cả khối `border-top 2px ink`. Phím ⌫ dùng icon `delete` 24px. |
| **Counter** (kiểm két) | Grid `64px 1fr 72px`: mệnh giá 16px/800 · [− 44×44 viền 1px] số tờ 18px/800 [+ 44×44] · thành tiền 14px/600 phải. Hàng ngăn 1px. |
| **ReceiptThumb** | 40×50 (list) / 46×58 (form) / 24×30 (bảng). Có ảnh: thumbnail ảnh thật (placeholder sọc chéo neutral-300/100). Không ảnh: trong suốt + icon image-off neutral-600. |
| **PhaseBar** | Grid 4 cột gap 4: vạch 4px (đã qua: ink · đang diễn ra: accent · chưa tới: neutral-300) + tên 12px/800 + ngày 11px neutral-700. Các giai đoạn: Pre-camp · Side trip · In-camp · Quyết toán. |
| **FlowStep** (Con của tôi) | Hàng: tên 14px/600 + phụ chú 11px; số 16px/800 phải; dưới là thanh 6px (nền neutral-200): phần còn lại = ink, phần bị trừ ở bước này = accent-300, nối tiếp nhau như waterfall. |
| **DataTable** (desktop) | Header 11px uppercase neutral-700, `border-bottom 2px`; hàng 14px `padding 10px 0` kẻ 1px. Cột số căn phải 800 tabular. |

---

## 4. Màn hình — LEADER (mobile, offline-first)

### L1 · Trang chủ — số dư ví & quỹ
Thứ tự từ trên xuống:
1. Header: label `VILLAGE DELHI 2026 · NGÀY 9` + tên đoàn 22px/800 "Đoàn CISV Hà Nội". Phải: Tag accent `cloud-off  Offline · 2 chờ` (khi online: tag neutral `Đã đồng bộ 21:41`).
2. HeroNumber: `TIỀN MẶT TRONG VÍ · THEO SỔ` → **₹22,037** → `≈ $256.16 · 6.750.000₫ · tỷ giá BQ 86.03`.
3. ActionSplit: `Đổi tiền` | `Kiểm két`.
4. Section `VÍ VẬT LÝ` → 3 WalletCell: Phong bì USD **$950** "gồm $300 khẩn cấp" · Thẻ Leader **₹14,600** "đoàn đang nợ Leader" · TK VND **5.150.000₫** "Pre-camp còn dư".
5. Section `QUỸ NGÂN SÁCH` / `CÒN LẠI` → FundRow × 5: Side Trip ₹32,393 (45%) · Camp Money ₹21,020 "đã nộp" (100%) · Quà tặng ₹2,550 (58%) · Pre-camp 5.150.000₫ (88%) · Khẩn cấp $300 "niêm phong" (0%, "Chưa dùng · chỉ mở khi có sự cố").
6. Section `POCKET MONEY · $200/BÉ` / `CÒN LẠI` → PocketRow × 4: Bách ₹8,624 · Kiệt ₹9,374 · Thư ₹11,381 · **Thỏ −₹966 (accent-700) "Âm $11.22 · báo phụ huynh"**.
7. TabBar (active: Tổng quan).

### L2 · Quick Add ① — nhập số tiền trước
Mục tiêu: ghi 1 khoản chi trong ~5 giây.
1. Top bar: nút X (44×44) · "Khoản chi mới" 16px/800 · ngày giờ 12px.
2. Stepper: **1 Số tiền** · 2 Quỹ · 3 Người.
3. Segmented tiền tệ: **₹ INR** | $ USD | ₫ VND (mặc định = tiền tệ ví đang dùng nhiều nhất).
4. Số tiền **84px** + con trỏ dọc 3px accent. Dưới: `≈ $23.25 · 612.600₫`.
5. Hàng 2 ô (border-top 2px): `Trả từ` → "Ví tiền mặt INR" (chạm để đổi ví: Ví INR / Phong bì USD / Thẻ Leader / TK VND) | `Hóa đơn` → "Chụp bill" (mở L4).
6. QuickChips "Lặp lại": Taxi ₹250 · Giặt đồ ₹150 · Nước ₹60 (lấy từ 3 khoản hay dùng nhất).
7. Keypad dính đáy.
8. PrimaryButton **"Tiếp: chọn quỹ →"** (disabled khi số tiền = 0).

### L3 · Quick Add ②③ — chọn quỹ & chia người
1. Top bar với nút quay lại. Stepper: ✓ Số tiền · ✓ Quỹ · **3 Người**.
2. Tóm tắt: label ví + **₹2,000** 44px; phải là ReceiptThumb 46×58 có nhãn "84KB".
3. `NỘI DUNG`: Input "Chơi game ở khu trò chơi" + hàng Chip danh mục: Ăn uống · Taxi · Vé · Camp shop · **Vui chơi** (chọn).
4. `QUỸ`: FundGrid 3×2: Side Trip · **Pocket Money** (chọn) · Camp Money · Quà tặng · Pre-camp ₫ · Khẩn cấp (khóa). Mô tả dưới 12px: "Trừ vào tiền riêng của từng bé được chọn."
5. `CHIA CHO · 3 NGƯỜI` + Segmented nhỏ: Cả đoàn | 4 bé | **Chọn**.
6. MemberTile × 5: Quân (Leader) — · **Bách ₹666.67** · **Kiệt ₹666.67** · Thư — · **Thỏ ₹666.66**.
7. InfoNote: "₹2,000 ÷ 3 không chia hết — phần lẻ ₹0.01 tự dồn cho người cuối, tổng luôn khớp hóa đơn."
8. PrimaryButton **"Lưu khoản chi ✓"** + dòng 12px `cloud-off  Đang offline · lưu trên máy, tự đồng bộ khi có Wi-Fi`.

**Quy tắc mặc định theo quỹ:**
- Side Trip / Pre-camp / Quà tặng → mặc định "Cả đoàn" (chia đều 5 người, hoặc theo cấu hình).
- Pocket Money / Camp Money → mặc định "Chọn", bắt buộc chọn ≥1 bé.
- Khẩn cấp → mở bằng xác nhận 2 bước ("Dùng quỹ khẩn cấp?") + bắt buộc ghi chú.

### L4 · Chụp bill — nén dưới 100KB
- **Nền ink toàn màn** (ngoại lệ duy nhất), chữ paper. Top bar: X · "Chụp hóa đơn" · flash (zap-off).
- Khung camera 390px cao, 4 góc nhắm 30×30 viền 3px accent; nhãn "Đã căn thẳng hóa đơn tự động".
- Sheet dưới nền paper: thumbnail + tên file `bill_0401_2131.jpg` + "Gắn vào: Chơi game · ₹2,000 · Pocket ÷ 3".
- So sánh: `ẢNH GỐC` **3.2 MB** (gạch ngang, neutral-600) → `SAU NÉN` **84 KB**; thanh 4px ink.
- Ghi chú: "Nén ngay trên máy, lưu offline cùng khoản chi. Tự tải lên khi có mạng — không cần ghi chú “Có ảnh / None”."
- 2 nút: SecondaryButton "Chụp lại" | PrimaryButton "Dùng ảnh này ✓".
- Kỹ thuật: `<input type="file" accept="image/*" capture="environment">` + `browser-image-compression` (`maxSizeMB: 0.1, maxWidthOrHeight: 1600, useWebWorker: true`), lưu Blob vào Dexie, upload khi online.

### L5 · Đổi tiền — tỷ giá bình quân gia quyền
1. Header: label `VÍ · 3 LẦN ĐỔI` + H1 "Đổi tiền USD → INR".
2. HeroNumber: `TỶ GIÁ BÌNH QUÂN GIA QUYỀN` → **₹86.03** + "/ 1 USD" → "= ₹77,427 ÷ $900 · tự tính lại sau mỗi lần đổi".
3. 2 ô: Còn trong phong bì **$950** ("$300 khẩn cấp không đổi") | Pocket $200/bé quy ra **₹17,206** ("theo tỷ giá BQ").
4. Form `LẦN ĐỔI MỚI · 04/01`: Input "Đưa ra" **$200** → Input "Nhận về" **₹17,300** (focus viền 2px accent). Bảng xem trước (hàng kẻ 1px, 13px): Tỷ giá lần này **₹86.50** · Bình quân sau khi lưu **₹86.03 → ₹86.12** · Pocket mỗi bé **₹17,206 → ₹17,223** · Nơi đổi · biên lai "Money changer trong trại" + icon image. PrimaryButton "Lưu lần đổi ✓".
5. Bảng `# · CÁC LẦN ĐÃ ĐỔI · TỶ GIÁ` (header kẻ 2px):
   - 01 · $200 → ₹16,800 · 27/12 · Quầy sân bay Delhi · **84.00**
   - 02 · $350 → ₹30,450 · 29/12 · Money changer, Connaught Place · **87.00**
   - 03 · $350 → ₹30,177 · 02/01 · Lễ tân khách sạn · **86.22**
   - Tổng: **$900 → ₹77,427 · 86.03** (accent-700), kẻ dưới 2px.
6. TabBar (active: Đổi tiền).

### L6 · Kiểm két cuối ngày
1. Header: label `04/01 · 22:10 · VÍ TIỀN MẶT INR` + H1 "Kiểm két cuối ngày".
2. 2 ô số 28px/800: `THEO SỔ` **₹22,037** | `ĐẾM THỰC TẾ` **₹20,450** (tự cộng từ bảng đếm).
3. Khối chênh lệch (kẻ 2px trên/dưới): `CHÊNH LỆCH` **−₹1,587** 48px accent-700 + Tag accent "Thiếu so với sổ". (Khớp → "₹0" ink + tag neutral "Khớp sổ"; thừa → "+₹x" + tag "Thừa so với sổ".)
4. Bảng Counter: ₹500 × 30 = 15,000 · ₹200 × 20 = 4,000 · ₹100 × 10 = 1,000 · ₹50 × 4 = 200 · ₹20 × 0 · ₹10 × 0 · **Xu & lẻ** 250 (nhập tổng trực tiếp).
5. Ghi chú: "250 + xu lẻ. Có thể quên ghi taxi tối 03/01."
6. PrimaryButton **"Ghi bút toán điều chỉnh −₹1,587 →"** + phụ chú "Ghi vào Side Trip, chia đều cả đoàn. Số dư các ngày sau không bị xáo trộn." + TextLink "Soát lại 6 khoản chi hôm nay →".
7. `LẦN KIỂM TRƯỚC`: 03/01 · 22:05 — Khớp sổ · 02/01 · 21:50 — Thiếu ₹20 · đã điều chỉnh (accent-700) · 31/12 · 22:30 — Khớp sổ.
8. TabBar (active: Kiểm két).

---

## 5. Màn hình — PHỤ HUYNH (link + PIN 4 số, chỉ xem)

Truy cập `/trip/[slug]` → nhập PIN 4 số (lưu phiên 30 ngày). Không có nút sửa/xóa ở bất kỳ đâu. Luôn hiện Tag neutral `eye  Chỉ xem` và thời điểm Leader đồng bộ gần nhất (kèm múi giờ).

### P1 · Tổng quan đoàn (mobile)
1. Label `VILLAGE DELHI 2026` + Tag "Chỉ xem"; H1 "Đoàn CISV Hà Nội"; `refresh-cw  Leader đồng bộ lúc 21:41 (giờ Delhi)`.
2. PhaseBar: Pre-camp (Tháng 12) · Side trip (27–30/12) · **In-camp (Ngày 9/14, vạch accent)** · Quyết toán (sau 14/01, xám).
3. `TIẾN ĐỘ CHI CÁC QUỸ` — mỗi quỹ: tên 14px/600 + % phải; số đã chi 22px/800 + "/ ngân sách" 12px; progress 4px; ghi chú 12px.
   - Pre-camp · tại VN: 36.850.000₫ / 42.000.000₫ · 88% · Bonding, National Night, visa
   - Side Trip: ₹26,130 / ₹58,523 · $303.73 / $680.26 · 45% · Ăn, ở, đi lại, vé
   - Quà tặng: ₹3,450 / ₹6,000 · 58% · Host Family, thầy cô
   - Camp Money: ₹21,020 · đã nộp Camp Bank · 100% · ₹5,255/bé · trừ Pocket
4. `KHOẢN CHI LỚN & HÓA ĐƠN` + link "Tất cả 31 khoản" (accent-700). Hàng: ReceiptThumb 40×50 · tên 14px/600 + "ngày · quỹ · chia cho" 12px · số 15px/800. Chạm thumbnail → xem ảnh full-screen (nền ink).
5. TabBar phụ huynh (active: Cả đoàn).

### P2 · Con của tôi — Bách (mobile)
1. Label `CON CỦA TÔI` + H1 tên bé.
2. Tab ngang 4 bé (kẻ 2px trên/dưới, ô 46px, ngăn 1px): **Bách** (vạch dưới 3px accent) · Kiệt · Thư · Thỏ.
3. HeroNumber: `POCKET MONEY CÒN LẠI` → **₹8,624.33** → "≈ $100.25 · 2.642.000₫".
4. `DÒNG TIỀN CỦA BÁCH` — FlowStep waterfall:
   - Bố mẹ gửi · $200 × tỷ giá BQ 86.03 · **+₹17,206**
   - Camp Money · Nộp Camp Bank · 31/12 · **−₹3,995**
   - Excursion · Dã ngoại do trại tổ chức · **−₹1,260**
   - Mua sắm cá nhân · 6 khoản · **−₹3,326.67**
   - Tổng (kẻ 2px): **Còn lại ₹8,624.33**
5. `MUA SẮM CÁ NHÂN · 6 KHOẢN` — hàng `40px 1fr auto`: ngày · tên (+icon image nếu có bill) + meta · số.
   03/01 Chơi game "chia 3: Bách, Kiệt, Thỏ · tổng ₹2,000" ₹666.67 · 02/01 Áo hoodie trại ₹1,850 (có ảnh) · 02/01 Notebook ₹180 · 01/01 Mũ CISV ₹450 · 01/01 Móc khóa ₹120 · 01/01 Chai nước ₹60.
6. Khối surface `TẠM TÍNH NẾU KẾT THÚC HÔM NAY`: "Leader hoàn lại **$276.79 + 1.287.500₫**" + "≈ 8.581.000₫ · gồm Pocket dư, phần quỹ chung dư, $75 khẩn cấp chưa dùng, Pre-camp dư. 1 USD = 26.350₫."
7. TabBar phụ huynh (active: Con của tôi).

### P3 · Desktop (≥1024px) — Tổng quan + Con của tôi
- Nav trên: "Sổ quỹ · Đoàn CISV Hà Nội" 18px/800 + "Village Delhi 2026" · links Tổng quan (accent-700) / Con của tôi / Quyết toán · trạng thái đồng bộ · Tag "Chỉ xem". `border-bottom 2px`.
- Grid `1fr 400px`, cột trái có `border-right 2px`:
  - **Trái:** label `NGÀY 9/14 · IN-CAMP` + H1 36px "Tổng quan đoàn" + PhaseBar (4 × 104px) bên phải → hàng 4 ô quỹ (grid 4 cột, ngăn 2px, mỗi ô: label, số 26px/800, ngân sách, progress, ghi chú + %) → DataTable "Khoản chi lớn & hóa đơn": cột `Ngày 56px | Khoản chi 1.7fr | Quỹ .9fr | Chia cho 1.1fr | Số tiền 120px phải | Hóa đơn 120px` ("Xem ảnh" ink / "Chưa có ảnh" accent-700 + image-off).
  - **Phải:** panel Con của tôi (cùng cấu trúc P2), ví dụ **Thỏ đang âm**: số **−₹965.67** accent-700 + Tag accent "Đang âm · cần nạp thêm $11.22 ≈ 296.000₫"; tạm tính "Leader hoàn lại $165.32 + 1.287.500₫ ≈ 5.644.000₫" + "Khoản âm có thể nạp ngay, hoặc trừ vào phần quỹ chung còn dư khi quyết toán."
- Breakpoint: <1024px dùng layout mobile P1/P2 (max-width 480px, căn giữa trên desktop hẹp).

---

## 6. Hành vi & trạng thái

**Offline / Sync**
- Mọi ghi chép lưu vào Dexie trước (`syncStatus: 'pending' | 'synced' | 'error'`), UI cập nhật tức thì (optimistic).
- Badge header: `Offline · N chờ` (accent-100) / `Đang đồng bộ…` (icon refresh-cw quay) / `Đã đồng bộ HH:mm` (neutral). Có mạng (`online` event + Background Sync) → đẩy hàng đợi theo thứ tự thời gian, ảnh upload sau dữ liệu.
- Mỗi bản ghi có `client_id` (uuid v4) để chống trùng khi sync lại.

**Quick Add flow**: L2 (số tiền) → L3 (quỹ + người + nội dung) → Lưu → toast dưới "Đã lưu · ₹2,000 · Pocket ÷ 3" + nút "Hoàn tác" 5 giây → quay về L1. Bill có thể chụp ở bất kỳ bước nào hoặc thêm sau từ Sổ chi.

**Chuyển động**: 200ms ease-out; chuyển bước = trượt ngang 16px + fade; không bounce, không scale. Hover nút chính → accent-600; pressed → accent-700.

**Trạng thái rỗng / lỗi**: dùng câu ngắn 13px neutral-700 căn trái + 1 TextLink hành động. Lỗi sync: Tag accent "Lỗi đồng bộ · thử lại".

---

## 7. Dữ liệu & công thức

### Bảng (Supabase / PostgreSQL) — tiền lưu `numeric(14,2)`, không dùng float
- `delegations(id, name, base_currency='VND', bridge_currency='USD', local_currency='INR', parent_passcode, slug)`
- `members(id, delegation_id, name, role: leader|delegate, initial_pocket_money_usd)`
- `funds(id, delegation_id, name, type: PRE_CAMP|SIDE_TRIP|CAMP_MONEY|GIFT_FUND|EMERGENCY|PERSONAL, member_id null, budget, currency)`
- `wallets(id, delegation_id, name, kind: CASH_LOCAL|CASH_USD|LEADER_CARD|BANK_VND, currency)`
- `currency_exchanges(id, delegation_id, date, from_currency, from_amount, to_currency, to_amount, exchange_rate, place, receipt_url)`
- `expenses(id, client_id, delegation_id, date, description, category, amount, currency, fund_id, wallet_id, receipt_url, is_adjustment bool, sync_status)`
- `expense_splits(id, expense_id, member_id, share_amount)`
- `cash_reconciliations(id, delegation_id, wallet_id, date, calculated_balance, actual_cash, denominations jsonb, loose_change, note, adjustment_expense_id)`

### Công thức
- **Tỷ giá BQ gia quyền:** `avgRate = Σ to_amount / Σ from_amount` (theo cặp USD→INR). Ví dụ: (16,800 + 30,450 + 30,177) / (200 + 350 + 350) = 77,427 / 900 = **86.03**.
- **Quy đổi hiển thị:** INR → USD = `inr / avgRate`; USD → VND = tỷ giá VND cấu hình (demo 26.350₫).
- **Chia đều có phần lẻ:** `share = floor(amount / n, 2)`; người cuối nhận `amount − share × (n−1)` → 666.67 / 666.67 / 666.66. Tổng splits luôn = amount.
- **Số dư Pocket bé:** `initial_usd × avgRate − Σ share_amount (fund PERSONAL/CAMP_MONEY của bé)`. Âm → cảnh báo.
- **Kiểm két:** `actual = Σ(denom × count) + loose_change`; `diff = actual − calculated`. Nút điều chỉnh tạo 1 `expense` `is_adjustment=true`, amount = −diff, fund mặc định SIDE_TRIP chia đều, ngày = ngày kiểm → không ảnh hưởng bút toán các ngày khác.
- **Quyết toán từng bé:** `pocket còn lại (→USD) + phần quỹ chung còn dư / số người + emergency chưa dùng / số bé + pre-camp dư / số bé` → trả theo từng loại tiền gốc (USD, VND); số âm = phụ huynh cần chuyển thêm.

### Dữ liệu mẫu (seed)
Đoàn CISV Hà Nội · Village Delhi 2026 · Leader **Quân** · Delegates **Bách, Kiệt, Thư, Thỏ** · Pocket $200/bé · Emergency $300 · Pre-camp 42.000.000₫ · Side Trip ₹58,523 · Gift ₹6,000. Dùng đúng số ở mục 4–5 để kiểm tra UI.

---

## 8. Checklist nghiệm thu
- [ ] Không có `border-radius` hay `box-shadow` nào (kể cả shadcn).
- [ ] Chỉ font Archivo; mọi số tiền `tabular-nums`.
- [ ] Xanh accent chỉ ở: nút chính, FAB, tab active, focus, số âm/cảnh báo.
- [ ] Nhãn nút rộng căn trái, icon phải.
- [ ] Vùng chạm ≥ 44px; nút chính 56px.
- [ ] Đường kẻ 2px giữa khối, 1px giữa hàng.
- [ ] Ghi chi tiêu + chụp ảnh hoạt động khi tắt mạng; tự sync khi bật lại.
- [ ] Tổng `expense_splits` luôn bằng `amount`.
- [ ] Trang phụ huynh không có thao tác ghi.
