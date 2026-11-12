/* Cấu hình email (Admin): cấu hình phía GỬI — người gửi, bật / tắt email báo khi đơn đổi trạng thái, soạn tiêu đề + nội dung có mã {...},
   Người nhận không cấu hình: thư luôn gửi thẳng tới email của người nộp đơn (email trên trang Thông tin cá nhân).
  
   xem trước bằng dữ liệu mẫu. Cấu hình sửa trên bản nháp (emDraft); bấm "Lưu" mới ghi vào emSaved. */
/* JUST FOR DEMO: START · cấu hình chỉ nằm trong bộ nhớ, "Gửi email thử" chỉ giả lập; bản thật: đọc / ghi qua API và máy chủ gửi thư */
const EMAIL_SAMPLE={
  ho_ten:"Nguyễn Văn An",ma_don:"XMM-2026-001-00001",loai_don:"Xét miễn môn",ngay_nop:"30/10/2026",
  nguoi_xu_li:"Phạm Thu Hà",ly_do:"Thiếu bảng điểm bản chính, vui lòng tải lại tệp rõ hơn.",
  link_don:"https://dichvu.hcmulaw.edu.vn/#don-XMM-2026-001-00001",chu_ki:"Phòng Đào tạo Đại học, Trường Đại học Luật TP.HCM"
};
/* email người nộp đơn mẫu, chỉ dùng cho khung xem trước */
const EMAIL_SAMPLE_TO="vanan.nguyen@hcmulaw.edu.vn";
const EMAIL_TAG_LABEL={ho_ten:"Họ và tên người nộp",ma_don:"Mã đơn",loai_don:"Tên loại đơn",ngay_nop:"Ngày nộp",nguoi_xu_li:"Người xử lí đơn",ly_do:"Lí do (ghi chú của người xử lí)",link_don:"Đường dẫn tới đơn",chu_ki:"Chữ kí cuối thư"};
/* bốn lúc gửi email, mã trạng thái như STATUS: nop · bs · tc · duyet */
const EMAIL_DEFAULT=()=>({
  sender:{name:"Phòng Đào tạo Đại học - ULAW",mail:"daotao@hcmulaw.edu.vn",signature:"Phòng Đào tạo Đại học, Trường Đại học Luật TP.HCM"},
  events:[
    {key:"nop",label:"Đã nộp",on:true,
      subject:"[{ma_don}] Đã nhận đơn {loai_don} của bạn",
      body:"Chào {ho_ten},\n\nPhòng Đào tạo đã nhận đơn {loai_don} bạn nộp ngày {ngay_nop}. Mã đơn của bạn là {ma_don}.\n\nChúng tôi sẽ tiếp nhận và xử lí trong thời gian sớm nhất. Bạn xem tiến độ xử lí tại:\n{link_don}\n\nTrân trọng,\n{chu_ki}"},
    {key:"bs",label:"Cần bổ sung",on:true,
      subject:"[{ma_don}] Đơn của bạn cần bổ sung",
      body:"Chào {ho_ten},\n\nĐơn {loai_don} mã {ma_don} cần bổ sung thông tin:\n\n{ly_do}\n\nBạn vào đơn để sửa và nộp lại:\n{link_don}\n\nTrân trọng,\n{nguoi_xu_li}\n{chu_ki}"},
    {key:"tc",label:"Từ chối",on:true,
      subject:"[{ma_don}] Đơn của bạn không được duyệt",
      body:"Chào {ho_ten},\n\nRất tiếc, đơn {loai_don} mã {ma_don} không được duyệt.\n\nLí do: {ly_do}\n\nBạn xem chi tiết tại:\n{link_don}\n\nTrân trọng,\n{nguoi_xu_li}\n{chu_ki}"},
    {key:"duyet",label:"Đã duyệt",on:true,
      subject:"[{ma_don}] Đơn của bạn đã được duyệt",
      body:"Chào {ho_ten},\n\nĐơn {loai_don} mã {ma_don} đã được duyệt.\n\nBạn xem kết quả và tải file tại:\n{link_don}\n\nTrân trọng,\n{nguoi_xu_li}\n{chu_ki}"}
  ]
});
let emSaved=EMAIL_DEFAULT(),emDraft=EMAIL_DEFAULT(),emKey="nop",emReady=false;
/* JUST FOR DEMO: END */
const emCurrent=()=>emDraft.events.find(e=>e.key===emKey);
const emDirty=()=>JSON.stringify(emDraft)!==JSON.stringify(emSaved);
const EM_SENDER_FIELDS={emSenderName:"name",emSenderMail:"mail",emSignature:"signature"};

/* thay mã bằng dữ liệu mẫu; mark: tô nền phần đã thay, mã lạ để nguyên và tô đỏ */
function emFill(text,mark){
  const sample={...EMAIL_SAMPLE,chu_ki:emDraft.sender.signature};
  return esc(text).replace(/\{([a-z_]+)\}/g,(whole,tag)=>{
    if(!(tag in sample))return mark?`<mark class="em-bad">${whole}</mark>`:whole;
    return mark?`<mark>${esc(sample[tag])}</mark>`:esc(sample[tag]);
  });
}
/* tab ngang: bốn lúc gửi email; chấm màu theo trạng thái, lúc nào đang tắt thì ghi "Tắt" */
function emRenderEvents(){
  $('emEvents').innerHTML=emDraft.events.map(ev=>`<button type="button" class="em-tab${ev.on?"":" off"}" role="tab" data-key="${ev.key}" aria-selected="${ev.key===emKey}" tabindex="${ev.key===emKey?0:-1}">
      <span class="em-dot s-${ev.key}" aria-hidden="true"></span>${ev.label}${ev.on?"":'<span class="em-off">Tắt</span>'}</button>`).join("");
}
/* cột phải: chỉ vẽ lại khi đổi lúc gửi, để không mất con trỏ khi đang gõ */
function emRenderEditor(){
  const ev=emCurrent();
  const chips=Object.keys(EMAIL_SAMPLE).map(t=>`<button type="button" class="em-chip" data-tag="${t}" title="${EMAIL_TAG_LABEL[t]}">{${t}}</button>`).join("");
  $('emEditor').innerHTML=`
    <div class="em-sec">
      <div class="em-cap-row"><p class="em-cap">Soạn thư</p>
        <div class="em-send"><span class="em-sub">${ev.on?"Gửi tới email người nộp đơn":"Đang tắt, không gửi email"}</span>
          <label class="switch"><span>Gửi email</span><input type="checkbox" id="emOn" ${ev.on?"checked":""}></label></div></div>
      <div class="em-fields em-dim">
        <label class="f">Tiêu đề thư<input id="emSubject" value="${esc(ev.subject)}" autocomplete="off"></label>
        <div class="f"><span>Mã chèn vào thư <small>Bấm để chèn vào chỗ đang gõ</small></span><div class="em-chips">${chips}</div></div>
        <label class="f">Nội dung thư<textarea id="emText" rows="11">${esc(ev.body)}</textarea></label></div></div>
      <div class="em-sec em-dim"><p class="em-cap">Xem trước <span>· dữ liệu mẫu, phần đã thay được tô nền</span></p>
        <div class="em-mail" id="emMail"></div>
        <div class="em-test"><label class="f">Gửi thử tới<input id="emTestTo" type="email" value="quan@hcmulaw.edu.vn" autocomplete="off"></label>
          <button type="button" class="btn" id="emTest">Gửi email thử</button></div>
        <p class="hint">Email thử có chữ [Thử] ở đầu tiêu đề và dùng dữ liệu mẫu ở trên.</p></div>`;
  emRenderPreview();emSyncOff();
}
function emRenderPreview(){
  const ev=emCurrent(),s=emDraft.sender;
  $('emMail').innerHTML=`<dl class="em-mail-head">
      <dt>Từ</dt><dd>${esc(s.name)} &lt;${esc(s.mail)}&gt;</dd><dt>Tới</dt><dd>${esc(EMAIL_SAMPLE.ho_ten)} &lt;${esc(EMAIL_SAMPLE_TO)}&gt; <span class="em-to-note">· email trên trang Thông tin cá nhân</span></dd><dt>Tiêu đề</dt><dd class="em-subj">${emFill(ev.subject,false)}</dd></dl>
    <div class="em-mail-body">${emFill(ev.body,true)}</div>`;
}
/* lúc gửi đang tắt: làm mờ và khóa phần soạn và xem trước (công tắc "Gửi email" vẫn bấm được) */
function emSyncOff(){const off=!emCurrent().on;$('emEditor').querySelectorAll('.em-dim').forEach(b=>{b.style.opacity=off?.5:1;b.inert=off})}
function emSyncDirty(){const d=emDirty();$('emDirty').hidden=!d;$('emSave').disabled=!d;$('emReset').disabled=!d}
function emFillSender(){for(const[id,k]of Object.entries(EM_SENDER_FIELDS))$(id).value=emDraft.sender[k]}
function renderEmailPage(){
  if(!emReady){emReady=true;emBind()}
  emFillSender();emRenderEvents();emRenderEditor();emSyncDirty();
}
function emBind(){
  /* tab: chọn lúc gửi; phím ← → chuyển tab */
  const pick=key=>{emKey=key;emRenderEvents();emRenderEditor();const t=$('emEvents').querySelector(`[data-key="${key}"]`);if(t){t.focus({preventScroll:true});t.scrollIntoView({block:'nearest',inline:'nearest'})}};
  $('emEvents').addEventListener('click',e=>{const t=e.target.closest('.em-tab');if(t&&t.dataset.key!==emKey)pick(t.dataset.key)});
  $('emEvents').addEventListener('keydown',e=>{
    if(e.key!=="ArrowRight"&&e.key!=="ArrowLeft")return;
    const ks=emDraft.events.map(x=>x.key),i=ks.indexOf(emKey);e.preventDefault();
    pick(ks[(i+(e.key==="ArrowRight"?1:ks.length-1))%ks.length]);
  });
  /* cột phải: gõ tiêu đề / nội dung, đổi người nhận, chèn mã, gửi thử */
  $('emEditor').addEventListener('input',e=>{
    const ev=emCurrent();
    if(e.target.id==="emSubject")ev.subject=e.target.value;else if(e.target.id==="emText")ev.body=e.target.value;else return;
    emRenderPreview();emSyncDirty();
  });
  $('emEditor').addEventListener('change',e=>{
    if(e.target.id!=="emOn")return;
    emCurrent().on=e.target.checked;
    emRenderEvents();emRenderPreview();emSyncOff();emSyncDirty();
    $('emEditor').querySelector('.em-sub').textContent=e.target.checked?"Gửi tới email người nộp đơn":"Đang tắt, không gửi email";
  });
  $('emEditor').addEventListener('mousedown',e=>{if(e.target.closest('.em-chip'))e.preventDefault()});
  $('emEditor').addEventListener('click',e=>{
    const chip=e.target.closest('.em-chip');
    if(chip){
      const f=document.activeElement&&document.activeElement.id==="emSubject"?$('emSubject'):$('emText');
      const t=`{${chip.dataset.tag}}`,a=f.selectionStart==null?f.value.length:f.selectionStart,b=f.selectionEnd==null?a:f.selectionEnd;
      f.value=f.value.slice(0,a)+t+f.value.slice(b);f.focus();f.setSelectionRange(a+t.length,a+t.length);
      f.dispatchEvent(new Event('input',{bubbles:true}));return;
    }
    if(e.target.id==="emTest"){
      const to=$('emTestTo').value.trim();
      if(!/^\S+@\S+\.\S+$/.test(to)){toast("Địa chỉ nhận thử chưa đúng");return}
      toast(`Đã gửi email thử tới ${to} (giả lập)`);
    }
  });
  /* phần Người gửi */
  for(const[id,k]of Object.entries(EM_SENDER_FIELDS))$(id).addEventListener('input',e=>{emDraft.sender[k]=e.target.value;emRenderPreview();emSyncDirty()});
  $('emSave').onclick=()=>{emSaved=JSON.parse(JSON.stringify(emDraft));emSyncDirty();toast("Đã lưu cấu hình email")};
  $('emReset').onclick=()=>{emDraft=JSON.parse(JSON.stringify(emSaved));emFillSender();emRenderEvents();emRenderEditor();emSyncDirty()};
}
