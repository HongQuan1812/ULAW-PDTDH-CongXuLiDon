/* Cấu hình nghiệp vụ: trạng thái đơn, các loại đơn (form) và các phần, câu hỏi của từng loại đơn. */
const STATUS={
  nop:{t:"Đã nộp",c:"s-nop"}, xet:{t:"Đang xét",c:"s-xet"}, bs:{t:"Cần bổ sung",c:"s-bs"},
  bsg:{t:"Đã bổ sung",c:"s-bsg"}, /* sinh viên đã sửa đơn "Cần bổ sung"; xử lý giống "Đã nộp" */
  duyet:{t:"Đã duyệt",c:"s-duyet"}, tc:{t:"Từ chối",c:"s-tc"}
};
/* Loại đơn (form). Cán bộ tạo và sửa ở trang "Quản lí loại đơn" (js/forms-page.js); đây chỉ là dữ liệu ban đầu.
   Bản thật: TYPES lấy từ API và lưu ở máy chủ.
   Mỗi loại đơn:
     name     : tên loại đơn (hiện ở bảng và ở cột "Loại đơn")
     title    : tiêu đề trên form khi nộp đơn (bỏ trống thì dùng "Đơn " + tên)
     desc     : mô tả ngắn, hiện dưới tiêu đề khi nộp đơn
     prefix   : tiền tố mã đơn, vd "XMM" → XMM-2026-00001
     status   : "draft" (Nháp, người nộp đơn không thấy) | "open" (Đang mở, nhận đơn) | "closed" (Đã đóng, không nhận đơn mới)
     updatedAt, updatedBy : lần lưu gần nhất
     sections : các phần (khung) của mục "Nội dung đơn", theo thứ tự
       { id, title, hint, main, questions:[…] }
       main = true → "nội dung chính": hiện trong xem nhanh (dropdown ›) ở các bảng đơn
     questions: câu hỏi trong phần; câu trả lời lưu ở a.data[<id câu hỏi>]
       { id, type, label, help, required, …tùy loại } — các loại câu hỏi xem QTYPES trong js/sections.js */
const TYPES={
  xmm:{name:"Xét miễn môn",desc:"Miễn môn đã học tương đương ở cơ sở đào tạo khác",prefix:"XMM",status:"open",
    updatedAt:"2026-09-01T08:00",updatedBy:"Phạm Thu Hà",
    sections:[
      {id:"s-mon",title:"Đăng ký miễn môn",main:true,
        hint:"Mỗi dòng là một môn của trường bạn muốn xét miễn, kèm môn đã học tương đương ở cơ sở khác.",
        questions:[{id:"mon",tag:"mon",type:"table",label:"Các môn xin miễn",required:true,rowName:"môn",
          columns:[{label:"Môn học của trường",sub:"Môn muốn xét miễn",type:"text",placeholder:"VD: Luật Hiến pháp"},
                   {label:"Số tín chỉ",type:"number",placeholder:"TC",sum:true,sumLabel:"tín chỉ"},
                   {label:"Môn học tương đương",sub:"Môn dùng để xét miễn",type:"text",placeholder:"Tên môn đã học"},
                   {label:"Cơ sở đào tạo",sub:"Nơi dạy môn tương đương",type:"text",placeholder:"Tên trường / cơ sở"}]}]},
      {id:"s-files",title:"Bảng điểm minh chứng",
        hint:"Tải lên bảng điểm có xác nhận của cơ sở đào tạo cũ.",
        questions:[{id:"files",tag:"tep_bang_diem",type:"file",label:"Tệp bảng điểm",required:true,accept:["pdf","jpg","png"],maxMB:10}]}
    ]}
};
const FORM_STATUS={draft:{t:"Nháp",c:"s-nop"},open:{t:"Đang mở",c:"s-duyet"},closed:{t:"Đã đóng",c:"s-tc"}};
const openTypes=()=>Object.keys(TYPES).filter(k=>TYPES[k].status==="open");
/* Đăng nhập bằng tài khoản Google do trường cấp: chỉ chấp nhận email thuộc các tên miền này (kể cả tên miền con, vd ...@student.hcmulaw.edu.vn).
   TODO: xác nhận lại tên miền email thật của sinh viên và cán bộ. */
const SCHOOL_EMAIL_DOMAINS=["hcmulaw.edu.vn"];
const isSchoolEmail=e=>{const d=String(e).toLowerCase().split('@')[1]||"";return SCHOOL_EMAIL_DOMAINS.some(x=>d===x||d.endsWith("."+x))};
/* Mục "Thông tin sinh viên" trên trang thông tin: lấy từ database trường (person.student), chỉ xem.
   Có ít nhất 1 mục thì hiện đủ các mục, mục trống ghi "—"; không có mục nào thì ẩn cả phần. */
const STUDENT_FIELDS=[{k:"mssv",t:"MSSV"},{k:"lop",t:"Lớp"},{k:"hinhThuc",t:"Hình thức đào tạo"},{k:"nganh",t:"Ngành"},{k:"khoa",t:"Khóa học hiện tại"},{k:"khoaGoc",t:"Khóa học gốc"}];
const PER=8;
const EDITABLE=["nop","bs","bsg"];  /* đơn ở các trạng thái này sinh viên mới được sửa */
const RECEIVABLE=["nop","bsg"];      /* đơn ở các trạng thái này phòng Đào tạo bấm được "Tiếp nhận" */
const TRANSFERABLE=["xet","bs","bsg"]; /* đơn ở các trạng thái này chuyển giao được (đã tiếp nhận, chưa có kết quả) */
const DECIDABLE=["xet"];             /* đơn ở các trạng thái này cán bộ bấm được Yêu cầu bổ sung / Duyệt / Từ chối */

/* Vai trò người dùng.
   pages: các trang được thấy trong menu · home: trang mở ra sau khi đăng nhập · perms: các quyền.
   Quyền hiện có: submit (nộp đơn mới), editOwn (sửa đơn của mình khi còn sửa được),
   viewAll (xem tất cả đơn ở trang Quản lí đơn), receive (bấm "Tiếp nhận" đơn),
   viewApplicant (xem trang thông tin của người nộp đơn),
   editApplicant (sửa thông tin của người nộp đơn), submitForApplicant (nộp đơn mới thay cho người nộp đơn),
   decide (Yêu cầu bổ sung / Duyệt / Từ chối đơn Đang xét mà mình là người xử lí),
   decideAny (làm việc đó trên đơn người khác phụ trách), transfer (chuyển giao đơn cho người xử lí khác),
   editAnyApp (sửa nội dung đơn của người khác, cùng điều kiện trạng thái EDITABLE),
   manageAccounts (trang Quản lí tài khoản: tạo tài khoản mới, sửa thông tin và vai trò tài khoản khác),
   manageForms (trang Quản lí loại đơn: tạo, sửa, mở / đóng các loại đơn — Người xử lí đơn và Admin).
   Muốn thay đổi vai trò nào làm được gì, chỉ cần sửa danh sách perms / pages ở đây. */
const ROLES={
  nop:  {name:"Người nộp đơn",  pages:["profile"],        home:"profile", perms:["submit","editOwn"]},
  xuly: {name:"Người xử lí đơn",pages:["profile","apps","forms"], home:"apps", perms:["submit","editOwn","viewAll","receive","viewApplicant","decide","transfer","manageForms"]},
  admin:{name:"Admin",          pages:["profile","apps","forms","accounts"], home:"apps", perms:["manageForms","submit","editOwn","viewAll","receive","viewApplicant","editApplicant","submitForApplicant","decide","decideAny","transfer","editAnyApp","manageAccounts"]}
};
const can=perm=>!!state.role&&ROLES[state.role].perms.includes(perm);
const canSee=page=>!!state.role&&ROLES[state.role].pages.includes(page);
/* có được Yêu cầu bổ sung / Duyệt / Từ chối đơn này không: đơn đang xét, và mình là người xử lí (hoặc có decideAny) */
const isHandlerOf=a=>!!a.handler&&!!state.user&&a.handler.email===state.user.email;
const canDecideOn=a=>can("decide")&&DECIDABLE.includes(a.status)&&(isHandlerOf(a)||can("decideAny"));
