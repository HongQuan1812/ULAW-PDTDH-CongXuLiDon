import { createHashRouter } from 'react-router';
import { StartPage } from './StartPage';

/* Đường dẫn dạng #/... như bản mẫu. Các trang thật thêm dần ở đây. */
export const router = createHashRouter([
  { path: '/', element: <StartPage /> },
]);
