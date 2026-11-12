/**
 * Sao chép sâu dữ liệu mẫu (toàn JSON: chữ, số, mảng, đối tượng) để sửa bản sao không đổi bản gốc.
 * Không dùng structuredClone vì thư viện kiểu của shared chưa có (shared không chạy riêng trên trình duyệt hay Node).
 * @param seedValue  dữ liệu mẫu
 * @returns          bản sao sâu
 */
export function cloneSeedValue<T>(seedValue: T): T {
  return JSON.parse(JSON.stringify(seedValue)) as T;
}
