/* Trang Thông tin cá nhân: phần 1 hồ sơ, phần 2 bảng đơn đã nộp (tìm kiếm, sắp xếp, lọc, phân trang, xem nhanh). */
/* tên và chữ cái avatar trên header và trong menu */
function renderAccount(){
  const n=state.profile.name,w=n.trim().split(/\s+/),ini=(w[w.length-1][0]||"?").toUpperCase();
  document.querySelectorAll('.js-name').forEach(e=>e.textContent=n);document.querySelectorAll('.js-avatar').forEach(e=>e.textContent=ini);
}
/* người đang hiển thị trên trang hồ sơ: chính mình, hoặc người nộp đơn mà cán bộ đang xem */
function viewedPerson(){
  if(state.viewing)return {...state.viewing,mine:false};
  return {name:state.profile.name,cccd:state.profile.cccd,phone:state.profile.phone,email:state.user.email,students:state.students,mainMssv:state.mainMssv,apps:state.apps,mine:true};
}
function renderProfile(){
  const p=viewedPerson();
  $('pName').textContent=p.name;$('pNameBig').textContent=p.name;{const w=p.name.trim().split(/\s+/);$('pAvatar').textContent=(w[w.length-1][0]||'?').toUpperCase()}$('pPhone').textContent=fmtP(p.phone);$('pEmail').textContent=p.email;
  $('pCccd').textContent=state.showCccd&&p.cccd?p.cccd:maskC(p.cccd);$('revealBtn').textContent=state.showCccd?"Ẩn":"Hiện";
  $('revealBtn').hidden=!p.cccd; /* chưa có CCCD thì không có nút Hiện */
  renderStudentInfo(p);
  $('h1s').textContent=p.mine?"Thông tin cá nhân":"Thông tin người nộp đơn";
  /* hồ sơ của mình: sửa + nộp đơn theo quyền submit; hồ sơ người khác: chỉ vai trò có editApplicant / submitForApplicant */
  $('editBtn').hidden=!(p.mine||can('editApplicant'));
  $('newBtn').hidden=p.mine?!can('submit'):!can('submitForApplicant');
  renderAccount();
  renderTable();
}
/* ---------- Thông tin sinh viên ----------
   Một email có thể gắn với nhiều MSSV (MSSV trùng phần trước @ của email đứng đầu).
   Trang thông tin chỉ hiện 1 hàng 6 mục: MSSV chính (person.mainMssv, mặc định MSSV đầu). MSSV chính cũng là
   thông tin điền vào file Word khi xuất đơn. Có ít nhất 1 MSSV thì có nút "Thông tin sinh viên" (cạnh "Sửa thông tin"),
   mở khung trượt từ phải ra để chọn.
   Trong một hàng: có ít nhất 1 mục thì hiện đủ 6 ô, ô trống ghi "—" (như SĐT, CCCD). */
const studentVal=(st,k)=>st&&st[k]!=null?String(st[k]).trim():"";
const hasStudentData=st=>STUDENT_FIELDS.some(f=>studentVal(st,f.k)!=="");
const studentsOf=p=>(p.students||[]).filter(hasStudentData);
/* MSSV chính của một người: MSSV đã chọn; chưa chọn (hoặc không còn) thì MSSV đầu; không có thì null */
function mainStudentOf(p){const list=studentsOf(p);return list.find(st=>st.mssv===p.mainMssv)||list[0]||null}
/* đổi được MSSV chính: hồ sơ của mình, hoặc Admin (quyền editApplicant) */
const canPickMssv=p=>p.mine||can('editApplicant');
function renderStudentInfo(p){
  const main=mainStudentOf(p);
  $('stuPick').hidden=!main; /* lấy được ít nhất 1 MSSV thì có nút */
  if(!main){$('pStudent').innerHTML='';$('pStudent').hidden=true;return}
  $('pStudent').innerHTML=`<dl class="info">${STUDENT_FIELDS.map(f=>`<div><dt>${f.t}</dt><dd>${studentVal(main,f.k)?esc(studentVal(main,f.k)):"—"}</dd></div>`).join('')}</dl>`;
  $('pStudent').hidden=false;
}
/* Khung "Thông tin sinh viên": danh sách mọi MSSV, MSSV chính có nhãn "Đang dùng"; bấm MSSV khác để chọn làm MSSV chính */
function renderStuList(){
  const p=viewedPerson(),main=mainStudentOf(p),editable=canPickMssv(p);
  $('stuSheetSub').textContent=editable
    ?'Chọn MSSV dùng làm thông tin chính. MSSV này hiện trên trang thông tin và được điền vào file Word khi xuất đơn.'
    :'MSSV "Đang dùng" là thông tin chính khi xuất file. Chỉ người nộp đơn hoặc Admin mới đổi được.';
  $('stuList').innerHTML=studentsOf(p).map(st=>{
    const on=st===main,v=k=>studentVal(st,k)?esc(studentVal(st,k)):'—';
    return `<button type="button" role="radio" class="stu-opt" aria-checked="${on}" data-mssv="${esc(studentVal(st,'mssv'))}"${editable?'':' disabled'}>
      <span class="stu-opt-top"><span class="stu-opt-id">${v('mssv')}</span>${on?'<span class="stu-opt-tag">Đang dùng</span>':''}</span>
      <span class="stu-opt-grid">${STUDENT_FIELDS.filter(f=>f.k!=='mssv').map(f=>`<span><span class="k">${f.t}</span><span class="v">${v(f.k)}</span></span>`).join('')}</span>
    </button>`;
  }).join('');
  $('stuList').querySelectorAll('.stu-opt').forEach(b=>b.onclick=()=>b.getAttribute('aria-checked')==='true'?closeStuSheet():setMainMssv(b.dataset.mssv));
}
/* chọn MSSV chính: lưu vào người đang xem (mình hoặc người khác), vẽ lại hàng thông tin sinh viên */
function setMainMssv(mssv){
  if(viewedPerson().mine)state.mainMssv=mssv;else state.viewing.mainMssv=mssv;
  closeStuSheet();renderStudentInfo(viewedPerson());
  toast(`Đã chọn MSSV ${mssv} làm thông tin chính`);
}
function openStuSheet(){
  renderStuList();
  $('stuSheet').classList.add('open');$('stuSheet').inert=false;$('stuSheetBg').hidden=false;
  ($('stuList').querySelector('[aria-checked="true"]')||$('stuSheetClose')).focus({preventScroll:true});
}
function closeStuSheet(){
  if(!$('stuSheet').classList.contains('open'))return;
  $('stuSheet').classList.remove('open');$('stuSheet').inert=true;$('stuSheetBg').hidden=true;
  if(!$('vProfile').hidden&&!$('stuPick').hidden)$('stuPick').focus({preventScroll:true});
}
$('stuPick').onclick=openStuSheet;
$('stuSheetClose').onclick=closeStuSheet;
$('stuSheetBg').onclick=closeStuSheet;
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeStuSheet()});
window.addEventListener('hashchange',closeStuSheet);
$('revealBtn').onclick=()=>{state.showCccd=!state.showCccd;renderProfile()};
/* Sửa thông tin: mở cùng popup với trang Quản lí tài khoản (js/accounts-page.js); Admin thấy cả phần Vai trò, vai trò khác thì không */
$('editBtn').onclick=e=>{const u=state.viewing||allAccounts().find(x=>x.me);openAccount(u,e.currentTarget,{fromProfile:true})};
/* Bảng đơn trên trang hồ sơ (dùng cho mục 2 "Đơn đã nộp" và mục 3 "Đơn phụ trách"):
   cùng các cột thông tin đơn, tìm kiếm / Sắp xếp / Lọc (table-tools.js), xem nhanh, phân trang */
const P_FIELDS=APP_FIELDS.filter(f=>["code","type","date","status"].includes(f.k));
/* Cột người tiếp nhận / người xử lí (phần bên phải bảng mục 3, ngăn bằng đường kẻ dọc như trang Quản lí đơn).
   Lọc chọn theo tên cán bộ có trong dữ liệu. */
const personField=(k,t,key,grp)=>({k,t,type:"select",grp,get:r=>r.a[key]?r.a[key].email:null,
  label:v=>{const hit=allRows().find(x=>x.a[key]&&x.a[key].email===v);return hit?hit.a[key].name:v},
  opts:()=>[...new Set(allRows().map(x=>x.a[key]&&x.a[key].email).filter(Boolean))]});
const H_FIELDS=[...P_FIELDS,personField("receiver","Người tiếp nhận","receiver",true),personField("handler","Người xử lí","handler",false)];
function createAppTable(o){ /* o: {ids, st (query/sort/filters/page), getApps(), emptyText, fields?} */
  const {ids,st}=o,FIELDS=o.fields||P_FIELDS,COLS=FIELDS.length+2;
  const tools=createTableTools({
    fields:FIELDS,
    st:{get sort(){return st.sort},get filters(){return st.filters},get query(){return st.query}},
    defaultSort:[{k:"date",dir:"desc"},{k:"code",dir:"desc"}],
    ids:{sortBtn:ids.sortBtn,sortPop:ids.sortPop,sortCnt:ids.sortCnt,filtBtn:ids.filtBtn,filtPop:ids.filtPop,filtCnt:ids.filtCnt},
    onChange:()=>{st.page=1;render()}
  });
  $(ids.search).addEventListener('input',e=>{st.query=e.target.value;st.page=1;render()});
  function render(){
    $(ids.head).innerHTML=`<th style="width:28px"><button type="button" class="exp" id="${ids.expAll}" aria-expanded="false" aria-label="Mở xem nhanh tất cả đơn" title="Mở/đóng tất cả">›</button></th>`+FIELDS.map(f=>tools.th(f,f.grp?'grp':'')).join('')+'<th></th>';
    tools.counts();
    const tb=$(ids.body);tb.innerHTML='';
    const all=tools.apply(o.getApps().map(a=>({a})));
    const pages=Math.max(1,Math.ceil(all.length/PER));st.page=Math.min(st.page,pages);
    const from=(st.page-1)*PER,list=all.slice(from,from+PER).map(r=>r.a);
    renderPager(ids.pager,st.page,all.length,pages,from,list.length);
    if(!list.length){tb.innerHTML=`<tr><td colspan="${COLS}" class="empty">${tools.hasQuery()?'Không có đơn nào khớp điều kiện tìm kiếm và bộ lọc.':(typeof o.emptyText==='function'?o.emptyText():o.emptyText)}</td></tr>`;syncAll(ids.body,ids.expAll);return}
    const q=st.query.trim();
    list.forEach(a=>{
      const s=STATUS[a.status],T=TYPES[a.type];
      const tr=document.createElement('tr');tr.className='main';tr.tabIndex=0;
      tr.innerHTML=`<td><button type="button" class="exp" aria-expanded="false" aria-label="Xem nhanh đơn ${a.code}">›</button></td><td class="code">${hl(a.code,q)}</td><td class="type">${hl(T.name,q)}</td><td class="num">${hl(fmtD(a.date),q)}</td><td><span class="pill ${s.c}">${hl(s.t,q)}</span></td>${FIELDS.slice(P_FIELDS.length).map(f=>{const v=f.get({a});return `<td class="nm${f.grp?' grp':''}">${v?hl(f.label(v),q):'<span class="dash">—</span>'}</td>`}).join('')}<td class="go"><span class="go-btn">Chi tiết ›</span></td>`;
      const dt=document.createElement('tr');dt.className='detail';dt.hidden=true;
      dt.innerHTML=`<td></td><td colspan="${COLS-1}">${quickHtml(a)}</td>`; /* xem nhanh: card nội dung chính, giống trang chi tiết */
      tr.querySelector('.exp').onclick=e=>{e.stopPropagation();setOpen(tr,dt.hidden);syncAll(ids.body,ids.expAll)};
      tr.onclick=()=>navigate("don-"+a.code);
      tr.onkeydown=e=>{if(e.target===tr&&e.key==='Enter'){e.preventDefault();navigate("don-"+a.code)}};
      tb.append(tr,dt);
    });
    fillQuick(tb);
    syncAll(ids.body,ids.expAll);
  }
  $(ids.pager).onclick=e=>{e.preventDefault();const b=e.target.closest('.pg');if(!b||b.disabled)return;st.page=+b.dataset.p;pageTo(ids.pager,b,render)};
  $(ids.head).onclick=e=>{
    if(!e.target.closest('#'+ids.expAll))return;
    const rows=[...$(ids.body).querySelectorAll('tr.main')],open=!rows.every(r=>r.classList.contains('open'));
    rows.forEach(r=>setOpen(r,open));syncAll(ids.body,ids.expAll);
  };
  return {render};
}
function renderPager(id,page,total,pages,from,n){
  const pg=$(id);
  if(total<=PER){pg.innerHTML=total?`<span>${total} đơn</span>`:'';return}
  let h=`<span>Hiển thị ${from+1}–${from+n} trong ${total} đơn</span><div class="pages"><button type="button" class="pg" data-p="${page-1}" ${page===1?'disabled':''} aria-label="Trang trước">‹</button>`;
  for(let i=1;i<=pages;i++)h+=`<button type="button" class="pg" data-p="${i}" ${i===page?'aria-current="page"':''}>${i}</button>`;
  h+=`<button type="button" class="pg" data-p="${page+1}" ${page===pages?'disabled':''} aria-label="Trang sau">›</button></div>`;
  pg.innerHTML=h;
}
/* Mục 2: Đơn đã nộp của người đang xem */
const submittedTable=createAppTable({
  ids:{search:"pSearch",sortBtn:"pSortBtn",sortPop:"pSortPop",sortCnt:"pSortCnt",filtBtn:"pFiltBtn",filtPop:"pFiltPop",filtCnt:"pFiltCnt",head:"pHead",body:"tb",pager:"pager",expAll:"expAll"},
  st:{get query(){return state.pQuery},set query(v){state.pQuery=v},get sort(){return state.pSort},get filters(){return state.pFilters},get page(){return state.page},set page(v){state.page=v}},
  getApps:()=>viewedPerson().apps,
  emptyText:'Chưa có đơn nào. Bấm “Nộp đơn mới” để tạo đơn.'
});
/* Mục 3: Đơn phụ trách — mọi đơn mà người đang đăng nhập là người tiếp nhận hoặc người xử lí */
const handledTable=createAppTable({
  ids:{search:"mSearch",sortBtn:"mSortBtn",sortPop:"mSortPop",sortCnt:"mSortCnt",filtBtn:"mFiltBtn",filtPop:"mFiltPop",filtCnt:"mFiltCnt",head:"mHead",body:"mtb",pager:"mPager",expAll:"mExpAll"},
  st:{get query(){return state.mQuery},set query(v){state.mQuery=v},get sort(){return state.mSort},get filters(){return state.mFilters},get page(){return state.mPage},set page(v){state.mPage=v}},
  /* đơn mà mình là người tiếp nhận HOẶC người xử lí; bên phải bảng có 2 cột Người tiếp nhận / Người xử lí */
  fields:H_FIELDS,
  /* của người đang xem trên trang hồ sơ: chính mình, hoặc tài khoản cán bộ mà Admin / cán bộ mở từ Quản lí tài khoản */
  getApps:()=>{const em=viewedPerson().email;return allRows().filter(r=>[r.a.receiver,r.a.handler].some(x=>x&&x.email===em)).map(r=>r.a)},
  emptyText:()=>viewedPerson().mine?'Bạn chưa tiếp nhận hay phụ trách đơn nào.':`${viewedPerson().name} chưa tiếp nhận hay phụ trách đơn nào.`
});

/* Mốc thời gian của đơn:
   submittedAt = lúc nộp; updatedAt = thay đổi mới nhất (lúc nộp hoặc lần lưu chỉnh sửa gần nhất);
   receivedAt = lúc phòng Đào tạo bấm "Tiếp nhận" (đơn chuyển từ Đã nộp sang Đang xét). */
function lastEdit(a){return a.updatedAt?`<p class="upd">Cập nhật lúc ${fmtT(a.updatedAt)}</p>`:''}
/* Mở/đóng xem nhanh: từng dòng và tất cả dòng trong một bảng */
function setOpen(tr,open){
  const dt=tr.nextElementSibling;if(!dt||!dt.classList.contains('detail'))return;
  dt.hidden=!open;tr.classList.toggle('open',open);tr.querySelector('.exp').setAttribute('aria-expanded',open);
}
function syncAll(bodyId,btnId){
  const rows=[...$(bodyId).querySelectorAll('tr.main')],b=$(btnId);if(!b)return;
  const all=rows.length>0&&rows.every(r=>r.classList.contains('open'));
  b.classList.toggle('all-open',all);b.setAttribute('aria-expanded',all);
  b.setAttribute('aria-label',all?'Đóng xem nhanh tất cả đơn':'Mở xem nhanh tất cả đơn');
  b.disabled=!rows.length;
}
/* Vẽ lại các bảng trên trang hồ sơ.
   Mục 3 "Đơn phụ trách" hiện khi người đang xem có vai trò xử lí đơn (quyền decide):
   - hồ sơ của mình: theo vai trò của mình
   - hồ sơ người khác: theo vai trò của tài khoản đó, và người xem phải xem được mọi đơn (viewAll) */
function roleCan(role,perm){return !!ROLES[role]&&ROLES[role].perms.includes(perm)}
function renderTable(){
  submittedTable.render();
  const p=viewedPerson();
  const showHandled=p.mine?can("decide"):roleCan(p.role,"decide")&&can("viewAll");
  $('secHandled').hidden=!showHandled;
  if(showHandled)handledTable.render();
}
