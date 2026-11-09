/* Trang "Quản lí loại đơn" và trình soạn loại đơn (kiểu Google Form). Quyền manageForms: Người xử lí đơn và Admin.
   - Danh sách loại đơn: tên, mã đơn, trạng thái (Nháp / Đang mở / Đã đóng), số phần · câu hỏi, số đơn đã nhận.
   - Trình soạn: thông tin loại đơn, các phần (tiêu đề, mô tả, nội dung chính), các câu hỏi trong phần
     (loại câu hỏi, bắt buộc, lựa chọn / cột bảng / định dạng tệp…), tab Xem trước, nút Lưu.
   - Bản đang soạn giữ trong formDrafts cho đến khi Lưu hoặc Bỏ thay đổi, nên đi trang khác rồi quay lại không mất.
   Bản thật: TYPES và các bản lưu đi qua API; máy chủ kiểm tra lại quyền manageForms. */

const clone=o=>JSON.parse(JSON.stringify(o));
const appsOfType=k=>allRows().filter(r=>r.a.type===k).length;
const countQ=T=>T.sections.reduce((n,s)=>n+(s.questions||[]).filter(q=>q.type!=="info").length,0);

/* ---------- Danh sách loại đơn ---------- */
/* các cột của bảng loại đơn: tìm kiếm, sắp xếp, lọc dùng bộ công cụ bảng chung (table-tools.js) */
const FM_ORDER={open:0,draft:1,closed:2};
const FM_FIELDS=[
  {k:"name",t:"Tên loại đơn",type:"text",get:r=>TYPES[r.k].name},
  {k:"prefix",t:"Mã đơn",type:"text",get:r=>TYPES[r.k].prefix||null},
  {k:"status",t:"Trạng thái",type:"select",get:r=>TYPES[r.k].status,label:v=>FORM_STATUS[v].t,opts:()=>Object.keys(FORM_STATUS),order:v=>FM_ORDER[v]},
  {k:"updated",t:"Cập nhật lúc",type:"datetime",get:r=>TYPES[r.k].updatedAt||null},
  {k:"by",t:"Người cập nhật",type:"text",get:r=>TYPES[r.k].updatedBy||null}
];
const fmTools=createTableTools({
  fields:FM_FIELDS,filterKey:"status",
  st:{get sort(){return state.fmSort},get filters(){return state.fmFilters},get query(){return state.fmQuery}},
  defaultSort:[{k:"status",dir:"asc"},{k:"name",dir:"asc"}],defaultNote:"Bảng đang xếp theo trạng thái (Đang mở → Nháp → Đã đóng), rồi theo tên loại đơn.",
  ids:{sortBtn:"fmSortBtn",sortPop:"fmSortPop",sortCnt:"fmSortCnt",filtBtn:"fmFiltBtn",filtPop:"fmFiltPop",filtCnt:"fmFiltCnt"},
  onChange:()=>renderFormsPage()
});
function fmCell(f,k,q){
  const T=TYPES[k],dash='<span class="dash">—</span>';
  switch(f.k){
    case "name":{const draft=formDrafts[k]&&formDrafts[k].dirty;return `<td class="nm">${hl(T.name,q)}${draft?' <span class="you">Có thay đổi chưa lưu</span>':''}</td>`}
    case "prefix":return `<td class="code">${T.prefix?hl(T.prefix,q):dash}</td>`;
    case "status":{const st=FORM_STATUS[T.status];return `<td><span class="pill ${st.c}">${hl(st.t,q)}</span></td>`}
    case "updated":return `<td>${T.updatedAt?hl(fmtT(T.updatedAt),q):dash}</td>`;
    case "by":return `<td>${T.updatedBy?hl(T.updatedBy,q):dash}</td>`;
  }
}
function renderFormsPage(){
  const q=state.fmQuery.trim(),all=Object.keys(TYPES).map(k=>({k})),list=fmTools.apply(all);
  $('fmHead').innerHTML=FM_FIELDS.map(f=>fmTools.th(f,'')).join('')+'<th></th>';fmTools.counts();
  $('fmTb').innerHTML=list.length?list.map(({k})=>`<tr class="main" tabindex="0" data-k="${esc(k)}">${FM_FIELDS.map(f=>fmCell(f,k,q)).join('')}<td class="go"><span class="go-btn">Soạn ›</span></td></tr>`).join('')
    :`<tr><td colspan="${FM_FIELDS.length+1}" class="empty">${fmTools.hasQuery()?'Không có loại đơn nào khớp điều kiện tìm kiếm và bộ lọc.':'Chưa có loại đơn nào. Bấm “+ Tạo loại đơn” để bắt đầu.'}</td></tr>`;
  $('fmPager').innerHTML=all.length?`<span>${list.length<all.length?`${list.length} / ${all.length}`:all.length} loại đơn</span>`:'';
}
$('fmSearch').addEventListener('input',e=>{state.fmQuery=e.target.value;renderFormsPage()});
$('fmTb').onclick=e=>{const tr=e.target.closest('tr[data-k]');if(tr)navigate("soan-don-"+tr.dataset.k)};
$('fmTb').addEventListener('keydown',e=>{const tr=e.target.closest('tr[data-k]');if(tr&&e.key==='Enter')navigate("soan-don-"+tr.dataset.k)});
$('fmNew').onclick=()=>{delete formDrafts.moi;navigate("soan-don-moi")};

/* ---------- Trình soạn ---------- */
const formDrafts={}; /* { <mã loại đơn | "moi">: {key, def, dirty} } */
let fe=null;          /* bản đang mở trong trình soạn */
const newQuestion=(type="text")=>withTypeDefaults({id:"q-"+uid(),type,label:"",help:"",required:false});
const newSection=()=>({id:"s-"+uid(),title:"",hint:"",main:false,questions:[newQuestion()]});
/* thuộc tính mặc định khi đổi loại câu hỏi */
function withTypeDefaults(q){
  if(QTYPES[q.type].choice&&!(q.options&&q.options.length))q.options=["Lựa chọn 1"];
  if(q.type==="table"&&!(q.columns&&q.columns.length)){q.columns=[{label:"Cột 1",type:"text"}];q.rowName=q.rowName||"dòng"}
  if(q.type==="file"){q.accept=q.accept&&q.accept.length?q.accept:["pdf","jpg","png"];q.maxMB=q.maxMB||10}
  if(q.type==="info")q.required=false;
  return q;
}
function openFormEditor(k){
  if(!formDrafts[k])formDrafts[k]={key:k,dirty:false,def:k==="moi"
    ?{name:"",desc:"",prefix:"",status:"draft",sections:[newSection()]}
    :clone(TYPES[k])};
  fe=formDrafts[k];
  if(typeof resetTplUi==='function')resetTplUi(); /* khung Mẫu xuất file và các mục bên trong mặc định đóng */
  $('feMsg').hidden=true;setTab('edit');renderEditor();show('vFormEdit');
}
function markDirty(){fe.dirty=true;$('feDirty').hidden=false;$('feMsg').hidden=true} /* sửa tiếp thì ẩn thông báo lỗi cũ; bấm Lưu sẽ kiểm tra lại */
function setTab(t){
  $('feTabEdit').setAttribute('aria-selected',t==='edit');$('feTabPreview').setAttribute('aria-selected',t==='preview');
  $('feEdit').hidden=t!=='edit';$('fePreview').hidden=t!=='preview';
  if(t==='preview')renderPreview();
}
$('feTabEdit').onclick=()=>setTab('edit');$('feTabPreview').onclick=()=>setTab('preview');
$('feBack').onclick=()=>{if(prevRoute()===ROUTE.forms)goBack();else navigate(ROUTE.forms,{replace:true})};

const ACCEPTS=[["pdf","PDF"],["jpg,png","Ảnh JPG, PNG"],["doc,docx","Word"],["xls,xlsx","Excel"]];
const opt=(v,t,cur)=>`<option value="${v}" ${v===cur?'selected':''}>${t}</option>`;
const ICON={
  up:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
  down:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
  copy:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  del:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  x:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>'
};
const iconBtn=(act,icon,label,dis=false)=>`<button type="button" class="icon-btn" data-act="${act}" aria-label="${label}" title="${label}" ${dis?'disabled':''}>${ICON[icon]}</button>`;

/* phần chỉnh riêng theo loại câu hỏi */
function typeEditor(q){
  if(QTYPES[q.type].choice)return `<div class="qe-opts">${q.options.map((o,i)=>`<div class="qe-opt"><span class="qe-mark ${q.type}" aria-hidden="true"></span><input data-f="option" data-i="${i}" value="${esc(o)}" aria-label="Lựa chọn ${i+1}">${iconBtn("rmOpt","x","Xóa lựa chọn",q.options.length<2).replace('data-act="rmOpt"',`data-act="rmOpt" data-i="${i}"`)}</div>`).join('')}
    <button type="button" class="link-btn" data-act="addOpt">+ Thêm lựa chọn</button></div>`;
  if(q.type==="table")return `<div class="qe-tbl">
    <label class="f qe-rn">Tên gọi mỗi dòng<input data-f="rowName" value="${esc(q.rowName||"")}"><small>Hiện ở nút “+ Thêm …” và dòng tổng, vd “môn”</small></label>
    <div class="qe-cols-h"><span>Cột <small>(và mã trong file Word)</small></span><span>Mô tả nhỏ</span><span>Kiểu</span><span>Tính tổng</span><span></span></div>
    ${q.columns.map((c,i)=>`<div class="qe-col">
      <span class="qe-colname"><input data-f="colLabel" data-i="${i}" value="${esc(c.label)}" aria-label="Tên cột ${i+1}" placeholder="Tên cột"><code class="col-code" title="Mã của cột trong file Word">{${esc(colTag(c))}}</code></span>
      <input data-f="colSub" data-i="${i}" value="${esc(c.sub||"")}" aria-label="Mô tả cột ${i+1}" placeholder="Không bắt buộc">
      <select data-f="colType" data-i="${i}" aria-label="Kiểu cột ${i+1}">${opt("text","Chữ",c.type)}${opt("number","Số",c.type)}</select>
      <label class="qe-chk"><input type="checkbox" data-f="colSum" data-i="${i}" ${c.sum?'checked':''} ${c.type!=="number"?'disabled':''}><span class="sr-label">Tính tổng cột ${i+1}</span></label>
      ${iconBtn("rmCol","x","Xóa cột",q.columns.length<2).replace('data-act="rmCol"',`data-act="rmCol" data-i="${i}"`)}</div>`).join('')}
    <button type="button" class="link-btn" data-act="addCol">+ Thêm cột</button></div>`;
  /* 2 cột thẳng hàng: Định dạng cho phép (các ô tích) | Tối đa mỗi tệp (MB) — nhãn cùng một hàng, ô tích và ô số cùng hàng bên dưới */
  if(q.type==="file")return `<div class="qe-file">
    <div class="qe-fcol"><span class="qe-sub">Định dạng cho phép</span>
      <div class="qe-accs">${ACCEPTS.map(([v,t])=>`<label class="qe-chk"><input type="checkbox" data-f="accept" value="${v}" ${v.split(',').every(x=>q.accept.includes(x))?'checked':''}><span>${t}</span></label>`).join('')}</div></div>
    <label class="qe-fcol qe-max"><span class="qe-sub">Tối đa mỗi tệp (MB)</span><input type="number" min="1" max="50" data-f="maxMB" value="${q.maxMB}"></label></div>`;
  return "";
}
/* Một câu hỏi trong trình soạn: khung riêng có thanh tiêu đề (số thứ tự · loại câu hỏi · nút sắp xếp / nhân bản / xóa),
   các ô đều có nhãn như phần Thông tin loại đơn, phần cài đặt riêng của từng loại câu hỏi nằm trong một khối nền nhạt. */
const QSET_TITLE={table:"Cài đặt bảng",file:"Cài đặt tải tệp",radio:"Các lựa chọn",check:"Các lựa chọn",select:"Các lựa chọn"};
function questionEditor(q,si,qi,n){
  const info=q.type==="info",set=typeEditor(q);
  return `<div class="qe${info?' qe-info':''}" data-s="${si}" data-q="${qi}">
    <div class="qe-head">
      <span class="qe-no">${info?'Khối thông báo':`Câu hỏi ${qi+1}`}</span>
      ${info?'':`<span class="qe-kind">${esc(QTYPES[q.type].name)}</span>`}${!info&&q.required?'<span class="qe-req">Bắt buộc</span>':''}
      <div class="qe-acts">${iconBtn("qUp","up","Đưa câu hỏi lên",qi===0)}${iconBtn("qDown","down","Đưa câu hỏi xuống",qi===n-1)}${iconBtn("qCopy","copy","Nhân bản câu hỏi")}${iconBtn("qDel","del","Xóa câu hỏi")}</div>
    </div>
    <div class="qe-body">
      <div class="qe-row">
        <label class="f">${info?'<span>Tiêu đề khối <span class="opt">(không bắt buộc)</span></span>':'Nội dung câu hỏi'}<input class="qe-label" data-f="label" value="${esc(q.label)}" placeholder="${info?'VD: Lưu ý khi nộp đơn':'VD: Lí do xin miễn'}"></label>
        <label class="f">Loại câu hỏi<select data-f="type">${Object.entries(QTYPES).map(([k,t])=>opt(k,t.name,q.type)).join('')}</select></label>
      </div>
      ${info?`<label class="f">Nội dung thông báo<textarea data-f="help" rows="3" placeholder="Nội dung thông báo, hướng dẫn cho người nộp đơn">${esc(q.help||"")}</textarea></label>`
            :`<label class="f"><span>Mô tả, gợi ý cho người nộp đơn <span class="opt">(không bắt buộc)</span></span><input class="qe-help" data-f="help" value="${esc(q.help||"")}" placeholder="VD: Ghi rõ học kỳ và năm học"></label>`}
      ${set?`<div class="qe-set"><p class="qe-set-h">${QSET_TITLE[q.type]||"Cài đặt"}</p>${set}</div>`:''}
      ${info?'':`<div class="qe-foot">
        <label class="switch"><input type="checkbox" data-f="required" ${q.required?'checked':''}><span>Bắt buộc trả lời</span></label>
        ${tagField(q)}
      </div>`}
    </div>
  </div>`;
}
function renderEditor(){
  const d=fe.def,n=fe.key==="moi"?0:appsOfType(fe.key);
  $('feTitle').textContent=fe.key==="moi"?"Tạo loại đơn":`Soạn loại đơn ${d.name}`;
  $('feDirty').hidden=!fe.dirty;
  $('feEdit').innerHTML=`
    ${n?`<div class="notice n-bs"><b>Đã có ${n} đơn loại này.</b> Sửa nội dung câu hỏi hay thứ tự thì các đơn đã nộp hiện theo form mới; xóa câu hỏi thì câu trả lời cũ của câu hỏi đó không còn hiện. Muốn thay đổi lớn, nên tạo loại đơn mới.</div>`:''}
    <section class="card fe-info">
      <div class="sec-head"><h2>Thông tin loại đơn</h2></div>
      <div class="grid2">
        <label class="f">Tên loại đơn<input data-f="name" value="${esc(d.name)}" placeholder="VD: Xin bảo lưu kết quả học tập"><span class="ferr" hidden></span><small>Dùng ở mọi nơi: tiêu đề trang đơn, danh sách chọn loại đơn, bảng và thống kê</small></label>
        <label class="f">Mã đơn<input data-f="prefix" value="${esc(d.prefix)}" maxlength="5" placeholder="VD: BL" ${n?'readonly':''}><span class="ferr" hidden></span><small>2–5 chữ in hoa, đứng đầu mã mỗi đơn (vd XMM-2026-00001)</small></label>
        <label class="f fe-wide">Mô tả ngắn<input data-f="desc" value="${esc(d.desc||"")}"><small>Hiện khi người nộp đơn chọn loại đơn</small></label>
      </div>
      <fieldset class="seg"><legend>Trạng thái</legend>
        ${Object.entries(FORM_STATUS).map(([k,s])=>`<label><input type="radio" name="feStatus" data-f="status" value="${k}" ${d.status===k?'checked':''}><span>${s.t}</span></label>`).join('')}
        <span class="hint seg-hint">${{draft:"Người nộp đơn chưa thấy loại đơn này; chỉ người xử lí đơn và Admin thấy để soạn.",open:"Người nộp đơn chọn được loại đơn này khi bấm “Nộp đơn mới”.",closed:"Không nhận đơn mới; các đơn đã nộp vẫn xử lí bình thường."}[d.status]}</span>
      </fieldset>
    </section>
    ${d.sections.map((s,si)=>`<section class="card fe-sec fold" data-s="${si}">
      <div class="sec-head"><span class="sec-no">${si+1}</span><h2>${esc(s.title||"Phần chưa có tên")}</h2>
        <div class="qe-acts">${iconBtn("sUp","up","Đưa phần lên",si===0)}${iconBtn("sDown","down","Đưa phần xuống",si===d.sections.length-1)}${iconBtn("sDel","del","Xóa phần",d.sections.length<2)}</div></div>
      <label class="switch"><input type="checkbox" data-f="secMain" ${s.main?'checked':''}><span>Nội dung chính — hiện trong xem nhanh (›) ở các bảng đơn</span></label>
      <div class="grid2">
        <label class="f">Tiêu đề phần<input data-f="secTitle" value="${esc(s.title)}" placeholder="VD: Lí do bảo lưu"></label>
        <label class="f"><span>Mô tả phần <span class="opt">(không bắt buộc)</span></span><input data-f="secHint" value="${esc(s.hint||"")}"></label>
      </div>
      <div class="qe-list">${s.questions.map((q,qi)=>questionEditor(q,si,qi,s.questions.length)).join('')||'<p class="hint">Phần này chưa có câu hỏi.</p>'}</div>
      <button type="button" class="btn" data-act="addQ">+ Thêm câu hỏi</button>
    </section>`).join('')}
    ${tplCardHtml(fe.key,d)}
    <div class="fe-bottom">
      <button type="button" class="btn" data-act="addS">+ Thêm phần</button>
      <span class="spacer"></span>
      ${fe.dirty&&fe.key!=="moi"?'<button type="button" class="btn" data-act="discard">Bỏ thay đổi</button>':''}
      ${fe.key!=="moi"&&!n?'<button type="button" class="btn danger-btn" data-act="delType">Xóa loại đơn</button>':''}
    </div>`;
  initCollapsible($('feEdit'));
}
function renderPreview(){
  const d=fe.def,box=$('fePreview');
  box.innerHTML=`<div class="notice n-xet">Đây là bản xem trước, giống như người nộp đơn sẽ thấy. Bạn có thể thử điền nhưng không có gì được lưu.</div>
    <h2 class="form-title pv-title">${esc(d.name||"Loại đơn chưa có tên")}</h2>${d.desc?`<p class="hint" style="margin:0">${esc(d.desc)}</p>`:''}`;
  const secs=renderSections(null,null,{def:d});
  secs.forEach(s=>box.appendChild(s.el));
  const tb=document.createElement('div');tb.className='submit-row';tb.innerHTML='<button type="button" class="btn primary">Thử kiểm tra câu trả lời</button><p class="msg" hidden></p>';
  tb.querySelector('button').onclick=()=>{const errs=secs.map(s=>s.validate()).filter(Boolean),m=tb.querySelector('.msg');m.hidden=false;m.textContent=errs.length?errs.join(' '):"Các câu trả lời hợp lệ.";m.classList.toggle('ok-msg',!errs.length)};
  box.appendChild(tb);initCollapsible(box);
}

/* ô "Mã dùng trong file Word" của câu hỏi (xem print-templates.js) */
const TAG_HELP={
  table:t=>`Mã của cả bảng. Trong file Word, gõ <code>{#${t}}</code> ở ô đầu và <code>{/${t}}</code> ở ô cuối của một dòng mẫu; khi xuất file, đơn có bao nhiêu dòng thì bảng có bấy nhiêu dòng. Mỗi cột có mã riêng, hiện dưới tên cột.`,
  check:t=>`Chỗ nào trong file Word có <code>{${t}}</code> sẽ được điền các lựa chọn, nối bằng dấu phẩy.`,
  file:t=>`Chỗ nào trong file Word có <code>{${t}}</code> sẽ được điền tên các tệp đã tải lên.`
};
const tagHelp=q=>{const t=esc(printTag(q));return (TAG_HELP[q.type]||(t=>`Chỗ nào trong file Word có <code>{${t}}</code> sẽ được điền câu trả lời của câu này.`))(t)};
function tagField(q){
  return `<div class="qe-tag"><label class="qe-tag-row"><span>Mã dùng trong file Word</span>
      <span class="tag-input"><span aria-hidden="true">{</span><input data-f="tag" value="${esc(q.tag||"")}" placeholder="${esc(printTag(q))}" spellcheck="false" aria-label="Mã dùng trong file Word"><span aria-hidden="true">}</span></span></label>
    <small>${tagHelp(q)} Bỏ trống thì tự lấy theo nội dung câu hỏi.</small></div>`;
}
/* cập nhật gợi ý mã khi đổi nội dung câu hỏi / tên cột */
function syncTagHint(box,q){
  if(!box)return;const i=box.querySelector('[data-f=tag]');
  if(i){i.placeholder=printTag(q);box.querySelector('.qe-tag small').innerHTML=tagHelp(q)+' Bỏ trống thì tự lấy theo nội dung câu hỏi.'}
  box.querySelectorAll('.col-code').forEach((c,k)=>{if(q.columns&&q.columns[k])c.textContent=`{${colTag(q.columns[k])}}`});
}
/* chỉnh nội dung: cập nhật bản nháp, chỉ vẽ lại khi thay đổi cấu trúc */
function target(el){const qe=el.closest('.qe'),se=el.closest('[data-s]');const s=se?fe.def.sections[+se.dataset.s]:null;return {s,q:qe&&s?s.questions[+qe.dataset.q]:null,si:se?+se.dataset.s:-1,qi:qe?+qe.dataset.q:-1}}
$('feEdit').addEventListener('input',e=>{
  const f=e.target.dataset.f;if(!f)return;const {s,q}=target(e.target),v=e.target.value,i=+e.target.dataset.i;const d=fe.def;
  if(["name","desc"].includes(f))d[f]=v;
  else if(f==="prefix"){e.target.value=v.toUpperCase().replace(/[^A-Z]/g,'');d.prefix=e.target.value}
  else if(f==="secTitle"){s.title=v;e.target.closest('.fe-sec').querySelector('.sec-head h2').textContent=v||"Phần chưa có tên"}
  else if(f==="secHint")s.hint=v;
  else if(f==="label"||f==="help"){q[f]=v;if(f==="label")syncTagHint(e.target.closest('.qe'),q)}
  else if(f==="tag"){e.target.value=v.toLowerCase().replace(/[^a-z0-9_]/g,'');if(e.target.value)q.tag=e.target.value;else delete q.tag;syncTagHint(e.target.closest('.qe'),q)}
  else if(f==="option")q.options[i]=v;
  else if(f==="rowName")q.rowName=v;
  else if(f==="colLabel"){q.columns[i].label=v;syncTagHint(e.target.closest('.qe'),q)}
  else if(f==="colSub")q.columns[i].sub=v;
  else if(f==="maxMB")q.maxMB=Math.max(1,+v||10);
  else return;
  if(f==="name")$('feTitle').textContent=fe.key==="moi"?"Tạo loại đơn":`Soạn loại đơn ${v}`;
  e.target.classList.remove('err');markDirty();
});
$('feEdit').addEventListener('change',e=>{
  const f=e.target.dataset.f;if(!f)return;const {s,q}=target(e.target),i=+e.target.dataset.i;
  if(f==="status")fe.def.status=e.target.value;
  else if(f==="secMain")s.main=e.target.checked;
  else if(f==="required"){q.required=e.target.checked; /* nhãn "Bắt buộc" trên thanh tiêu đề câu hỏi */
    const h=e.target.closest('.qe').querySelector('.qe-head'),r=h.querySelector('.qe-req');
    if(q.required&&!r)h.querySelector('.qe-kind').insertAdjacentHTML('afterend','<span class="qe-req">Bắt buộc</span>');else if(!q.required&&r)r.remove()}
  else if(f==="type"){q.type=e.target.value;withTypeDefaults(q)}
  else if(f==="colType"){q.columns[i].type=e.target.value;if(e.target.value!=="number")delete q.columns[i].sum}
  else if(f==="colSum")q.columns[i].sum=e.target.checked;
  else if(f==="accept"){const all=[...e.target.closest('.qe-file').querySelectorAll('[data-f=accept]:checked')].flatMap(x=>x.value.split(','));q.accept=all}
  else return;
  markDirty();
  if(["status","type","colType"].includes(f))renderEditor();
});
$('feEdit').addEventListener('click',e=>{
  const b=e.target.closest('[data-act]');if(!b||b.disabled)return;
  const {s,q,si,qi}=target(b),d=fe.def,act=b.dataset.act,i=+b.dataset.i;
  const mv=(arr,a,c)=>{const [x]=arr.splice(a,1);arr.splice(c,0,x)};
  switch(act){
    case "addQ":s.questions.push(newQuestion());break;
    case "addS":d.sections.push(newSection());break;
    case "qUp":mv(s.questions,qi,qi-1);break;
    case "qDown":mv(s.questions,qi,qi+1);break;
    case "qCopy":s.questions.splice(qi+1,0,{...clone(q),id:"q-"+uid()});break;
    case "qDel":s.questions.splice(qi,1);break;
    case "sUp":mv(d.sections,si,si-1);break;
    case "sDown":mv(d.sections,si,si+1);break;
    case "sDel":d.sections.splice(si,1);break;
    case "addOpt":q.options.push(`Lựa chọn ${q.options.length+1}`);break;
    case "rmOpt":q.options.splice(i,1);break;
    case "addCol":q.columns.push({label:`Cột ${q.columns.length+1}`,type:"text"});break;
    case "rmCol":q.columns.splice(i,1);break;
    case "discard":delete formDrafts[fe.key];openFormEditor(fe.key);toast("Đã bỏ các thay đổi chưa lưu");return;
    case "delType":{const name=d.name;delete TYPES[fe.key];delete formDrafts[fe.key];navigate(ROUTE.forms,{replace:true});toast(`Đã xóa loại đơn ${name}`);return}
    default:return;
  }
  markDirty();renderEditor();
  if(act==="addQ"){const l=$('feEdit').querySelectorAll(`.fe-sec[data-s="${si}"] .qe-label`);l[l.length-1].focus()}
  if(act==="addS"){const t=$('feEdit').querySelectorAll('[data-f=secTitle]');t[t.length-1].focus()}
});

/* Lưu: kiểm tra rồi ghi vào TYPES */
function checkDraft(d,key){
  const errs=[],mark=(sel,m)=>{const el=$('feEdit').querySelector(sel);if(el)el.classList.add('err');errs.push(m)};
  if(!d.name.trim())mark('[data-f=name]',"Nhập tên loại đơn.");
  if(!/^[A-Z]{2,5}$/.test(d.prefix))mark('[data-f=prefix]',"Mã đơn gồm 2–5 chữ in hoa.");
  else if(Object.entries(TYPES).some(([k,T])=>k!==key&&T.prefix===d.prefix))mark('[data-f=prefix]',`Mã ${d.prefix} đã được loại đơn khác dùng.`);
  d.sections.forEach((s,si)=>{
    if(!s.title.trim())mark(`.fe-sec[data-s="${si}"] [data-f=secTitle]`,`Phần ${si+1}: nhập tiêu đề phần.`);
    s.questions.forEach((q,qi)=>{
      const at=`.fe-sec[data-s="${si}"] .qe[data-q="${qi}"]`;
      if(q.type!=="info"&&!q.label.trim())mark(`${at} [data-f=label]`,`Phần ${si+1}, câu ${qi+1}: nhập nội dung câu hỏi.`);
      if(QTYPES[q.type].choice&&q.options.some(o=>!o.trim()))mark(`${at} [data-f=option]`,`Phần ${si+1}, câu ${qi+1}: lựa chọn không được để trống.`);
      if(q.type==="table"&&q.columns.some(c=>!c.label.trim()))mark(`${at} [data-f=colLabel]`,`Phần ${si+1}, câu ${qi+1}: đặt tên cho mọi cột.`);
      if(q.type==="file"&&!q.accept.length)errs.push(`Phần ${si+1}, câu ${qi+1}: chọn ít nhất một định dạng tệp.`);
    });
  });
  /* mã trường: đúng dạng, không trùng nhau, không trùng mã chung */
  const seen={};
  d.sections.forEach((s,si)=>s.questions.forEach((q,qi)=>{
    if(q.type==="info")return;const t=printTag(q),at=`.fe-sec[data-s="${si}"] .qe[data-q="${qi}"] [data-f=tag]`;
    const tags=[t,...(q.type==="table"?(q.columns||[]).map(colTag):[])];
    if(!/^[a-z_][a-z0-9_]*$/.test(t))mark(at,`Phần ${si+1}, câu ${qi+1}: mã trường chỉ gồm chữ thường không dấu, số và dấu _.`);
    tags.forEach(x=>{
      if(COMMON_KEYS.includes(x)||x==="stt")mark(at,`Phần ${si+1}, câu ${qi+1}: mã {${x}} trùng mã có sẵn, hãy đặt mã khác.`);
      else if(seen[x])mark(at,`Phần ${si+1}, câu ${qi+1}: mã {${x}} trùng với ${seen[x]}. Đặt mã trường khác${x!==t?' hoặc đổi tên cột':''}.`);
      else seen[x]=`phần ${si+1}, câu ${qi+1}`;
    });
  }));
  if(d.status==="open"&&!countQ(d))errs.push("Loại đơn đang mở phải có ít nhất một câu hỏi.");
  return errs;
}
$('feSave').onclick=()=>{
  setTab('edit');$('feEdit').querySelectorAll('.err').forEach(x=>x.classList.remove('err'));
  const d=fe.def,errs=checkDraft(d,fe.key),m=$('feMsg');
  m.hidden=!errs.length;m.innerHTML=errs.map(esc).join('<br>');
  if(errs.length){const bad=$('feEdit').querySelector('.err');if(bad)bad.focus();else m.scrollIntoView({block:"center"});return}
  d.name=d.name.trim();d.updatedAt=nowIso();d.updatedBy=state.profile.name;
  let key=fe.key;
  if(key==="moi"){key=d.prefix.toLowerCase();while(TYPES[key])key+="-"+uid().slice(0,2);delete formDrafts.moi}
  else delete formDrafts[key];
  TYPES[key]=clone(d);
  toast(`Đã lưu loại đơn ${d.name} (${FORM_STATUS[d.status].t})`);
  if(fe.key==="moi")navigate("soan-don-"+key,{replace:true});else openFormEditor(key);
};
