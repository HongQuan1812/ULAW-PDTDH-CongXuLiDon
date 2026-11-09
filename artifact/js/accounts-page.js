/* Trang Quản lí tài khoản: chỉ vai trò có quyền manageAccounts (Admin).
   Xem tất cả tài khoản, tạo tài khoản mới, sửa họ tên / CCCD / SĐT / vai trò của tài khoản khác.
   Bản thật: danh sách và mọi thay đổi đi qua API; máy chủ phải kiểm tra lại quyền manageAccounts. */
const U_PER=10;
/* tài khoản của chính mình (đánh dấu me) + tất cả tài khoản khác */
function allAccounts(){
  const me=state.profile?[{id:"me",me:true,name:state.profile.name,email:state.user.email,cccd:state.profile.cccd,phone:state.profile.phone,role:state.role,apps:state.apps}]:[];
  return [...me,...state.others];
}
const U_FIELDS=[
  {k:"name",t:"Họ và tên",type:"text",get:r=>r.u.name},
  {k:"email",t:"Email",type:"text",get:r=>r.u.email},
  {k:"role",t:"Vai trò",type:"select",get:r=>r.u.role,label:v=>ROLES[v].name,opts:()=>Object.keys(ROLES)},
  {k:"phone",t:"Số điện thoại",type:"text",get:r=>r.u.phone||null},
  {k:"cccd",t:"Số CCCD",type:"text",get:r=>r.u.cccd||null}
];
const uTools=createTableTools({
  fields:U_FIELDS,filterKey:"role",
  st:{get sort(){return state.uSort},get filters(){return state.uFilters},get query(){return state.uQuery}},
  defaultSort:[{k:"name",dir:"asc"}],defaultNote:"Bảng đang xếp theo họ tên A → Z.",
  ids:{sortBtn:"uSortBtn",sortPop:"uSortPop",sortCnt:"uSortCnt",filtBtn:"uFiltBtn",filtPop:"uFiltPop",filtCnt:"uFiltCnt"},
  onChange:()=>{state.uPage=1;renderAccountsPage()}
});
function uCell(f,u,q){
  const dash='<span class="dash">—</span>';
  switch(f.k){
    case "name":return `<td class="nm">${hl(u.name,q)}${u.me?' <span class="you">Bạn</span>':''}</td>`;
    case "email":return `<td>${hl(u.email,q)}</td>`;
    case "role":return `<td><span class="role-badge" data-role="${u.role}">${hl(ROLES[u.role].name,q)}</span></td>`;
    case "phone":return `<td class="mono">${u.phone?hl(u.phone,q):dash}</td>`;
    case "cccd":return `<td class="mono">${!u.cccd?dash:state.uReveal||q?hl(u.cccd,q):maskC(u.cccd)}</td>`;
  }
}
function renderAccountsPage(){
  const q=state.uQuery.trim(),list=uTools.apply(allAccounts().map(u=>({u})));
  $('uHead').innerHTML=U_FIELDS.map(f=>uTools.th(f,'')).join('')+'<th></th>';uTools.counts();
  const pages=Math.max(1,Math.ceil(list.length/U_PER));state.uPage=Math.min(state.uPage,pages);
  const from=(state.uPage-1)*U_PER,view=list.slice(from,from+U_PER);
  $('uTb').innerHTML=view.length?view.map(({u})=>`<tr class="main" tabindex="0" data-id="${esc(u.id)}">${U_FIELDS.map(f=>uCell(f,u,q)).join('')}<td class="u-act"><button type="button" class="btn sm" data-edit aria-label="Sửa tài khoản ${esc(u.name)}">Sửa</button></td></tr>`).join('')
    :`<tr><td colspan="${U_FIELDS.length+1}" class="empty">${uTools.hasQuery()?'Không có tài khoản nào khớp điều kiện tìm kiếm và bộ lọc.':'Chưa có tài khoản nào.'}</td></tr>`;
  const pg=$('uPager');
  if(list.length<=U_PER)pg.innerHTML=list.length?`<span>${list.length} tài khoản</span>`:'';
  else{
    let h=`<span>Hiển thị ${from+1}–${from+view.length} trong ${list.length} tài khoản</span><div class="pages"><button type="button" class="pg" data-p="${state.uPage-1}" ${state.uPage===1?'disabled':''} aria-label="Trang trước">‹</button>`;
    for(let i=1;i<=pages;i++)h+=`<button type="button" class="pg" data-p="${i}" ${i===state.uPage?'aria-current="page"':''}>${i}</button>`;
    pg.innerHTML=h+`<button type="button" class="pg" data-p="${state.uPage+1}" ${state.uPage===pages?'disabled':''} aria-label="Trang sau">›</button></div>`;
  }
  const rb=$('uReveal');rb.textContent=state.uReveal?'Ẩn CCCD':'Hiện CCCD';rb.setAttribute('aria-pressed',state.uReveal);
}
$('uSearch').addEventListener('input',e=>{state.uQuery=e.target.value;state.uPage=1;renderAccountsPage()});
$('uReveal').onclick=()=>{state.uReveal=!state.uReveal;renderAccountsPage()};
$('uPager').onclick=e=>{e.preventDefault();const b=e.target.closest('.pg');if(!b||b.disabled)return;state.uPage=+b.dataset.p;pageTo('uPager',b,renderAccountsPage)};
const findAccount=id=>allAccounts().find(u=>u.id===id);
/* bấm vào dòng: mở trang thông tin của tài khoản (của mình → Thông tin cá nhân); nút Sửa: mở popup sửa */
const accountRoute=u=>u.me?ROUTE.profile:"ho-so-"+u.id;
$('uTb').onclick=e=>{
  const tr=e.target.closest('tr.main');if(!tr)return;const u=findAccount(tr.dataset.id);if(!u)return;
  if(e.target.closest('[data-edit]'))openAccount(u,e.target.closest('[data-edit]'));else navigate(accountRoute(u));
};
$('uTb').addEventListener('keydown',e=>{const tr=e.target.closest('tr.main');if(tr&&e.target===tr&&e.key==='Enter'){e.preventDefault();navigate(accountRoute(findAccount(tr.dataset.id)))}});
$('uNew').onclick=e=>openAccount(null,e.currentTarget);

/* ---- Popup tạo / sửa tài khoản ----
   Dùng chung cho 2 nơi:
   - trang Quản lí tài khoản (Admin): tạo mới, sửa thông tin và vai trò
   - nút "Sửa thông tin" ở trang Thông tin cá nhân
   Popup trông thế nào tùy theo VAI TRÒ người đang dùng, không tùy trang:
   - có quyền manageAccounts (Admin): popup đầy đủ, có phần Vai trò (trừ vai trò của chính mình) — giống nhau ở cả 2 trang
   - vai trò khác: ẩn phần Vai trò, chỉ sửa Họ và tên / CCCD / SĐT
   opts.fromProfile chỉ để biết lưu xong thì vẽ lại trang nào. */
const rxEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
['uCccd','uPhone'].forEach(id=>$(id).addEventListener('input',e=>{e.target.value=e.target.value.replace(/\D/g,'')}));
['uName','uEmail','uCccd','uPhone'].forEach(id=>$(id).addEventListener('input',e=>check(e.target,true,'')));
let uEditing=null,uOpener=null,uOpts={}; /* uEditing: tài khoản đang sửa; null = tạo mới */
function openAccount(u,opener,opts={}){
  /* từ trang Quản lí tài khoản: cần manageAccounts; từ trang thông tin: tài khoản của mình, hoặc người khác với quyền editApplicant */
  if(opts.fromProfile?!(u&&(u.me||can("editApplicant"))):!can("manageAccounts"))return;
  uEditing=u;uOpener=opener;uOpts=opts;
  const admin=can("manageAccounts");
  $('uTitle').textContent=u?"Sửa thông tin tài khoản":"Tạo tài khoản mới"; /* cùng một tên ở mọi nơi */
  $('uSub').textContent="Người dùng đăng nhập bằng tài khoản Google của trường với email này. CCCD và số điện thoại có thể để trống.";
  $('uSub').hidden=!!u; /* chỉ hiện khi tạo mới */
  $('uName').value=u?u.name:'';$('uEmail').value=u?u.email:'';$('uCccd').value=u?u.cccd||'':'';$('uPhone').value=u?u.phone||'':'';
  $('uEmail').readOnly=!!u;
  const role=u?u.role:"nop";
  document.querySelectorAll('input[name="uRole"]').forEach(r=>{r.checked=r.value===role;r.disabled=!!(u&&u.me)}); /* không tự đổi vai trò của mình */
  $('uRoleHint').hidden=!(admin&&u&&u.me);
  $('uForm').querySelector('.u-role').hidden=!admin; /* không phải Admin: ẩn Vai trò */
  ['uName','uEmail','uCccd','uPhone'].forEach(id=>check($(id),true,''));
  $('uOk').textContent=u?"Lưu thay đổi":"Tạo tài khoản";
  $('uModal').hidden=false;$('uName').focus();
}
function closeAccount(){$('uModal').hidden=true;uEditing=null;if(uOpener&&uOpener.isConnected&&uOpener.offsetParent)uOpener.focus()}
$('uCancel').onclick=closeAccount;
let uDownOnBg=false;$('uModal').addEventListener('mousedown',e=>{uDownOnBg=e.target.id==='uModal'});
$('uModal').onclick=e=>{if(e.target.id==='uModal'&&uDownOnBg)closeAccount()};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('uModal').hidden)closeAccount()});
$('uForm').addEventListener('submit',e=>{
  e.preventDefault();
  const u=uEditing,name=$('uName').value.trim(),email=$('uEmail').value.trim().toLowerCase(),cccd=$('uCccd').value.trim(),phone=$('uPhone').value.trim();
  const others=allAccounts().filter(x=>x!==u&&!(u&&u.me&&x.me));
  const ok=[
    check($('uName'),name.split(/\s+/).length>=2,"Nhập đầy đủ họ và tên."),
    u?true:check($('uEmail'),rxEmail.test(email)&&isSchoolEmail(email)&&!others.some(x=>x.email.toLowerCase()===email),
      !rxEmail.test(email)?`Nhập đúng địa chỉ email, ví dụ ten@${SCHOOL_EMAIL_DOMAINS[0]}.`:!isSchoolEmail(email)?`Chỉ dùng email trường (@${SCHOOL_EMAIL_DOMAINS[0]}).`:"Email này đã có tài khoản."),
    check($('uCccd'),!cccd||(rx.cccd.test(cccd)&&!others.some(x=>x.cccd===cccd)),rx.cccd.test(cccd)?"Số CCCD này đã thuộc tài khoản khác.":"Số CCCD gồm đúng 12 chữ số và bắt đầu bằng 0."),
    check($('uPhone'),!phone||rx.phone.test(phone),"Số điện thoại gồm 10 chữ số, bắt đầu bằng 03, 05, 07, 08 hoặc 09.")
  ].every(Boolean);
  if(!ok){const bad=$('uForm').querySelector('input.err');if(bad)bad.focus();return}
  const role=(document.querySelector('input[name="uRole"]:checked')||{}).value||"nop";
  if(!u){
    const acc={id:`tk-${Date.now()}`,name,email,cccd,phone,role,apps:[]};
    state.others.push(acc);
    /* hiện tài khoản vừa tạo: bỏ tìm kiếm / lọc đang chặn nó */
    state.uQuery="";$('uSearch').value="";state.uFilters=[];
    const list=uTools.apply(allAccounts().map(x=>({u:x})));state.uPage=Math.floor(list.findIndex(r=>r.u===acc)/U_PER)+1;
    closeAccount();renderAccountsPage();toast(`Đã tạo tài khoản ${name} (${ROLES[role].name})`);
    return;
  }
  const fromProfile=!!uOpts.fromProfile;
  if(u.me){Object.assign(state.profile,{name,cccd,phone});renderAccount()} /* tài khoản của mình: giữ nguyên vai trò */
  else Object.assign(u,can("manageAccounts")?{name,cccd,phone,role}:{name,cccd,phone}); /* chỉ Admin đổi vai trò; sửa trực tiếp trên tài khoản nên tên mới hiện ở mọi nơi dùng tài khoản này */
  closeAccount();
  if(fromProfile){renderProfile();toast("Đã cập nhật thông tin")}
  else{renderAccountsPage();toast(`Đã lưu thay đổi tài khoản ${name}`)}
});
