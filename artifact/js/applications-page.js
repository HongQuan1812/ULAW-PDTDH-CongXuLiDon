/* Trang Đơn: bảng gộp thông tin đơn + thông tin cá nhân của người nộp.
   Tìm kiếm / Sắp xếp / Lọc dùng bộ công cụ chung trong table-tools.js. */
const A_PER=10;
const A_FIELDS=[...APP_FIELDS,
  {k:"name",t:"Họ và tên",type:"text",get:r=>r.p.name,grp:true},
  {k:"cccd",t:"Số CCCD",type:"text",get:r=>r.p.cccd},
  {k:"phone",t:"Số điện thoại",type:"text",get:r=>r.p.phone},
  {k:"email",t:"Email",type:"text",get:r=>r.p.email}
];
function allRows(){
  const me=state.profile?[{...state.profile,email:state.user.email,apps:state.apps}]:[];
  return [...me,...state.others].flatMap(p=>p.apps.map(a=>({p,a})));
}
const aTools=createTableTools({
  fields:A_FIELDS,
  st:{get sort(){return state.aSort},get filters(){return state.aFilters},get query(){return state.aQuery}},
  defaultSort:[{k:"date",dir:"desc"},{k:"code",dir:"desc"}], /* mặc định: mới nộp lên trên */
  ids:{sortBtn:"aSortBtn",sortPop:"aSortPop",sortCnt:"aSortCnt",filtBtn:"aFiltBtn",filtPop:"aFiltPop",filtCnt:"aFiltCnt"},
  onChange:()=>{state.aPage=1;renderAppsPage()}
});

function renderHead(){
  $('aHead').innerHTML=`<th style="width:28px"><button type="button" class="exp" id="aExpAll" aria-expanded="false" aria-label="Mở xem nhanh tất cả đơn" title="Mở/đóng tất cả">›</button></th>`+A_FIELDS.map(f=>aTools.th(f,f.grp?'grp':'')).join('');
}
function cellHtml(f,row,q){
  const {a,p}=row;
  switch(f.k){
    case "code":return `<td class="code">${hl(a.code,q)}</td>`;
    case "type":return `<td class="type">${hl(TYPES[a.type].name,q)}</td>`;
    case "date":return `<td class="num">${hl(fmtD(a.date),q)}</td>`;
    case "status":{const s=STATUS[a.status];return `<td><span class="pill ${s.c}">${hl(s.t,q)}</span></td>`}
    /* đơn chờ tiếp nhận (Đã nộp / Đã bổ sung) hiện nút; đơn khác hiện thời gian tiếp nhận gần nhất */
    case "received":return `<td class="num">${RECEIVABLE.includes(a.status)&&can("receive")?`<button type="button" class="btn primary sm" data-recv="${a.code}">Tiếp nhận</button>`:a.receivedAt?hl(fmtT(a.receivedAt),q):'<span class="dash">—</span>'}</td>`;
    case "name":return `<td class="nm grp">${hl(p.name,q)}</td>`;
    case "cccd":return `<td class="mono">${state.aReveal||q?hl(p.cccd,q):maskC(p.cccd)}</td>`;
    case "phone":return `<td class="mono">${hl(p.phone,q)}</td>`;
    case "email":return `<td>${hl(p.email,q)}</td>`;
  }
}
/* số điều kiện đang áp dụng hiện trên nút Sắp xếp / Lọc */
function renderAppsPage(){
  renderStats();
  const q=state.aQuery.trim(),list=aTools.apply(allRows());
  renderHead();aTools.counts();
  const pages=Math.max(1,Math.ceil(list.length/A_PER));state.aPage=Math.min(state.aPage,pages);
  const from=(state.aPage-1)*A_PER,view=list.slice(from,from+A_PER);
  const filtered=aTools.hasQuery();
  $('aTb').innerHTML=view.length?view.map(r=>`<tr class="main" tabindex="0" data-code="${r.a.code}"><td><button type="button" class="exp" aria-expanded="false" aria-label="Xem nhanh đơn ${r.a.code}">›</button></td>${A_FIELDS.map(f=>cellHtml(f,r,q)).join('')}</tr>
      <tr class="detail" hidden><td></td><td colspan="${A_FIELDS.length}">${quickHtml(r.a)}</td></tr>`).join('')
    :`<tr><td colspan="${A_FIELDS.length+1}" class="empty">${filtered?'Không có đơn nào khớp điều kiện tìm kiếm và bộ lọc.':'Chưa có đơn nào.'}</td></tr>`;
  const pg=$('aPager');
  if(list.length<=A_PER){pg.innerHTML=list.length?`<span>${list.length} đơn</span>`:'';}
  else{
    let h=`<span>Hiển thị ${from+1}–${from+view.length} trong ${list.length} đơn</span><div class="pages"><button type="button" class="pg" data-p="${state.aPage-1}" ${state.aPage===1?'disabled':''} aria-label="Trang trước">‹</button>`;
    for(let i=1;i<=pages;i++)h+=`<button type="button" class="pg" data-p="${i}" ${i===state.aPage?'aria-current="page"':''}>${i}</button>`;
    pg.innerHTML=h+`<button type="button" class="pg" data-p="${state.aPage+1}" ${state.aPage===pages?'disabled':''} aria-label="Trang sau">›</button></div>`;
  }
  fillQuick($('aTb')); /* gắn card nội dung chính vào ô xem nhanh */
  aSyncAll();
  const rb=$('aReveal');rb.textContent=state.aReveal?'Ẩn CCCD':'Hiện CCCD';rb.setAttribute('aria-pressed',state.aReveal);
}

$('aPager').onclick=e=>{e.preventDefault();const b=e.target.closest('.pg');if(!b||b.disabled)return;state.aPage=+b.dataset.p;pageTo('aPager',b,renderAppsPage)};
$('aSearch').addEventListener('input',e=>{state.aQuery=e.target.value;state.aPage=1;renderAppsPage()});
$('aReveal').onclick=()=>{state.aReveal=!state.aReveal;renderAppsPage()};

function aSetOpen(tr,open){const dt=tr.nextElementSibling;dt.hidden=!open;tr.classList.toggle('open',open);tr.querySelector('.exp').setAttribute('aria-expanded',open)}
function aSyncAll(){
  const rows=[...$('aTb').querySelectorAll('tr.main')],b=$('aExpAll');if(!b)return;
  const all=rows.length>0&&rows.every(r=>r.classList.contains('open'));
  b.classList.toggle('all-open',all);b.setAttribute('aria-expanded',all);b.disabled=!rows.length;
  b.setAttribute('aria-label',all?'Đóng xem nhanh tất cả đơn':'Mở xem nhanh tất cả đơn');
}
$('aHead').onclick=e=>{
  if(!e.target.closest('#aExpAll'))return;
  const rows=[...$('aTb').querySelectorAll('tr.main')],open=!rows.every(r=>r.classList.contains('open'));
  rows.forEach(r=>aSetOpen(r,open));aSyncAll();
};
/* Tiếp nhận đơn: ghi thời gian tiếp nhận và chuyển Đã nộp / Đã bổ sung → Đang xét.
   Dùng chung cho nút ở bảng Quản lí đơn và nút ở trang chi tiết đơn. */
function receiveApp(code){
  const hit=findApp(code);if(!hit||!RECEIVABLE.includes(hit.a.status)||!can("receive"))return null;
  hit.a.receivedAt=nowIso();hit.a.status="xet";
  hit.a.note=""; /* bắt đầu lượt xét mới: bỏ lí do của lần yêu cầu bổ sung trước */
  /* người tiếp nhận = cán bộ vừa bấm; mặc định cũng là người xử lí (có thể chuyển giao sau) */
  const me={name:state.profile.name,email:state.user.email};
  hit.a.receiver=me;hit.a.handler=me;hit.a.handlerSince=hit.a.receivedAt;
  toast(`Đã tiếp nhận đơn ${hit.a.code} lúc ${fmtT(hit.a.receivedAt)}`);
  return hit.a;
}
$('aTb').onclick=e=>{
  /* Tiếp nhận đơn: ghi thời gian tiếp nhận và chuyển Đã nộp → Đang xét */
  const b=e.target.closest('[data-recv]');
  if(b){
    if(receiveApp(b.dataset.recv))renderAppsPage();return;
  }
  const tr=e.target.closest('tr.main');if(!tr)return;
  if(e.target.closest('.exp')){aSetOpen(tr,tr.nextElementSibling.hidden);aSyncAll();return}
  navigate("don-"+tr.dataset.code); /* bấm vào dòng: mở trang chi tiết đơn */
};
$('aTb').addEventListener('keydown',e=>{const tr=e.target.closest('tr.main');if(tr&&e.target===tr&&e.key==='Enter'){e.preventDefault();navigate("don-"+tr.dataset.code)}});

/* ---- Thống kê đầu trang Quản lí đơn ----
   Đếm trên TẤT CẢ đơn (không theo ô tìm kiếm / bộ lọc), để số liệu luôn là tổng thể.
   Bấm một trạng thái hoặc một loại đơn: lọc bảng theo mục đó (thay điều kiện lọc cùng cột); bấm lại để bỏ lọc. */
const statFilter=k=>state.aFilters.find(r=>r.k===k&&r.op==="eq"&&r.v);
function renderStats(){
  const rows=allRows(),total=rows.length,cnt={},byType={};
  rows.forEach(({a})=>{cnt[a.status]=(cnt[a.status]||0)+1;(byType[a.type]=byType[a.type]||{n:0,s:{}}).n++;byType[a.type].s[a.status]=(byType[a.type].s[a.status]||0)+1});
  const pct=n=>total?Math.round(n*100/total):0,fs=statFilter("status"),ft=statFilter("type"),keys=Object.keys(STATUS);
  const bar=(s,n)=>`<div class="st-bar" aria-hidden="true">${keys.filter(k=>s[k]).map(k=>`<span class="sb-${k}" style="flex:${s[k]}" title="${STATUS[k].t}: ${s[k]}"></span>`).join('')||'<span class="sb-empty" style="flex:1"></span>'}</div>`;
  const types=Object.keys(TYPES).sort((x,y)=>((byType[y]||{}).n||0)-((byType[x]||{}).n||0)||TYPES[x].name.localeCompare(TYPES[y].name,'vi'));
  $('aStats').innerHTML=`
    <section class="card st-card" aria-labelledby="stS">
      <div class="st-head"><h2 id="stS">Theo trạng thái</h2><span class="st-total"><b>${total}</b> đơn</span></div>
      ${bar(cnt,total)}
      <div class="st-grid">${keys.map(k=>`<button type="button" class="st-tile${fs&&fs.v===k?' on':''}" data-st="${k}" aria-pressed="${!!(fs&&fs.v===k)}" title="Bấm để lọc bảng theo “${STATUS[k].t}”">
          <span class="st-lbl"><i class="sb-${k}"></i>${STATUS[k].t}</span><span class="st-num">${cnt[k]||0}</span><span class="st-pct">${pct(cnt[k]||0)}%</span></button>`).join('')}</div>
    </section>
    <section class="card st-card" aria-labelledby="stT">
      <div class="st-head"><h2 id="stT">Theo loại đơn</h2><span class="st-total">${types.length} loại đơn</span></div>
      ${typeChart(types,byType,ft)}
    </section>`;
}
/* Biểu đồ cột theo loại đơn: trục x là tên loại đơn (nhãn nghiêng), trục y là % trên tổng số đơn (0–100%).
   Nhiều loại đơn thì biểu đồ cuộn ngang. Bấm một cột để lọc bảng theo loại đơn đó. */
function typeChart(types,byType,ft){
  /* trục y: 0–100% (tỉ lệ trên tổng số đơn); chiều cao cột và nhãn trên cột đều là % */
  const n=t=>(byType[t]||{}).n||0,all=types.reduce((t,x)=>t+n(x),0),exact=v=>all?v*100/all:0,share=v=>Math.round(exact(v)),ticks=[0,25,50,75,100];
  const pctOf=p=>p;
  return `<div class="bc" role="group" aria-label="Biểu đồ số đơn theo loại đơn">
    <div class="bc-y" aria-hidden="true">${ticks.map(v=>`<span style="bottom:${v}%">${v}%</span>`).join('')}</div>
    <div class="bc-scroll"><div class="bc-inner" style="--cols:${types.length}">
      <div class="bc-plot">
        ${ticks.map(v=>`<i class="bc-line" style="bottom:${pctOf(v)}%"></i>`).join('')}
        ${types.map(t=>{const v=n(t),on=ft&&ft.v===t,T=TYPES[t];return `<button type="button" class="bc-col${on?' on':''}${T.status!=="open"?' off':''}" data-ty="${esc(t)}" aria-pressed="${!!on}"
            aria-label="${esc(T.name)}: ${v} đơn, ${share(v)}%${T.status!=="open"?' ('+FORM_STATUS[T.status].t+')':''}. Bấm để lọc bảng" title="${esc(T.name)}: ${v} đơn (${share(v)}%) — bấm để lọc bảng">
            <span class="bc-bar" style="height:${exact(v)}%"><b>${share(v)}%<small>${v} đơn</small></b></span></button>`}).join('')}
      </div>
      <div class="bc-x" aria-hidden="true">${types.map(t=>`<span><em title="${esc(TYPES[t].name)}">${esc(TYPES[t].name)}${TYPES[t].status!=="open"?` · ${FORM_STATUS[TYPES[t].status].t}`:''}</em></span>`).join('')}</div>
    </div></div>
  </div>`;
}
function toggleStatFilter(k,v){
  const cur=statFilter(k);
  state.aFilters=state.aFilters.filter(r=>r.k!==k);
  if(!(cur&&cur.v===v))state.aFilters.push({k,op:"eq",v,from:"",to:""});
  state.aPage=1;renderAppsPage();
}
$('aStats').onclick=e=>{
  const s=e.target.closest('[data-st]'),t=e.target.closest('[data-ty]');
  if(s)toggleStatFilter("status",s.dataset.st);else if(t)toggleStatFilter("type",t.dataset.ty);
};
