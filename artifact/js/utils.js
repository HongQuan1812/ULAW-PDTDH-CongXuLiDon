/* Tiện ích dùng chung: chọn phần tử, định dạng ngày giờ, số điện thoại, thông báo nhanh (toast), chuyển màn hình. */
const $=id=>document.getElementById(id);
let toastT;
function toast(m){const t=$('toast');t.textContent=m;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,2600)}
function show(v){
  ['vLogin','vOnb','vProfile','vForm','vApps','vAccounts','vForms','vFormEdit','vEmail'].forEach(x=>$(x).hidden=x!==v);
  $('shell').hidden=v==='vLogin'||v==='vOnb'; /* khung ứng dụng (thanh bên + nội dung) chỉ hiện sau khi đăng nhập */
  document.body.dataset.view=v;
  if(typeof syncNav==='function')syncNav();
  window.scrollTo(0,0);
}
/* Chuyển trang trong bảng: vẽ lại bảng nhưng giữ thanh phân trang đứng yên trên màn hình
   (vẽ lại làm mất nút đang bấm, có trình duyệt nhảy lên đầu trang), và giữ focus ở nút tương ứng. */
function pageTo(pager,btn,draw){
  const id=typeof pager==='string'?pager:pager.id,top=$(id).getBoundingClientRect().top,key=btn.getAttribute('aria-label')||btn.dataset.p;
  draw();
  const pg=$(id);window.scrollBy(0,pg.getBoundingClientRect().top-top);
  const nb=[...pg.querySelectorAll('.pg')].find(x=>(x.getAttribute('aria-label')||x.dataset.p)===key&&!x.disabled)||pg.querySelector('.pg[aria-current]');
  if(nb)nb.focus({preventScroll:true});
}
const maskC=c=>c?c.slice(0,3)+"•••••"+c.slice(-4):"—";               /* "—" khi tài khoản chưa có CCCD */
const fmtP=p=>p?p.replace(/(\d{4})(\d{3})(\d{3})/,"$1 $2 $3"):"—";
const fmtD=d=>d.split('-').reverse().join('/');
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
/* thời gian */
const pad=n=>String(n).padStart(2,'0');
const nowIso=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`};
const fmtT=iso=>{const [d,t]=iso.split('T');return `${t} · ${fmtD(d)}`};
const addHours=(iso,h)=>{const d=new Date(new Date(iso).getTime()+h*36e5);return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`};
