/* Bộ công cụ bảng dùng chung (kiểu Notion): tìm kiếm, Sắp xếp nhiều cột có thứ tự ưu tiên, Lọc theo cột.
   Dùng cho bảng "Đơn đã nộp" (trang Thông tin cá nhân), bảng Quản lí đơn, Quản lí tài khoản và Quản lí loại đơn.
   Kiểu cột: text, select, number, date, datetime. */
const norm=t=>String(t).normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();
function hl(text,q){
  const t=String(text);if(!q)return esc(t);
  const i=norm(t).indexOf(norm(q));if(i<0)return esc(t);
  return esc(t.slice(0,i))+'<mark>'+esc(t.slice(i,i+q.length))+'</mark>'+esc(t.slice(i+q.length));
}
const TT_ICON={
  up:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
  down:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
  filt:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h18l-7 8v6l-4 2v-8z"/></svg>'
};
/* Các cột thông tin đơn, dùng chung cho cả hai bảng. Mỗi dòng có dạng {a: đơn, p: người nộp}.
   type: text/select lọc "=" ; date/datetime lọc "=" (theo ngày) hoặc "Trong khoảng" */
const APP_FIELDS=[
  {k:"code",t:"Mã đơn",type:"text",get:r=>r.a.code},
  {k:"type",t:"Loại đơn",type:"select",get:r=>r.a.type,label:v=>TYPES[v].name,opts:()=>Object.keys(TYPES)},
  {k:"date",t:"Ngày nộp",type:"date",get:r=>r.a.date},
  {k:"status",t:"Trạng thái",type:"select",get:r=>r.a.status,label:v=>STATUS[v].t,opts:()=>Object.keys(STATUS)},
  {k:"received",t:"Thời gian tiếp nhận",type:"datetime",get:r=>r.a.receivedAt||null}
];
const TT_DIRS={number:["Nhỏ → lớn","Lớn → nhỏ"],text:["A → Z","Z → A"],select:["A → Z","Z → A"],date:["Cũ → mới","Mới → cũ"],datetime:["Cũ → mới","Mới → cũ"]};

const _ttPops=[]; /* tất cả bảng nổi đang có, để đóng khi bấm ra ngoài */
document.addEventListener('click',e=>{if(!e.target.closest('.pop-wrap'))_ttPops.forEach(c=>c())});
document.addEventListener('keydown',e=>{if(e.key==='Escape')_ttPops.forEach(c=>c())});

/* cfg: {fields, st:{sort,filters,query}, defaultSort, ids:{sortBtn,sortPop,sortCnt,filtBtn,filtPop,filtCnt}, onChange()} */
function createTableTools(cfg){
  const {fields,st,ids}=cfg;
  const F=k=>fields.find(f=>f.k===k);
  const dirLabel=(f,dir)=>TT_DIRS[f.type][dir==="asc"?0:1];
  const OPS=f=>f.type==="date"||f.type==="datetime"||f.type==="number"?[["eq","="],["range","Trong khoảng"]]:[["eq","="]];
  const active=r=>r.op==="range"?!!(r.from||r.to):r.v!==""&&r.v!=null;
  const newFilter=()=>({k:(fields.find(f=>f.k===(cfg.filterKey||"status"))||fields[0]).k,op:"eq",v:"",from:"",to:""});
  const changed=()=>{cfg.onChange()};

  function pass(row,r){
    const f=F(r.k),val=f.get(row);
    if(val==null||val==="")return false;
    if(f.type==="select")return val===r.v;
    if(f.type==="text")return norm(val)===norm(String(r.v).trim());
    if(f.type==="number"){const n=Number(val);return r.op==="eq"?n===Number(r.v):(r.from===""||r.from==null||n>=Number(r.from))&&(r.to===""||r.to==null||n<=Number(r.to))}
    const day=String(val).slice(0,10);
    if(r.op==="eq")return day===r.v;
    return (!r.from||day>=r.from)&&(!r.to||day<=r.to);
  }
  function cmp(x,y,f){
    let a=f.get(x),b=f.get(y);
    const na=a==null||a==="",nb=b==null||b==="";
    if(na||nb)return na&&nb?0:na?1:-1; /* ô trống luôn nằm cuối */
    if(f.order)return f.order(a)-f.order(b); /* thứ tự riêng, vd trạng thái: Đang mở → Nháp → Đã đóng */
    if(f.type==="number")return Number(a)-Number(b);
    if(f.type==="select"){a=f.label(a);b=f.label(b)}
    return String(a).localeCompare(String(b),'vi',{numeric:true,sensitivity:'base'});
  }
  /* nội dung hiển thị của một ô, dùng để tìm kiếm: chỉ tìm trong các cột của bảng */
  function shown(f,row){
    const v=f.get(row);if(v==null||v==="")return "";
    if(f.type==="select")return f.label(v);
    if(f.type==="date")return fmtD(v);
    if(f.type==="datetime")return fmtT(v);
    return String(v);
  }
  function apply(rows){
    const q=norm(st.query.trim());
    let out=rows.filter(r=>!q||fields.some(f=>norm(shown(f,r)).includes(q)));
    st.filters.filter(active).forEach(r=>{out=out.filter(row=>pass(row,r))});
    const sorts=st.sort.length?st.sort:cfg.defaultSort;
    out.sort((x,y)=>{for(const s of sorts){const f=F(s.k),c=cmp(x,y,f);if(c){const blank=f.get(x)==null||f.get(y)==null;return s.dir==="asc"||blank?c:-c}}return 0});
    return out;
  }
  /* biểu tượng trên tiêu đề cột đang được sắp xếp / lọc */
  function ind(f){
    const si=st.sort.findIndex(s=>s.k===f.k),s=st.sort[si];let h='';
    if(s)h+=`<span class="ind" title="Đang sắp xếp: ${dirLabel(f,s.dir)}">${s.dir==="asc"?TT_ICON.up:TT_ICON.down}${st.sort.length>1?`<small>${si+1}</small>`:''}</span>`;
    if(st.filters.some(r=>r.k===f.k&&active(r)))h+=`<span class="ind" title="Đang lọc theo cột này">${TT_ICON.filt}</span>`;
    return h;
  }
  function th(f,extra=''){const i=ind(f);return `<th class="${extra}${i?' act':''}"><span class="hd">${f.t}${i}</span></th>`}
  function counts(){
    const ns=st.sort.length,nf=st.filters.filter(active).length;
    $(ids.sortCnt).hidden=!ns;$(ids.sortCnt).textContent=ns;$(ids.sortBtn).classList.toggle('on',!!ns);
    $(ids.filtCnt).hidden=!nf;$(ids.filtCnt).textContent=nf;$(ids.filtBtn).classList.toggle('on',!!nf);
  }
  const hasQuery=()=>!!st.query.trim()||st.filters.some(active);

  /* ---- bảng Sắp xếp ---- */
  const fieldOpts=(sel,skip=[])=>fields.filter(f=>f.k===sel||!skip.includes(f.k)).map(f=>`<option value="${f.k}" ${f.k===sel?'selected':''}>${f.t}</option>`).join('');
  const SP=$(ids.sortPop),FP=$(ids.filtPop);
  function renderSort(){
    const used=st.sort.map(s=>s.k);
    SP.innerHTML=`<div class="ph">Sắp xếp theo</div>
      ${st.sort.length?st.sort.map((s,i)=>`<div class="row srow" data-i="${i}" draggable="true">
        <span class="grip" title="Kéo để đổi thứ tự ưu tiên" aria-hidden="true">⋮⋮</span><span class="prio">${i+1}</span>
        <select data-f="k" aria-label="Cột">${fieldOpts(s.k,used)}</select>
        <select data-f="dir" aria-label="Thứ tự"><option value="asc" ${s.dir==="asc"?'selected':''}>${dirLabel(F(s.k),"asc")}</option><option value="desc" ${s.dir==="desc"?'selected':''}>${dirLabel(F(s.k),"desc")}</option></select>
        <span class="mv"><button type="button" class="icon-btn" data-mv="-1" aria-label="Ưu tiên cao hơn" ${i===0?'disabled':''}>↑</button><button type="button" class="icon-btn" data-mv="1" aria-label="Ưu tiên thấp hơn" ${i===st.sort.length-1?'disabled':''}>↓</button></span>
        <button type="button" class="icon-btn" data-rm aria-label="Bỏ dòng sắp xếp">×</button></div>`).join('')
        :`<p class="empty-note">Chưa sắp xếp. ${cfg.defaultNote||'Bảng đang xếp đơn mới nộp lên trên.'}</p>`}
      ${st.sort.length>1?'<p class="empty-note">Dòng trên được ưu tiên trước. Kéo ⋮⋮ hoặc bấm ↑ ↓ để đổi thứ tự.</p>':''}
      <div class="foot">${used.length<fields.length?'<button type="button" class="link-btn" data-add>+ Thêm sắp xếp</button>':'<span></span>'}${st.sort.length?'<button type="button" class="link-btn muted" data-clear>Xóa tất cả</button>':''}</div>`;
  }
  const move=(from,to)=>{if(to<0||to>=st.sort.length||from===to)return;const [s]=st.sort.splice(from,1);st.sort.splice(to,0,s)};
  SP.addEventListener('change',e=>{const row=e.target.closest('.row');if(!row)return;st.sort[+row.dataset.i][e.target.dataset.f]=e.target.value;renderSort();changed()});
  SP.addEventListener('click',e=>{
    e.stopPropagation();
    if(e.target.closest('[data-add]')){const used=st.sort.map(s=>s.k);st.sort.push({k:fields.find(f=>!used.includes(f.k)).k,dir:"asc"})}
    else if(e.target.closest('[data-clear]'))st.sort.splice(0);
    else if(e.target.closest('[data-rm]'))st.sort.splice(+e.target.closest('.row').dataset.i,1);
    else if(e.target.closest('[data-mv]')){const i=+e.target.closest('.row').dataset.i;move(i,i+ +e.target.closest('[data-mv]').dataset.mv)}
    else return;
    renderSort();changed();
  });
  let dragFrom=null;
  SP.addEventListener('dragstart',e=>{
    const row=e.target.closest('.srow');if(!row)return;
    if(e.target.closest('select,button')){e.preventDefault();return}
    dragFrom=+row.dataset.i;row.classList.add('dragging');e.dataTransfer.effectAllowed='move';
    try{e.dataTransfer.setData('text/plain',String(dragFrom))}catch(_){}
  });
  SP.addEventListener('dragover',e=>{
    const row=e.target.closest('.srow');if(!row||dragFrom==null)return;e.preventDefault();
    SP.querySelectorAll('.srow').forEach(r=>r.classList.remove('over-top','over-bot'));
    const b=row.getBoundingClientRect();row.classList.add(e.clientY<b.top+b.height/2?'over-top':'over-bot');
  });
  SP.addEventListener('drop',e=>{
    const row=e.target.closest('.srow');if(!row||dragFrom==null)return;e.preventDefault();
    let to=+row.dataset.i;const b=row.getBoundingClientRect();if(e.clientY>=b.top+b.height/2)to++;
    if(to>dragFrom)to--;move(dragFrom,to);dragFrom=null;renderSort();changed();
  });
  SP.addEventListener('dragend',()=>{dragFrom=null;SP.querySelectorAll('.srow').forEach(r=>r.classList.remove('dragging','over-top','over-bot'))});

  /* ---- bảng Lọc ---- */
  function valueInputs(r){
    const f=F(r.k);
    if(f.type==="select")return `<select data-f="v" aria-label="Giá trị"><option value="">Chọn…</option>${f.opts().map(v=>`<option value="${v}" ${v===r.v?'selected':''}>${esc(f.label(v))}</option>`).join('')}</select>`;
    if(f.type==="text")return `<input class="txt" data-f="v" value="${esc(r.v||'')}" placeholder="Nhập giá trị" aria-label="Giá trị">`;
    if(f.type==="number")return r.op==="range"?`<input type="number" data-f="from" value="${esc(r.from||'')}" placeholder="Từ" aria-label="Từ"><span class="to">đến</span><input type="number" data-f="to" value="${esc(r.to||'')}" placeholder="Đến" aria-label="Đến">`
      :`<input type="number" class="txt" data-f="v" value="${esc(r.v||'')}" placeholder="Nhập số" aria-label="Giá trị">`;
    if(r.op==="range")return `<input type="date" data-f="from" value="${r.from||''}" aria-label="Từ ngày"><span class="to">đến</span><input type="date" data-f="to" value="${r.to||''}" aria-label="Đến ngày">`;
    return `<input type="date" data-f="v" value="${r.v||''}" aria-label="Ngày">`;
  }
  function renderFilt(){
    FP.innerHTML=`<div class="ph">Lọc theo · thỏa tất cả điều kiện</div>
      ${st.filters.length?st.filters.map((r,i)=>`<div class="row" data-i="${i}">
        <select data-f="k" aria-label="Cột">${fieldOpts(r.k)}</select>
        <select data-f="op" aria-label="Điều kiện" style="flex:0 1 130px">${OPS(F(r.k)).map(([v,t])=>`<option value="${v}" ${v===r.op?'selected':''}>${t}</option>`).join('')}</select>
        ${valueInputs(r)}
        <button type="button" class="icon-btn" data-rm aria-label="Bỏ điều kiện lọc">×</button></div>`).join('')
        :'<p class="empty-note">Chưa có bộ lọc nào.</p>'}
      <div class="foot"><button type="button" class="link-btn" data-add>+ Thêm bộ lọc</button>${st.filters.length?'<button type="button" class="link-btn muted" data-clear>Xóa tất cả</button>':''}</div>`;
  }
  FP.addEventListener('input',e=>{
    const row=e.target.closest('.row');if(!row||e.target.tagName==='SELECT')return;
    st.filters[+row.dataset.i][e.target.dataset.f]=e.target.value;changed();
  });
  FP.addEventListener('change',e=>{
    const row=e.target.closest('.row');if(!row)return;const r=st.filters[+row.dataset.i],k=e.target.dataset.f;
    if(k==="k"){Object.assign(r,{k:e.target.value,op:"eq",v:"",from:"",to:""});renderFilt()}
    else if(k==="op"){Object.assign(r,{op:e.target.value,v:"",from:"",to:""});renderFilt()}
    else r[k]=e.target.value;
    changed();
  });
  FP.addEventListener('click',e=>{
    e.stopPropagation();
    if(e.target.closest('[data-add]'))st.filters.push(newFilter());
    else if(e.target.closest('[data-clear]'))st.filters.splice(0);
    else if(e.target.closest('[data-rm]'))st.filters.splice(+e.target.closest('.row').dataset.i,1);
    else return;
    renderFilt();changed();
  });

  /* mở/đóng */
  const pairs=[[ids.sortBtn,SP,renderSort],[ids.filtBtn,FP,renderFilt]];
  function close(except){pairs.forEach(([b,p])=>{if(p!==except){p.hidden=true;$(b).setAttribute('aria-expanded','false')}})}
  _ttPops.push(()=>close());
  pairs.forEach(([b,p,render])=>{
    $(b).onclick=e=>{
      e.stopPropagation();const open=p.hidden;_ttPops.forEach(c=>c());
      if(open){if(p===FP&&!st.filters.length)st.filters.push(newFilter());render();p.hidden=false;$(b).setAttribute('aria-expanded','true')}
    };
  });
  return {apply,th,counts,hasQuery,F};
}
