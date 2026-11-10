/* Xem ảnh (.jpg, .jpeg, .png): hiện trực tiếp. */
import { useEffect, useState } from 'react';

/**
 * @param blob      nội dung ảnh
 * @param fileName  tên tệp, làm chữ thay thế cho ảnh
 * @returns         thẻ <img>
 */
export function ImageView({ blob, fileName }: { blob: Blob; fileName: string }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Tạo đường dẫn tạm cho ảnh, thu hồi khi đổi ảnh hoặc đóng
  useEffect(() => {
    const url = URL.createObjectURL(blob);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  return imageUrl ? <img src={imageUrl} alt={fileName} /> : null;
}
