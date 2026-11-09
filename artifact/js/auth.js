/* Đăng nhập (đang mô phỏng Google SSO), bổ sung thông tin lần đầu, kiểm tra CCCD/SĐT, đăng xuất. */
/* validation */
const rx={cccd:/^0\d{11}$/,phone:/^0(3|5|7|8|9)\d{8}$/};
function check(el,ok,msg){const e=el.parentElement.querySelector('.ferr');el.classList.toggle('err',!ok);if(e){e.hidden=ok;e.textContent=msg}return ok}
/* Họ và tên bắt buộc; CCCD và số điện thoại không bắt buộc, nhưng có nhập thì phải đúng định dạng */
function validate(n,c,p){
  const a=check(n,n.value.trim().split(/\s+/).length>=2,"Nhập đầy đủ họ và tên.");
  const b=check(c,!c.value.trim()||rx.cccd.test(c.value.trim()),"Số CCCD gồm đúng 12 chữ số và bắt đầu bằng 0.");
  const d=check(p,!p.value.trim()||rx.phone.test(p.value.trim()),"Số điện thoại gồm 10 chữ số, bắt đầu bằng 03, 05, 07, 08 hoặc 09.");
  return a&&b&&d;
}
['oCccd','oPhone'].forEach(id=>$(id).addEventListener('input',e=>{e.target.value=e.target.value.replace(/\D/g,'')}));
document.querySelectorAll('input').forEach(i=>i.addEventListener('input',()=>{i.classList.remove('err');const e=i.parentElement.querySelector('.ferr');if(e)e.hidden=true}));

/* screen 1 */
$('gLogin').onclick=()=>{
  /* JUST FOR DEMO: START · mô phỏng đăng nhập Google bằng email trường + chọn vai trò.
     Bản thật: chạy Google OAuth (giới hạn tên miền trường), máy chủ kiểm tra lại tên miền rồi trả về
     {user:{email,name}, role, profile|null, student|null}; student lấy từ database trường. */
  state.user={email:"minhanh.nguyen@hcmulaw.edu.vn",name:"Nguyễn Minh Anh"};
  state.role=(document.querySelector('input[name="loginRole"]:checked')||{}).value||"nop";
  state.student=state.role==="nop"?{mssv:"2253801010001",lop:"47-LTM-A",khoa:"K47 (2022–2026)",khoaGoc:"K47 (2022–2026)",hinhThuc:"Chính quy",nganh:"Luật Thương mại quốc tế"}:null; /* cán bộ thường không có thông tin sinh viên */
  /* JUST FOR DEMO: END */
  if(!isSchoolEmail(state.user.email)){ /* không phải email trường: không cho vào */
    const m=$('loginMsg');m.textContent=`Hãy đăng nhập bằng email trường (@${SCHOOL_EMAIL_DOMAINS[0]}). Email ${state.user.email} không được dùng cho cổng này.`;m.hidden=false;
    state.user=null;state.role=null;return;
  }
  $('loginMsg').hidden=true;
  if(state.profile){applyRole();enterApp()}
  else{$('oEmail').value=state.user.email;$('oName').value=state.user.name;$('oCccd').value='';$('oPhone').value='';show('vOnb');$('oCccd').focus()}
};
/* screen 2 */
$('onbForm').addEventListener('submit',e=>{
  e.preventDefault();
  if(!validate($('oName'),$('oCccd'),$('oPhone')))return;
  state.profile={name:$('oName').value.trim(),cccd:$('oCccd').value.trim(),phone:$('oPhone').value.trim()};
  applyRole();enterApp();toast("Đã lưu thông tin cá nhân");
});
$('onbBack').onclick=logout;
/* screen 3 */
function logout(){if(typeof closeDrawer==='function')closeDrawer();if(typeof resetProfileCollapse==='function')resetProfileCollapse();['uModal','dModal','tModal','pv'].forEach(id=>{const m=$(id);if(m)m.hidden=true}); /* đóng mọi popup đang mở */state.user=null;state.role=null;state.student=null;state.viewing=null;state.showCccd=false;leaveApp();show('vLogin');toast("Đã đăng xuất")}
document.querySelectorAll('.js-logout').forEach(b=>b.onclick=logout);
