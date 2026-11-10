import { useParams } from 'react-router';
import { ComingSoon } from '../../components/ComingSoon';

/**
 * Trang nộp đơn mới của một loại đơn (tạm, làm ở bước 4).
 * @returns  giao diện trang, ghi mã loại đơn trên đường dẫn
 */
export function NewFormPage() {
  const { formTypeId = '' } = useParams();
  return <ComingSoon title={`Nộp đơn mới (${formTypeId})`} step={4} />;
}
