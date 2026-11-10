import { useParams } from 'react-router';
import { ComingSoon } from '../../components/ComingSoon';

/**
 * Trang chi tiết một lá đơn (tạm, làm ở bước 5).
 * @returns  giao diện trang, tiêu đề là mã đơn trên đường dẫn
 */
export function FormDetailPage() {
  const { code = '' } = useParams();
  return <ComingSoon title={`Đơn ${code}`} step={5} />;
}
