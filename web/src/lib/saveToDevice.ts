/**
 * Lưu một file về máy (như bấm link tải về).
 * @param content   nội dung file
 * @param fileName  tên file
 */
export function saveToDevice(content: Blob, fileName: string): void {
  const url = URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  // Đợi trình duyệt bắt đầu tải rồi mới bỏ đường dẫn tạm
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
