/* JUST FOR DEMO: START · cả file là DỮ LIỆU MẪU để thử giao diện.
   Bản thật: bỏ file này; state.apps (đơn của người đăng nhập) và state.others (người nộp + đơn, cho trang Quản lí đơn) lấy từ API. */
/* Dữ liệu mẫu: 18 đơn để xem bảng co giãn */
/* cán bộ phòng Đào tạo mẫu */
const SAMPLE_STAFF=[
  {id:"cb-1",name:"Phạm Thu Hà",email:"thuha.pham.pdt@hcmulaw.edu.vn",cccd:"079188002314",phone:"0903112233",role:"xuly",apps:[]},
  {id:"cb-2",name:"Trần Quốc Việt",email:"quocviet.tran.pdt@hcmulaw.edu.vn",cccd:"079185006671",phone:"0918445566",role:"xuly",apps:[]},
  {id:"cb-3",name:"Lê Ngọc Diệp",email:"ngocdiep.le.pdt@hcmulaw.edu.vn",cccd:"",phone:"",role:"admin",apps:[]}];
(function seed(){
  const P=[["Triết học Mác – Lênin",3,"Triết học Mác – Lênin","ĐH KHXH&NV – ĐHQG TP.HCM"],["Kinh tế chính trị Mác – Lênin",2,"Kinh tế chính trị Mác – Lênin","ĐH Kinh tế TP.HCM"],["Chủ nghĩa xã hội khoa học",2,"Chủ nghĩa xã hội khoa học","ĐH Sư phạm TP.HCM"],["Lịch sử Đảng Cộng sản Việt Nam",2,"Lịch sử Đảng Cộng sản Việt Nam","ĐH Công nghiệp TP.HCM"],["Tư tưởng Hồ Chí Minh",2,"Tư tưởng Hồ Chí Minh","ĐH Mở TP.HCM"],["Tiếng Anh pháp lý 1",3,"English for Specific Purposes 1","ĐH Sư phạm TP.HCM"],["Tin học đại cương",2,"Tin học căn bản","ĐH Bách khoa – ĐHQG TP.HCM"],["Logic học",2,"Logic học đại cương","ĐH KHXH&NV – ĐHQG TP.HCM"],["Xã hội học pháp luật",2,"Xã hội học đại cương","ĐH Mở TP.HCM"],["Kinh tế vi mô",3,"Microeconomics","ĐH Kinh tế – Luật"],["Giáo dục thể chất 1",1,"Giáo dục thể chất 1","ĐH Nông Lâm TP.HCM"]];
  /* ghi chú = lí do người xử lí nhập khi Yêu cầu bổ sung / Từ chối; đơn khác không có ghi chú */
  const BS="Bảng điểm chưa có dấu xác nhận của cơ sở đào tạo. Vui lòng nộp lại bản có xác nhận.";
  const N={bs:BS,bsg:BS,tc:"Nội dung môn tương đương trùng dưới 70% đề cương môn của trường.",nop:"",xet:"",duyet:""};
  const st=["nop","xet","xet","bs","duyet","xet","duyet","tc","duyet","bsg","duyet","duyet","tc","duyet","duyet","tc","duyet","duyet"];
  let d=new Date(2026,9,30);
  st.forEach((s0,i)=>{
    const n=1+(i*7)%3, mon=[];for(let k=0;k<n;k++)mon.push(P[(i*3+k*5)%P.length]);
    const date=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const S=`${date}T${pad(7+i%4)}:${pad((i*17)%60)}`;
    state.apps.push({code:`XMM-${d.getFullYear()}-${String(1520-i*83).padStart(5,'0')}`,type:"xmm",date,status:s0,data:{mon,files:[`Bang_diem_${i%2?'hoc_ky':'toan_khoa'}_${i+1}.pdf`]},note:N[s0],
      submittedAt:S, updatedAt:i%4===1?`${date}T${pad(13+i%5)}:${pad((i*29)%60)}`:S,
      receivedAt:s0==="nop"?null:addHours(S,3+(i%3)*18)});
    d=new Date(d.getTime()-(9+(i*13)%17)*864e5);
  });
})();

/* Sinh viên khác và đơn của họ, dùng cho trang Đơn */
(function seedOthers(){
  const S=[["Trần Thị Bảo Ngọc","079305004821","0912345678","baongoc.tran@hcmulaw.edu.vn"],["Lê Hoàng Phúc","077206011935","0938112204","phuc.lehoang@hcmulaw.edu.vn"],["Phạm Gia Hân","079306007712","0987654321","giahan.pham06@hcmulaw.edu.vn"],["Võ Minh Khang","083206002249","0905778123","khangvo.law@hcmulaw.edu.vn"],["Đặng Thùy Linh","079305010388","0393456712","thuylinh.dang@hcmulaw.edu.vn"],["Huỳnh Quốc Bảo","075206003167","0868234590","quocbao.huynh@hcmulaw.edu.vn"],["Ngô Phương Thảo","079306012456","0703998812","thao.ngophuong@hcmulaw.edu.vn"],["Bùi Đức Anh","080206009021","0326781145","ducanh.bui.k51@hcmulaw.edu.vn"],["Trương Ngọc Mai","079305006643","0918223467","ngocmai.truong@hcmulaw.edu.vn"],["Đỗ Thành Nam","072206004478","0566102938","thanhnam.do@hcmulaw.edu.vn"]];
  /* thông tin sinh viên (Lớp, Khóa, Hình thức đào tạo, Ngành): bản thật lấy từ database trường; có người thiếu vài mục hoặc không có.
     Mỗi người một danh sách MSSV (một email có thể gắn với nhiều MSSV); Võ Minh Khang có 2 MSSV.
     mainMssv (không bắt buộc) = MSSV chọn làm thông tin chính; không có thì dùng MSSV đầu danh sách */
  const ST=[{mssv:"2253801010012",lop:"47-LTM-A",khoa:"K47 (2022–2026)",khoaGoc:"K47 (2022–2026)",hinhThuc:"Chính quy",nganh:"Luật Thương mại quốc tế"},{mssv:"2353801020145",lop:"48-QTL-B",khoa:"K48 (2023–2027)",khoaGoc:"K48 (2023–2027)",hinhThuc:"Chính quy",nganh:"Quản trị – Luật"},{mssv:"2253801010388",lop:"48-L-C",khoa:"K48 (2023–2027)",khoaGoc:"K47 (2022–2026)",hinhThuc:"Chính quy",nganh:"Luật"},[{mssv:"2053801010214",lop:"45-L-B",khoa:"K45 (2020–2024)",khoaGoc:"K45 (2020–2024)",hinhThuc:"Chính quy",nganh:"Luật"},{mssv:"2323801040021",lop:"VB2-23A",khoa:"VB2 K23",khoaGoc:"VB2 K23",hinhThuc:"Văn bằng 2",nganh:"Luật"}],{mssv:"2453801010507",khoa:"K49 (2024–2028)",khoaGoc:"K49 (2024–2028)",hinhThuc:"Chính quy",nganh:"Luật"},null,{mssv:"2153801030219",lop:"47-LDS-A",khoa:"K47 (2022–2026)",khoaGoc:"K46 (2021–2025)",hinhThuc:"Chính quy",nganh:"Luật Dân sự"},{mssv:"2453801010733",nganh:"Luật"},{mssv:"2353801020611",lop:"48-LTM-B",khoa:"K48 (2023–2027)",khoaGoc:"K48 (2023–2027)",hinhThuc:"Chính quy",nganh:"Luật Thương mại quốc tế"},{mssv:"2423801050042",lop:"LT-24A",khoa:"Liên thông K24",khoaGoc:"Liên thông K24",hinhThuc:"Liên thông",nganh:"Luật"}]; /* khoa: khóa học hiện tại · khoaGoc: khóa học gốc (khác nhau khi sinh viên bảo lưu, học lại khóa sau) */
  const P=[["Triết học Mác – Lênin",3,"Triết học Mác – Lênin","ĐH KHXH&NV – ĐHQG TP.HCM"],["Tiếng Anh pháp lý 1",3,"English for Specific Purposes 1","ĐH Sư phạm TP.HCM"],["Tin học đại cương",2,"Tin học căn bản","ĐH Bách khoa – ĐHQG TP.HCM"],["Kinh tế vi mô",3,"Microeconomics","ĐH Kinh tế – Luật"],["Logic học",2,"Logic học đại cương","ĐH KHXH&NV – ĐHQG TP.HCM"]];
  const st=["nop","xet","bs","duyet","tc","bsg","xet","duyet"];
  let no=1500,k=0;
  S.forEach((p,i)=>{
    const apps=[];
    for(let j=0;j<1+(i%3);j++,k++){
      const d=new Date(2026,9,31-((k*11)%200)*1);
      const date=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
      apps.push({code:`XMM-${d.getFullYear()}-${String(no-k*37).padStart(5,'0')}`,type:"xmm",date,status:st[k%st.length],data:{mon:[P[k%P.length]],files:[`Bang_diem_${k+1}.pdf`]},note:"",...(()=>{const S=`${date}T${pad(8+k%9)}:${pad((k*13)%60)}`,s0=st[k%st.length];return {submittedAt:S,updatedAt:s0==="bsg"?addHours(S,30):k%5===2?addHours(S,5):S,receivedAt:s0==="nop"?null:addHours(S,3+(k%3)*18),handler:s0==="nop"?null:SAMPLE_STAFF[k%3]}})()});
    }
    state.others.push({id:`sv-${i+1}`,name:p[0],cccd:p[1],phone:p[2],email:p[3],role:"nop",students:Array.isArray(ST[i])?ST[i]:ST[i]?[ST[i]]:[],apps});
  });
})();
/* tài khoản cán bộ (cùng danh sách tài khoản với sinh viên) + người tiếp nhận / người xử lí cho các đơn đã tiếp nhận; vài đơn đã được chuyển giao */
state.others.push(...SAMPLE_STAFF);
[...state.apps,...state.others.flatMap(p=>p.apps)].forEach((a,i)=>{
  if(!a.receivedAt){a.receiver=null;a.handler=null;a.handlerSince=null;return}
  a.receiver=SAMPLE_STAFF[i%3];
  const moved=i%5===2;
  a.handler=moved?SAMPLE_STAFF[(i+1)%3]:a.receiver;
  a.handlerSince=moved?addHours(a.receivedAt,26):a.receivedAt;
});
/* một số đơn của sinh viên khác được chuyển cho tài khoản demo, để mục "Đơn phụ trách" có dữ liệu khi thử vai trò cán bộ */
const DEMO_ME={name:"Nguyễn Minh Anh",email:"minhanh.nguyen@hcmulaw.edu.vn"};
state.others.flatMap(p=>p.apps).forEach((a,i)=>{if(a.receivedAt&&i%3===0){a.handler=DEMO_ME;a.handlerSince=addHours(a.receivedAt,20)}});
/* JUST FOR DEMO: END */
