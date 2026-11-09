/* Trạng thái của ứng dụng trong trình duyệt. Khi có backend, user/profile/apps sẽ lấy từ API. */
const state={
  user:null, role:null, profile:null, showCccd:false,
  student:null, /* thông tin sinh viên của người đăng nhập (Lớp, Khóa, Hình thức đào tạo, Ngành), lấy từ database trường; null = không có */
  viewing:null, /* người nộp đơn đang được cán bộ xem trên trang hồ sơ; null = xem hồ sơ của chính mình */
  /* bảng Đơn đã nộp: tìm kiếm, sắp xếp, lọc */
  pQuery:"", pSort:[], pFilters:[],
  /* bảng Đơn phụ trách (mục 3, cán bộ) */
  mQuery:"", mSort:[], mFilters:[], mPage:1,
  apps:[], page:1,
  /* trang Đơn: đơn của các sinh viên khác (dữ liệu mẫu) và bộ lọc */
  others:[], /* tất cả tài khoản khác (sinh viên và cán bộ), mỗi tài khoản có role và apps; bản thật lấy từ API */
  aQuery:"", aPage:1, aReveal:false,
  aSort:[], /* [{k:"date", dir:"asc"|"desc"}] */
  aFilters:[], /* [{k:"status", op:"eq"|"range", v:"", from:"", to:""}] */
  /* trang Quản lí tài khoản (Admin) */
  uQuery:"", uSort:[], uFilters:[], uPage:1, uReveal:false,
  fmQuery:"", fmSort:[], fmFilters:[]
};
