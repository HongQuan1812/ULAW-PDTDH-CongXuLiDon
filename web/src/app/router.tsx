import { RichTextDemoPage } from '../pages/dev/RichTextDemoPage';
import { createHashRouter } from 'react-router';
import { AccountsPage } from '../pages/accounts/AccountsPage';
import { EmailSettingsPage } from '../pages/email-settings/EmailSettingsPage';
import { FormDetailPage } from '../pages/form/FormDetailPage';
import { NewFormPage } from '../pages/form/NewFormPage';
import { FormTypeEditorPage } from '../pages/form-editor/FormTypeEditorPage';
import { FormTypesPage } from '../pages/form-types/FormTypesPage';
import { FormsPage } from '../pages/forms/FormsPage';
import { LoginPage } from '../pages/login/LoginPage';
import { OnboardingPage } from '../pages/onboarding/OnboardingPage';
import { PersonProfilePage } from '../pages/profile/PersonProfilePage';
import { ProfilePage } from '../pages/profile/ProfilePage';
import { AppLayout } from './AppLayout';
import { HomeRedirect, PageGuard } from './guards';
import {
  FORM_TYPE_EDITOR_ROUTE,
  LOGIN_PATH,
  NEW_FORM_FOR_APPLICANT_ROUTE,
  NEW_FORM_ROUTE,
  ONBOARDING_PATH,
  PAGE_PATH,
  PERSON_PROFILE_ROUTE,
} from './paths';

/* Đường dẫn dạng #/...
   Trang Đăng nhập và Bổ sung thông tin lần đầu nằm ngoài khung; các trang còn lại nằm trong AppLayout (phải đăng nhập). */
export const router = createHashRouter([
  { path: LOGIN_PATH, element: <LoginPage /> },
  { path: ONBOARDING_PATH, element: <OnboardingPage /> },
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: PAGE_PATH.profile, element: <PageGuard page="profile"><ProfilePage /></PageGuard> },
      // Xem hồ sơ người nộp đơn: cán bộ có quyền viewApplicant (máy chủ kiểm tra lại)
      { path: PERSON_PROFILE_ROUTE, element: <PageGuard page="forms" permission="viewApplicant"><PersonProfilePage /></PageGuard> },
      { path: NEW_FORM_ROUTE, element: <PageGuard page="profile" permission="submit"><NewFormPage /></PageGuard> },
      // Nộp đơn thay cho người khác: Admin có quyền submitForApplicant (máy chủ kiểm tra lại)
      {
        path: NEW_FORM_FOR_APPLICANT_ROUTE,
        element: <PageGuard page="forms" permission="submitForApplicant"><NewFormPage /></PageGuard>,
      },
      // Ai xem được đơn nào do máy chủ kiểm tra (người nộp, hoặc cán bộ có quyền xem mọi đơn)
      { path: '/don/:code', element: <FormDetailPage /> },
      { path: PAGE_PATH.forms, element: <PageGuard page="forms"><FormsPage /></PageGuard> },
      {
        path: PAGE_PATH.formTypes,
        element: <PageGuard page="formTypes" permission="manageFormTypes"><FormTypesPage /></PageGuard>,
      },
      {
        path: FORM_TYPE_EDITOR_ROUTE,
        element: <PageGuard page="formTypes" permission="manageFormTypes"><FormTypeEditorPage /></PageGuard>,
      },
      {
        path: PAGE_PATH.accounts,
        element: <PageGuard page="accounts" permission="manageAccounts"><AccountsPage /></PageGuard>,
      },
      {
        path: PAGE_PATH.emailSettings,
        element: <PageGuard page="emailSettings" permission="manageEmail"><EmailSettingsPage /></PageGuard>,
      },
      // Trang thử tạm của trình soạn văn bản (xóa khi đã gắn vào câu hỏi / mô tả phần)
      { path: '/thu-soan-van-ban', element: <RichTextDemoPage /> },
      { path: '*', element: <HomeRedirect /> },
    ],
  },
]);
