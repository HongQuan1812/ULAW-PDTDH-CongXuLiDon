/* Vẽ nội dung đơn từ cấu hình loại đơn (TYPES trong js/config.js): mỗi PHẦN là một khung, trong khung là các CÂU HỎI.
   Cùng một giao diện dùng cho 4 nơi:
     - trang nộp đơn mới (sửa được)
     - trang chi tiết đơn (sửa được hoặc chỉ xem, tùy trạng thái và quyền)
     - xem nhanh (dropdown ›) trong các bảng đơn (chỉ xem, chỉ các phần main:true)
     - tab "Xem trước" của trình soạn loại đơn (js/forms-page.js)
   Thêm loại câu hỏi mới: khai báo trong QTYPES (tên hiện trong trình soạn) và QUESTION_UI (giao diện). */

/* Các loại câu hỏi. Thuộc tính riêng của từng loại:
   choice (radio / check / select): options:["…"]
   table : columns:[{label, sub, type:"text"|"number", placeholder, sum, sumLabel}], rowName (vd "môn")
   file  : accept:["pdf","jpg","png"], maxMB */
const QTYPES={
  text:{name:"Trả lời ngắn"}, para:{name:"Đoạn văn"}, number:{name:"Số"}, date:{name:"Ngày"},
  radio:{name:"Chọn một",choice:true}, check:{name:"Chọn nhiều",choice:true}, select:{name:"Danh sách thả xuống",choice:true},
  file:{name:"Tải tệp"}, table:{name:"Bảng nhiều dòng"}, info:{name:"Khối thông báo (không cần trả lời)"}
};

/* Mỗi hàm QUESTION_UI[type](box, q, value, readonly) vẽ ô trả lời vào box và trả về {get(), check()}:
     get()   : câu trả lời hiện tại, lưu vào a.data[q.id]
     check() : "" nếu hợp lệ, ngược lại là câu báo lỗi hiện ngay dưới câu hỏi */
const QUESTION_UI={};
const emptyVal=v=>v==null||v===""||(Array.isArray(v)&&!v.length);
const uid=()=>Math.random().toString(36).slice(2,8);

QUESTION_UI.info=()=>({get:()=>undefined,check:()=>""});

QUESTION_UI.text=QUESTION_UI.number=QUESTION_UI.date=(box,q,value,ro)=>{
  const i=document.createElement('input');
  i.type=q.type==="number"?"number":q.type==="date"?"date":"text";
  if(q.type==="number")i.inputMode="decimal";
  i.value=value??"";i.disabled=ro;i.setAttribute('aria-label',q.label||"Câu trả lời");
  box.appendChild(i);
  return {
    get:()=>q.type==="number"?(i.value===""?"":Number(i.value)):i.value.trim(),
    check(){const bad=q.required&&!i.value.trim();i.classList.toggle('err',bad);return bad?"Câu hỏi này bắt buộc.":""}
  };
};
QUESTION_UI.para=(box,q,value,ro)=>{
  const t=document.createElement('textarea');t.rows=4;t.value=value??"";t.disabled=ro;t.setAttribute('aria-label',q.label||"Câu trả lời");
  box.appendChild(t);
  return {get:()=>t.value.trim(),check(){const bad=q.required&&!t.value.trim();t.classList.toggle('err',bad);return bad?"Câu hỏi này bắt buộc.":""}};
};
QUESTION_UI.radio=QUESTION_UI.check=(box,q,value,ro)=>{
  const name='q-'+q.id+'-'+uid(),multi=q.type==="check",cur=multi?(value||[]):value;
  const wrap=document.createElement('div');wrap.className='choices';
  wrap.innerHTML=(q.options||[]).map(o=>`<label class="choice"><input type="${multi?'checkbox':'radio'}" name="${name}" value="${esc(o)}" ${(multi?cur.includes(o):cur===o)?'checked':''} ${ro?'disabled':''}><span>${esc(o)}</span></label>`).join('');
  box.appendChild(wrap);
  const get=()=>{const c=[...wrap.querySelectorAll('input:checked')].map(x=>x.value);return multi?c:(c[0]||"")};
  return {get,check(){const bad=q.required&&emptyVal(get());wrap.classList.toggle('err',bad);return bad?(multi?"Chọn ít nhất một mục.":"Chọn một mục."):""}};
};
QUESTION_UI.select=(box,q,value,ro)=>{
  const s=document.createElement('select');s.disabled=ro;s.setAttribute('aria-label',q.label||"Chọn");
  s.innerHTML=`<option value="">Chọn…</option>`+(q.options||[]).map(o=>`<option ${o===value?'selected':''}>${esc(o)}</option>`).join('');
  box.appendChild(s);
  return {get:()=>s.value,check(){const bad=q.required&&!s.value;s.classList.toggle('err',bad);return bad?"Chọn một mục.":""}};
};

/* Độ rộng cột của bảng nhiều dòng: co giãn theo độ dài tên cột (và mô tả nhỏ), tối thiểu 7 ký tự, tối đa 24 ký tự.
   Tên cột dài hơn mức tối đa thì tự xuống dòng. Bảng rộng hơn khung thì cuộn ngang. */
const COL_MIN=7,COL_MAX=24;
const colCh=c=>Math.min(COL_MAX,Math.max(COL_MIN,(c.label||"").length,Math.ceil((c.sub||"").length*.85)))+2; /* +2: đệm hai bên ô */
const colgroup=cols=>`<colgroup><col style="width:52px">${cols.map(c=>`<col style="width:${colCh(c)}ch">`).join('')}<col style="width:48px"></colgroup>`;
const colMinWidth=cols=>`min-width:calc(100px + ${cols.reduce((t,c)=>t+colCh(c),0)}ch)`;
/* Bảng nhiều dòng: mỗi dòng là một mảng theo thứ tự cột; cột số có thể tính tổng ở chân bảng */
QUESTION_UI.table=(box,q,value,ro)=>{
  const cols=q.columns&&q.columns.length?q.columns:[{label:"Nội dung",type:"text"}],rn=q.rowName||"dòng";
  box.insertAdjacentHTML('beforeend',`
    <div class="tbl-wrap"><table class="ftbl" style="${colMinWidth(cols)}">${colgroup(cols)}
      <thead><tr><th>STT</th>${cols.map(c=>`<th>${esc(c.label)}${c.sub?`<small>${esc(c.sub)}</small>`:''}</th>`).join('')}<th><span style="position:absolute;left:-9999px">Xóa</span></th></tr></thead>
      <tbody></tbody></table></div>
    <div class="tbl-foot"><button type="button" class="btn add-row">+ Thêm ${esc(rn)}</button><div class="total"></div></div>`);
  const body=box.querySelector('tbody');
  function refresh(){
    [...body.children].forEach((tr,i)=>tr.querySelector('.idx').textContent=i+1);
    const sums=cols.map((c,k)=>c.sum?[...body.children].reduce((t,tr)=>t+(parseFloat(tr.querySelectorAll('input')[k].value)||0),0):null);
    box.querySelector('.total').innerHTML=`<b>${body.children.length}</b> ${esc(rn)}`+cols.map((c,k)=>c.sum?` · tổng <b>${sums[k]}</b> ${esc(c.sumLabel||c.label.toLowerCase())}`:'').join('');
  }
  function addRow(row){
    const tr=document.createElement('tr');
    tr.innerHTML=`<td class="idx"></td>`+cols.map(c=>`<td${c.type==="number"?' class="tc"':''}><input ${c.type==="number"?'type="number" min="0"':''} aria-label="${esc(c.label)}" placeholder="${esc(c.placeholder||'')}"></td>`).join('')+
      `<td class="act"><button type="button" class="icon-btn" aria-label="Xóa dòng"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button></td>`;
    const ins=tr.querySelectorAll('input');
    if(row)row.forEach((v,k)=>{if(ins[k])ins[k].value=v});
    ins.forEach(i=>i.disabled=ro);
    tr.querySelector('button').onclick=()=>{tr.remove();refresh()};
    tr.addEventListener('input',e=>{e.target.classList.remove('err');refresh()});
    body.appendChild(tr);refresh();
  }
  box.querySelector('.add-row').onclick=()=>{addRow();body.lastChild.querySelector('input').focus()};
  (value||[]).forEach(addRow);
  if(!ro&&!body.children.length)addRow(); /* đơn mới: sẵn một dòng trống */
  refresh();
  return {
    get:()=>[...body.children].map(tr=>[...tr.querySelectorAll('input')].map((i,k)=>cols[k].type==="number"?(parseFloat(i.value)||0):i.value.trim())),
    check(){
      let bad=false;
      body.querySelectorAll('input').forEach(x=>{if(!x.value.trim()){x.classList.add('err');bad=true}});
      if(q.required&&!body.children.length)return `Thêm ít nhất một ${rn}.`;
      return bad?`Điền đủ ${cols.length} cột cho các ô được tô đỏ.`:"";
    }
  };
};

/* Tải tệp: chọn hoặc kéo thả, kiểm tra định dạng và dung lượng, bấm vào tệp để xem lại */
const fmt=b=>b==null?'Đã tải lên':b<1048576?(b/1024).toFixed(0)+' KB':(b/1048576).toFixed(1)+' MB';
const MIME={pdf:"application/pdf",jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",doc:"application/msword",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls:"application/vnd.ms-excel",xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"};
QUESTION_UI.file=(box,q,value,ro)=>{
  const exts=(q.accept&&q.accept.length?q.accept:["pdf","jpg","png"]).map(x=>x.toLowerCase());
  if(exts.includes("jpg")&&!exts.includes("jpeg"))exts.push("jpeg");
  const max=(q.maxMB||10)*1048576,okType=new RegExp(`\\.(${exts.join('|')})$`,'i');
  const shown=exts.filter(x=>x!=="jpeg").map(x=>x.toUpperCase()).join(' · ');
  box.insertAdjacentHTML('beforeend',`
    <div class="drop" tabindex="0" role="button" aria-label="Chọn tệp">
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M12 17v-6"/><path d="m9 13 3-3 3 3"/></svg>
      <strong>Kéo thả tệp vào đây hoặc bấm để chọn</strong>
      <span>${shown} — tối đa ${q.maxMB||10} MB/tệp</span>
    </div>
    <input type="file" multiple accept="${exts.map(x=>'.'+x).join(',')},${exts.map(x=>MIME[x]).filter(Boolean).join(',')}" hidden>
    <ul class="files"></ul>
    <p class="hint no-files">Chưa có tệp nào.</p>
    <p class="msg file-msg" hidden></p>`);
  const drop=box.querySelector('.drop'),fi=box.querySelector('input[type=file]'),fl=box.querySelector('.files'),msg=box.querySelector('.file-msg');
  let files=(value||[]).map(n=>({name:n,size:null})); /* tệp đã lưu chỉ có tên; tệp vừa chọn là đối tượng File */
  function render(){
    fl.innerHTML='';
    files.forEach((f,i)=>{
      const li=document.createElement('li');
      li.innerHTML=`<span class="ftype">${esc(f.name.split('.').pop().toUpperCase())}</span><button type="button" class="fname"></button><span class="fsize">${fmt(f.size)}</span><button type="button" class="icon-btn view-btn" aria-label="Xem tệp" style="color:var(--muted)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg></button><button type="button" class="icon-btn rm-btn" aria-label="Gỡ tệp"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`;
      const fb=li.querySelector('.fname');fb.textContent=f.name;fb.title=`Xem ${f.name}`;
      li.onclick=()=>preview(f);
      li.querySelector('.rm-btn').onclick=e=>{e.stopPropagation();files.splice(i,1);render()};
      fl.appendChild(li);
    });
    box.querySelector('.no-files').hidden=files.length>0;
  }
  function add(list){
    const bad=[];
    [...list].forEach(f=>{
      if(!okType.test(f.name))bad.push(`${f.name}: định dạng không hỗ trợ, hãy dùng ${shown}.`);
      else if(f.size>max)bad.push(`${f.name}: ${fmt(f.size)}, vượt quá ${q.maxMB||10} MB.`);
      else if(!files.some(x=>x.name===f.name))files.push(f);
    });
    msg.hidden=!bad.length;msg.innerHTML=bad.map(esc).join('<br>');render();
  }
  if(!ro){
    drop.onclick=()=>fi.click();
    drop.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fi.click()}};
    fi.onchange=()=>{add(fi.files);fi.value=''};
    ['dragenter','dragover'].forEach(t=>drop.addEventListener(t,e=>{e.preventDefault();drop.classList.add('over')}));
    ['dragleave','drop'].forEach(t=>drop.addEventListener(t,e=>{e.preventDefault();drop.classList.remove('over')}));
    drop.addEventListener('drop',e=>add(e.dataTransfer.files));
  }
  render();
  return {get:()=>files.map(f=>f.name),check:()=>q.required&&!files.length?"Tải lên ít nhất một tệp.":""};
};

/* Vẽ một câu hỏi: nhãn (dấu * nếu bắt buộc), mô tả, ô trả lời, dòng báo lỗi */
function renderQuestion(q,value,ro){
  const box=document.createElement('div');box.className='q q-'+q.type;box.dataset.q=q.id;
  if(q.type==="info"){box.innerHTML=`${q.label?`<p class="q-label">${esc(q.label)}</p>`:''}${q.help?`<p class="q-info">${esc(q.help)}</p>`:''}`;return {q,el:box,...QUESTION_UI.info()}}
  box.innerHTML=`<p class="q-label">${esc(q.label||"Câu hỏi chưa có tên")}${q.required?' <span class="req" aria-label="bắt buộc">*</span>':''}</p>${q.help?`<p class="hint">${esc(q.help)}</p>`:''}`;
  const ui=(QUESTION_UI[q.type]||QUESTION_UI.text)(box,q,value,ro);
  const msg=document.createElement('p');msg.className='msg q-msg';msg.hidden=true;box.appendChild(msg);
  box.addEventListener('input',()=>{if(!msg.hidden&&!ui.check()){msg.hidden=true}});
  box.addEventListener('change',()=>{if(!msg.hidden&&!ui.check()){msg.hidden=true}});
  return {q,el:box,get:ui.get,validate(){const m=ui.check();msg.hidden=!m;msg.textContent=m;return m}};
}

/* Vẽ các phần của một loại đơn. Trả về danh sách {sec, el, get(), validate()}.
   get()      : {<id câu hỏi>: câu trả lời, …} của phần này
   validate() : "" nếu hợp lệ, ngược lại là câu báo lỗi ngắn hiện dưới nút Gửi đơn
   opts.readonly : chỉ xem · opts.onlyMain : chỉ vẽ các phần main:true (xem nhanh) · opts.def : cấu hình thay cho TYPES[type] (xem trước) */
function renderSections(type,data,{readonly=false,onlyMain=false,def=null}={}){
  const T=def||TYPES[type];
  return T.sections.map((sec,i)=>({sec,no:i+1})).filter(({sec})=>!onlyMain||sec.main).map(({sec,no})=>{
    const el=document.createElement('section');
    el.className='card'+(readonly?' ro':'');el.dataset.sec=sec.id;
    el.innerHTML=`<div class="sec-head"><span class="sec-no">${no}</span><h2>${esc(sec.title||"Phần chưa có tên")}</h2></div>${sec.hint?`<p class="hint">${esc(sec.hint)}</p>`:''}`;
    const qs=(sec.questions||[]).map(q=>renderQuestion(q,data?data[q.id]:undefined,readonly));
    qs.forEach(x=>el.appendChild(x.el));
    return {sec,el,qs,
      get:()=>Object.fromEntries(qs.filter(x=>x.q.type!=="info").map(x=>[x.q.id,x.get()])),
      validate:()=>qs.map(x=>x.validate()).some(Boolean)?`Kiểm tra lại phần “${sec.title}”.`:""};
  });
}

/* Xem nhanh (dropdown ›) trong các bảng đơn: dùng lại đúng khung của trang chi tiết đơn, chỉ xem,
   chỉ các phần nội dung chính (main:true). Bảng vẽ chỗ trống bằng quickHtml(), rồi gọi fillQuick() để gắn khung vào. */
function quickHtml(a){
  return `<div class="qv" data-code="${esc(a.code)}"></div>${lastEdit(a)}${a.note?`<p class="note"><b>Phòng Đào tạo:</b> ${esc(a.note)}</p>`:''}`;
}
function fillQuick(root){
  root.querySelectorAll('.qv:empty').forEach(box=>{
    const hit=findApp(box.dataset.code);if(!hit)return;
    box.append(...renderSections(hit.a.type,hit.a.data,{readonly:true,onlyMain:true}).map(s=>s.el));
    if(typeof initCollapsible==='function')initCollapsible(box);
  });
}
