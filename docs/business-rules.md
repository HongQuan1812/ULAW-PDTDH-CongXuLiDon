# Nghiệp vụ

Mô tả bằng lời các luật của cổng. Danh sách chính xác (quyền, trạng thái, mã, câu thông báo) nằm trong code ở `shared/`;
tệp này nói luật đó để làm gì và trỏ tới chỗ khai báo. Hai bên lệch nhau thì sửa cho khớp, `shared/` là chuẩn.

## Đăng nhập và tài khoản

- **Đăng nhập bằng tài khoản Google của trường.** Chỉ nhận email thuộc `SCHOOL_EMAIL_DOMAINS` (`shared/src/validators/auth.ts`),
  tính cả tên miền con (vd `...@student.hcmulaw.edu.vn`). Giới hạn tên miền ngay khi gọi Google OAuth, máy chủ kiểm tra lại.
  **Cần xác nhận tên miền email thật** của sinh viên và cán bộ.
- **Lần đầu đăng nhập:** chỉ **Họ và tên** bắt buộc. CCCD và số điện thoại không bắt buộc; có nhập thì phải đúng định dạng.
  Bỏ trống thì hiện "—", bổ sung sau bằng nút Sửa thông tin.
- **Kiểm tra thông tin tài khoản** (`shared/src/validators/profile.ts`): họ tên ít nhất 2 chữ; email là email trường, chưa tài khoản nào dùng;
  CCCD (nếu có) đúng 12 số, bắt đầu bằng 0, không trùng; SĐT (nếu có) đúng định dạng.
- **Email không đổi được sau khi tạo**: email là tài khoản Google để đăng nhập.
- **Đơn lưu theo id tài khoản**, không chép tên, email vào đơn. Đổi tên cán bộ thì tên mới hiện ở mọi đơn họ tiếp nhận / xử lí.
- **CCCD là dữ liệu nhạy cảm**: mặc định trả về dạng che; chỉ trả số đầy đủ khi người dùng có quyền và yêu cầu (nút Hiện CCCD).
- Chưa có xóa hay khóa tài khoản.

### Thông tin sinh viên

- MSSV, Lớp, Hình thức đào tạo, Ngành, Khóa học hiện tại, Khóa học gốc: lấy từ **database trường** (module `student-directory`), chỉ xem, không sửa trên cổng.
  Khóa gốc khác khóa hiện tại khi sinh viên bảo lưu hoặc học lại khóa sau. Tên và thứ tự các mục: `shared/src/api-contract/profile.ts`.
- Một email có thể gắn với **nhiều MSSV** (vd học văn bằng 2). Có một **MSSV chính**: mặc định MSSV trùng phần trước @ của email, người dùng đổi được.
  Chỉ chính người đó hoặc Admin đổi được. MSSV chính là thông tin điền vào file Word khi xuất đơn.
- Database trường có MSSV thiếu ngành, khóa hoặc lớp: mục trống ghi "—". Không có MSSV nào (vd cán bộ) thì ẩn cả phần, không báo lỗi.
- **Cần xác nhận cách kết nối** database sinh viên của trường.

## Vai trò và quyền

Ba vai trò: **Người nộp đơn**, **Người xử lí đơn**, **Admin**. Vai trò nào có quyền gì, thấy trang nào: `ROLES` trong
`shared/src/business-rules/accounts--permissions.ts`; ý nghĩa từng quyền: `PERMISSIONS` trong `shared/src/aux-schema/accounts--roles.ts`.
Giao diện ẩn / hiện nút theo quyền; **máy chủ kiểm tra lại mọi quyền**.

| Chức năng | Quyền | Người nộp đơn | Người xử lí đơn | Admin |
|---|---|:---:|:---:|:---:|
| Trang mở ra sau khi đăng nhập | | Thông tin cá nhân | Quản lí đơn | Quản lí đơn |
| Xem, sửa thông tin cá nhân của mình | | ✓ | ✓ | ✓ |
| Nộp đơn cho chính mình | `submit` | ✓ | ✓ | ✓ |
| Sửa đơn của mình (khi còn sửa được) | `editOwn` | ✓ | ✓ | ✓ |
| Xem tất cả đơn (Quản lí đơn, chi tiết đơn người khác) | `viewAll` | ✗ | ✓ | ✓ |
| Tiếp nhận đơn | `receive` | ✗ | ✓ | ✓ |
| Yêu cầu bổ sung / Duyệt / Từ chối đơn **mình phụ trách** | `decide` | ✗ | ✓ | ✓ |
| Yêu cầu bổ sung / Duyệt / Từ chối đơn **người khác phụ trách** | `decideAny` | ✗ | ✗ | ✓ |
| Chuyển giao đơn cho người xử lí khác | `transfer` | ✗ | ✓ | ✓ |
| Xem thông tin người nộp đơn khác | `viewApplicant` | ✗ | ✓ | ✓ |
| Sửa thông tin người nộp đơn khác | `editApplicant` | ✗ | ✗ | ✓ |
| Nộp đơn thay người nộp đơn khác | `submitForApplicant` | ✗ | ✗ | ✓ |
| Sửa nội dung đơn của người khác (khi còn sửa được) | `editAnyForm` | ✗ | ✗ | ✓ |
| Quản lí tài khoản: tạo, sửa thông tin và vai trò | `manageAccounts` | ✗ | ✗ | ✓ |
| Quản lí loại đơn: tạo, sửa, mở / đóng | `manageFormTypes` | ✗ | ✓ | ✓ |
| Cấu hình email | `manageEmail` | ✗ | ✓ | ✓ |

Ghi chú:
- **Admin không tự đổi được vai trò của chính mình**, để không tự khóa mình khỏi trang Quản lí tài khoản (`canChangeAccountRole`).
- Tài khoản có quyền xử lí đơn tự có trong danh sách **Chuyển giao**. Đổi một cán bộ sang Người nộp đơn thì họ không còn trong danh sách đó,
  nhưng các đơn họ đang phụ trách vẫn giữ nguyên.
- Chuyển giao: ai có quyền `transfer` cũng chuyển giao được mọi đơn, không cần là người phụ trách (`canTransferForm`).
- Hồ sơ của cán bộ (vai trò có quyền `decide`) có mục "Đơn phụ trách": các đơn người đó là người tiếp nhận hoặc người xử lí.

## Vòng đời lá đơn

Trạng thái và tên hiện: `shared/src/aux-schema/forms--statuses.ts`. Trạng thái nào làm được gì: `shared/src/business-rules/forms--statuses.ts`.

```
nop Đã nộp ──Tiếp nhận──▶ xet Đang xét ──▶ duyet Đã duyệt
                              │       └──▶ tc Từ chối
                              └──▶ bs Cần bổ sung ──người nộp sửa, lưu──▶ bsg Đã bổ sung ──Tiếp nhận lại──▶ xet
```

| Việc | Được khi | Luật trong code |
|---|---|---|
| Sửa đơn | `nop`, `bs`, `bsg` | `EDITABLE`, `canEditForm` |
| Tiếp nhận | `nop`, `bsg` | `RECEIVABLE`, `canReceiveForm` |
| Chuyển giao | `xet`, `bs`, `bsg` | `TRANSFERABLE`, `canTransferForm` |
| Yêu cầu bổ sung / Duyệt / Từ chối | `xet` | `DECIDABLE`, `canDecideOn` |

- Người tiếp nhận trở thành người xử lí của đơn. Chuyển giao đổi người xử lí.
- **Lí do** khi Yêu cầu bổ sung hoặc Từ chối là không bắt buộc. Lí do bị xóa khi đơn được tiếp nhận lại và khi Duyệt.
- Mọi bước chuyển trạng thái đi qua **một chỗ duy nhất** ở máy chủ (`forms/workflow.service.ts`).
- **Mã đơn** `<TIỀN TỐ>-<NĂM>-<PHIÊN BẢN>-<STT>`, vd `XMM-2026-001-00001` (`shared/src/business-rules/forms--codes.ts`).
  Số thứ tự tăng theo từng tiền tố và từng năm, đếm tiếp qua các phiên bản. Máy chủ sinh mã trong transaction.
- **Nộp đơn gửi câu trả lời và mọi tệp trong một lần.** Máy chủ kiểm tra hết; sai một chỗ thì không lưu gì.
  Đơn lưu kèm **bản chụp cấu trúc loại đơn lúc nộp**, nên sửa loại đơn sau này không làm hỏng đơn cũ.

### Câu thông báo trên trang chi tiết đơn

Giống nhau với mọi người xem. Khai báo ở `STATUS_NOTICE` trong `web/src/pages/form/FormDetailPage.tsx`.
Có lí do của Phòng Đào tạo thì hiện thêm dòng "Phòng Đào tạo: <lí do>".

## Loại đơn

- Mỗi **loại đơn** là một form: các **phần**, trong phần là các **câu hỏi**. "Xét miễn môn" là loại đơn đầu tiên, sửa được như mọi loại khác.
- **Mã đơn (tiền tố)**: 2–5 chữ in hoa, không trùng; khóa khi phiên bản đầu tiên được mở.
- **Phiên bản** (`shared/src/api-contract/form-types.ts`): mỗi loại đơn có nhiều phiên bản; tên, mô tả, các phần, câu hỏi thuộc từng phiên bản.
  - **Nháp**: sửa được, xóa được. Nhiều nhất một phiên bản Nháp, luôn là phiên bản mới nhất. Người nộp đơn không thấy.
  - **Đang mở**: nhận đơn; nội dung khóa cứng. Mỗi lúc chỉ một phiên bản mở; mở phiên bản khác thì phiên bản đang mở tự chuyển sang Đã đóng.
  - **Đã đóng**: không nhận đơn mới; đơn đã nộp vẫn xử lí bình thường. Phiên bản đã khóa chỉ đổi qua lại Đang mở / Đã đóng.
  - Muốn sửa nội dung đã khóa thì tạo phiên bản mới.
- Mỗi phần có công tắc **Nội dung chính**: chỉ các phần này hiện ở xem nhanh (dòng xổ ra trong các bảng đơn).
- **Các loại câu hỏi** (`shared/src/aux-schema/form-types--question-types.ts`): trả lời ngắn, đoạn văn, số, ngày, chọn một, chọn nhiều,
  danh sách thả xuống, tải tệp (đuôi tệp và dung lượng tối đa), bảng nhiều dòng (các cột kiểu chữ / số / chọn, cột số có thể tính tổng), khối thông báo.
  Câu trả lời lưu theo **id câu hỏi**; kiểm tra câu trả lời ở `shared/src/validators/forms--answers.ts`.
- Bảng môn của Xét miễn môn là một câu hỏi bảng nhiều dòng.
- Nộp đơn: nút **+ Nộp đơn mới** luôn mở hộp chọn loại đơn (kể cả khi chỉ có một loại), liệt kê các loại đang mở.
  Quy trình xử lí dùng chung cho mọi loại đơn.

## Tệp đính kèm

- Tệp lưu ở ổ đĩa máy chủ, tải lên cùng lúc nộp / sửa đơn.
- Xem được tệp: người nộp đơn có tệp đó, hoặc cán bộ có quyền `viewAll`. Không có tệp hoặc không được xem đều trả 404.
- Xem trước: ảnh (JPG, PNG), PDF, Word (.docx); tệp khác (vd .doc cũ, Excel) thì tải về (`shared/src/validators/files.ts`).

## Xuất file theo mẫu Word

- Cán bộ soạn mẫu bằng Word, gõ **mã trường** trong ngoặc nhọn vào chỗ cần điền (vd `{ho_ten}`, `{mssv}`), rồi tải file `.docx` lên trong trình soạn loại đơn.
  Mẫu lưu ở máy chủ theo loại đơn, dùng chung mọi phiên bản.
- Ở trang chi tiết đơn, **Xuất file** điền dữ liệu đơn vào mẫu (máy chủ dùng docxtemplater), xem trước rồi tải file Word. Định dạng của mẫu giữ nguyên.
  Chỉ ra file Word; muốn ra PDF cần máy chủ chuyển đổi.
- Các loại mã (`shared/src/business-rules/exports--tags.ts`):
  - **Mã chung**: thông tin người nộp đơn và thông tin đơn; ngày nộp tách thêm `{ngay}` `{thang}` `{nam}`.
  - **Mã câu hỏi**: ô "Mã dùng trong file Word" của câu hỏi; bỏ trống thì lấy theo nội dung câu hỏi bỏ dấu (`Tệp bảng điểm` → `tep_bang_diem`).
    Mã sai dạng, trùng nhau hoặc trùng mã chung thì không lưu được loại đơn. Đổi tên câu hỏi khi chưa đặt mã riêng thì mã đổi theo.
  - **Câu hỏi dạng bảng**: vòng lặp `{#mã bảng}` … `{/mã bảng}`, bên trong có `{stt}` và mã từng cột (theo tên cột);
    ngoài vòng lặp có `{so_<mã bảng>}` (số dòng) và `{tong_<mã cột>}` (tổng cột). Mã cột đặt ngoài vòng lặp sẽ để trống.
- **Kiểm tra** mẫu báo mã không có trong loại đơn và lỗi ngoặc. **Xuất thử** điền bằng một đơn của loại đơn, chưa có đơn thì bằng dữ liệu giả.

## Thống kê ở trang Quản lí đơn

- Theo trạng thái (số đơn và % của từng trạng thái) và theo loại đơn (biểu đồ cột). Máy chủ đếm.
- Đếm trên **tất cả** đơn, không đổi theo ô tìm kiếm / bộ lọc. Bấm một mục để lọc bảng theo mục đó; bấm lại để bỏ lọc.

## Cấu hình email

- Chỉ cấu hình phía **gửi**: tên người gửi, chữ kí. Địa chỉ gửi lấy từ cấu hình SMTP của máy chủ, chỉ hiện ra.
  Người nhận luôn là email của người nộp đơn; bấm "Trả lời" thì thư về địa chỉ gửi.
- **Bốn lúc gửi** (`shared/src/aux-schema/email--events.ts`): Đã nộp, Cần bổ sung, Từ chối, Đã duyệt. Mỗi lúc bật / tắt riêng, có tiêu đề và nội dung riêng.
- Mã chèn vào thư (`shared/src/business-rules/email--tags.ts`): `{ho_ten}`, `{ma_don}`, `{loai_don}`, `{ngay_nop}`, `{nguoi_xu_li}`, `{ly_do}`, `{link_don}`, `{chu_ki}`.
- Có xem trước bằng dữ liệu mẫu và gửi thư thử.

## Quy ước màu

Biến màu ở `web/src/styles/tokens.css`. Màu chủ đạo là **xanh da trời** (`--accent`); xanh lá chỉ dùng cho trạng thái Đã duyệt.

| Thành phần | Quy tắc |
|---|---|
| Chữ | Chỉ tiêu đề lớn (tên cổng, tiêu đề trang, khung, nhóm, popup) và tên trường mang màu xanh. Chữ khác dùng màu chữ chính; nhãn, gợi ý dùng xám. |
| Bấm được | Luôn có **nền đặc**. Nút chính và mọi nút trên phần đầu khung: nền xanh. Nút khác: nền xám. Yêu cầu bổ sung / Từ chối / Duyệt dùng màu trạng thái. Không dùng nút viền rỗng. |
| Không bấm được | **Nền rỗng, chỉ viền**: nhãn trạng thái, nhãn vai trò, nhãn "Bạn", số thứ tự mục. |
| Trạng thái | Đã nộp xanh lơ · Đang xét xanh dương · Cần bổ sung vàng · Đã bổ sung tím · Đã duyệt xanh lá · Từ chối đỏ (`--s-<mã>-bg` / `--s-<mã>-fg`). Chỉ dùng cho nhãn trạng thái, khung thông báo và 3 nút ra quyết định. |
| Vai trò | Chỉ hiện ở Quản lí tài khoản: Người nộp đơn xám, Người xử lí đơn xanh nhạt, Admin xanh đậm. |
