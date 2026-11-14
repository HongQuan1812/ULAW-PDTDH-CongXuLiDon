/* API giả của backend. Quy ước: tên có tiền tố "dev-" là bản giả, vd dev-login, dev-student-directory
   (TypeScript báo lỗi nếu tên trong DEMO_APIS thiếu "dev-"). Code của bản giả bọc trong JUST FOR DEMO.
   ENABLE_DEMO_APIS=true thì dùng bản giả, trừ các API trong ALWAYS_REAL_APIS; ENABLE_DEMO_APIS=false thì mọi API dùng bản thật
   (cả hai biến nằm trong api/.env, mỗi máy đặt riêng).
   Bản thật chưa được phát triển thì request gọi tới báo lỗi 501 (realApiNotBuilt); backend vẫn chạy bình thường. */
import { COMMON_MESSAGES } from '@ulaw/shared';
import { ApiException } from '../common/api-exception';

/** Mọi API giả. Thêm API giả mới thì thêm tên vào đây. */
export const DEMO_APIS = [
  /** đăng nhập thử theo vai trò · bản thật: đăng nhập Google */
  'dev-login',
  /** thông tin sinh viên đọc từ bảng StudentInfo do seed điền · bản thật: đọc database trường (chưa phát triển, chờ cách kết nối) */
  'dev-student-directory',
] as const satisfies readonly `dev-${string}`[];
export type DemoApi = (typeof DEMO_APIS)[number];

/**
 * Một API dùng bản giả hay bản thật.
 * @param demoApisEnabled  ENABLE_DEMO_APIS = "true"
 * @param api              tên API giả, vd 'dev-login'
 * @param alwaysRealApis   ALWAYS_REAL_APIS: các API luôn dùng bản thật, kể cả khi bật bản giả
 * @returns                true: dùng bản giả · false: dùng bản thật
 */
export function usesDemoApi(demoApisEnabled: boolean, api: DemoApi, alwaysRealApis: ReadonlySet<DemoApi>): boolean {
  return demoApisEnabled && !alwaysRealApis.has(api);
}

/**
 * Lỗi trả về khi phải dùng bản thật mà bản thật chưa được phát triển. Bản thật chưa làm thì chỉ cần `throw realApiNotBuilt('dev-…')`.
 * @param api  tên API giả, vd 'dev-student-directory'
 * @returns    lỗi 501 kèm câu "API thật thay cho … chưa được phát triển."
 */
export function realApiNotBuilt(api: DemoApi): ApiException {
  return new ApiException(501, COMMON_MESSAGES.realApiNotBuilt(api));
}
