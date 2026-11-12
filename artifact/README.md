# Quy ước tag JUST FOR DEMO

Mọi đoạn code chỉ dùng cho bản mẫu được bọc trong tag `JUST FOR DEMO`.
Khi viết code thật, **bỏ qua / gỡ toàn bộ các khối này**. Code mới chỉ dùng cho demo cũng phải bọc tag như vậy.

## Định dạng

| Loại file | Mở khối | Đóng khối |
|---|---|---|
| HTML | `<!-- JUST FOR DEMO: START · mô tả -->` | `<!-- JUST FOR DEMO: END -->` |
| JS / CSS | `/* JUST FOR DEMO: START · mô tả */` | `/* JUST FOR DEMO: END */` |

Phần "mô tả" ghi đoạn đó làm gì và bản thật thay bằng gì.

## Tìm và gỡ

Tìm tất cả: `grep -rn "JUST FOR DEMO" .`

Gỡ tự động:

```python
import re, glob
for p in glob.glob('**/*.*', recursive=True):
    if not p.endswith(('.js', '.css', '.html')): continue
    s = open(p, encoding='utf-8').read()
    s = re.sub(r'<!-- JUST FOR DEMO: START.*?<!-- JUST FOR DEMO: END -->', '', s, flags=re.S)
    s = re.sub(r'/\* JUST FOR DEMO: START.*?/\* JUST FOR DEMO: END \*/', '', s, flags=re.S)
    open(p, 'w', encoding='utf-8').write(s)
```

# Đăng nhập và thông tin tài khoản

- **Đăng nhập bằng tài khoản Google của trường** (nút "Đăng nhập bằng email trường"). Chỉ chấp nhận email thuộc
  `SCHOOL_EMAIL_DOMAINS` trong `js/config.js` (hiện là `hcmulaw.edu.vn`, tính cả tên miền con như `...@student.hcmulaw.edu.vn`).
  **Cần xác nhận lại tên miền email thật** của sinh viên và cán bộ. Bản thật: giới hạn tên miền ngay khi gọi Google OAuth và máy chủ kiểm tra lại.
- **Bổ sung thông tin lần đầu:** chỉ **Họ và tên** bắt buộc. CCCD và số điện thoại không bắt buộc, có nhập thì phải đúng định dạng;
  bỏ trống thì trang thông tin hiện "—" và có thể bổ sung sau bằng nút Sửa thông tin.
- **Tạo tài khoản ở trang Quản lí tài khoản:** email cũng phải là email trường.
- **Thông tin sinh viên** (MSSV, Lớp, Hình thức đào tạo, Ngành, Khóa học hiện tại, Khóa học gốc; khóa gốc khác khóa hiện tại khi sinh viên bảo lưu hoặc học lại khóa sau; mã xuất file `{khoa_hoc}` · `{khoa_hoc_goc}`): lấy từ **database trường**, chỉ xem, không sửa trên cổng này.
  Hiện thành một phần riêng trong thẻ "Thông tin cá nhân". Một email trường có thể gắn với **nhiều MSSV** (vd học thêm văn bằng 2;
  MSSV trùng phần trước @ của email đứng đầu). Trang thông tin chỉ hiện **MSSV chính**: mặc định MSSV đầu, người dùng đổi được.
  MSSV chính cũng là thông tin điền vào file Word khi xuất đơn. Có ít nhất 1 MSSV thì có nút **Thông tin sinh viên** (cạnh "Sửa thông tin", giống nút "Thông tin đơn"), mở khung "Thông tin sinh viên"
  trượt từ phải ra: liệt kê mọi MSSV, MSSV chính có nhãn "Đang dùng", bấm MSSV khác để chọn. Chỉ chính người đó hoặc Admin đổi được; người khác chỉ xem.
  Trong một hàng, các mục đi cùng nhau: có ít nhất 1 mục thì hiện đủ tất cả, mục trống ghi "—" (giống SĐT, CCCD; database trường có MSSV thiếu ngành, khóa hoặc lớp).
  Không có MSSV nào (ví dụ tài khoản cán bộ) thì ẩn cả phần, không báo lỗi. Danh sách mục khai báo ở `STUDENT_FIELDS` (`js/config.js`),
  dữ liệu nằm ở `person.students` (người khác) và `state.students` (người đăng nhập), đều là danh sách; MSSV chính ở `person.mainMssv` / `state.mainMssv`.

# Câu thông báo trên trang chi tiết đơn

Khung thông báo nằm dưới phần thông tin chung của đơn. Màu khung theo trạng thái.
Nội dung **giống nhau với mọi vai trò**, không đổi theo người xem.
Khai báo trong `STATUS_MSG` ở `js/application-form.js`.

| Trạng thái | Câu thông báo |
|---|---|
| Đã nộp (`nop`) | Đơn đã được gửi, đang chờ phòng Đào tạo tiếp nhận. Người nộp đơn được quyền chỉnh sửa đến khi đơn được tiếp nhận. |
| Đang xét (`xet`) | Phòng Đào tạo đang xét đơn. |
| Cần bổ sung (`bs`) | Phòng Đào tạo yêu cầu bổ sung hồ sơ. Sau khi người nộp đơn sửa và lưu, đơn chuyển sang “Đã bổ sung”. |
| Đã bổ sung (`bsg`) | Người nộp đơn đã bổ sung lúc `<giờ · ngày>`, đang chờ phòng Đào tạo tiếp nhận lại. Người nộp đơn được quyền chỉnh sửa đến khi đơn được tiếp nhận. |
| Đã duyệt (`duyet`) | Đơn đã được duyệt. |
| Từ chối (`tc`) | Đơn đã bị từ chối. |

Dòng **“Phòng Đào tạo: `<lí do>`”** chỉ hiện thêm khi người xử lí đơn có nhập lí do lúc bấm
Yêu cầu bổ sung hoặc Từ chối (lí do không bắt buộc). Không nhập thì không có dòng này.
Lí do được xóa khi đơn được tiếp nhận lại, và khi bấm Duyệt.

# Loại đơn và trình soạn form (kiểu Google Form)

Mỗi **loại đơn** là một form: gồm các **phần** (mỗi phần là một khung), trong phần là các **câu hỏi**.
Người xử lí đơn và Admin (quyền `manageForms`) tạo và sửa loại đơn ở trang **Quản lí loại đơn** (`#quan-li-loai-don`, code ở `js/forms-page.js`).
"Xét miễn môn" là loại đơn đầu tiên, sửa được bằng giao diện như mọi loại đơn khác.

## Trang Quản lí loại đơn

- Bảng các loại đơn: tên, mã đơn, trạng thái, cập nhật lúc, người cập nhật. Bấm vào dòng để soạn.
- **Tìm kiếm, Sắp xếp, Lọc** dùng bộ công cụ bảng chung `createTableTools()` (`js/table-tools.js`, cột khai báo ở `FM_FIELDS`).
  Mặc định xếp theo trạng thái (Đang mở → Nháp → Đã đóng, qua thuộc tính `order` của cột) rồi theo tên.
- **+ Tạo loại đơn** mở trình soạn với một phần và một câu hỏi trống.

## Trình soạn (`#soan-don-<mã>`, tạo mới: `#soan-don-moi`)

- **Thông tin loại đơn:** tên, mã đơn (2–5 chữ in hoa, không trùng; khóa khi đã có đơn), tiêu đề trên form, mô tả ngắn,
  trạng thái **Nháp** (người nộp đơn chưa thấy) / **Đang mở** (nhận đơn) / **Đã đóng** (không nhận đơn mới; đơn đã nộp vẫn xử lí).
- **Phần:** tiêu đề, mô tả, công tắc **Nội dung chính** (hiện trong xem nhanh), đổi thứ tự ↑ ↓, xóa.
- **Câu hỏi:** nội dung, loại câu hỏi, mô tả, công tắc **Bắt buộc**, đổi thứ tự, nhân bản, xóa.
- Tab **Xem trước** vẽ form đúng như người nộp đơn thấy, thử điền và kiểm tra được, không lưu gì.
- **Lưu** kiểm tra rồi ghi vào `TYPES`. Bản đang soạn được giữ lại (nhãn "Chưa lưu") khi đi trang khác; **Bỏ thay đổi** để quay về bản đã lưu.
  Loại đơn chưa có đơn nào thì có nút **Xóa loại đơn**.

## Các loại câu hỏi (`QTYPES` trong `js/sections.js`)

| Loại | Câu trả lời lưu | Cài đặt riêng |
|---|---|---|
| Trả lời ngắn, Đoạn văn, Số, Ngày | chữ / số | — |
| Chọn một, Chọn nhiều, Danh sách thả xuống | chữ / mảng chữ | danh sách lựa chọn |
| Tải tệp | mảng tên tệp | định dạng cho phép (PDF, ảnh JPG/PNG, Word, Excel), dung lượng tối đa |
| Bảng nhiều dòng | mảng các dòng, mỗi dòng là mảng theo thứ tự cột | các cột (tên, mô tả nhỏ, kiểu Chữ/Số, tính tổng), tên gọi mỗi dòng |
| Khối thông báo | không có | tiêu đề + nội dung hướng dẫn |

Bảng môn của Xét miễn môn chính là một câu hỏi **Bảng nhiều dòng** (4 cột, cột Số tín chỉ có tính tổng).
Độ rộng mỗi cột của bảng co giãn theo độ dài tên cột (tối thiểu 7, tối đa 24 ký tự; `COL_MIN`, `COL_MAX` trong `js/sections.js`);
tên cột dài hơn thì tự xuống dòng. Bảng rộng hơn khung thì cuộn ngang.

## Cách lưu (`TYPES` trong `js/config.js`)

```js
TYPES.xmm = { name, desc, prefix:"XMM", status:"open", updatedAt, updatedBy,   // name: tên duy nhất của loại đơn, dùng cả làm tiêu đề trang đơn
  sections:[ { id, title, hint, main:true,
    questions:[ { id:"mon", type:"table", label, help, required:true, rowName:"môn", columns:[…] } ] } ] }
```

Câu trả lời của đơn lưu theo **id câu hỏi**: `a.data[<id câu hỏi>]` (vd `a.data.mon`, `a.data.files`).
Nộp đơn: nút **+ Nộp đơn mới** luôn mở hộp **Chọn loại đơn** (kể cả khi chỉ có một loại): danh sách các loại đơn **Đang mở** xếp theo tên, có ô tìm kiếm (tên, mã đơn, mô tả; không dấu cũng được), dùng ↑ ↓ và Enter để chọn bằng bàn phím.
Mã đơn lấy theo `prefix` của loại đơn. Quy trình xử lí (Tiếp nhận → Yêu cầu bổ sung / Duyệt / Từ chối) **dùng chung** cho mọi loại đơn.

**Lưu ý — sửa form khi đã có đơn:** bản mẫu chưa có phiên bản form. Đơn cũ hiện theo form mới nhất; câu hỏi bị xóa thì câu trả lời cũ
không hiện nữa (dữ liệu vẫn giữ trong đơn). Trình soạn hiện cảnh báo khi loại đơn đã có đơn. Bản thật nên lưu **phiên bản form**
mỗi lần lưu, và mỗi đơn ghi lại phiên bản lúc nộp.

## Một giao diện, bốn nơi dùng

Hàm `renderSections()` vẽ các phần và câu hỏi; mỗi loại câu hỏi chỉ viết một lần trong `QUESTION_UI`:

| Nơi hiện | Chế độ | Các phần được vẽ |
|---|---|---|
| Trang nộp đơn mới | Sửa được | Tất cả |
| Trang chi tiết đơn | Sửa được hoặc chỉ xem (theo trạng thái và quyền) | Tất cả |
| Xem nhanh (dropdown ›) | Luôn chỉ xem | Chỉ các phần **Nội dung chính** |
| Tab Xem trước của trình soạn | Thử điền, không lưu | Tất cả |

Thêm loại câu hỏi mới: khai báo trong `QTYPES` và viết `QUESTION_UI.<loại>(box, q, value, readonly)` trả về `{get(), check()}`,
rồi thêm phần cài đặt riêng (nếu có) vào `typeEditor()` trong `js/forms-page.js`.

Xem lại tệp (`js/file-preview.js`): ảnh hiện trực tiếp; PDF dựng bằng pdf.js; **Excel (.xls, .xlsx) đọc bằng SheetJS**,
mỗi trang tính một tab, hiện tối đa 300 dòng đầu; Word (.docx) dựng bằng docx-preview; .doc cũ chưa xem được, có nút tải về. Thư viện chỉ tải khi mở tệp.

# Xuất file theo mẫu Word (`js/print-templates.js`)

Cán bộ soạn mẫu bằng Word, gõ **mã trường** trong ngoặc nhọn vào chỗ cần điền (vd `{ho_ten}`, `{mssv}`), rồi tải file `.docx` lên ở khung **Mẫu xuất file** trong trình soạn loại đơn.
Ở trang chi tiết đơn, nút **Xuất file** (hiện khi loại đơn có mẫu xuất file; nhiều mẫu thì chọn mẫu) điền dữ liệu của đơn vào mẫu và tải về file Word.

- Thư viện: **docxtemplater** + **PizZip** (tải từ jsDelivr khi bấm Xuất file / Kiểm tra lần đầu). Định dạng của mẫu (font, bảng, căn lề) giữ nguyên.
- **Mã trường chung** (mọi loại đơn): thông tin người nộp đơn và thông tin đơn, xem `COMMON_TAGS`. Ngày nộp tách thêm `{ngay}` `{thang}` `{nam}` để viết "ngày … tháng … năm …".
- **Mã câu hỏi**: ô "Mã dùng trong file Word" của từng câu hỏi (`q.tag`); bỏ trống thì lấy theo nội dung câu hỏi bỏ dấu (`Tệp bảng điểm` → `tep_bang_diem`).
  Lưu loại đơn sẽ báo lỗi nếu mã sai dạng, trùng nhau hoặc trùng mã chung. Chọn nhiều → nối bằng dấu phẩy; tệp → tên tệp; ngày → dd/mm/yyyy.
- **Câu hỏi dạng bảng — vòng lặp `{#…}` … `{/…}`**: mã cột lấy theo tên cột, và phải nằm **giữa** `{#mã bảng}` và `{/mã bảng}`.
  - `{#mon}` mở vòng lặp, `{/mon}` đóng vòng lặp: phần ở giữa được lặp lại cho mỗi dòng của bảng trong đơn.
  - Lặp **dòng bảng Word**: đặt `{#mon}` ở ô đầu và `{/mon}` ở ô cuối của cùng một dòng, vd `{#mon}{stt} | {mon_hoc_cua_truong} | {so_tin_chi} | … | {co_so_dao_tao}{/mon}`.
  - Lặp **đoạn văn**: đặt `{#mon}` … `{/mon}` quanh đoạn, vd `{#mon}- {mon_hoc_cua_truong} ({so_tin_chi} tín chỉ){/mon}`.
  - Trong vòng lặp có thêm `{stt}` (số thứ tự). Ngoài vòng lặp: `{so_<mã bảng>}` (số dòng), `{tong_<mã cột>}` (tổng cột có tính tổng).
  - Mã cột đặt ngoài vòng lặp sẽ để trống; nút **Kiểm tra** báo lỗi này.
- **Giao diện khung Mẫu xuất file**: 3 bước (Soạn file Word → Tải lên → Xuất file) kèm ví dụ trước/sau; danh sách mẫu đã tải lên;
  **Bảng mã** gồm 3 cột *Gõ vào file Word* · *Sẽ được điền bằng* · *Ví dụ* (lấy từ một đơn đã nộp, chưa có đơn thì dữ liệu giả). Bấm vào mã để sao chép.
  Câu hỏi dạng bảng có hình bảng mẫu (dòng chứa `{#mon}` … `{/mon}`) và nút "Sao chép bảng mẫu" — dán vào Word thành bảng thật (sao chép dạng HTML).
  Trong trình soạn câu hỏi, mỗi cột của câu hỏi bảng hiện mã của cột ngay dưới tên cột.
- Mỗi lần mở trình soạn, khung **Mẫu xuất file** và mọi mục thu gọn bên trong (Cách tạo một mẫu, các nhóm trong Bảng mã) đều ở trạng thái đóng; trong lúc soạn, mục nào đang mở vẫn giữ nguyên khi trình soạn vẽ lại.
- **Tải mẫu lên**: nút "+ Tải mẫu lên" ở đầu mục Mẫu đã tải lên; chọn file .docx là thêm mẫu ngay (tên mẫu = tên file) và tự chạy Kiểm tra mã. **Đổi tên** sửa tên ngay tại dòng (Enter lưu, Esc hủy); tên này hiện trong menu chọn mẫu khi bấm Xuất file.
- **Xem mẫu** (hoặc bấm vào tên mẫu): mở file mẫu gốc còn nguyên các mã trong khung xem, có nút **Tải mẫu gốc**.
- **Kiểm tra**: báo mã không có trong loại đơn (khi xuất sẽ để trống) và lỗi ngoặc. **Xuất thử**: điền bằng đơn đầu tiên của loại đơn, chưa có đơn thì bằng dữ liệu giả.
- Đổi tên câu hỏi / tên cột khi chưa đặt mã riêng thì **mã đổi theo** → bấm Kiểm tra lại các mẫu xuất file.
- Mẫu xuất file lưu ngay khi tải lên (không cần bấm Lưu loại đơn), giữ trong bộ nhớ `PRINT_TEMPLATES[mã loại đơn]` — tải lại trang là mất (trừ mẫu demo).
- **Xem trước trước khi tải**: bấm Xuất file (hoặc Xuất thử) → mở khung xem trang Word đã điền, nút **Tải file Word** trên thanh xem.
  Dựng bằng **docx-preview 0.3.7** + **JSZip** (tải khi cần, `previewDocx()` trong `js/file-preview.js`). Bản xem là gần đúng: font thay thế nếu máy không có
  (vd Times New Roman), ngắt trang chỉ theo ngắt trang đặt sẵn. Màn hình hẹp thì trang được thu nhỏ cho vừa. Tệp Word (.docx) sinh viên tải lên cũng xem được bằng cách này.
- Chỉ ra file **Word**. Muốn ra PDF cần máy chủ chuyển đổi (vd LibreOffice `soffice --convert-to pdf`).

Bản thật: lưu file mẫu ở máy chủ (theo loại đơn), có thể lưu lại bản đã xuất kèm đơn.
Mẫu demo: `js/sample-template.js` (file `mau-don-xet-mien-mon.docx` mã hóa base64).

# Thống kê ở trang Quản lí đơn

Đầu trang Quản lí đơn có 2 khung (`renderStats()` trong `js/applications-page.js`):
- **Theo trạng thái**: tổng số đơn, thanh tỉ lệ nhiều màu, 6 ô (số đơn và % của từng trạng thái).
- **Theo loại đơn**: biểu đồ cột vẽ bằng HTML/CSS (`typeChart()`), trục x là tên loại đơn (nhãn nghiêng 35°, dài quá thì cắt "…", rê chuột xem đủ), trục y là tỉ lệ 0–100% trên tổng số đơn (vạch 0 · 25 · 50 · 75 · 100%), cột cao theo % của loại đó; trên đầu cột ghi % (đậm) và số đơn thật bên dưới, vd "68%" / "25 đơn". Loại đơn Nháp / Đã đóng có cột màu nhạt và ghi kèm sau tên. Nhiều loại đơn thì biểu đồ cuộn ngang. Bấm một cột để lọc bảng theo loại đó.
- Số liệu đếm trên **tất cả** đơn, không thay đổi theo ô tìm kiếm / bộ lọc.
- Bấm một ô trạng thái hoặc một loại đơn: lọc bảng bên dưới theo mục đó (thay điều kiện lọc cùng cột trong nút Lọc); bấm lại để bỏ lọc. Mục đang lọc được tô viền.
- Bản thật: số liệu nên lấy từ API thống kê của máy chủ thay vì đếm trên trình duyệt.

# Khung "Thông tin đơn" ở trang đơn

Khung bên phải (trạng thái, người nộp đơn, người tiếp nhận, người xử lí) ẩn / hiện được (cuối `js/application-form.js`):
- Màn hình rộng: bấm › ở đầu khung để ẩn, nội dung đơn giãn ra cả chiều ngang; nút **Thông tin đơn** (cạnh Xuất file, giữ chiều rộng vừa chữ) hiện ở đầu trang để mở lại. Lựa chọn được nhớ trong trình duyệt (localStorage).
- Màn hình hẹp (≤ 1100px): khung ẩn sẵn, bấm **Thông tin đơn** để trượt ra từ bên phải; bấm ra ngoài, › hoặc Esc để đóng.

# Xem nhanh (dropdown ›) trong các bảng đơn

Bấm nút **›** ở đầu dòng (hoặc nút mở/đóng tất cả) để sổ xuống phần xem nhanh ngay trong bảng ("Đơn đã nộp", "Đơn phụ trách", "Quản lí đơn").
Xem nhanh chỉ hiện các phần được bật **Nội dung chính** trong trình soạn, dùng lại đúng khung của trang chi tiết đơn ở chế độ chỉ xem.
Ngoài ra luôn hiện dòng "Cập nhật lúc …" (nếu có) và "Phòng Đào tạo: <lí do>" (nếu có).

# Trang Quản lí tài khoản (chỉ Admin)

Đường dẫn `#quan-li-tai-khoan`, mở từ menu. Code ở `js/accounts-page.js`. Chỉ vai trò có trang `accounts` và quyền `manageAccounts` (Admin) mới thấy và mở được.

- **Bảng tài khoản:** tất cả tài khoản (người nộp đơn và cán bộ), có tìm kiếm / Sắp xếp / Lọc như các bảng khác, nút Hiện CCCD.
  Tài khoản của chính mình có nhãn "Bạn".
- **Tạo tài khoản:** Họ và tên, Email, Vai trò là bắt buộc. CCCD và số điện thoại không bắt buộc;
  để trống thì người dùng tự điền ở bước bổ sung thông tin khi đăng nhập lần đầu.
- **Mở trang thông tin:** bấm vào dòng → trang thông tin của tài khoản đó (`#ho-so-<id>`, có nút "‹ Quay lại Quản lí tài khoản"); dòng của chính mình → trang Thông tin cá nhân.
- **Sửa tài khoản:** bấm nút **Sửa** ở cuối dòng. Sửa được Họ và tên, CCCD, số điện thoại, vai trò.
- **Cùng một popup với nút "Sửa thông tin" ở trang Thông tin cá nhân** (`openAccount()` trong `js/accounts-page.js`).
  Popup **thay đổi theo vai trò, không theo trang**: Admin (`manageAccounts`) luôn thấy popup đầy đủ, có phần Vai trò, dù bấm Sửa ở trang nào
  (riêng vai trò của chính mình thì khóa). Vai trò khác chỉ sửa được thông tin của chính mình, popup ẩn phần Vai trò.
- **Kiểm tra khi lưu:** họ tên ít nhất 2 chữ; email đúng định dạng và chưa có tài khoản nào dùng; CCCD (nếu nhập) đúng 12 số, bắt đầu bằng 0 và không trùng; SĐT (nếu nhập) đúng định dạng.

Quy tắc:
- **Email không đổi được sau khi tạo**, vì email là tài khoản Google để đăng nhập và là khóa nhận ra người tiếp nhận / người xử lí của đơn.
- **Admin không tự đổi được vai trò của chính mình**, để tránh tự khóa mình khỏi trang này.
- Tài khoản có vai trò được xử lí đơn (Người xử lí đơn, Admin) tự có trong danh sách **Chuyển giao**. Đổi một cán bộ sang Người nộp đơn thì họ không còn trong danh sách đó, nhưng các đơn họ đang phụ trách vẫn giữ nguyên.
- Đổi tên tài khoản cán bộ thì tên mới hiện ở mọi đơn họ tiếp nhận / xử lí.
- Trang thông tin của tài khoản cán bộ (vai trò có quyền `decide`) có mục 3 "Đơn phụ trách": các đơn tài khoản đó là người tiếp nhận hoặc người xử lí. Tài khoản Người nộp đơn không có mục 3.
- Chưa có xóa hay khóa tài khoản.

Bản thật: danh sách tài khoản và mọi thay đổi đi qua API; máy chủ kiểm tra quyền `manageAccounts`, tính duy nhất của email / CCCD,
và nên lưu đơn theo **id tài khoản** thay vì chép tên + email vào đơn như bản mẫu.

# Thu gọn khung

Mọi khung có phần đầu (tiêu đề) đều bấm được để **thu gọn / mở rộng** phần nội dung, như một nút bật tắt (`js/collapse.js`).
Mặc định mở, **trừ trang Thông tin cá nhân**: chỉ mục 1 "Thông tin cá nhân" mở, mục 2 "Đơn đã nộp" và mục 3 "Đơn phụ trách"
thu gọn (class `collapsed` trong `index.html`, danh sách ở `PROFILE_DEFAULT_COLLAPSED` trong `js/collapse.js`). Trạng thái thu gọn
giữ nguyên khi đi qua trang khác rồi quay lại, và đặt lại như mặc định mỗi lần đăng nhập. Vừa nộp đơn mới thì mục "Đơn đã nộp" tự mở để thấy đơn vừa nộp.
Bấm vào nút nằm trong phần đầu (Sửa thông tin, Nộp đơn mới, Chuyển giao…) thì chỉ làm việc của nút.
Dùng được bằng bàn phím (Tab tới tiêu đề, Enter hoặc Space). Phần đầu mọi khung cao bằng nhau (60px); nút trong phần đầu dùng cỡ nhỏ.

# Quy ước màu

Khai báo ở khối "HỆ THỐNG MÀU" cuối `styles.css`; áp dụng cho cả giao diện sáng và tối.
Màu chủ đạo (`--accent`, đầu `styles.css`) là **xanh da trời**: sáng `#0A7CC6`, tối `#5CBDF3`; nền và chữ là xám ánh xanh dương. Màu xanh lá chỉ còn dùng cho trạng thái Đã duyệt.

| Thành phần | Quy tắc |
|---|---|
| Chữ | Chỉ **tiêu đề lớn** (tên cổng, tiêu đề trang, tiêu đề khung, tiêu đề nhóm, tiêu đề popup) và **tên trường** mang màu xanh. Mọi chữ khác dùng màu chữ chính; nhãn và gợi ý dùng xám. |
| Bấm được | Luôn có **nền đặc**. Nút chính (Nộp đơn mới, Tạo tài khoản, Tiếp nhận, Lưu thay đổi / Gửi đơn) và **mọi nút nằm trên phần đầu khung, cạnh tiêu đề** (Sửa thông tin, Thông tin người nộp đơn ›, Chuyển giao): nền xanh trường. Các nút còn lại (Sắp xếp, Lọc, Đóng, Đăng xuất, Chi tiết ›, Quay lại, ›, ×…): nền xám đặc. Riêng 3 nút Yêu cầu bổ sung / Từ chối / Duyệt dùng màu trạng thái. Không dùng nút viền rỗng. |
| Không bấm được | **Nền rỗng, chỉ viền**: nhãn trạng thái, nhãn vai trò, nhãn "Bạn", nhãn PDF, số thứ tự mục. |
| Trạng thái | Màu riêng: Đã nộp xanh lơ · **Đang xét xanh dương** · **Cần bổ sung vàng** · Đã bổ sung tím · Đã duyệt xanh lá · Từ chối đỏ (biến `--s-*-bg` / `--s-*-fg` đầu `styles.css`), chỉ dùng cho nhãn trạng thái, khung thông báo và 3 nút Yêu cầu bổ sung / Từ chối / Duyệt. |
| Vai trò | Chỉ hiện ở Quản lí tài khoản; đậm nhạt của xanh trường: Người nộp đơn xám, Người xử lí đơn xanh nhạt, Admin xanh đậm. |

# So sánh quyền của 3 vai trò

Khai báo trong `ROLES` ở `js/config.js` (mỗi vai trò có danh sách trang `pages` và quyền `perms`).
Giao diện kiểm tra bằng `can('quyền')` / `canSee('trang')`; khi làm thật máy chủ phải kiểm tra lại.

✓ = được phép · ✗ = không được phép

| Chức năng | Quyền (`perms`) | Người nộp đơn (`nop`) | Người xử lí đơn (`xuly`) | Admin (`admin`) |
|---|---|:---:|:---:|:---:|
| Trang mở ra sau khi đăng nhập | `home` | Thông tin cá nhân | Quản lí đơn | Quản lí đơn |
| Xem và sửa thông tin cá nhân của mình | — | ✓ | ✓ | ✓ |
| Nộp đơn mới cho chính mình | `submit` | ✓ | ✓ | ✓ |
| Sửa đơn của mình (khi Đã nộp / Cần bổ sung / Đã bổ sung) | `editOwn` | ✓ | ✓ | ✓ |
| Trang Quản lí đơn (xem tất cả đơn) | `viewAll` | ✗ | ✓ | ✓ |
| Mở chi tiết đơn của người khác (chỉ xem) | `viewAll` | ✗ | ✓ | ✓ |
| Tiếp nhận đơn (Đã nộp / Đã bổ sung → Đang xét) | `receive` | ✗ | ✓ | ✓ |
| Yêu cầu bổ sung / Duyệt / Từ chối đơn Đang xét **mình đang phụ trách** | `decide` | ✗ | ✓ | ✓ |
| Yêu cầu bổ sung / Duyệt / Từ chối đơn Đang xét **người khác phụ trách** | `decideAny` | ✗ | ✗ | ✓ |
| Mục 3 "Đơn phụ trách" trên hồ sơ của mình | `decide` | ✗ | ✓ | ✓ |
| Xem mục 3 "Đơn phụ trách" trên hồ sơ tài khoản cán bộ khác | `viewAll` | ✗ | ✓ | ✓ |
| Chuyển giao đơn cho người xử lí khác | `transfer` | ✗ | ✓ | ✓ |
| Xem thông tin người nộp đơn khác | `viewApplicant` | ✗ | ✓ | ✓ |
| Sửa thông tin người nộp đơn khác | `editApplicant` | ✗ | ✗ | ✓ |
| Nộp đơn mới thay cho người nộp đơn khác | `submitForApplicant` | ✗ | ✗ | ✓ |
| Sửa nội dung đơn của người khác (khi Đã nộp / Cần bổ sung / Đã bổ sung) | `editAnyApp` | ✗ | ✗ | ✓ |
| Trang Quản lí tài khoản: tạo tài khoản mới, sửa thông tin và vai trò tài khoản khác | `manageAccounts` | ✗ | ✗ | ✓ |
| Trang Quản lí loại đơn: tạo, sửa, mở / đóng loại đơn (form) | `manageForms` | ✗ | ✓ | ✓ |

Ghi chú:
- Admin có tất cả các quyền. Người nộp đơn chỉ sửa được đơn của mình; Admin sửa được cả đơn của người khác.
  Cả hai trường hợp đều chỉ sửa được khi đơn đang Đã nộp / Cần bổ sung / Đã bổ sung (`EDITABLE`).
- Tiếp nhận, Yêu cầu bổ sung / Duyệt / Từ chối và Chuyển giao chỉ hiện khi trạng thái đơn cho phép
  (`RECEIVABLE`, `DECIDABLE`, `TRANSFERABLE` trong `js/config.js`).
- Yêu cầu bổ sung / Duyệt / Từ chối: Người xử lí đơn chỉ làm được trên đơn mình là người xử lí; Admin làm được trên mọi đơn.
- Chuyển giao: hiện ai có quyền `transfer` cũng chuyển giao được mọi đơn, không chỉ đơn mình phụ trách.

## Cấu hình email (Admin) — bản xem thử

Trang `#cau-hinh-email` (menu "Cấu hình email", chỉ Admin, quyền `manageEmail`). Mã nguồn: `js/email-page.js`.

- **Người gửi**: tên, địa chỉ gửi, chữ kí cuối thư. Không cấu hình địa chỉ nhận: người nộp đơn bấm "Trả lời" thì thư về chính địa chỉ gửi.
- **Bốn lúc gửi email**: đơn `nop` Đã nộp · `bs` Cần bổ sung · `tc` Từ chối · `duyet` Đã duyệt. Mỗi lúc có công tắc bật / tắt riêng.
- **Người nhận không cấu hình**: thư luôn gửi thẳng tới email của người nộp đơn (email trên trang Thông tin cá nhân). Trang này chỉ cấu hình phía gửi.
- **Mỗi lúc gửi**: soạn tiêu đề và nội dung, chèn mã `{ho_ten}`, `{ma_don}`, `{loai_don}`, `{ngay_nop}`, `{nguoi_xu_li}`, `{ly_do}`, `{link_don}`, `{chu_ki}`.
- **Xem trước** thư bằng dữ liệu mẫu (phần đã thay mã được tô nền, mã không có thì tô đỏ) và "Gửi email thử" (chỉ giả lập).
- Sửa xong bấm **Lưu**; có thay đổi chưa lưu thì hiện nhãn "Chưa lưu", nút **Hoàn tác** trả về bản đã lưu.
- Cấu hình chỉ nằm trong bộ nhớ (tải lại trang là về mặc định). Bản thật lưu qua API và máy chủ gửi thư.
