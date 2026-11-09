/* Xem lại tệp đã tải lên: ảnh hiển thị trực tiếp, PDF dựng bằng pdf.js (tải khi cần). */
/* Xem lại tệp đã tải lên: ảnh hiển thị trực tiếp, PDF dựng bằng pdf.js */
let pvUrl=null,pdfLib=null,dlUrl=null;
function loadScript(src){return new Promise((ok,bad)=>{const t=document.createElement('script');t.src=src;t.onload=ok;t.onerror=bad;document.head.appendChild(t)})}
async function getPdf(){
  if(pdfLib)return pdfLib;
  const base='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  await loadScript(base+'pdf.worker.min.js'); /* chạy worker ngay trên trang */
  await loadScript(base+'pdf.min.js');
  pdfLib=window.pdfjsLib;return pdfLib;
}
function closePv(){$('pv').hidden=true;$('pvBody').innerHTML='';if(pvUrl){URL.revokeObjectURL(pvUrl);pvUrl=null}if(dlUrl){URL.revokeObjectURL(dlUrl);dlUrl=null}$('pvDl').hidden=true;document.body.style.overflow=''}
$('pvClose').onclick=closePv;
$('pv').onclick=e=>{if(e.target.id==='pv')closePv()};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('pv').hidden)closePv()});
/* opts.download: hiện nút "Tải file Word" trên thanh xem (dùng khi xem trước file xuất từ mẫu) */
async function preview(f,opts={}){
  const body=$('pvBody');body.innerHTML='';$('pvName').textContent=f.name;$('pvMeta').textContent=opts.meta||(f.size!=null?fmt(f.size):'');
  const dl=$('pvDl');if(dlUrl){URL.revokeObjectURL(dlUrl);dlUrl=null}dl.hidden=!opts.download;
  if(opts.download){dlUrl=URL.createObjectURL(f);dl.href=dlUrl;dl.download=opts.fileName||f.name;dl.textContent=opts.download===true?"Tải về":opts.download}
  $('pv').hidden=false;document.body.style.overflow='hidden';$('pvClose').focus();
  /* JUST FOR DEMO: START · tệp trong dữ liệu mẫu chỉ có tên. Bản thật: tải nội dung tệp từ máy chủ (theo id/URL) rồi hiển thị như tệp vừa chọn. */
  if(!(f instanceof Blob)){
    body.innerHTML='<div class="pv-empty"><strong>Đây là tệp trong dữ liệu mẫu</strong><span>Tệp mẫu không có nội dung thật nên không xem được. Với tệp bạn tự tải lên, nội dung sẽ hiển thị ở đây.</span></div>';return;
  }
  /* JUST FOR DEMO: END */

  const isImg=/^image\//.test(f.type)||/\.(jpe?g|png)$/i.test(f.name);
  if(isImg){pvUrl=URL.createObjectURL(f);const img=new Image();img.alt=f.name;img.src=pvUrl;body.appendChild(img);return}
  if(/\.xlsx?$/i.test(f.name)){previewExcel(f,body);return}
  if(/\.docx$/i.test(f.name)){previewDocx(f,body);return}
  if(!/\.pdf$/i.test(f.name)){ /* Word và các loại khác: chưa xem trước được, cho tải về */
    pvUrl=URL.createObjectURL(f);
    body.innerHTML=`<div class="pv-empty"><strong>Chưa xem trước được loại tệp này</strong><span>Tải tệp về máy để mở.</span><a class="btn" download="${esc(f.name)}" href="${pvUrl}">Tải tệp về</a></div>`;return;
  }
  body.innerHTML='<div class="pv-empty">Đang mở tệp PDF…</div>';
  try{
    const lib=await getPdf();
    const doc=await lib.getDocument({data:new Uint8Array(await f.arrayBuffer())}).promise;
    if($('pv').hidden)return;
    body.innerHTML='';const n=Math.min(doc.numPages,30);
    $('pvMeta').textContent=`${fmt(f.size)} · ${doc.numPages} trang`;
    const w=Math.min(body.clientWidth-32,900),dpr=window.devicePixelRatio||1;
    for(let i=1;i<=n;i++){
      const pg=await doc.getPage(i),v0=pg.getViewport({scale:1}),sc=w/v0.width,vp=pg.getViewport({scale:sc*dpr});
      const c=document.createElement('canvas');c.width=vp.width;c.height=vp.height;c.style.width=`${vp.width/dpr}px`;c.setAttribute('aria-label',`Trang ${i}`);
      body.appendChild(c);await pg.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;
      if($('pv').hidden)return;
    }
    if(doc.numPages>n)body.insertAdjacentHTML('beforeend',`<div class="pv-empty">Đang hiển thị ${n} trang đầu trong ${doc.numPages} trang.</div>`);
  }catch(err){
    body.innerHTML='<div class="pv-empty"><strong>Không mở được tệp PDF này</strong><span>Tệp có thể bị hỏng hoặc có mật khẩu. Hãy kiểm tra lại tệp trên máy rồi tải lên lại.</span></div>';
  }
}

/* Xem trước Excel (.xls, .xlsx): đọc bằng SheetJS (tải khi cần), mỗi trang tính một tab, hiện tối đa 300 dòng đầu */
let xlsxLib=null;
async function getXlsx(){if(!xlsxLib){await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');xlsxLib=window.XLSX}return xlsxLib}
async function previewExcel(f,body){
  body.innerHTML='<div class="pv-empty">Đang mở tệp Excel…</div>';
  try{
    const X=await getXlsx(),wb=X.read(new Uint8Array(await f.arrayBuffer()),{type:'array'});
    if($('pv').hidden)return;
    const names=wb.SheetNames,MAXR=300;
    $('pvMeta').textContent=`${fmt(f.size)} · ${names.length} trang tính`;
    body.innerHTML=`<div class="xl">${names.length>1?`<div class="tabs xl-tabs" role="tablist">${names.map((n,i)=>`<button type="button" role="tab" class="tab" data-i="${i}" aria-selected="${i===0}">${esc(n)}</button>`).join('')}</div>`:''}<div class="xl-sheet"></div></div>`;
    const show=i=>{
      const ws=wb.Sheets[names[i]],rows=X.utils.sheet_to_json(ws,{header:1,blankrows:false,defval:""});
      const cut=rows.slice(0,MAXR),w=Math.max(0,...cut.map(r=>r.length));
      body.querySelector('.xl-sheet').innerHTML=!cut.length?'<div class="pv-empty">Trang tính trống.</div>':
        `<div class="tbl-wrap"><table class="xl-tbl">${cut.map((r,ri)=>`<tr>${Array.from({length:w},(_,k)=>`<${ri?'td':'th'}>${esc(r[k]??"")}</${ri?'td':'th'}>`).join('')}</tr>`).join('')}</table></div>`+
        (rows.length>MAXR?`<div class="pv-empty">Đang hiện ${MAXR} dòng đầu trong ${rows.length} dòng.</div>`:'');
      body.querySelectorAll('.xl-tabs .tab').forEach(t=>t.setAttribute('aria-selected',String(+t.dataset.i===i)));
    };
    body.querySelectorAll('.xl-tabs .tab').forEach(t=>t.onclick=()=>show(+t.dataset.i));
    show(0);
  }catch(err){
    body.innerHTML='<div class="pv-empty"><strong>Không mở được tệp Excel này</strong><span>Tệp có thể bị hỏng hoặc có mật khẩu. Hãy kiểm tra lại tệp trên máy rồi tải lên lại.</span></div>';
  }
}

/* Word (.docx): dựng trang bằng docx-preview (+ JSZip), tải khi cần. File .doc cũ không xem được.
   Bản xem là gần đúng: font thay thế nếu máy không có, ngắt trang chỉ theo ngắt trang đặt sẵn trong file. */
async function getDocxPreview(){
  if(!window.JSZip)await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
  if(!(window.docx&&window.docx.renderAsync))await loadScript('https://cdn.jsdelivr.net/npm/docx-preview@0.3.7/dist/docx-preview.min.js');
  return window.docx;
}
async function previewDocx(f,body){
  body.innerHTML='<div class="pv-empty">Đang mở file Word…</div>';
  try{
    const lib=await getDocxPreview(),box=document.createElement('div');box.className='docx-pv';
    await lib.renderAsync(await f.arrayBuffer(),box,null,{inWrapper:true,breakPages:true,experimental:true,renderHeaders:true,renderFooters:true,useBase64URL:true});
    if($('pv').hidden)return;
    body.innerHTML='';body.appendChild(box);fitDocx();
  }catch(e){
    if(!pvUrl)pvUrl=URL.createObjectURL(f);
    body.innerHTML=`<div class="pv-empty"><strong>Không xem trước được file này</strong><span>Tải file về máy để mở bằng Word.</span><a class="btn" download="${esc(f.name)}" href="${pvUrl}">Tải tệp về</a></div>`;
  }
}
/* màn hình hẹp: thu nhỏ trang Word cho vừa khung xem */
function fitDocx(){
  const box=document.querySelector('#pvBody .docx-pv'),pg=box&&box.querySelector('section.docx');if(!pg)return;
  box.style.zoom=1;const z=Math.min(1,(box.clientWidth-4)/pg.offsetWidth);box.style.zoom=z;
}
window.addEventListener('resize',()=>{if(!$('pv').hidden)fitDocx()});
