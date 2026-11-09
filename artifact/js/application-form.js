/* Màn hình đơn: dùng chung cho nộp đơn mới và xem/sửa chi tiết đơn. */
/* thông tin chung của đơn trên trang chi tiết: dạng nhãn – giá trị theo cột, tự xuống dòng khi tên dài */
function subLine(a){
  const s=STATUS[a.status];
  const item=(k,v)=>`<div><dt>${k}</dt><dd>${v}</dd></div>`;
  return `<dl class="meta">${item("Trạng thái",`<span class="pill ${s.c}">${s.t}</span>`)}${item("Loại đơn",esc(TYPES[a.type].name))}${item("Nộp lúc",a.submittedAt?fmtT(a.submittedAt):fmtD(a.date))}${item("Cập nhật lúc",a.updatedAt?fmtT(a.updatedAt):"—")}</dl>`;
}

/* Màn hình đơn: dùng chung cho nộp mới và xem/sửa chi tiết */
let mode={kind:"new"};
let formFresh=false; /* true khi bấm "Nộp đơn mới": mở form trống; false khi quay lại bằng Back: giữ bản đang soạn */
/* nộp đơn mới cho chính mình (#nop-don) hoặc thay cho người nộp đang xem (#nop-don-<id>, admin) */
/* Nộp đơn mới: chỉ các loại đơn "Đang mở". Một loại thì vào thẳng form; nhiều loại thì hiện danh sách để chọn. */
let newType=null;
const chosenType=()=>newType&&TYPES[newType]&&TYPES[newType].status==="open"?newType:(openTypes().length===1?openTypes()[0]:null);
function startNew(type){newType=type;formFresh=true;closeNewPicker(false);navigate(state.viewing?ROUTE.newForm+"-"+state.viewing.id:ROUTE.newForm)}
/* Hộp "Chọn loại đơn": luôn hiện khi bấm Nộp đơn mới, có ô tìm kiếm để dùng được khi có nhiều loại đơn */
let nSel=0;
function nMatches(){
  const q=norm($('nSearch').value.trim());
  return openTypes().filter(k=>{const T=TYPES[k];return !q||[T.name,T.prefix,T.desc].some(x=>x&&norm(x).includes(q))})
    .sort((a,b)=>TYPES[a].name.localeCompare(TYPES[b].name,'vi'));
}
function renderNewPicker(){
  const q=$('nSearch').value.trim(),list=nMatches(),all=openTypes().length;
  nSel=Math.min(nSel,Math.max(0,list.length-1));
  $('nList').innerHTML=list.length?list.map((k,i)=>{const T=TYPES[k];return `<button type="button" class="n-opt${i===nSel?' sel':''}" role="option" aria-selected="${i===nSel}" data-type="${esc(k)}">
      <span class="n-top"><b>${hl(T.name,q)}</b>${T.prefix?`<span class="ftype">${hl(T.prefix,q)}</span>`:''}</span>
      ${T.desc?`<span class="n-desc">${hl(T.desc,q)}</span>`:''}</button>`}).join('')
    :`<p class="empty-note">Không có loại đơn nào khớp “${esc(q)}”.</p>`;
  $('nCount').textContent=q?`${list.length} / ${all} loại đơn đang nhận đơn`:`${all} loại đơn đang nhận đơn`;
}
let nOpener=null;
function closeNewPicker(refocus=true){$('nModal').hidden=true;if(refocus&&nOpener&&nOpener.offsetParent)nOpener.focus()}
$('newBtn').onclick=e=>{
  e.stopPropagation();
  if(!openTypes().length){toast("Hiện chưa có loại đơn nào đang nhận đơn.");return}
  nOpener=e.currentTarget;$('nSearch').value='';nSel=0;renderNewPicker();$('nModal').hidden=false;$('nSearch').focus();
};
$('nSearch').addEventListener('input',()=>{nSel=0;renderNewPicker()});
$('nSearch').addEventListener('keydown',e=>{
  const list=nMatches();
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!list.length)return;nSel=(nSel+(e.key==='ArrowDown'?1:-1)+list.length)%list.length;renderNewPicker();$('nList').querySelector('.sel').scrollIntoView({block:'nearest'})}
  else if(e.key==='Enter'&&list.length){e.preventDefault();startNew(list[nSel])}
});
$('nList').onclick=e=>{const b=e.target.closest('[data-type]');if(b)startNew(b.dataset.type)};
$('nClose').onclick=()=>closeNewPicker();
let nDownOnBg=false;$('nModal').addEventListener('mousedown',e=>{nDownOnBg=e.target.id==='nModal'});
$('nModal').onclick=e=>{if(e.target.id==='nModal'&&nDownOnBg)closeNewPicker()};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('nModal').hidden)closeNewPicker()});
/* tìm đơn theo mã trong toàn bộ dữ liệu (của mình và của sinh viên khác) */
function findApp(code){return allRows().find(r=>r.a.code===code)}
const formTitle=T=>T.name; /* một tên duy nhất cho loại đơn: tiêu đề trang đơn = Tên loại đơn */
function prepForm(type,p,keep=false){
  const mine=!p||p.apps===state.apps;
  $('fName').textContent=mine?state.profile.name:p.name;$('fEmail').textContent=mine?state.user.email:p.email;
  /* khung bên phải chỉ hiện họ tên và email người nộp đơn; SĐT xem ở hồ sơ (Xem hồ sơ ›) */
  /* nút sang trang thông tin: hồ sơ của mình, hoặc hồ sơ người nộp (cán bộ có quyền viewApplicant) */
  const canView=!mine&&can("viewApplicant")&&p&&p.id;
  const tp=$('toProfile');tp.hidden=!(mine||canView);
  tp.dataset.target=mine?ROUTE.profile:"ho-so-"+(canView?p.id:"");
  if(!keep)$('cam').checked=false;
  $('formMsg').hidden=true;
}
/* các phần của mục "Nội dung đơn" đang hiện trên trang (xem js/sections.js) */
let secs=[];
function buildSections(type,data,readonly){
  secs=renderSections(type,data,{readonly});
  $('fSections').replaceChildren(...secs.map(s=>s.el));
  if(typeof initCollapsible==='function')initCollapsible($('fSections')); /* các phần của đơn cũng thu gọn được */
}
function openForm(type,forPerson=null){
  const keep=!formFresh&&mode.kind==="new"&&mode.forPerson===forPerson&&mode.type===type;formFresh=false; /* giữ bản đang soạn khi quay lại */
  mode={kind:"new",type,forPerson};prepForm(type,forPerson,keep);
  $('fTitle').textContent=formTitle(TYPES[type]);$('fMeta').hidden=true;
  $('fNotice').hidden=true;$('fReceive').hidden=true;setupPrintButton(null);$('fHandler').hidden=true;$('fReceiver').hidden=true;$('fDecide').hidden=true;$('xmmForm').classList.remove('ro');
  $('fSubmit').textContent="Gửi đơn";$('formCancel').textContent="Hủy";
  if(!keep)buildSections(type,null,false);
  show('vForm');
}
function openDetail(code){
  const hit=findApp(code);if(!hit)return;const a=hit.a;
  const mine=hit.p.apps===state.apps;
  /* chỉ sửa khi trạng thái còn cho sửa (EDITABLE): đơn của mình (editOwn) hoặc đơn người khác (editAnyApp, Admin) */
  const editable=EDITABLE.includes(a.status)&&((mine&&can("editOwn"))||can("editAnyApp"));
  mode={kind:"edit",code,type:a.type};prepForm(a.type,hit.p);
  $('fTitle').textContent=`Chi tiết đơn ${a.code}`;
  $('fMeta').innerHTML=subLine(a);$('fMeta').hidden=false; /* trạng thái, loại đơn, nộp lúc, cập nhật lúc */
  renderNotice(a);
  setupPrintButton(a); /* nút Xuất file: hiện khi loại đơn có mẫu xuất file (print-templates.js) */
  $('fReceive').hidden=!(can("receive")&&RECEIVABLE.includes(a.status)); /* nút Tiếp nhận cho cán bộ */
  $('fDecide').hidden=!canDecideOn(a);     /* Yêu cầu bổ sung / Duyệt / Từ chối: chỉ người xử lí đơn (hoặc Admin) */
  /* mục Người tiếp nhận đơn và Người xử lí đơn: hiện khi đơn đã được tiếp nhận */
  $('fReceiver').hidden=!a.receiver;
  if(a.receiver){$('rName').textContent=a.receiver.name;$('rAt').textContent=a.receivedAt?fmtT(a.receivedAt):''}
  $('fHandler').hidden=!a.handler;
  if(a.handler){$('hName').textContent=a.handler.name;$('hSince').textContent=a.handlerSince?fmtT(a.handlerSince):''}
  $('hTransfer').hidden=!(a.handler&&can("transfer")&&TRANSFERABLE.includes(a.status));
  buildSections(a.type,a.data,!editable);
  $('xmmForm').classList.toggle('ro',!editable);
  $('fSubmit').textContent="Lưu thay đổi";$('formCancel').textContent=editable?"Hủy thay đổi":"Đóng";
  show('vForm');
}
/* khung thông báo trên trang chi tiết, đổi màu theo trạng thái */
/* khung thông báo trên trang chi tiết: một câu cố định theo trạng thái (giống nhau với mọi vai trò),
   kèm dòng "Phòng Đào tạo:" chỉ khi người xử lí đơn có nhập lí do (Yêu cầu bổ sung / Từ chối) */
const STATUS_MSG={
  nop:  ()=>"Đơn đã được gửi, đang chờ phòng Đào tạo tiếp nhận. Người nộp đơn được quyền chỉnh sửa đến khi đơn được tiếp nhận.",
  xet:  ()=>"Phòng Đào tạo đang xét đơn.",
  bs:   ()=>"Phòng Đào tạo yêu cầu bổ sung hồ sơ. Sau khi người nộp đơn sửa và lưu, đơn chuyển sang “Đã bổ sung”.",
  bsg:  a=>`Người nộp đơn đã bổ sung lúc ${fmtT(a.updatedAt)}, đang chờ phòng Đào tạo tiếp nhận lại. Người nộp đơn được quyền chỉnh sửa đến khi đơn được tiếp nhận.`,
  duyet:()=>"Đơn đã được duyệt.",
  tc:   ()=>"Đơn đã bị từ chối."
};
function renderNotice(a){
  const lines=[STATUS_MSG[a.status](a)];
  if(a.note)lines.push(`<b>Phòng Đào tạo:</b> ${esc(a.note)}`);
  const nb=$('fNotice');nb.innerHTML=lines.join('<br>');nb.className='notice n-'+a.status;nb.hidden=false;
}
/* rời màn hình đơn: quay về trang đã mở nó (Thông tin cá nhân hoặc Đơn) */
/* rời màn hình đơn: về trang trước (giống nút Back), không có trang trước thì về trang chính của vai trò */
const leaveForm=()=>goBack();
$('formBack').onclick=leaveForm;
$('fReceive').onclick=()=>{if(mode.kind==="edit"&&receiveApp(mode.code))openDetail(mode.code)}; /* vẽ lại trang với trạng thái mới */$('formCancel').onclick=leaveForm;
$('toProfile').onclick=e=>navigate(e.currentTarget.dataset.target||ROUTE.profile); /* sang trang thông tin; ở đó có nút quay lại đơn */

/* phần nào có thay đổi so với dữ liệu đã lưu */
function describeChange(oldD,newD){
  return secs.filter(x=>x.qs.some(({q})=>q.type!=="info"&&JSON.stringify(oldD[q.id])!==JSON.stringify(newD[q.id]))).map(x=>'cập nhật '+x.sec.title.toLowerCase());
}
$('xmmForm').addEventListener('submit',e=>{
  e.preventDefault();
  const errs=secs.map(x=>x.validate()).filter(Boolean); /* mỗi phần tự kiểm tra */
  if(!$('cam').checked)errs.push('Đánh dấu ô cam đoan trước khi gửi.');
  const fm=$('formMsg');fm.hidden=!errs.length;fm.innerHTML=errs.join('<br>');
  if(errs.length)return;
  const data=Object.assign({},...secs.map(x=>x.get())),at=nowIso(); /* câu trả lời theo id câu hỏi */
  if(mode.kind==="edit"){
    const a=findApp(mode.code).a;
    const ch=describeChange(a.data,data);
    if(!ch.length){toast("Không có thay đổi nào để lưu");return}
    a.data={...a.data,...data};a.updatedAt=at; /* giữ câu trả lời của câu hỏi đã bị xóa khỏi form */
    const supplemented=a.status==="bs";
    if(supplemented)a.status="bsg"; /* sửa đơn "Cần bổ sung" → "Đã bổ sung", chờ tiếp nhận lại */
    $('cam').checked=false;$('fMeta').innerHTML=subLine(a);renderNotice(a);
    toast(supplemented?`Đã bổ sung đơn lúc ${fmtT(at)}, đơn chuyển sang “Đã bổ sung”`:`Đã lưu thay đổi lúc ${fmtT(at)}`);
    return;
  }
  const y=at.slice(0,4);
  /* số thứ tự lấy lớn nhất trên toàn bộ đơn để không trùng mã (bản thật: máy chủ sinh mã) */
  const pf=TYPES[mode.type].prefix||"DON";
  const maxNo=Math.max(0,...allRows().map(r=>r.a.code).filter(c=>c.startsWith(`${pf}-${y}-`)).map(c=>+c.slice(-5)));
  const code=`${pf}-${y}-${String(maxNo+1).padStart(5,'0')}`;
  const owner=mode.forPerson; /* null = đơn của chính mình; có giá trị = admin nộp thay */
  (owner?owner.apps:state.apps).unshift({code,type:mode.type,date:at.slice(0,10),status:"nop",data,note:"",submittedAt:at,updatedAt:at,receivedAt:null});
  state.pQuery="";state.pFilters=[];$('pSearch').value="";state.page=1;
  setCollapsed($('secSubmitted'),false); /* vừa nộp đơn: mở mục Đơn đã nộp để thấy đơn mới */
  /* về trang hồ sơ đã mở form; thay mục "nộp đơn" trong lịch sử để Back không mở lại form đã gửi */
  const back=owner?"ho-so-"+owner.id:ROUTE.profile;
  if(prevRoute()===back)goBack();else navigate(back,{replace:true});
  toast(owner?`Đã nộp đơn ${code} thay cho ${owner.name}`:`Đã nộp đơn ${code}`);
});

/* ---- Cán bộ xử lí đơn đang xét: Yêu cầu bổ sung / Duyệt / Từ chối ----
   Yêu cầu bổ sung và Từ chối mở hộp thoại để ghi lí do (không bắt buộc); Duyệt thực hiện ngay. */
const DECIDE_TEXT={
  bs:{title:"Yêu cầu bổ sung đơn",ok:"Gửi yêu cầu bổ sung",cls:"warn",sub:"Đơn sẽ chuyển sang “Cần bổ sung” để người nộp sửa và gửi lại.",done:"Đã yêu cầu bổ sung đơn"},
  duyet:{done:"Đã duyệt đơn"},
  tc:{title:"Từ chối đơn",ok:"Xác nhận từ chối",cls:"no",sub:"Đơn sẽ chuyển sang “Từ chối”.",done:"Đã từ chối đơn"}
};
function decideApp(code,status,note){
  const hit=findApp(code);if(!hit||!canDecideOn(hit.a))return;
  const a=hit.a;a.status=status;a.note=note;a.decidedAt=nowIso();
  toast(`${DECIDE_TEXT[status].done} ${a.code}`);
  openDetail(a.code); /* vẽ lại trang với trạng thái mới */
}
let pendingDecision=null,decideOpener=null;
$('fDecide').onclick=e=>{
  const b=e.target.closest('[data-decide]');if(!b||mode.kind!=="edit")return;
  const st=b.dataset.decide;
  if(st==="duyet"){decideApp(mode.code,"duyet","");return}
  const t=DECIDE_TEXT[st];pendingDecision={code:mode.code,status:st};decideOpener=b;
  $('dTitle').textContent=`${t.title} ${mode.code}`;
  $('dSub').textContent=t.sub;
  $('dNote').value='';const ok=$('dOk');ok.textContent=t.ok;ok.className='btn primary '+t.cls;
  $('dModal').hidden=false;$('dNote').focus();
};
function closeDecide(){$('dModal').hidden=true;pendingDecision=null;if(decideOpener&&decideOpener.offsetParent)decideOpener.focus()}
$('dCancel').onclick=closeDecide;
let dDownOnBg=false;$('dModal').addEventListener('mousedown',e=>{dDownOnBg=e.target.id==='dModal'});
$('dModal').onclick=e=>{if(e.target.id==='dModal'&&dDownOnBg)closeDecide()};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('dModal').hidden)closeDecide()});
$('dOk').onclick=()=>{const d=pendingDecision;if(!d)return;const note=$('dNote').value.trim();closeDecide();decideApp(d.code,d.status,note)};

/* ---- Chuyển giao đơn cho người xử lí khác ---- */
function staffChoices(a){
  /* cán bộ = tài khoản có vai trò được quyền xử lí đơn (decide); tài khoản mới tạo ở trang Quản lí tài khoản tự có trong danh sách */
  const list=state.others.filter(p=>ROLES[p.role]&&ROLES[p.role].perms.includes("decide"));
  if(can("decide"))list.push({name:state.profile.name,email:state.user.email}); /* chính mình */
  const seen=new Set();
  return list.filter(p=>!seen.has(p.email)&&seen.add(p.email)&&(!a.handler||p.email!==a.handler.email));
}
let transferOpener=null,tOpts=[],tPicked=null,tActive=0;
$('hTransfer').onclick=e=>{
  if(mode.kind!=="edit")return;const a=findApp(mode.code).a;transferOpener=e.currentTarget;
  tOpts=staffChoices(a);tPicked=null;
  $('tTitle').textContent=`Chuyển giao đơn ${a.code}`;$('tCurrent').textContent=a.handler.name;
  $('tSearch').value='';$('tOk').disabled=true;closeCombo();
  $('tModal').hidden=false;$('tSearch').focus();openCombo();
};
/* ô "Chuyển cho": bấm vào sổ danh sách cán bộ, gõ để lọc theo tên / email; tên bên trái, email canh phải */
function comboMatches(){const q=norm($('tSearch').value.trim());return tOpts.map((p,i)=>({p,i})).filter(({p})=>!q||norm(p.name).includes(q)||norm(p.email).includes(q))}
function renderCombo(){
  const list=comboMatches();tActive=Math.min(tActive,Math.max(0,list.length-1));
  $('tTo').innerHTML=list.length?list.map(({p,i},k)=>`<li role="option" id="tOpt${i}" data-i="${i}" class="${k===tActive?'active':''}" aria-selected="${tPicked===i}"><span class="pn">${esc(p.name)}</span><span class="pe">${esc(p.email)}</span></li>`).join('')
    :`<li class="none">${tOpts.length?'Không tìm thấy cán bộ phù hợp.':'Không có cán bộ khác để chuyển giao.'}</li>`;
  const act=list[tActive];$('tSearch').setAttribute('aria-activedescendant',act?'tOpt'+act.i:'');
}
function openCombo(){tActive=0;renderCombo();$('tTo').hidden=false;$('tSearch').setAttribute('aria-expanded','true')}
function closeCombo(){$('tTo').hidden=true;$('tSearch').setAttribute('aria-expanded','false')}
function pickStaff(i){tPicked=i;$('tSearch').value=tOpts[i].name;$('tOk').disabled=false;closeCombo()}
$('tSearch').addEventListener('click',()=>{if($('tTo').hidden)openCombo()});
$('tSearch').addEventListener('input',()=>{tPicked=null;$('tOk').disabled=true;openCombo()});
$('tSearch').addEventListener('keydown',e=>{
  const list=comboMatches();
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if($('tTo').hidden){openCombo();return}tActive=(tActive+(e.key==='ArrowDown'?1:-1)+list.length)%Math.max(1,list.length);renderCombo()}
  else if(e.key==='Enter'){e.preventDefault();if(!$('tTo').hidden&&list[tActive])pickStaff(list[tActive].i)}
  else if(e.key==='Escape'&&!$('tTo').hidden){e.stopPropagation();closeCombo()} /* Esc lần đầu chỉ đóng danh sách */
});
/* chọn khi bấm xong (click), không phải lúc vừa nhấn chuột: tránh việc danh sách đóng sớm làm cú click rơi ra ngoài popup */
$('tTo').addEventListener('mousedown',e=>e.preventDefault()); /* giữ con trỏ trong ô tìm kiếm */
$('tTo').addEventListener('click',e=>{e.stopPropagation();const li=e.target.closest('li[data-i]');if(li)pickStaff(+li.dataset.i)});
$('tModal').addEventListener('click',e=>{if(!e.target.closest('.combo'))closeCombo()});
function closeTransfer(){$('tModal').hidden=true;closeCombo();if(transferOpener&&transferOpener.offsetParent)transferOpener.focus()}
$('tCancel').onclick=closeTransfer;
let tDownOnBg=false;$('tModal').addEventListener('mousedown',e=>{tDownOnBg=e.target.id==='tModal'});
$('tModal').onclick=e=>{if(e.target.id==='tModal'&&tDownOnBg)closeTransfer()}; /* chỉ đóng khi nhấn và thả đều ở vùng tối */
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('tModal').hidden)closeTransfer()});
$('tOk').onclick=()=>{
  const to=tPicked!=null?tOpts[tPicked]:null;closeTransfer();
  const hit=findApp(mode.code);if(!to||!hit||!can("transfer")||!TRANSFERABLE.includes(hit.a.status))return;
  hit.a.handler=to;hit.a.handlerSince=nowIso();
  toast(`Đã chuyển giao đơn ${hit.a.code} cho ${to.name}`);
  openDetail(hit.a.code);
};

/* Khung "Thông tin đơn" (người nộp, người tiếp nhận, người xử lí) ở trang đơn:
   - màn hình rộng: nằm bên phải; bấm › để ẩn, nội dung đơn giãn ra cả chiều ngang, nút "Thông tin đơn" ở đầu trang để hiện lại
     (nhớ lựa chọn trong trình duyệt này)
   - màn hình hẹp (≤ 1100px): ẩn sẵn, bấm "Thông tin đơn" để trượt ra từ bên phải; bấm ra ngoài, › hoặc Esc để đóng */
const sideMQ=window.matchMedia('(max-width: 1100px)');
let sideClosedWide=(()=>{try{return localStorage.getItem('sideClosed')==='1'}catch(_){return false}})();
function syncSide(){
  const v=$('vForm'),narrow=sideMQ.matches,openN=v.classList.contains('side-open');
  v.classList.toggle('side-closed',!narrow&&sideClosedWide);
  $('sideToggle').setAttribute('aria-expanded',String(narrow?openN:!sideClosedWide));
  $('sideBg').hidden=!(narrow&&openN&&!v.hidden);
  $('fSide').inert=narrow&&!openN;
}
function setSide(open){
  if(sideMQ.matches)$('vForm').classList.toggle('side-open',open);
  else{sideClosedWide=!open;try{localStorage.setItem('sideClosed',open?'0':'1')}catch(_){}}
  syncSide();(open?$('sideClose'):$('sideToggle')).focus({preventScroll:true});
}
$('sideToggle').onclick=()=>setSide(sideMQ.matches?!$('vForm').classList.contains('side-open'):sideClosedWide);
$('sideClose').onclick=()=>setSide(false);
$('sideBg').onclick=()=>setSide(false);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&sideMQ.matches&&$('vForm').classList.contains('side-open'))setSide(false)});
sideMQ.addEventListener('change',()=>{$('vForm').classList.remove('side-open');syncSide()});
window.addEventListener('hashchange',()=>{$('vForm').classList.remove('side-open');syncSide()});
syncSide();
