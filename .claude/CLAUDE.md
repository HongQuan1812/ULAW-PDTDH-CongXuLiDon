# Cổng xử lí đơn — Phòng Đào tạo Đại học, Trường ĐH Luật TP.HCM (ULAW)

Ứng dụng web để **sinh viên nộp đơn trực tuyến** và **Phòng Đào tạo Đại học tiếp nhận, xử lí, quản lí đơn**.
Loại đơn đầu tiên là **Xét miễn môn**. Cán bộ tự tạo thêm loại đơn mới bằng trình soạn form kiểu Google Form.

## Kế hoạch

Xem @plan.md

## Nghiệp vụ cốt lõi (tóm tắt)

Chi tiết: `docs/business-rules.md`.

- **Đăng nhập**: Google OAuth, chỉ email trường (`hcmulaw.edu.vn` và tên miền con, cần xác nhận lại tên miền thật).
  Lần đầu đăng nhập: xác nhận họ tên; CCCD và SĐT không bắt buộc. Thông tin sinh viên (MSSV, lớp, ngành, khóa…) lấy từ database trường, chỉ đọc.
- **Vai trò**: Người nộp đơn · Người xử lí đơn · Admin. Quyền khai báo tập trung ở `ROLES` (`shared/src/business-rules/accounts--permissions.ts`).
- **Vòng đời đơn**: `nop` Đã nộp → (Tiếp nhận) → `xet` Đang xét → `duyet` Đã duyệt / `tc` Từ chối / `bs` Cần bổ sung
  → sinh viên sửa → `bsg` Đã bổ sung → tiếp nhận lại.
  Sửa được khi `nop|bs|bsg` · tiếp nhận được khi `nop|bsg` · chuyển giao được khi `xet|bs|bsg` · ra quyết định khi `xet`.
- **Loại đơn**: gồm các phần → câu hỏi (text, số, bảng, tệp…). Mỗi loại đơn có nhiều phiên bản; mỗi phiên bản Nháp / Đang mở / Đã đóng. Mã đơn `<TIỀN TỐ>-<NĂM>-<PHIÊN BẢN>-<STT>`, vd `XMM-2026-001-00001`.
- **Xuất file**: mẫu Word theo từng loại đơn, có mã thay thế `{...}`.

---

## Công nghệ (đã chốt ngày 09/11/2026)

Cả frontend và backend dùng **TypeScript**, đặt trong **một repo (monorepo, pnpm workspaces)**.
Lí do: dùng chung một bộ định nghĩa trạng thái, vai trò, quyền, kiểu câu hỏi và kiểm tra dữ liệu cho cả hai phía.
Như vậy luật nghiệp vụ chỉ viết một lần.

### Frontend: `web/`

| Việc | Chọn | Ghi chú |
|---|---|---|
| Khung | **React + Vite** | SPA, trang nội bộ, không cần SEO nên không cần Next.js |
| Điều hướng | **React Router** | |
| Gọi API, cache | **TanStack Query** | Tự tải lại sau khi Tiếp nhận / Duyệt… |
| Form | **React Hook Form + Zod** | Zod schema lấy từ `shared/`, dùng chung với backend |
| Bảng | **TanStack Table** | Tìm kiếm, sắp xếp nhiều cột, lọc, phân trang |
| Giao diện | **CSS Modules** + biến CSS (`web/src/styles/tokens.css`) | Font Be Vietnam Pro |
| Xem tệp | pdf.js, docx-preview | Tải khi cần |
| Mock API | **MSW (Mock Service Worker)** | Chặn `fetch` ngay trong trình duyệt và trả dữ liệu giả |
| Kiểm thử | Vitest + Testing Library, Playwright (E2E) | Dùng lại handler MSW cho test |

### Backend: `api/`

| Việc | Chọn | Ghi chú |
|---|---|---|
| Khung | **NestJS** (Node.js) | Chia module rõ ràng; Guard/Decorator hợp để kiểm tra quyền |
| CSDL | **PostgreSQL** | Câu trả lời của đơn và cấu trúc loại đơn lưu dạng **JSONB** |
| ORM | **Prisma** | Migration, seed dữ liệu mẫu |
| Đăng nhập | Google OAuth (Passport), tham số `hd` + kiểm tra lại tên miền ở máy chủ | Phiên đăng nhập bằng cookie httpOnly |
| Tệp tải lên | **Ổ đĩa máy chủ** | |
| Xuất Word | **docxtemplater** | Điền mã `{...}` vào mẫu .docx |
| Dữ liệu sinh viên | Module `student-directory` | Đọc từ database trường (cách kết nối chờ xác nhận) |
| Tài liệu API | Swagger (OpenAPI) tự sinh | |
| Kiểm thử | Jest + Supertest | |

### Hạ tầng

- **Docker Compose** cho môi trường phát triển: `postgres`.
- Biến môi trường trong `.env` (có `.env.example`). Không commit `.env`.

### Nguyên tắc thiết kế

- **Máy chủ là nơi quyết định.** Giao diện ẩn hoặc hiện nút theo quyền, nhưng mọi quyền và mọi bước chuyển trạng thái đều phải được kiểm tra lại ở API.
- **Chuyển trạng thái đơn đi qua một chỗ duy nhất** (`forms/workflow.service.ts`). Mỗi bước được ghi vào bảng lịch sử: ai làm, lúc nào, lí do.
- **Đơn lưu kèm bản chụp cấu trúc loại đơn lúc nộp.** Vì vậy sửa loại đơn sau này không làm hỏng các đơn cũ.
- **Mã đơn sinh ở máy chủ**, đánh số tăng dần theo từng tiền tố và từng năm, trong transaction.
- **CCCD là dữ liệu nhạy cảm**: mặc định trả về dạng che, chỉ trả số đầy đủ khi người dùng có quyền và yêu cầu.

---

## Cây thư mục dự kiến

```
Cổng xử lí đơn/
├── .claude/CLAUDE.md             # tệp này
├── artifact/                     # chỗ để bản mẫu, ý tưởng mới khi cần (hiện trống)
├── docs/business-rules.md        # mô tả nghiệp vụ bằng lời
│
├── web/                          # ===== FRONTEND (React + Vite) =====
│   ├── index.html · vite.config.ts
│   ├── public/assets/logo.png
│   └── src/
│       ├── main.tsx
│       ├── app/                  # router, providers (Query, Auth), layout khung (thanh menu, drawer)
│       ├── pages/                # mỗi trang một thư mục:
│       │                         #   login · onboarding · profile · form (nộp / chi tiết / xử lí)
│       │                         #   forms (Quản lí đơn) · form-types · form-editor · accounts
│       ├── features/             # logic dùng lại giữa các trang:
│       │                         #   auth (useAuth, useCan) · form-renderer
│       │                         #   file-preview · export · transfer
│       ├── components/           # UI chung: DataTable, Sort/FilterPopover, Modal, Toast, StatusPill, Avatar…
│       ├── api/                  # client gọi API, các hook TanStack Query
│       ├── mocks/                # MSW: browser.ts · db.ts (dữ liệu giả trong bộ nhớ) · handlers/ (auth, forms, form-types, users, files…)
│       ├── lib/                  # định dạng ngày giờ, SĐT, che CCCD…
│       └── styles/               # tokens.css (biến màu, cỡ chữ), global.css
│
├── api/                          # ===== BACKEND (NestJS) =====
│   ├── prisma/                   # schema.prisma · migrations/ · seed.ts
│   │                             #   bảng: User, StudentInfo, FormType, Form, FormEvent, FileObject, ExportTemplate
│   ├── src/
│   │   ├── main.ts · app.module.ts
│   │   ├── common/               # PrismaService, guard quyền (@RequirePerm), lọc lỗi, phân trang
│   │   ├── auth/                 # Google OAuth, phiên đăng nhập, kiểm tra tên miền
│   │   ├── users/                # hồ sơ cá nhân, Quản lí tài khoản, phân vai trò
│   │   ├── student-directory/    # đọc thông tin sinh viên từ database trường
│   │   ├── form-types/           # CRUD loại đơn, mở / đóng, kiểm tra cấu trúc
│   │   ├── forms/                # nộp, sửa, tìm kiếm, lọc + workflow.service.ts (tiếp nhận, bổ sung, duyệt, từ chối, chuyển giao)
│   │   ├── files/                # tải lên / tải về tệp minh chứng
│   │   ├── exports/              # mẫu Word, docxtemplater
│   │   └── stats/                # số liệu theo trạng thái, theo loại đơn
│   └── test/                     # e2e (Supertest)
│
├── shared/                       # ===== DÙNG CHUNG FE + BE =====
│   └── src/
│       ├── api-contract/         # SCHEMA CHÍNH, mỗi nhóm một file (auth.ts, form.ts, forms.ts…): endpoint + schema request/response + câu thông báo (MSW, FE, BE cùng theo)
│       ├── aux-schema/           # SCHEMA PHỤ dựng nên schema chính: ví dụ, vai trò, trạng thái, câu hỏi, các phần, câu trả lời
│       ├── business-rules/       # LUẬT NGHIỆP VỤ: ví dụ, ROLES + can(), trạng thái nào sửa / tiếp nhận / chuyển giao / ra quyết định được
│       └── validators/           # KIỂM TRA DỮ LIỆU: ví dụ, CCCD, SĐT, email trường, câu trả lời của lá đơn
│
├── docker-compose.yml            # postgres
├── .env.example
├── package.json                  # script chung: dev, build, test, lint
├── pnpm-workspace.yaml           # packages: web, api, shared
└── tsconfig.base.json
```

## Lệnh thường dùng (khi đã dựng xong)

```bash
pnpm install
pnpm --filter web dev                   # chỉ chạy frontend + API giả

# khi đã có backend
docker compose up -d                    # postgres
pnpm --filter api prisma migrate dev    # tạo bảng
pnpm --filter api prisma db seed        # dữ liệu mẫu
pnpm dev                                # chạy web + api cùng lúc
pnpm test
```

## Quy ước

- Giao diện, thông báo, comment viết **tiếng Việt có dấu**. Tên biến, hàm, tệp viết **tiếng Anh**.
  Mã trạng thái viết tắt tiếng Việt: `nop`, `xet`, `bs`, `bsg`, `duyet`, `tc`.
- Viết "xử lí" (không viết "xử lý").
- **Đặt tên biến, tham số, hàm cho có nghĩa, đọc là hiểu** nó chứa gì hoặc làm gì, không phải đoán.
  Tránh tên chung chung như `values`, `value`, `data`, `item`, `result`, `update`, `temp`.
  Vd: `values` → `profileInput` (dữ liệu người dùng nhập ở form hồ sơ), `update` → `updateProfile` (lệnh lưu hồ sơ).
  Chỉ riêng biến đếm vòng lặp ngắn (`i`) hoặc tham số của hàm một dòng quá rõ nghĩa mới được viết tắt.
- **Comment cho hàm**: mỗi hàm có comment ngắn gọn, đủ ý, ghi rõ **mục đích**, **đầu vào**, **đầu ra**.
  Trong thân hàm, gom các dòng code liên quan thành nhóm; mỗi nhóm có một dòng comment ở trên, các nhóm cách nhau 1 dòng trống.
- **API giả**: mọi handler chờ 2 giây trước khi trả kết quả (`await delay(MOCK_DELAY_MS)`), để thấy giao diện lúc đang tải.
- Khi nghiệp vụ thay đổi: cập nhật `shared/` trước, sau đó sửa backend và frontend, rồi sửa `docs/business-rules.md`.
- Code chỉ dùng để thử khi phát triển (đăng nhập theo vai trò, đổi vai trò…) bọc trong `JUST FOR DEMO: START · <làm gì, bản thật thay bằng gì>` … `JUST FOR DEMO: END`
  (comment `/* */`, trong JSX `{/* */}`). Tìm tất cả: `grep -rn "JUST FOR DEMO" web/src`.
- Việc còn treo: xác nhận tên miền email thật của sinh viên và cán bộ; cách kết nối với database sinh viên của trường.

