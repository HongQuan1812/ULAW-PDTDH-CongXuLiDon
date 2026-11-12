/* Menu: nút cạnh logo mở panel bên trái gồm các trang và tài khoản (tên + đăng xuất) ở dưới cùng. */
/* Menu (thanh bên): trên màn hình rộng luôn hiện bên trái; trên màn hình hẹp trượt ra khi bấm nút menu.
   Mở/đóng bằng class "open" (không dùng thuộc tính hidden) để màn hình rộng luôn thấy menu. */
let lastMenuBtn=null;
const narrowMQ=window.matchMedia('(max-width: 960px)');
function currentPageName(){return !$('vEmail').hidden?"email":!$('vAccounts').hidden?"accounts":(!$('vForms').hidden||!$('vFormEdit').hidden)?"forms":!$('vApps').hidden?"apps":"profile"}
function drawerOpen(){return $('drawer').classList.contains('open')}
/* màn hình hẹp và menu đang đóng: không cho Tab vào menu */
function syncDrawerInert(){const d=$('drawer');d.inert=narrowMQ.matches&&!drawerOpen()}
/* đánh dấu trang đang mở trong menu, email ở chân menu */
function syncNav(){
  const pg=$('vForm').hidden?currentPageName():null; /* trang đơn: không đánh dấu mục nào */
  document.querySelectorAll('.drawer-nav button').forEach(b=>{if(b.dataset.go===pg)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
  $('drawerEmail').textContent=state.user?state.user.email:'';
  syncDrawerInert();
}
function openDrawer(btn){
  lastMenuBtn=btn;syncNav();
  $('drawer').classList.add('open');$('drawerBg').hidden=false;syncDrawerInert();
  document.querySelectorAll('.js-menu-btn').forEach(b=>b.setAttribute('aria-expanded','true'));
  ($('drawer').querySelector('.drawer-nav button:not([hidden])')||$('drawerClose')).focus();
}
function closeDrawer(){
  if(!drawerOpen())return;
  $('drawer').classList.remove('open');$('drawerBg').hidden=true;syncDrawerInert();
  document.querySelectorAll('.js-menu-btn').forEach(b=>b.setAttribute('aria-expanded','false'));
  if(lastMenuBtn&&lastMenuBtn.offsetParent)lastMenuBtn.focus();
}
narrowMQ.addEventListener('change',()=>{if(!narrowMQ.matches)closeDrawer();syncDrawerInert()});
/* ---- Điều hướng theo #hash: nút Back / Forward của trình duyệt dùng được, và có thể gửi link tới từng trang ----
   #thong-tin-ca-nhan · #quan-li-don · #quan-li-tai-khoan · #nop-don · #don-<mã đơn> · #ho-so-<id người nộp> */
const ROUTE={profile:"thong-tin-ca-nhan",apps:"quan-li-don",accounts:"quan-li-tai-khoan",forms:"quan-li-loai-don",email:"cau-hinh-email",newForm:"nop-don"};
/* #soan-don-<mã loại đơn> · #soan-don-moi : trình soạn loại đơn */
const homeRoute=()=>ROUTE[ROLES[state.role].home];
const currentRoute=()=>decodeURIComponent(location.hash.replace(/^#/,''));
/* các trang đã đi trong phiên, để biết "trang trước" cho nút Quay lại */
const navStack=[];let navIntent=null; /* "push" | "replace" | "back" khi trang tự điều hướng; null khi người dùng bấm Back/Forward của trình duyệt */
const prevRoute=()=>navStack.length>1?navStack[navStack.length-2]:null;
function navigate(route,{replace=false}={}){
  if(currentRoute()===route){renderRoute(route);return}
  navIntent=replace?"replace":"push";
  if(replace)location.replace('#'+route);else location.hash=route; /* hashchange sẽ vẽ trang */
}
/* về trang trước nếu có, không thì về trang chính của vai trò */
function goBack(){if(prevRoute()){navIntent="back";history.back()}else navigate(homeRoute(),{replace:true})}
function routeLabel(r){
  if(r===ROUTE.apps)return "Quản lí đơn";
  if(r===ROUTE.accounts)return "Quản lí tài khoản";
  if(r===ROUTE.forms)return "Quản lí loại đơn";
  if(r===ROUTE.email)return "Cấu hình email";
  if(r&&r.startsWith("soan-don-"))return "trình soạn loại đơn";
  if(r&&r.startsWith(ROUTE.newForm))return "đơn đang soạn";
  if(r&&r.startsWith("don-"))return "đơn "+r.slice(4);
  if(r&&r.startsWith("ho-so-"))return "thông tin người nộp đơn";
  return "Thông tin cá nhân";
}
const findPerson=id=>state.others.find(x=>x.id===id);
function canOpenApp(code){const hit=findApp(code);return !!hit&&(hit.p.apps===state.apps||can("viewAll"))}
function renderRoute(r){
  if(!state.user||!state.profile)return; /* chưa đăng nhập: trang đăng nhập đang hiện */
  closeDrawer();
  let m;
  if(r===ROUTE.apps&&canSee("apps")){renderAppsPage();show('vApps')}
  else if(r===ROUTE.accounts&&canSee("accounts")&&can("manageAccounts")){renderAccountsPage();show('vAccounts')}
  else if(r===ROUTE.email&&canSee("email")&&can("manageEmail")){renderEmailPage();show('vEmail')}
  else if(r===ROUTE.forms&&canSee("forms")&&can("manageForms")){renderFormsPage();show('vForms')}
  else if((m=r.match(/^soan-don-(.+)$/))&&canSee("forms")&&can("manageForms")&&(m[1]==="moi"||TYPES[m[1]])){openFormEditor(m[1])}
  else if(r===ROUTE.newForm&&can("submit")&&chosenType()){openForm(chosenType())}
  else if((m=r.match(/^nop-don-(.+)$/))&&can("submitForApplicant")&&findPerson(m[1])&&chosenType()){openForm(chosenType(),findPerson(m[1]))} /* admin nộp thay */
  else if((m=r.match(/^don-(.+)$/))&&canOpenApp(m[1])){openDetail(m[1])}
  else if((m=r.match(/^ho-so-(.+)$/))&&can("viewApplicant")&&findPerson(m[1])){
    const per=findPerson(m[1]);if(state.viewing!==per){state.showCccd=false;state.page=1;state.mPage=1}
    state.viewing=per;renderProfile();show('vProfile');                      /* hồ sơ người nộp đơn (chỉ xem) */
  }
  else if(r===ROUTE.profile){if(state.viewing){state.showCccd=false;state.page=1;state.mPage=1}state.viewing=null;renderProfile();show('vProfile')}
  else{navigate(homeRoute(),{replace:true});return} /* trang không có hoặc không thuộc vai trò */
  /* nhãn các nút quay lại */
  const p=prevRoute();
  $('formBack').textContent="‹ Quay lại "+routeLabel(p||homeRoute());
  const onProfile=r===ROUTE.profile||r.startsWith("ho-so-");
  const pb=$('pBack'),fromApp=onProfile&&p&&(p.startsWith(ROUTE.newForm)||p.startsWith("don-")||p===ROUTE.accounts); /* có nút quay lại khi đến từ đơn hoặc từ Quản lí tài khoản */
  pb.hidden=!fromApp;if(fromApp)pb.textContent="‹ Quay lại "+routeLabel(p);
}
window.addEventListener('hashchange',()=>{
  if(!state.user||!state.profile)return;
  const r=currentRoute();
  const intent=navIntent;navIntent=null;
  if(intent==="replace"&&navStack.length)navStack[navStack.length-1]=r;     /* thay trang hiện tại */
  else if(intent==="push")navStack.push(r);                                  /* trang tự đi tới */
  else if(intent==="back"||prevRoute()===r)navStack.pop();                   /* đi lùi (nút trong trang hoặc Back) */
  else if(navStack[navStack.length-1]!==r)navStack.push(r);                  /* Forward của trình duyệt */
  renderRoute(r);
});
$('pBack').onclick=goBack;
/* vào ứng dụng sau khi đăng nhập: mở trang trong link nếu được phép, không thì trang chính */
function enterApp(){
  navStack.length=0;const r=currentRoute();
  if(r){navStack.push(r);renderRoute(r)}else{navStack.push(homeRoute());navigate(homeRoute(),{replace:true})}
}
function leaveApp(){navStack.length=0;if(location.hash)location.replace('#')}
function go(page){navigate(ROUTE[page]||homeRoute())}
const goHome=()=>navigate(homeRoute());
/* Áp dụng vai trò lên giao diện: menu, nhãn vai trò, các nút theo quyền */
function applyRole(){
  const r=ROLES[state.role];renderAccount();
  document.querySelectorAll('.drawer-nav button[data-go]').forEach(b=>b.hidden=!canSee(b.dataset.go));
  $('newBtn').hidden=!can('submit');
}
/* JUST FOR DEMO: START · ô "Vai trò (thử nghiệm)" trong menu để đổi vai trò khi đang dùng */
const _applyRoleCore=applyRole;
applyRole=function(){_applyRoleCore();$('drawerRole').value=state.role};
$('drawerRole').onchange=e=>{
  state.role=e.target.value;applyRole();goHome();
  toast(`Đang dùng vai trò ${ROLES[state.role].name}`);
};
/* JUST FOR DEMO: END */
document.querySelectorAll('.js-menu-btn').forEach(b=>b.onclick=()=>openDrawer(b));
$('drawerClose').onclick=closeDrawer;$('drawerBg').onclick=closeDrawer;
$('drawer').querySelector('.drawer-nav').onclick=e=>{const b=e.target.closest('button[data-go]');if(b)go(b.dataset.go)};
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDrawer()});
