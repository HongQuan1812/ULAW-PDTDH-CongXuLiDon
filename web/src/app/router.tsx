import { createHashRouter } from 'react-router';
import { AccountsPage } from '../pages/accounts/AccountsPage';
import { FormTypesPage } from '../pages/form-types/FormTypesPage';
import { FormsPage } from '../pages/forms/FormsPage';
import { LoginPage } from '../pages/login/LoginPage';
import { ProfilePage } from '../pages/profile/ProfilePage';
import { AppLayout } from './AppLayout';
import { HomeRedirect, PageGuard } from './guards';
import { LOGIN_PATH, PAGE_PATH } from './paths';

/* Đường dẫn dạng #/... như bản mẫu.
   Trang Đăng nhập nằm ngoài khung; các trang còn lại nằm trong AppLayout (phải đăng nhập). */
export const router = createHashRouter([
  { path: LOGIN_PATH, element: <LoginPage /> },
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: PAGE_PATH.profile, element: <PageGuard page="profile"><ProfilePage /></PageGuard> },
      { path: PAGE_PATH.forms, element: <PageGuard page="forms"><FormsPage /></PageGuard> },
      {
        path: PAGE_PATH.formTypes,
        element: <PageGuard page="formTypes" permission="manageFormTypes"><FormTypesPage /></PageGuard>,
      },
      {
        path: PAGE_PATH.accounts,
        element: <PageGuard page="accounts" permission="manageAccounts"><AccountsPage /></PageGuard>,
      },
      { path: '*', element: <HomeRedirect /> },
    ],
  },
]);
