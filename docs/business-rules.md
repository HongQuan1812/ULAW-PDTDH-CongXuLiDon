# Nghiệp vụ

Mô tả bằng lời các luật của cổng. Danh sách chính xác (quyền, trạng thái, mã, câu thông báo) nằm trong code ở `shared/`;
tệp này nói luật đó để làm gì và trỏ tới chỗ khai báo. Hai bên lệch nhau thì sửa cho khớp, `shared/` là chuẩn.

## Đăng nhập và tài khoản

- **Đăng nhập bằng tài khoản Google của trường.** Chỉ nhận email thuộc `SCHOOL_EMAIL_DOMAINS` (`shared/src/validators/auth.ts`),
  tính cả tên miền con (vd `...@student.hcmulaw.edu.vn`). Máy chủ kiểm tra email (đã được Google xác minh) khi Google chuyển về;
  không gửi tham số `hd` cho Google, nên muốn nhận thêm tên miền (kể cả người ngoài trường) chỉ cần thêm vào `SCHOOL_EMAIL_DOMAINS`.
  Email ngoài danh sách: không tạo tài khoản, không tạo phiên, trang Đăng nhập báo `AUTH_MESSAGES[403]`.
- **Email trường chưa có tài khoản** đăng nhập lần đầu: tự tạo tài khoản vai trò **Người nộp đơn**, họ tên để trống
  (không lấy từ Google), chưa bổ sung thông tin: người dùng tự nhập họ tên ở màn Bổ sung thông tin. Muốn ai là Người xử lí đơn / Admin thì Admin đổi vai trò, hoặc tạo tài khoản trước ở Quản lí tài khoản.
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
- Tra theo **email đăng nhập** trong database trường (SQL Server `CoreUis`, chỉ đọc; bảng, cột: `api/src/student-directory/school-database.json`), không cắt chuỗi email.
  Database trường ghi gì thì hiện đúng như vậy, không ghép thêm mục khác, không tự điền thay (vd khóa gốc trống thì để trống).
- Database trường không tới được: trang hồ sơ báo "Chưa lấy được thông tin sinh viên từ hệ thống của trường.", các trang khác vẫn dùng được.

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
| Xem, viết ghi chú nội bộ trên đơn; sửa, xóa ghi chú của mình | `internalNotes` | ✗ | ✓ | ✓ |
| Xem thông tin người nộp đơn khác | `viewApplicant` | ✗ | ✓ | ✓ |
| Sửa thông tin người nộp đơn khác | `editApplicant` | ✗ | ✗ | ✓ |
| Nộp đơn thay người nộp đơn khác | `submitForApplicant` | ✗ | ✗ | ✓ |
| Sửa nội dung đơn của người khác (khi còn sửa được) | `editAnyForm` | ✗ | ✗ | ✓ |
| Quản lí tài khoản: tạo, sửa thông tin và vai trò | `manageAccounts` | ✗ | ✗ | ✓ |
| Quản lí loại đơn: tạo, sửa, mở / đóng | `manageFormTypes` | ✗ | ✓ | ✓ |
| Cấu hình email | `manageEmail` | ✗ | ✓ | ✓ |
| Nguồn dữ liệu: xem cấu hình (không có mật khẩu) và tình trạng kết nối database trường | `manageDataSources` | ✗ | ✗ | ✓ |
| Sao lưu: nơi lưu, sao lưu ngay, lịch định kì, lịch sử, tải bản sao lưu về | `manageBackups` | ✗ | ✗ | ✓ |
| Ngày nghỉ: thêm, sửa, xóa ngày nghỉ (lễ, Tết, nghỉ bù) để tính hạn xử lí | `manageHolidays` | ✗ | ✗ | ✓ |

Ghi chú:
- Cấu hình email, Nguồn dữ liệu, Sao lưu, Ngày nghỉ không có mục riêng trên menu: menu có một mục **Cấu hình** (`#/cau-hinh`), trong đó mỗi trang một thẻ,
  bấm thẻ thì mở trang đó (`#/cau-hinh/email`, `#/cau-hinh/nguon-du-lieu`, `#/cau-hinh/sao-luu`, `#/cau-hinh/ngay-nghi`), đầu mỗi trang có nút "‹ Quay lại Cấu hình". Mỗi vai trò chỉ thấy thẻ của trang mình được vào;
  không được vào trang nào thì không có mục Cấu hình.
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
- **Hoàn tác trong 10 giây** (để tránh bấm nhầm): Yêu cầu bổ sung, Duyệt, Từ chối không gửi lên máy chủ ngay mà chờ **10 giây**;
  trong lúc chờ có thanh "có hiệu lực sau N giây · Hoàn tác" ở góc trái dưới. Bấm Hoàn tác thì không có gì được gửi đi (đơn, thư gửi người nộp đều không đổi); bấm Ngay và luôn thì làm liền, không chờ hết giờ. Nền hộp rút dần theo số giây còn lại.
  Hết 10 giây mới gửi, trạng thái đổi và thư tự động mới đi. Mỗi đơn chỉ chờ một thao tác một lúc. Việc chờ nằm ở trình duyệt (`web/src/lib/undoScheduler.ts`),
  máy chủ không đổi; đóng hẳn trang trong lúc chờ thì thao tác mất (trình duyệt hỏi lại trước khi đóng). Tiếp nhận, Chuyển giao, Nộp đơn, sửa đơn của người nộp không chờ.
- Mọi bước chuyển trạng thái đi qua **một chỗ duy nhất** ở máy chủ (`forms/workflow.service.ts`).
- **Lịch sử đơn**: mỗi lần nộp đơn, sửa đơn, bổ sung đơn (sửa đơn Cần bổ sung), tiếp nhận, yêu cầu bổ sung, duyệt, từ chối, chuyển giao ghi một dòng:
  ai làm, lúc nào, đơn sang trạng thái nào, lí do (yêu cầu bổ sung, từ chối), cán bộ nhận (chuyển giao). Ghi trong cùng transaction với việc đó; việc bị từ chối (403, 409…) không ghi.
  Nộp thay thì người làm là cán bộ bấm nộp. Ai xem được đơn thì xem được lịch sử: mục **Lịch sử** cuối khung "Thông tin đơn" ở trang chi tiết đơn,
  cũ nhất ở trên, chấm màu theo trạng thái sau việc đó (sửa đơn, chuyển giao không đổi trạng thái thì chấm xám).
- **Mã đơn** `<TIỀN TỐ>-<NĂM>-<PHIÊN BẢN>-<STT>`, vd `XMR-2026-001-00001` (`shared/src/business-rules/forms--codes.ts`).
  Số thứ tự tăng theo từng tiền tố và từng năm, đếm tiếp qua các phiên bản. Máy chủ sinh mã trong transaction.
- **Nộp đơn gửi câu trả lời và mọi tệp trong một lần.** Máy chủ kiểm tra hết; sai một chỗ thì không lưu gì.
  Đơn lưu kèm **bản chụp cấu trúc loại đơn lúc nộp**, nên sửa loại đơn sau này không làm hỏng đơn cũ.

### Câu thông báo trên trang chi tiết đơn

Giống nhau với mọi người xem. Khai báo ở `STATUS_NOTICE` trong `web/src/pages/form/FormDetailPage.tsx`.
Có lí do của Phòng Đào tạo thì hiện thêm dòng "Phòng Đào tạo: <lí do>".
Cần bổ sung / Đã duyệt / Từ chối thì câu thông báo ghi kèm lúc ra quyết định (`decidedAt`, lưu mỗi lần ra quyết định, kể cả Yêu cầu bổ sung).

### Ghi chú nội bộ

- Cán bộ (quyền `internalNotes`) để lại ghi chú trên một lá đơn, nối thành chuỗi theo thứ tự viết, như bình luận.
  **Người nộp đơn không thấy**, không biết có ghi chú. Khác với lí do Yêu cầu bổ sung / Từ chối (người nộp đơn thấy).
- Mỗi ghi chú có người viết, lúc viết; nội dung là văn bản có định dạng, không được trống.
- **Chỉ người viết sửa, xóa được ghi chú của mình** (`canEditFormNote`), Admin cũng không sửa, xóa ghi chú người khác. Sửa thì hiện "đã sửa".
- Trang chi tiết đơn: nút tròn ở góc phải dưới, có số ghi chú; bấm thì mở khung ghi chú, kéo góc trên bên trái để co giãn.
- Bảng Quản lí đơn và Đơn phụ trách có cột **Ghi chú**: số ghi chú của đơn (`noteCount`), sắp xếp và lọc như cột số (vd "= 0" là đơn chưa có ghi chú, khoảng "từ 1" là đơn đã có). Bấm ô đó thì mở trang chi tiết đơn và mở sẵn khung ghi chú.
- Hợp đồng API: `shared/src/api-contract/form-notes.ts`. Backend: bảng `FormNote` (xóa đơn thì xóa ghi chú theo), module `api/src/form-notes/`.

## Hạn xử lí đơn

Luật tính hạn: `shared/src/business-rules/forms--deadlines.ts` (hàm thuần, API giả và backend cùng gọi). Tình trạng hạn tính ở máy chủ mỗi lần trả đơn, từ lịch sử đơn (`FormEvent`), không lưu riêng.

- **Ngày làm việc** = trọn 24 giờ của Thứ Hai đến Thứ Sáu, theo giờ Việt Nam, **trừ ngày nghỉ** do Admin nhập. Không có ngày làm bù: Thứ Bảy, Chủ nhật luôn nghỉ.
- **Hạn** = đồng hồ chạy từ đúng lúc nộp, chỉ chạy trong ngày làm việc, đủ N × 24 giờ là hết hạn (N = thời gian xử lí tối đa trong bản chụp loại đơn lúc nộp).
  Vd nộp 10:00 Thứ Sáu, hạn 3 ngày → 10:00 Thứ Tư tuần sau; nộp 15:00 Thứ Bảy → đồng hồ chạy từ 00:00 Thứ Hai.
- **Tạm dừng khi chờ bổ sung**: đồng hồ dừng từ lúc Yêu cầu bổ sung; sinh viên gửi bổ sung thì chạy tiếp phần còn lại, không tính lại từ đầu, nên hạn lùi ra.
  Đang chờ bổ sung thì chưa có hạn, chỉ ghi còn bao lâu ("Còn 3 ngày, tính tiếp khi bổ sung xong"); tình trạng xếp theo thời gian còn lại lúc dừng.
- **Tình trạng hạn** (`DEADLINE_STATES`), mỗi đơn đúng một: **Còn hạn** · **Sắp tới hạn** (còn 1 ngày làm việc trở xuống) · **Quá hạn** ·
  **Xong đúng hạn** / **Xong trễ hạn** (đã Duyệt / Từ chối, so lúc ra quyết định với hạn) · **Không có hạn** (loại đơn lúc nộp không giới hạn, hoặc đơn nộp trước khi có hạn xử lí).
- **Chỗ hiện**: khung Thông tin đơn ở chi tiết đơn (hạn, còn N ngày / trễ N ngày / tạm dừng chờ bổ sung; sinh viên và cán bộ cùng thấy) ·
  cột **Tình trạng hạn** ở Quản lí đơn và Đơn phụ trách (lọc theo tình trạng; sắp xếp gấp nhất trước: Quá hạn → Sắp tới hạn → Còn hạn → Không có hạn → Xong trễ hạn → Xong đúng hạn) ·
  khung thống kê **Theo tình trạng hạn**.
- **Ngày nghỉ** (trang `#/cau-hinh/ngay-nghi`, quyền `manageHolidays`; hợp đồng `shared/src/api-contract/holidays.ts`, bảng `Holiday`): lịch cả năm, ngày nghỉ tô xanh, Thứ Bảy, Chủ nhật tô xám.
  Bấm một ngày để thêm / sửa, nhấn giữ rồi kéo để chọn nhiều ngày. Mỗi ngày nghỉ là một ngày hoặc một khoảng (tối đa 31 ngày), có tên, không trùng nhau.
  Thêm, sửa ngày nghỉ thì hạn của mọi đơn tính lại theo lịch mới. Seed dev có sẵn ngày nghỉ 2026–2027; bản thật để trống.
- **Thư nhắc hạn** cho cán bộ: mục **Cấu hình email**.

## Loại đơn

- Mỗi **loại đơn** là một form: các **phần**, trong phần là các **câu hỏi**. Loại đơn ban đầu là 32 mẫu đơn Word của Phòng Đào tạo Đại học (`shared/src/seed/school-form-types.ts`), sửa được như mọi loại khác; seed bản thật thêm cả 32 ở dạng Nháp, chừa mã nào thì khai ở `shared/src/seed/production-form-types.ts`.
- **Mã đơn (tiền tố)**: 2–5 chữ in hoa, không trùng; khóa khi phiên bản đầu tiên được mở.
- **Phiên bản** (`shared/src/api-contract/form-types.ts`): mỗi loại đơn có nhiều phiên bản; tên, mô tả, các phần, câu hỏi thuộc từng phiên bản.
  - **Nháp**: sửa được, xóa được. Nhiều nhất một phiên bản Nháp, luôn là phiên bản mới nhất. Người nộp đơn không thấy.
  - **Đang mở**: nhận đơn; nội dung khóa cứng. Mỗi lúc chỉ một phiên bản mở; mở phiên bản khác thì phiên bản đang mở tự chuyển sang Đã đóng.
  - **Đã đóng**: không nhận đơn mới; đơn đã nộp vẫn xử lí bình thường. Phiên bản đã khóa chỉ đổi qua lại Đang mở / Đã đóng.
  - Muốn sửa nội dung đã khóa thì tạo phiên bản mới.
- **Thời gian xử lí tối đa** (số ngày làm việc, 1–365, để trống = không giới hạn) đặt ở từng phiên bản, trong khung thông tin loại đơn. Đơn lưu kèm bản chụp lúc nộp, nên sửa hạn của loại đơn không đổi hạn của đơn đã nộp (mục **Hạn xử lí đơn**). Seed dev đặt sẵn hạn cho mọi loại đơn; bản thật để trống, Phòng tự đặt.
- Mỗi phần có công tắc **Nội dung chính**: chỉ các phần này hiện ở xem nhanh (dòng xổ ra trong các bảng đơn).
- **Các loại câu hỏi** (`shared/src/aux-schema/form-types--question-types.ts`): trả lời ngắn, đoạn văn, số, ngày, chọn một, chọn nhiều,
  danh sách thả xuống, tải tệp (đuôi tệp và dung lượng tối đa), bảng nhiều dòng (các cột kiểu chữ / số / ngày / chọn, cột số có thể tính tổng, cột ngày xuất file dạng dd/mm/yyyy), khối thông báo.
  Câu trả lời ngắn, đoạn văn, số và cột chữ, cột số của bảng có **chữ gợi ý** (chữ mờ trong ô, vd "VD: 2026 - 2027"): ví dụ để ở đây, không để ở mô tả, nên đơn đã nộp không còn dòng ví dụ thừa.
  Câu trả lời lưu theo **id câu hỏi**; kiểm tra câu trả lời ở `shared/src/validators/forms--answers.ts`.
- Bảng học phần trong các mẫu đơn là câu hỏi bảng nhiều dòng.
- Nộp đơn: nút **+ Nộp đơn mới** luôn mở hộp chọn loại đơn (kể cả khi chỉ có một loại), liệt kê các loại đang mở.
  Quy trình xử lí dùng chung cho mọi loại đơn.

## Tệp đính kèm

- Tệp lưu ở ổ đĩa máy chủ, tải lên cùng lúc nộp / sửa đơn.
- Xem được tệp: người nộp đơn có tệp đó, hoặc cán bộ có quyền `viewAll`. Không có tệp hoặc không được xem đều trả 404.
- Xem trước: ảnh (JPG, PNG), PDF, Word (.docx), Excel (.xlsx, hiện chữ từng sheet, tối đa 500 dòng × 40 cột); tệp khác (vd .doc, .xls cũ) thì tải về (`shared/src/validators/files.ts`).

## Xuất file theo mẫu

Mỗi loại đơn có hai nhóm mẫu, lưu ở máy chủ theo loại đơn, dùng chung mọi phiên bản, cùng một bộ mã trường:
- **Mẫu xuất đơn** (Word `.docx`): điền dữ liệu của một lá đơn.
- **Mẫu xuất danh sách đơn** (Excel `.xlsx`): điền các lá đơn của loại đơn theo phiên bản và ngày nộp, mỗi đơn một hàng.

### Mẫu xuất đơn (Word)

- Cán bộ soạn mẫu bằng Word, gõ **mã trường** trong ngoặc nhọn vào chỗ cần điền (vd `{ho_ten}`, `{mssv}`), rồi tải file `.docx` lên ở khung "Mẫu xuất đơn" của trình soạn loại đơn.
- Ở trang chi tiết đơn, **Xuất đơn** mở hộp "Chọn mẫu xuất đơn": mỗi mẫu một dòng, hệ thống tự **đối chiếu mã trong mẫu với các câu hỏi của lá đơn này** (bản chụp lúc nộp). Mã nào đơn không có thì báo đỏ như khi kiểm tra ở trình soạn ("sẽ để trống khi xuất file"); khớp hết thì báo xanh. Người xem đơn bấm **Xuất** ở mẫu muốn dùng, kể cả khi mẫu còn mã không khớp.
- Xuất đơn điền dữ liệu đơn vào mẫu (máy chủ dùng docxtemplater), xem trước rồi tải file Word. Định dạng của mẫu giữ nguyên.
  Chỉ ra file Word; muốn ra PDF cần máy chủ chuyển đổi.
- Các loại mã (`shared/src/business-rules/exports--tags.ts`):
  - **Mã chung**: thông tin người nộp đơn và thông tin đơn; ngày nộp tách thêm `{ngay}` `{thang}` `{nam}`.
  - **Mã câu hỏi**: ô "Mã dùng trong file Word" của câu hỏi; bỏ trống thì lấy theo nội dung câu hỏi bỏ dấu (`Tệp bảng điểm` → `tep_bang_diem`).
    Mã sai dạng, trùng nhau hoặc trùng mã chung thì không lưu được loại đơn. Đổi tên câu hỏi khi chưa đặt mã riêng thì mã đổi theo.
  - **Câu hỏi dạng bảng**: mã từng cột là mã bảng + tên cột, số thứ tự dòng là `{<mã bảng>_stt}` (vd bảng `ielts` có `{ielts_stt}`, `{ielts_so_hieu}`),
    nên hai bảng có cột cùng tên không trùng mã. Cột tên "STT" trùng `{<mã bảng>_stt}` nên báo trùng mã.
    **Không cần vòng lặp** `{#…}` `{/…}`: hàng bảng Word hay đoạn văn nào có mã cột thì khi xuất tự nhân lên, mỗi dòng của bảng một hàng / một đoạn
    (bảng không có dòng nào thì hàng / đoạn đó biến mất). Một hàng có mã cột của hai bảng thì số hàng theo bảng dài hơn, bảng ngắn để trống phần còn lại, giống mẫu Excel.
    Thêm `{so_<mã bảng>}` (số dòng) và `{tong_<mã cột>}` (tổng cột), đặt ở đâu cũng được. Mẫu còn `{#…}` `{/…}` thì Kiểm tra mẫu báo lỗi, bảo xóa đi.
- **Kiểm tra** mẫu báo mã không có trong loại đơn và lỗi ngoặc. **Xuất thử** điền bằng một đơn của loại đơn, chưa có đơn thì bằng dữ liệu giả.

### Mẫu xuất danh sách đơn (Excel)

- Cán bộ soạn mẫu bằng Excel, dùng cùng các mã như mẫu Word, rồi tải file `.xlsx` lên ở khung "Mẫu xuất danh sách đơn" của trình soạn loại đơn.
  **Xuất danh sách đơn** ở đầu trình soạn mở hộp "Xuất danh sách đơn" (máy chủ dùng ExcelJS, `shared/src/business-rules/exports--xlsx.ts`). Cần quyền `manageFormTypes`.
- Hộp có hai điều kiện, rồi các mẫu danh sách đơn đã lưu:
  - **Phiên bản**: một phiên bản (mặc định là phiên bản đang xem ở trình soạn) hoặc **Tất cả**. Bản nháp chưa có đơn nên không có trong danh sách.
  - **Ngày nộp**: từ ngày nào đến ngày nào, tính cả hai đầu, theo giờ Việt Nam; bỏ trống = không giới hạn.
  Mỗi mẫu tự **đối chiếu mã với câu hỏi của phiên bản được chọn** (chọn Tất cả thì báo theo từng phiên bản): mã nào phiên bản đó không có thì báo đỏ "sẽ để trống", khớp hết thì báo xanh. Bấm **Xuất** ở mẫu muốn dùng để mở trình xem file Excel đã điền, rồi **Tải file Excel**.
- **Mỗi phiên bản một sheet**: chọn một phiên bản thì file có một sheet; chọn Tất cả thì mỗi phiên bản (đã từng mở) một sheet tên "Phiên bản N", kể cả phiên bản không có đơn nào.
  Các sheet đều là **bản sao cấu trúc của mẫu** (mẫu nhiều sheet thì mỗi sheet được sao cho từng phiên bản), mỗi sheet chỉ chứa đơn của phiên bản đó, theo thứ tự nộp, mọi trạng thái.
  Mã nào phiên bản đó không có câu hỏi thì ô để trống, cột vẫn còn. `{loai_don}` là tên của phiên bản trong sheet đó, `{so_don}` là số đơn của sheet đó.
- **Hàng có mã của đơn** (vd `{ma_don}`, `{ho_ten}`) là hàng mẫu: hàng đó nhân lên, mỗi đơn một hàng, giữ định dạng của hàng mẫu.
  `{stt}` là số thứ tự của đơn trong file. Không có đơn nào thì bỏ hàng mẫu.
- **Hàng chỉ có mã của cả file** (`{so_don}` số đơn, `{loai_don}`, `{ngay_xuat}`) điền một lần, vd tiêu đề, dòng tổng.
  `so_don` cũng là mã dành riêng, không đặt làm mã câu hỏi được.
- Câu hỏi dạng bảng có hai cách đặt trong mẫu:
  - **Mỗi cột một ô** (file mẫu dựng sẵn làm vậy): đặt `{<mã cột>}` ở hàng mẫu. Đơn có bảng n dòng thì **chiếm n hàng**: mỗi hàng điền một dòng của bảng,
    các ô còn lại của đơn (mã đơn, họ tên, tổng…) **gộp dọc** n hàng. Đơn không có dòng nào thì chiếm một hàng, ô của bảng để trống.
    Đơn có nhiều bảng thì số hàng theo bảng dài nhất; bảng ngắn hơn để trống phần còn lại. `{<mã bảng>_stt}` là số thứ tự dòng của bảng (đánh lại từ 1 ở mỗi đơn), như mẫu Word.
  - **Cả bảng một ô**: đặt `{<mã bảng>}`, mỗi dòng của bảng một dòng trong ô, vd "1. Triết học · 3".
  - Cả hai cách đều có `{so_<mã bảng>}`, `{tong_<mã cột>}` như mẫu Word.
- **File mẫu dựng sẵn** có đầu cột hai tầng: cột thường gộp dọc hai hàng; câu hỏi dạng bảng là ô gộp ngang trên các cột của nó, STT của bảng và tên từng cột nằm ở tầng dưới.
  Cột tổng (`{tong_<mã cột>}`) đứng sau bảng, thuộc cả đơn nên cũng gộp dọc.
- Ô chỉ có một mã mà giá trị là số (vd `{stt}`, `{tong_cac_mon_xin_mien_so_tin_chi}`) được điền thành số, để Excel tính toán được.
- Công thức trong mẫu không tự giãn theo số hàng chèn thêm; nên đặt dòng tổng bằng mã `{so_don}` hoặc tự viết công thức sau khi xuất.

## Thống kê ở trang Quản lí đơn

- Theo trạng thái (số đơn và % của từng trạng thái) và theo loại đơn (vành khuyên: 5 loại nhiều đơn nhất mỗi loại một màu, còn lại gộp "Khác" màu xám, bấm để xem; lát từ 10% ghi phần trăm trên hình, số đơn và phần trăm đủ ở chú thích). Máy chủ đếm.
- Theo tình trạng hạn: vành khuyên, dưới khung Theo trạng thái, đủ 6 tình trạng (kể cả chưa có đơn), màu như nhãn ở bảng.
- Đếm trên **tất cả** đơn, không đổi theo ô tìm kiếm / bộ lọc. Bấm một mục để lọc bảng theo mục đó; bấm lại để bỏ lọc.

## Thống kê câu trả lời của loại đơn

Thẻ **Thống kê** ở trình soạn loại đơn (cạnh Soạn, Xem trước; chỉ loại đơn đã lưu), kiểu Google Form. Cần quyền `manageFormTypes`.
API `GET /form-types/:formTypeId/stats`; máy chủ đếm và chia nhóm bằng `computeFormTypeAnswerStats` (`shared/src/business-rules/form-types--answer-stats.ts`), API giả dùng cùng hàm.

- **Điều kiện** chỉ quyết định đơn nào được đếm: phiên bản (Tất cả hoặc một phiên bản đã phát hành), khoảng ngày nộp (tính cả hai đầu), trạng thái (bấm nhiều nút được; không chọn = mọi trạng thái).
  Số trên các nút trạng thái đếm theo phiên bản và ngày nộp, chưa lọc trạng thái.
- **Gộp phiên bản**: các phần, câu hỏi theo thứ tự của phiên bản mới nhất; phần, câu chỉ có ở phiên bản cũ chen vào sau phần, câu đứng trước nó. Câu trùng id là một câu (tên, bắt buộc, lựa chọn lấy theo phiên bản mới nhất).
  Câu chỉ có ở một số phiên bản thì ghi "Chỉ có ở phiên bản …" và chỉ tính đơn của các phiên bản đó. Cột bảng gộp theo tên cột. Bỏ khối thông báo.
- Mỗi câu hỏi ghi số đơn có trả lời / số đơn có câu này, rồi thống kê theo loại:
  - **Chọn một, Danh sách thả xuống**: vành khuyên, phần trăm trên số đơn trả lời. **Chọn nhiều**: cột ngang, phần trăm trên số đơn trả lời (tổng có thể quá 100%).
    Lựa chọn theo thứ tự soạn (kể cả lựa chọn chưa ai chọn), rồi các giá trị khác (vd lựa chọn của phiên bản cũ), nhiều trước.
  - **Số**: nhỏ nhất, trung bình, lớn nhất và cột đứng. Không quá 10 giá trị khác nhau (nguyên hay lẻ): mỗi giá trị một cột.
    Còn lại chia đều, tối đa 8 nhóm, độ rộng tròn (…, 0,5, 1, 2, 5, 10…), mốc đầu là bội của độ rộng (vd 0–4, 5–9; số lẻ ghi 5–6 = từ 5 tới dưới 6).
  - **Ngày**: sớm nhất, muộn nhất và cột đứng theo khoảng từ ngày sớm nhất tới muộn nhất: dưới 2 tuần theo ngày · dưới 2 tháng theo tuần (tuần lịch, cột ghi thứ Hai đầu tuần) · dưới 2 năm theo tháng (T6/26) · từ 2 năm theo năm. Không có nhóm "Trước …"; nhóm 0 ở giữa vẫn hiện.
  - **Trả lời ngắn**: gộp câu trùng (không phân biệt hoa thường, bỏ khoảng trắng thừa), nhiều trước; hiện 4 câu, "Xem thêm" mở tới 50 câu.
  - **Đoạn văn**: 20 câu mới nhất kèm mã đơn (bấm để mở đơn), ngày nộp; hiện 3 câu. Xem đủ thì dùng Xuất danh sách đơn.
  - **Tải tệp**: tổng số tệp, trung bình mỗi đơn, tỉ lệ theo đuôi tệp.
  - **Bảng nhiều dòng**: số dòng, trung bình mỗi đơn; mỗi cột thống kê như câu hỏi cùng kiểu (cột Chọn: phần trăm trên số dòng có điền).

## Cấu hình email

- Chỉ cấu hình phía **gửi**: tên người gửi, chữ kí. Địa chỉ gửi lấy từ cấu hình SMTP của máy chủ, chỉ hiện ra. Bấm "Trả lời" thì thư về địa chỉ gửi.
- **Bảy lúc gửi** (`EMAIL_EVENT_KINDS`, `shared/src/aux-schema/email--events.ts`), mỗi lúc một tab, bật / tắt riêng, có tiêu đề và nội dung riêng; tab ghi rõ người nhận:

  | Nhóm | Lúc gửi | Người nhận |
  |---|---|---|
  | Thư cho sinh viên | Đã nộp, Cần bổ sung, Từ chối, Đã duyệt | người nộp đơn |
  | Thư cho cán bộ | Nhắc sắp tới hạn, Nhắc quá hạn | người xử lí đơn; đơn chưa tiếp nhận (chưa có người xử lí) thì mọi Admin |
  | | Được chuyển giao | người nhận đơn (người xử lí mới) |

- Mã chèn vào thư (`shared/src/business-rules/email--tags.ts`): `{ho_ten}`, `{ma_don}`, `{loai_don}`, `{ngay_nop}`, `{han_xu_li}` (hạn xử lí; "Không giới hạn", hoặc "Chưa có, chờ bổ sung"),
  `{nguoi_xu_li}`, `{nguoi_chuyen_giao}`, `{ly_do}`, `{link_don}`, `{chu_ki}`.
- Có xem trước bằng dữ liệu mẫu và gửi thư thử.
- Cấu hình lưu ở một dòng JSON. Cấu hình đã lưu kiểu cũ (bốn lúc gửi, mỗi thư ghi `status`) đọc bằng `withAllEmailEvents`: giữ bốn thư cũ, tự thêm ba thư cho cán bộ mặc định, không cần migration.
- **Thư tự động**, theo tiêu đề, nội dung của lúc gửi đó; đang tắt thì không gửi. Thư gửi sau khi đơn đã lưu; gửi lỗi chỉ ghi log, không làm hỏng việc nộp đơn, ra quyết định, chuyển giao.
  - Nộp đơn xong (Đã nộp), ra quyết định xong (Cần bổ sung, Từ chối, Đã duyệt): gửi người nộp đơn. Tiếp nhận, sửa đơn không gửi thư.
  - Chuyển giao xong: thư Được chuyển giao gửi người nhận đơn, `{nguoi_chuyen_giao}` là người bấm chuyển giao.
  - **Thư nhắc**: backend tự kiểm **mỗi 10 phút** (`api/src/email/deadline-reminder.service.ts`), chỉ gửi **từ 07:00** (đơn tới lúc nhắc trong đêm thì 07:00 mới gửi).
    Đơn đang có hạn chạy (Đã nộp, Đang xét, Đã bổ sung; Cần bổ sung thì đồng hồ dừng, không nhắc) mà Sắp tới hạn thì gửi Nhắc sắp tới hạn, Quá hạn thì gửi Nhắc quá hạn.
    **Mỗi đơn, mỗi loại thư gửi một lần cho mỗi hạn**: hạn đã nhắc ghi ở cột `Form.dueSoonRemindedFor` / `overdueRemindedFor`, nên kiểm lại hay restart backend không gửi trùng;
    hạn lùi vì bổ sung thì khác hạn đã ghi, nhắc lại theo hạn mới. Gửi lỗi thì không ghi, lần kiểm sau gửi lại. Lúc gửi đang tắt thì coi như đã nhắc (bật lại không gửi bù cho hạn đó).
    Seed dev coi các đơn mẫu đang Sắp tới hạn / Quá hạn là đã nhắc, để bật dev không gửi cả loạt thư.
  - `{link_don}` dựng từ `WEB_BASE_URL_DEV` khi `APP_ENV=dev`, còn lại `WEB_BASE_URL_PRODUCTION`; thư thử cũng vậy.
  - Bản giả `dev-email` (`ENABLE_DEMO_APIS=true`, không có `dev-email` trong `ALWAYS_REAL_APIS`): mọi thư tự động gửi về `DEV_EMAIL_REDIRECT_TO` thay vì người nhận thật
    (nhiều người nhận vẫn chỉ một thư; bỏ trống thì chỉ in ra console), để không gửi nhầm tới email của người dùng mẫu. Bản thật gửi tới người nhận thật, mỗi người một thư.
- Backend: bảng `EmailSettings` (một dòng), module `api/src/email/`. Máy chủ thư đặt ở `.env.dev` / `.env.prod` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` là địa chỉ gửi, `SMTP_PASSWORD`).
  Chưa đặt `SMTP_HOST` thì chưa gửi được thư; riêng bản giả `dev-email` thì thư in ra console thay vì gửi đi.

## Sao lưu

- Trang **Sao lưu** (`#/cau-hinh/sao-luu`, chỉ Admin). Mỗi bản sao lưu luôn gồm **cả database lẫn tệp tải lên**, là một tệp `sao-luu-<YYYYMMDD-HHmmss>.tar.gz`
  chứa `manifest.json`, `database.dump` (`pg_dump` dạng custom, khôi phục bằng `pg_restore`) và thư mục `uploads/`.
- **Nơi lưu**: thư mục trên máy chủ (thư mục con trong `BACKUP_DIR`, không ra ngoài được) hoặc Google Drive (trong hộp thêm / sửa nơi lưu, Admin bấm
  **Kết nối Google**, chọn tài khoản, thấy email rồi mới bấm Lưu; chưa kết nối thì không lưu được. Bản giả `dev-google-drive-connect` không qua Google: gõ email bất kì,
  sao lưu vào đó báo lỗi trong lịch sử vì không có quyền thật. Bản thật mở cửa sổ popup sang Google; chọn tài khoản, đồng ý xong thì Google chuyển về
  `/api/backups/google-drive/callback`, máy chủ đổi mã lấy refresh token, trang đó báo email về hộp thoại rồi tự đóng; bấm Hủy hoặc lỗi thì hộp thoại báo lỗi.
  Kết nối chỉ người bấm dùng được, giữ 30 phút trong bộ nhớ máy chủ (khởi động lại backend thì phải kết nối lại);
  cổng chỉ xin quyền `drive.file`: chỉ thấy tệp do chính nó tạo và thư mục Admin chọn. Ô thư mục kiểu hộp "Lưu thành…": **Lưu vào** (mặc định My Drive;
  nút **Chọn…**: máy chủ cấp access token ngắn hạn của tài khoản đó (`POST /backups/google-drive/picker`), giao diện mở **Google Picker**
  (cửa sổ duyệt Drive của Google, chỉ hiện thư mục); thư mục chọn được cấp cho cổng, nên cổng lưu thẳng vào thư mục có sẵn) và **Thư mục mới bên trong**
  (không bắt buộc: Picker không tạo được thư mục, nên gõ tên ở đây, bấm Lưu thì máy chủ tạo thư mục đó bên trong chỗ lưu rồi lưu vào đó).
  Dòng "Sẽ lưu vào: …" cho thấy trước kết quả. Bấm Lưu thì máy chủ hỏi Drive xem mở được thư mục không, lấy tên thật;
  không mở được (đã xóa, chọn bằng tài khoản khác) thì báo chọn lại. Đổi tài khoản thì chỗ lưu về My Drive. Tài khoản kết nối bằng bản giả thì
  không có Picker, gõ tên thư mục bất kì; thư mục mới là thư mục giả, không gọi Google. Thẻ Nơi lưu có đường dẫn ↗ mở thẳng thư mục trên Drive; thư mục bị xóa hoặc mất quyền thì lần sao lưu sau báo lỗi
  trong lịch sử, sửa nơi lưu chọn lại). Mỗi nơi lưu đặt **giữ N bản gần nhất**:
  sau mỗi lần sao lưu thành công vào đó, bản cũ hơn bị xóa (lịch sử vẫn ghi, đánh dấu đã xóa). Hai nơi lưu không được dùng chung thư mục
  (thư mục máy chủ theo đường dẫn, Drive theo thư mục đã chọn; hai thư mục Drive khác nhau cùng tên thì được).
  Bỏ nơi lưu: lịch không lưu vào đó nữa, bản đã lưu và lịch sử giữ nguyên.
- **Sao lưu ngay** (popup): chọn **một hoặc nhiều nơi lưu** (một tệp, chép vào từng nơi, mỗi nơi một dòng lịch sử), hoặc **Tải về máy này**
  (tạo bản rồi tải thẳng về trình duyệt, không giữ trên máy chủ; lịch sử: Đang chạy từ lúc bấm, trình duyệt nhận đủ tệp thì Thành công, đứt giữa chừng thì Lỗi; trang không biết người dùng bấm Hủy ở hộp lưu của trình duyệt). Tải về đi một mình: tích ô này thì các nơi lưu bị khóa. Nơi lưu Drive chưa kết nối không chọn được;
  gửi lên vẫn có thì cả lần bị từ chối (409). Mỗi lúc chỉ chạy một bản; đang chạy thì bấm lại báo 409. Bản lưu ở thư mục máy chủ có nút Tải về trong lịch sử, bản trên Google Drive có nút Mở trên Drive (mở tệp trên Drive ở thẻ mới); bản đã bị xóa vì quá số bản giữ lại thì không có.
- **Lịch định kì**: một danh sách lịch (thêm, sửa, bỏ). Mỗi lịch: bật / tắt, hằng ngày hoặc hằng tuần (thứ mấy), giờ chạy theo giờ Việt Nam,
  lưu vào một hoặc nhiều nơi (một tệp, chép vào từng nơi; nơi nào lỗi thì chỉ dòng đó lỗi). Nhiều lịch trúng cùng một phút thì chạy chung một lần,
  lưu vào mọi nơi của các lịch đó. "Lần tới" là lần sớm nhất trong các lịch đang bật. Backend kiểm mỗi 30 giây; tắt đúng phút chạy thì lần ấy bỏ qua; khởi động lại trong cùng phút không chạy trùng.
  Bản thật mặc định (seed:production, chỉ thêm khi chưa có nơi lưu lẫn lịch nào): một nơi lưu "Trên máy chủ" (`hang-ngay`, giữ 14 bản), một lịch 02:00 hằng ngày, **tắt sẵn** (Admin tự bật, không tự sao lưu khi chưa ai biết).
- **Trước cập nhật**: mỗi lần đưa phiên bản mới lên (CI/CD, `docker/deploy.sh`), trước khi đổi bản cổng tự sao lưu một bản vào **mọi nơi lưu kiểu thư mục trên máy chủ**
  (không lưu lên Drive), giữ N bản như thường. Đang có lần khác chạy thì chờ xong. Chưa có nơi lưu kiểu này thì bỏ qua (chỉ cảnh báo trong log deploy); sao lưu lỗi thì không cập nhật.
  Chạy ngoài backend (lệnh `backup-before-update` trong container api), nên "mỗi lúc chỉ chạy một bản" kiểm cả lần đang chạy ghi trong database.
- Giao diện: lịch sử bên trái; khung "Lịch và nơi lưu" bên phải (hẹp thì trượt ra từ bên phải) gồm hai mục thu gọn được kiểu VS Code, mỗi mục có nút + để thêm.
- **Lịch sử**: mỗi lần sao lưu vào mỗi nơi một dòng: lúc bắt đầu, nơi lưu (tên chép lại lúc chạy), cách chạy (Bấm tay · tên người bấm / Định kì / Trước cập nhật), dung lượng,
  tình trạng (Đang chạy / Thành công / Lỗi kèm câu lỗi / Đã xóa vì quá số bản giữ). Bảng phân trang ở máy chủ (`GET /backups/runs`, 10 dòng mỗi trang),
  tìm kiếm (cả câu lỗi), Sắp xếp, Lọc như các bảng khác; mặc định mới nhất trước.
  Backend tắt khi đang sao lưu thì lần đó ghi lỗi lúc bật lại.
- Google Drive: refresh token lưu mã hóa (khóa băm từ `GOOGLE_CLIENT_SECRET`), không trả về giao diện; đổi bí mật hoặc thu hồi quyền thì phải kết nối lại.
  Cần thêm redirect URI `<địa chỉ cổng>/api/backups/google-drive/callback` vào OAuth client, bật Google Drive API, Google Picker API
  và tạo API key `GOOGLE_PICKER_API_KEY` (README, mục Đăng nhập Google).
- Khôi phục từ bản sao lưu: chưa làm.
- Backend: bảng `BackupTarget`, `BackupSchedule` (một dòng), `BackupRun`, module `api/src/backups/`. Image api cài sẵn `pg_dump` 18 (khớp PostgreSQL).

## Quy ước màu

Biến màu ở `web/src/styles/tokens.css`. Màu chủ đạo là **xanh da trời** (`--accent`); xanh lá chỉ dùng cho trạng thái Đã duyệt.

| Thành phần | Quy tắc |
|---|---|
| Chữ | Chỉ tiêu đề lớn (tên cổng, tiêu đề trang, khung, nhóm, popup) và tên trường mang màu xanh. Chữ khác dùng màu chữ chính; nhãn, gợi ý dùng xám. |
| Bấm được | Luôn có **nền đặc**. Nút chính và mọi nút trên phần đầu khung: nền xanh. Nút khác: nền xám. Yêu cầu bổ sung / Từ chối / Duyệt dùng màu trạng thái. Không dùng nút viền rỗng. |
| Không bấm được | **Nền rỗng, chỉ viền**: nhãn trạng thái, nhãn vai trò, nhãn "Bạn", số thứ tự mục. |
| Trạng thái | Đã nộp xanh lơ · Đang xét xanh dương · Cần bổ sung vàng · Đã bổ sung tím · Đã duyệt xanh lá · Từ chối đỏ (`--s-<mã>-bg` / `--s-<mã>-fg`). Chỉ dùng cho nhãn trạng thái, khung thông báo và 3 nút ra quyết định. |
| Vai trò | Chỉ hiện ở Quản lí tài khoản: Người nộp đơn xám, Người xử lí đơn xanh nhạt, Admin xanh đậm. |
