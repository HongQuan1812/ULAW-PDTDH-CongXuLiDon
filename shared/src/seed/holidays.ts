/* Ngày nghỉ mẫu 2026–2027 (lễ, Tết, nghỉ bù), để thử hạn xử lí đơn. Chỉ API giả và seed dev dùng;
   bản thật để trống, Admin tự nhập theo thông báo nghỉ lễ hằng năm. Ngày nghỉ Tết, nghỉ bù là ngày dự kiến, chỉ để thử. */
import type { Holiday } from '../api-contract/holidays';

export const HOLIDAYS_SEED: readonly Holiday[] = [
  { id: 'holiday-2026-new-year', name: 'Tết Dương lịch', startDate: '2026-01-01', endDate: '2026-01-01' },
  { id: 'holiday-2026-tet', name: 'Tết Nguyên đán', startDate: '2026-02-14', endDate: '2026-02-22' },
  { id: 'holiday-2026-hung-kings', name: 'Nghỉ bù Giỗ Tổ Hùng Vương', startDate: '2026-04-27', endDate: '2026-04-27' },
  { id: 'holiday-2026-reunification', name: 'Ngày Giải phóng miền Nam, Quốc tế Lao động', startDate: '2026-04-30', endDate: '2026-05-01' },
  { id: 'holiday-2026-national-day', name: 'Quốc khánh', startDate: '2026-09-01', endDate: '2026-09-02' },
  { id: 'holiday-2027-new-year', name: 'Tết Dương lịch', startDate: '2027-01-01', endDate: '2027-01-01' },
  { id: 'holiday-2027-tet', name: 'Tết Nguyên đán', startDate: '2027-02-04', endDate: '2027-02-12' },
  { id: 'holiday-2027-hung-kings', name: 'Giỗ Tổ Hùng Vương', startDate: '2027-04-16', endDate: '2027-04-16' },
  { id: 'holiday-2027-reunification', name: 'Ngày Giải phóng miền Nam', startDate: '2027-04-30', endDate: '2027-04-30' },
  { id: 'holiday-2027-labour-day', name: 'Nghỉ bù Quốc tế Lao động', startDate: '2027-05-03', endDate: '2027-05-03' },
  { id: 'holiday-2027-national-day', name: 'Quốc khánh', startDate: '2027-09-02', endDate: '2027-09-03' },
];
