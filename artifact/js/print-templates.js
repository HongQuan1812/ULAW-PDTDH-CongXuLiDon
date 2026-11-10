/* Mẫu xuất file: cán bộ tải lên file Word (.docx) có các MÃ TRƯỜNG trong ngoặc nhọn, vd {ho_ten}, {mssv}.
   Bấm "Xuất file" ở trang chi tiết đơn → ứng dụng thay mã bằng dữ liệu của đơn và tải về file Word đã điền.
   - Điền mẫu bằng docxtemplater + PizZip (tải từ CDN khi cần).
   - Bảng nhiều dòng: bọc phần cần lặp bằng {#mã bảng} … {/mã bảng}, vd một dòng bảng Word:
     {#mon}{stt} | {mon_hoc_cua_truong} | … | {co_so_dao_tao}{/mon} → dòng đó lặp lại theo số dòng của đơn.
   Bản thật: lưu file mẫu ở máy chủ; chuyển Word → PDF ở máy chủ (LibreOffice) nếu cần xuất PDF; lưu lại bản đã xuất. */

const PRINT_TEMPLATES={}; /* { <mã loại đơn>: [{id, name, fileName, size, buf:ArrayBuffer, uploadedAt, uploadedBy}] } */

/* ---- mã trường ---- */
const slug=t=>norm(String(t||"")).replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').replace(/^(\d)/,'_$1')||'truong';
const printTag=q=>q.tag||slug(q.label);
const colTag=c=>c.tag||slug(c.label);
/* mã có sẵn cho mọi loại đơn */
const COMMON_TAGS=[
  ["Người nộp đơn",[["ho_ten","Họ và tên"],["mssv","MSSV"],["lop","Lớp"],["khoa_hoc","Khóa học hiện tại"],["khoa_hoc_goc","Khóa học gốc"],["hinh_thuc","Hình thức đào tạo"],["nganh","Ngành"],["email","Email"],["sdt","Số điện thoại"],["cccd","Số CCCD"]]],
  ["Thông tin đơn",[["ma_don","Mã đơn"],["loai_don","Tên loại đơn"],["ngay_nop","Ngày nộp (dd/mm/yyyy)"],["gio_nop","Giờ nộp"],["ngay","Ngày nộp — số ngày"],["thang","Ngày nộp — tháng"],["nam","Ngày nộp — năm"],
    ["trang_thai","Trạng thái"],["nguoi_tiep_nhan","Người tiếp nhận"],["nguoi_xu_li","Người xử lí"],["ngay_xu_li","Ngày Duyệt / Từ chối"],["ly_do","Lí do của phòng Đào tạo"],["ngay_xuat","Ngày xuất file"]]]
];
const COMMON_KEYS=[...COMMON_TAGS.flatMap(([,l])=>l.map(([k])=>k)),"tinh_trang"]; /* tinh_trang: tên cũ của {trang_thai} */
/* mã theo câu hỏi của loại đơn: [{tag, label, kind, cols?}] */
function questionTags(T){
  return T.sections.flatMap(s=>(s.questions||[]).filter(q=>q.type!=="info").map(q=>{
    const o={tag:printTag(q),label:q.label||"(chưa có tên)",type:q.type};
    if(q.type==="table"){o.rowName=q.rowName;o.cols=(q.columns||[]).map(c=>({tag:colTag(c),label:c.label,sum:c.sum}))}
    return o;
  }));
}
/* tất cả mã hợp lệ của một loại đơn (để kiểm tra mẫu) */
function knownTags(T){
  const k=new Set(COMMON_KEYS);
  questionTags(T).forEach(q=>{k.add(q.tag);if(q.cols){k.add('so_'+q.tag);k.add('stt');q.cols.forEach(c=>{k.add(c.tag);if(c.sum)k.add('tong_'+c.tag)})}});
  return k;
}

/* ---- dữ liệu để điền ---- */
const dmy=iso=>iso?fmtD(iso.slice(0,10)):"";
function personOf(hit){
  const mine=hit.p.apps===state.apps;
  return mine?{name:state.profile.name,email:state.user.email,phone:state.profile.phone,cccd:state.profile.cccd,students:state.students,mainMssv:state.mainMssv}:hit.p;
}
function buildPrintData(a,person,T){
  /* thông tin sinh viên: MSSV người dùng chọn làm thông tin chính ở trang thông tin (js/profile.js) */
  const st=mainStudentOf(person)||{},sub=a.submittedAt||a.date||"";
  const d={ho_ten:person.name||"",mssv:st.mssv||"",lop:st.lop||"",khoa_hoc:st.khoa||"",khoa_hoc_goc:st.khoaGoc||"",hinh_thuc:st.hinhThuc||"",nganh:st.nganh||"",
    email:person.email||"",sdt:person.phone?fmtP(person.phone):"",cccd:person.cccd||"",
    ma_don:a.code||"",loai_don:T.name||"",ngay_nop:dmy(sub),gio_nop:sub.includes('T')?sub.slice(11,16):"",
    ngay:sub.slice(8,10),thang:sub.slice(5,7),nam:sub.slice(0,4),
    trang_thai:STATUS[a.status]?STATUS[a.status].t:"",tinh_trang:STATUS[a.status]?STATUS[a.status].t:"", /* tinh_trang: tên cũ, giữ cho mẫu đã soạn trước */nguoi_tiep_nhan:a.receiver?a.receiver.name:"",nguoi_xu_li:a.handler?a.handler.name:"",
    ngay_xu_li:dmy(a.decidedAt),ly_do:a.note||"",ngay_xuat:fmtD(nowIso().slice(0,10))};
  T.sections.forEach(s=>(s.questions||[]).forEach(q=>{
    if(q.type==="info")return;
    const v=(a.data||{})[q.id],tag=printTag(q);
    if(q.type==="table"){
      const cols=q.columns||[],rows=(v||[]).map((r,i)=>Object.fromEntries([["stt",i+1],...cols.map((c,k)=>[colTag(c),r[k]??""])]));
      d[tag]=rows;d['so_'+tag]=rows.length;
      cols.forEach((c,k)=>{if(c.sum)d['tong_'+colTag(c)]=(v||[]).reduce((t,r)=>t+(parseFloat(r[k])||0),0)});
    }
    else if(Array.isArray(v))d[tag]=v.join(", ");
    else if(q.type==="date")d[tag]=v?fmtD(v):"";
    else d[tag]=v??"";
  }));
  return d;
}
/* dữ liệu giả để "Xuất thử" khi loại đơn chưa có đơn nào */
function samplePrintData(T){
  const d={ho_ten:"Nguyễn Văn A",mssv:"2253801010001",lop:"47-LTM-A",khoa_hoc:"K48 (2023–2027)",khoa_hoc_goc:"K47 (2022–2026)",hinh_thuc:"Chính quy",nganh:"Luật",email:"vana@hcmulaw.edu.vn",sdt:"0901 234 567",cccd:"079206001234",
    ma_don:`${T.prefix||"DON"}-2026-00001`,loai_don:T.name,ngay_nop:"01/11/2026",gio_nop:"08:30",ngay:"01",thang:"11",nam:"2026",trang_thai:"Đã duyệt",tinh_trang:"Đã duyệt",nguoi_tiep_nhan:"Phạm Thu Hà",nguoi_xu_li:"Phạm Thu Hà",ngay_xu_li:"05/11/2026",ly_do:"",ngay_xuat:fmtD(nowIso().slice(0,10))};
  questionTags(T).forEach(q=>{
    if(q.cols){d[q.tag]=[1,2].map(i=>Object.fromEntries([["stt",i],...q.cols.map(c=>[c.tag,`(${c.label} ${i})`])]));d['so_'+q.tag]=2;q.cols.forEach(c=>{if(c.sum)d['tong_'+c.tag]=0})}
    else d[q.tag]=`(${q.label})`;
  });
  return d;
}

/* ---- đọc và điền file Word ---- */
async function getDocxLibs(){
  if(!window.PizZip)await loadScript('https://cdn.jsdelivr.net/npm/pizzip@3.1.8/dist/pizzip.min.js');
  if(!window.docxtemplater)await loadScript('https://cdn.jsdelivr.net/npm/docxtemplater@3.58.4/build/docxtemplater.min.js');
  return {PizZip:window.PizZip,Docx:window.docxtemplater};
}
const XML_PARTS=z=>Object.keys(z.files).filter(n=>/^word\/(document|header\d*|footer\d*)\.xml$/.test(n));
const plain=xml=>xml.replace(/<w:tab\/>/g,' ').replace(/<[^>]+>/g,'');
/* Kiểm tra mẫu: mã không có trong loại đơn, mã cột nằm ngoài vòng lặp {#bảng}…{/bảng}, ngoặc lỗi */
async function checkTemplate(buf,T){
  const {PizZip,Docx}=await getDocxLibs();
  const zip=new PizZip(buf),k=knownTags(T),found=new Set(),unknown=new Set(),outside=new Set();
  const owner={};questionTags(T).filter(q=>q.cols).forEach(q=>{owner.stt=(owner.stt||[]).concat(q.tag);q.cols.forEach(c=>owner[c.tag]=(owner[c.tag]||[]).concat(q.tag))});
  XML_PARTS(zip).forEach(n=>{
    const open=[];
    for(const m of plain(zip.file(n).asText()).matchAll(/\{\s*([#\/^]?)\s*([^{}]*?)\s*\}/g)){
      const [,sign,t]=m;found.add(t);if(!k.has(t))unknown.add(t);
      if(sign==="#"||sign==="^")open.push(t);
      else if(sign==="/"){const i=open.lastIndexOf(t);if(i>=0)open.splice(i)}
      else if(owner[t]&&!owner[t].some(x=>open.includes(x)))outside.add(t);
    }
  });
  let error="";
  try{new Docx(zip,{paragraphLoop:true,linebreaks:true})}catch(e){error=explainDocxError(e)}
  return {found:[...found],unknown:[...unknown],outside:[...outside],error};
}
function explainDocxError(e){
  const errs=(e.properties&&e.properties.errors)||[e];
  return errs.slice(0,5).map(x=>{const p=x.properties||{},id=p.id||"";
    if(id==="unclosed_tag"||id==="unopened_tag")return `Thiếu dấu ngoặc ở mã “${p.xtag||p.context||"?"}”.`;
    if(id==="unclosed_loop"||id==="closing_tag_does_not_match_opening_tag"||id==="unopened_loop")return `Vòng lặp “${p.xtag||"?"}” chưa có cặp {#…} {/…} khớp nhau.`;
    if(id==="duplicate_open_tag"||id==="duplicate_close_tag")return `Có hai dấu ngoặc liền nhau ở “${p.xtag||"?"}”.`;
    return x.message||String(x);}).join(" ");
}
async function renderDocx(buf,data,T){
  const {PizZip,Docx}=await getDocxLibs();
  const zip=new PizZip(buf);
  const doc=new Docx(zip,{paragraphLoop:true,linebreaks:true,nullGetter:()=>""});
  doc.render(data);
  return doc.getZip().generate({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
}
/* xem trước file đã điền, có nút tải về trên thanh xem (file-preview.js) */
const DOCX_MIME='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
function showExport(blob,fileName,title,src){
  const f=new File([blob],fileName,{type:DOCX_MIME});
  preview(f,{download:"Tải file Word",fileName,meta:`Xem trước gần đúng${src?' · '+src:''}`});$('pvName').textContent=title;
}
function saveBlob(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000)}
/* tên file không dấu (một số trình duyệt đổi tên file có dấu thành "download") */
const fileSafe=(pre,name)=>`${pre}_${slug(name).replace(/_/g,'-')}.docx`;

/* ---- Nút "Xuất file" ở trang chi tiết đơn ---- */
let printCode=null;
function setupPrintButton(a){
  printCode=a?a.code:null;const list=a?(PRINT_TEMPLATES[a.type]||[]):[];
  $('fPrint').hidden=!list.length;$('printPop').hidden=true;
}
async function printWith(tpl){
  const hit=findApp(printCode);if(!hit)return;const T=TYPES[hit.a.type];
  $('printPop').hidden=true;toast("Đang tạo file…");
  try{
    const blob=await renderDocx(tpl.buf,buildPrintData(hit.a,personOf(hit),T),T);
    showExport(blob,fileSafe(hit.a.code,tpl.name),`${hit.a.code} · ${tpl.name}`);
  }catch(e){toast("Không tạo được file: "+explainDocxError(e))}
}
$('fPrint').onclick=e=>{
  e.stopPropagation();const hit=findApp(printCode);if(!hit)return;const list=PRINT_TEMPLATES[hit.a.type]||[];
  if(list.length===1){printWith(list[0]);return}
  const pop=$('printPop');if(!pop.hidden){pop.hidden=true;return}
  pop.innerHTML=`<div class="ph">Chọn mẫu</div>`+list.map(t=>`<button type="button" class="new-opt" data-tpl="${t.id}"><b>${esc(t.name)}</b><span>${esc(t.fileName)}</span></button>`).join('');
  pop.hidden=false;pop.querySelector('button').focus();
};
$('printPop').onclick=e=>{e.stopPropagation();const b=e.target.closest('[data-tpl]');if(!b)return;const hit=findApp(printCode);const t=(PRINT_TEMPLATES[hit.a.type]||[]).find(x=>x.id===b.dataset.tpl);if(t)printWith(t)};
document.addEventListener('click',()=>{$('printPop').hidden=true});

/* Trạng thái mở / đóng của khung Mẫu xuất file và các mục thu gọn bên trong.
   Mỗi lần mở trình soạn: khung và mọi mục đều đóng (resetTplUi() trong openFormEditor);
   trong lúc soạn, vẽ lại trình soạn (thêm mẫu, đổi tên…) vẫn giữ nguyên những gì người dùng đang mở. */
const tplUi={open:false,details:new Set()};
function resetTplUi(){tplUi.open=false;tplUi.details.clear()}
const dOpen=k=>tplUi.details.has(k)?' open':'';
document.addEventListener('toggle',e=>{
  const d=e.target;if(!(d instanceof HTMLDetailsElement)||!d.closest('.fe-tpl'))return;
  const k=d.classList.contains('tpl-guide')?'guide':d.dataset.k;if(!k)return;
  if(d.open)tplUi.details.add(k);else tplUi.details.delete(k);
},true);
document.addEventListener('click',()=>{const c=document.querySelector('#feEdit .fe-tpl');if(c)setTimeout(()=>{tplUi.open=!c.classList.contains('collapsed')},0)});
/* ---- Khung "Mẫu xuất file" trong trình soạn loại đơn ---- */
/* dữ liệu ví dụ cho cột "Ví dụ": lấy từ đơn đầu tiên của loại đơn, chưa có đơn thì dùng dữ liệu giả */
function exampleData(key,d){
  const hit=key==="moi"?null:allRows().find(r=>r.a.type===key);
  try{return hit?buildPrintData(hit.a,personOf(hit),d):samplePrintData(d)}catch(_){return samplePrintData(d)}
}
const QKIND={check:"các lựa chọn nối bằng dấu phẩy",file:"tên các tệp đã tải lên",date:"dạng dd/mm/yyyy"};
const codeBtn=t=>`<button type="button" class="code-chip" data-act="copyTag" data-tag="{${esc(t)}}" title="Bấm để sao chép">{${esc(t)}}</button>`;
const exCell=v=>v===""||v==null?'<span class="ex-empty">(trống)</span>':esc(v);
/* bảng mẫu cho câu hỏi dạng bảng: giống bảng trong Word, dòng thứ hai chứa mã và vòng lặp */
function loopTableHtml(q){
  return `<table class="word-tbl"><tr><th>STT</th>${q.cols.map(c=>`<th>${esc(c.label)}</th>`).join('')}</tr>
    <tr><td><b class="loop">{#${esc(q.tag)}}</b>{stt}</td>${q.cols.map((c,i)=>`<td>{${esc(c.tag)}}${i===q.cols.length-1?`<b class="loop">{/${esc(q.tag)}}</b>`:''}</td>`).join('')}</tr></table>`;
}
function tplCardHtml(key,d){
  const list=key==="moi"?[]:(PRINT_TEMPLATES[key]||[]);
  const qt=questionTags(d),ex=exampleData(key,d);
  const row=(t,what,v)=>`<tr><td>${codeBtn(t)}</td><td>${what}</td><td class="ex">${exCell(v)}</td></tr>`;
  const head=`<thead><tr><th>Gõ vào file Word</th><th>Sẽ được điền bằng</th><th>Ví dụ</th></tr></thead>`;
  const qBlock=q=>{
    if(!q.cols)return `<tr class="q-grp"><td colspan="3">${esc(q.label)}</td></tr>`+row(q.tag,`Câu trả lời${QKIND[q.type]?` (${QKIND[q.type]})`:''}`,ex[q.tag]);
    const first=(ex[q.tag]||[])[0]||{};
    return `<tr class="q-grp"><td colspan="3">${esc(q.label)} <span class="kind">— câu hỏi dạng bảng</span></td></tr>
      <tr><td colspan="3" class="loop-box">
        <p>Trong Word, tạo bảng có <b>một dòng mẫu</b> như dưới đây. Khi xuất file, dòng này tự nhân lên theo số ${esc(q.rowName||"dòng")} trong đơn.
          <b class="loop">{#${esc(q.tag)}}</b> ở ô đầu và <b class="loop">{/${esc(q.tag)}}</b> ở ô cuối đánh dấu dòng mẫu.</p>
        ${loopTableHtml(q)}
        <button type="button" class="btn sm2" data-act="copyTbl" data-q="${esc(q.tag)}">Sao chép bảng mẫu để dán vào Word</button>
      </td></tr>
      ${row('stt',"Số thứ tự (đặt trong vòng lặp)",first.stt)}
      ${q.cols.map(c=>row(c.tag,`Cột “${esc(c.label)}” (đặt trong vòng lặp)`,first[c.tag])).join('')}
      ${row('so_'+q.tag,`Số ${esc(q.rowName||"dòng")} trong bảng (đặt ngoài vòng lặp)`,ex['so_'+q.tag])}
      ${q.cols.filter(c=>c.sum).map(c=>row('tong_'+c.tag,`Tổng cột “${esc(c.label)}” (đặt ngoài vòng lặp)`,ex['tong_'+c.tag])).join('')}`;
  };
  /* Bố cục: (1) Mẫu đã tải lên + tải mẫu mới · (2) Cách tạo mẫu (thu gọn được) · (3) Bảng mã */
  return `<section class="card fe-tpl fold${tplUi.open?'':' collapsed'}">
    <div class="sec-head"><h2>Mẫu xuất file</h2></div>
    <p class="tpl-intro">File Word có chèn mã. Khi bấm “Xuất file” ở chi tiết đơn, các mã được thay bằng dữ liệu của đơn.</p>

    <div class="tpl-block">
      <div class="tpl-bh"><h3 class="tpl-h">Mẫu đã tải lên</h3>${key==="moi"?'':`<span class="tpl-count">${list.length} mẫu</span><label class="btn primary sm2 tpl-up"><input id="tplFile" type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden>+ Tải mẫu lên</label>`}</div>
      ${key==="moi"?'<div class="notice n-nop">Lưu loại đơn trước, sau đó mới tải mẫu lên được.</div>':`
      <div class="tpl-list">${list.length?list.map(t=>`<div class="tpl" data-tpl="${t.id}">
          <span class="ftype">DOCX</span><button type="button" class="tpl-name" data-act="tplView" title="Xem mẫu"><b class="tpl-title">${esc(t.name)}</b><span>${esc(t.fileName)} · ${fmt(t.size)}${t.uploadedBy?` · ${esc(t.uploadedBy)}`:''}</span></button>
          <div class="tpl-acts"><button type="button" class="btn sm2" data-act="tplView">Xem</button><button type="button" class="btn sm2" data-act="tplRename" title="Đổi tên hiện khi chọn mẫu lúc Xuất file">Đổi tên</button><button type="button" class="btn sm2" data-act="tplCheck">Kiểm tra mã</button><button type="button" class="btn sm2" data-act="tplTry">Xuất thử</button>${iconBtn("tplDel","del","Xóa mẫu")}</div>
          <p class="tpl-res" hidden></p></div>`).join(''):'<p class="tpl-empty">Chưa có mẫu nào. Bấm “+ Tải mẫu lên” để chọn file Word (.docx).</p>'}</div>
      <p class="msg" id="tplMsg" hidden></p>`}
    </div>

    <details class="tpl-guide"${dOpen("guide")}>
      <summary>Cách tạo một mẫu</summary>
      <div class="tpl-guide-body">
        <ol class="tpl-steps">
          <li><b>Soạn file Word</b><span>Gõ mã vào chỗ cần điền, lấy mã ở Bảng mã bên dưới.</span></li>
          <li><b>Tải lên và kiểm tra</b><span>Tải file ở mục trên, bấm “Kiểm tra mã” để biết mã gõ đúng chưa.</span></li>
          <li><b>Xuất file</b><span>Ở chi tiết đơn, bấm “Xuất file” để nhận file Word đã điền sẵn.</span></li>
        </ol>
        <div class="tpl-demo" aria-label="Ví dụ">
          <div><span class="lbl">Trong file mẫu</span><p>Họ và tên: <b class="code">{ho_ten}</b> &nbsp; MSSV: <b class="code">{mssv}</b></p></div>
          <span class="arrow" aria-hidden="true">→</span>
          <div><span class="lbl">Trong file xuất ra</span><p>Họ và tên: <b>${esc(ex.ho_ten||"Nguyễn Văn A")}</b> &nbsp; MSSV: <b>${esc(ex.mssv||"2253801010001")}</b></p></div>
        </div>
      </div>
    </details>

    <div class="tpl-block">
      <div class="tpl-bh"><h3 class="tpl-h">Bảng mã</h3></div>
      <p class="hint" style="margin:0">Bấm vào mã để sao chép, rồi dán vào file Word. Cột “Ví dụ” lấy ${key!=="moi"&&allRows().some(r=>r.a.type===key)?"từ một đơn đã nộp":"từ dữ liệu mẫu"}.</p>
      <div class="tags-list">
        <details class="tags" data-k="answers"${dOpen("answers")}><summary>Câu trả lời trong đơn</summary>
          ${qt.length?`<div class="tag-wrap"><table class="tag-tbl">${head}<tbody>${qt.map(qBlock).join('')}</tbody></table></div>`:'<p class="hint">Loại đơn chưa có câu hỏi.</p>'}
          <p class="hint">Mã của câu hỏi đặt ở ô “Mã dùng trong file Word” của câu hỏi đó. Mã của cột bảng lấy theo tên cột.</p>
        </details>
        ${COMMON_TAGS.map(([g,l])=>`<details class="tags" data-k="${esc(g)}"${dOpen(g)}><summary>${g}</summary><div class="tag-wrap"><table class="tag-tbl">${head}<tbody>${l.map(([t,n])=>row(t,esc(n),ex[t])).join('')}</tbody></table></div></details>`).join('')}
      </div>
    </div>
  </section>`;
}
/* sao chép bảng mẫu: dạng HTML để dán vào Word thành bảng thật */
async function copyLoopTable(q){
  const html=`<table border="1" style="border-collapse:collapse">${loopTableHtml(q).replace(/<b class="loop">|<\/b>|<table class="word-tbl">|<\/table>/g,'')}</table>`;
  const text=["STT",...q.cols.map(c=>c.label)].join('\t')+'\n'+[`{#${q.tag}}{stt}`,...q.cols.map((c,i)=>`{${c.tag}}`+(i===q.cols.length-1?`{/${q.tag}}`:''))].join('\t');
  try{await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([text],{type:'text/plain'})})]);toast("Đã sao chép bảng mẫu — dán (Ctrl+V) vào file Word")}
  catch(_){try{await navigator.clipboard.writeText(text);toast("Đã sao chép bảng mẫu")}catch(__){toast("Trình duyệt không cho sao chép, hãy gõ tay theo bảng mẫu")}}
}
document.addEventListener('click',async e=>{
  const b=e.target.closest('#feEdit [data-act^="tpl"], #feEdit [data-act="copyTag"], #feEdit [data-act="copyTbl"]');if(!b)return;
  const act=b.dataset.act,key=fe.key,d=fe.def,box=b.closest('.tpl'),t=box?(PRINT_TEMPLATES[key]||[]).find(x=>x.id===box.dataset.tpl):null;
  const res=m=>{const r=box.querySelector('.tpl-res');r.hidden=false;r.innerHTML=m};
  if(act==="copyTbl"){const q=questionTags(d).find(x=>x.tag===b.dataset.q);if(q)copyLoopTable(q);return}
  if(act==="copyTag"){try{await navigator.clipboard.writeText(b.dataset.tag);toast(`Đã sao chép ${b.dataset.tag}`)}catch(_){toast(`Mã: ${b.dataset.tag}`)}return}
  if(act==="tplRename"){ /* sửa tên ngay tại dòng: Enter / bấm ra ngoài để lưu, Esc để hủy */
    const nm=box.querySelector('.tpl-name');if(box.querySelector('.tpl-rn'))return;
    const inp=document.createElement('input');inp.className='tpl-rn';inp.value=t.name;inp.setAttribute('aria-label','Tên mẫu');
    nm.hidden=true;nm.after(inp);inp.focus();inp.select();
    let done=false;const fin=save=>{if(done)return;done=true;const v=inp.value.trim();if(save&&v&&v!==t.name){t.name=v;toast(`Đã đổi tên mẫu thành “${v}”`)}renderEditor()};
    inp.onkeydown=ev=>{if(ev.key==='Enter'){ev.preventDefault();fin(true)}else if(ev.key==='Escape'){ev.stopPropagation();fin(false)}};
    inp.onblur=()=>fin(true);
    return;
  }
  if(!t)return;
  if(act==="tplDel"){PRINT_TEMPLATES[key]=PRINT_TEMPLATES[key].filter(x=>x!==t);renderEditor();toast(`Đã xóa mẫu xuất file “${t.name}”`);return}
  if(act==="tplDl"){saveBlob(new Blob([t.buf]),t.fileName);return}
  /* xem file mẫu gốc (còn nguyên các mã), có nút tải mẫu gốc trên thanh xem */
  if(act==="tplView"){preview(new File([t.buf],t.fileName,{type:DOCX_MIME}),{download:"Tải mẫu gốc",meta:`Mẫu gốc · ${fmt(t.size)}`});$('pvName').textContent=t.name;return}
  if(act==="tplCheck"){
    res("Đang kiểm tra…");
    try{const r=await checkTemplate(t.buf,d);
      const codes=l=>l.map(x=>`<code>{${esc(x)}}</code>`).join(' '),probs=[];
      if(r.unknown.length)probs.push(`Có ${r.unknown.length} mã không có trong loại đơn này: ${codes(r.unknown)} — sẽ để trống khi xuất file.`);
      if(r.outside.length)probs.push(`Mã cột ${codes(r.outside)} nằm ngoài vòng lặp — sẽ để trống. Đặt chúng giữa ${questionTags(d).filter(q=>q.cols).map(q=>`<code>{#${esc(q.tag)}}</code> … <code>{/${esc(q.tag)}}</code>`).join(' hoặc ')}.`);
      res(r.error?`<span class="bad">Mẫu có lỗi: ${esc(r.error)}</span>`:
        !r.found.length?`<span class="bad">Không thấy mã trường nào trong mẫu. Gõ mã trong ngoặc nhọn, vd {ho_ten}.</span>`:
        probs.length?`<span class="bad">${probs.join('<br>')}</span>`:
        `<span class="good">Mẫu hợp lệ: ${r.found.length} mã trường đều dùng được.</span>`);
    }catch(e2){res(`<span class="bad">Không đọc được file này. Hãy chắc đây là file Word .docx.</span>`)}
    return;
  }
  if(act==="tplTry"){
    const apps=allRows().filter(r=>r.a.type===key),hit=apps[0];
    try{const data=hit?buildPrintData(hit.a,personOf(hit),d):samplePrintData(d);
      showExport(await renderDocx(t.buf,data,d),fileSafe('Xuat-thu',t.name),`Xuất thử · ${t.name}`,hit?`dữ liệu đơn ${hit.a.code}`:'dữ liệu giả');
      res(hit?`Đã tạo file xuất thử bằng đơn ${esc(hit.a.code)}.`:`Đã tạo file xuất thử bằng dữ liệu giả (loại đơn chưa có đơn nào).`);
    }catch(e2){res(`<span class="bad">Không tạo được file: ${esc(explainDocxError(e2))}</span>`)}
  }
});

/* "+ Tải mẫu lên": chọn file là thêm mẫu ngay (tên mẫu = tên file, đổi được bằng nút "Đổi tên"), rồi tự kiểm tra mã */
document.addEventListener('change',async e=>{
  if(e.target.id!=='tplFile')return;
  const f=e.target.files[0],m=$('tplMsg'),key=fe.key;if(!f)return;
  const err=!/\.docx$/i.test(f.name)?"Mẫu xuất file phải là file Word .docx (Word 2007 trở lên). File .doc cũ hãy mở bằng Word và lưu lại thành .docx.":"";
  m.hidden=!err;m.textContent=err;if(err){e.target.value="";return}
  const tpl={id:"t-"+uid(),name:f.name.replace(/\.docx$/i,''),fileName:f.name,size:f.size,buf:await f.arrayBuffer(),uploadedAt:nowIso(),uploadedBy:state.profile.name};
  (PRINT_TEMPLATES[key]=PRINT_TEMPLATES[key]||[]).push(tpl);
  renderEditor();toast(`Đã thêm mẫu xuất file “${tpl.name}”`);
  const nb=$('feEdit').querySelector(`.tpl[data-tpl="${tpl.id}"] [data-act=tplCheck]`);if(nb)nb.click();
});
