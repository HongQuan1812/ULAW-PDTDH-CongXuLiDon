/* Thu gọn / mở rộng khung: bấm vào phần đầu khung (tiêu đề) để ẩn hoặc hiện phần nội dung bên dưới.
   Áp dụng cho mọi khung có phần đầu (.card > .sec-head), kể cả khung tạo bằng JS (các phần của đơn, ô xem nhanh).
   Bấm vào nút nằm trong phần đầu (Sửa thông tin, Nộp đơn mới…) thì chỉ làm việc của nút, không thu gọn.
   Mặc định khung mở; khung nào có sẵn class "collapsed" trong HTML thì mặc định thu gọn
   (trang thông tin: chỉ mục 1 "Thông tin cá nhân" mở, mục 2 và 3 thu gọn — xem PROFILE_DEFAULT_COLLAPSED). */
function initCollapsible(root=document){
  root.querySelectorAll('.card.fold>.sec-head:first-child').forEach(h=>{
    if(h.dataset.toggle)return;h.dataset.toggle="1";
    h.setAttribute('role','button');h.tabIndex=0;
    h.setAttribute('aria-expanded',String(!h.parentElement.classList.contains('collapsed')));
    const t=h.querySelector('h2');h.setAttribute('aria-label',(t?t.textContent:'Khung')+': bấm để thu gọn hoặc mở rộng');
  });
}
function setCollapsed(card,closed){
  if(!card)return;card.classList.toggle('collapsed',closed);
  const h=card.querySelector(':scope>.sec-head');if(h)h.setAttribute('aria-expanded',String(!closed));
}
/* các khung trên trang thông tin mặc định thu gọn; đặt lại mỗi lần đăng nhập */
const PROFILE_DEFAULT_COLLAPSED=[]; /* giao diện mới: các khung trên trang thông tin luôn mở */
function resetProfileCollapse(){PROFILE_DEFAULT_COLLAPSED.forEach(id=>setCollapsed(document.getElementById(id),true))}
function toggleCard(h){
  const card=h.parentElement,closed=card.classList.toggle('collapsed');
  h.setAttribute('aria-expanded',String(!closed));
}
document.addEventListener('click',e=>{
  const h=e.target.closest('.card.fold>.sec-head:first-child');if(!h)return;
  if(e.target.closest('button,a,input,select,label,.pop'))return; /* bấm vào nút trong phần đầu: không thu gọn */
  toggleCard(h);
});
document.addEventListener('keydown',e=>{
  const h=e.target.closest&&e.target.closest('.card.fold>.sec-head:first-child');
  if(!h||e.target!==h||(e.key!=='Enter'&&e.key!==' '))return;
  e.preventDefault();toggleCard(h);
});
initCollapsible();
