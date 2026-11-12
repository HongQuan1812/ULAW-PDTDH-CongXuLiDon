/* Tài khoản mẫu: dùng chung cho API giả (web) và seed database (api). */
import type { RoleId } from '../aux-schema';

/** Một tài khoản trong API giả: email (không đổi được), vai trò, họ tên, SĐT, CCCD (null = chưa có),
    đã bổ sung thông tin lần đầu hay chưa, và MSSV chính người dùng đã chọn (null = chưa chọn, dùng MSSV đầu). */
export interface SeedAccount {
  email: string;
  role: RoleId;
  name: string;
  phone: string | null;
  cccd: string | null;
  completed: boolean;
  mainStudentId: string | null;
}

/** Ghi tắt một tài khoản mẫu: người dùng sẵn có, đã bổ sung thông tin, chưa có SĐT, CCCD. */
export const seedAccount = (name: string, email: string, role: RoleId): SeedAccount => ({
  email,
  role,
  name,
  phone: null,
  cccd: null,
  completed: true,
  mainStudentId: null,
});

/* Tài khoản ban đầu, khóa theo id. Họ tên, email, số liệu tổng hợp, không phải người thật.
   - sv-1, cb-1, cb-3: tài khoản đăng nhập thử của 3 vai trò (DEMO_USER_IDS). sv-1 chưa bổ sung thông tin (để thấy màn Bổ sung thông tin
     lần đầu); cb-1, cb-3 có sẵn CCCD (để thử báo trùng CCCD).
   - cb-2: cán bộ thứ ba (SEED_STAFF_IDS). sv-2 … sv-11: 10 sinh viên khác (seedOtherStudentForms). */
export const SEED_ACCOUNTS: Record<string, SeedAccount> = {
  'sv-1': { ...seedAccount('Nguyễn Minh Anh', 'minhanh.nguyen@hcmulaw.edu.vn', 'nguoiNopDon'), completed: false },
  'cb-1': { ...seedAccount('Phạm Thu Hà', 'thuha.pham.pdt@hcmulaw.edu.vn', 'nguoiXuLiDon'), phone: '0912345678', cccd: '079188001122' },
  'cb-2': seedAccount('Trần Quốc Việt', 'quocviet.tran.pdt@hcmulaw.edu.vn', 'nguoiXuLiDon'),
  'cb-3': { ...seedAccount('Lê Ngọc Diệp', 'ngocdiep.le.pdt@hcmulaw.edu.vn', 'admin'), phone: '0987654321', cccd: '079190003344' },
  ...Object.fromEntries(
    [
      ['Trần Thị Bảo Ngọc', 'baongoc.tran@hcmulaw.edu.vn'],
      ['Lê Hoàng Phúc', 'phuc.lehoang@hcmulaw.edu.vn'],
      ['Phạm Gia Hân', 'giahan.pham06@hcmulaw.edu.vn'],
      ['Võ Minh Khang', 'khangvo.law@hcmulaw.edu.vn'],
      ['Đặng Thùy Linh', 'thuylinh.dang@hcmulaw.edu.vn'],
      ['Huỳnh Quốc Bảo', 'quocbao.huynh@hcmulaw.edu.vn'],
      ['Ngô Phương Thảo', 'thao.ngophuong@hcmulaw.edu.vn'],
      ['Bùi Đức Anh', 'ducanh.bui.k51@hcmulaw.edu.vn'],
      ['Trương Ngọc Mai', 'ngocmai.truong@hcmulaw.edu.vn'],
      ['Đỗ Thành Nam', 'thanhnam.do@hcmulaw.edu.vn'],
    ].map(([name, email], i) => [`sv-${i + 2}`, seedAccount(name!, email!, 'nguoiNopDon')]),
  ),
};

/* JUST FOR DEMO: START · Tài khoản đăng nhập thử của mỗi vai trò (ô đổi vai trò ở giao diện). Bản thật: đăng nhập Google. */
export const DEMO_USER_IDS: Record<RoleId, string> = { nguoiNopDon: 'sv-1', nguoiXuLiDon: 'cb-1', admin: 'cb-3' };
/* JUST FOR DEMO: END */
