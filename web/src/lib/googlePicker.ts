/* Google Picker: cửa sổ duyệt Drive của Google để Admin chọn thư mục cho nơi lưu sao lưu.
   Thư mục được chọn trong Picker (kèm appId của project) được cấp cho cổng, nên cổng lưu thẳng vào thư mục có sẵn mà vẫn chỉ có quyền drive.file.
   Script của Google chỉ tải khi bấm "Chọn thư mục" lần đầu. */

/** Phần của thư viện Picker mà cổng dùng (thư viện không có kiểu TypeScript đi kèm). */
interface PickerLibrary {
  DocsView: new (viewId: string) => PickerDocsView;
  PickerBuilder: new () => PickerBuilder;
  ViewId: { FOLDERS: string };
  Action: { PICKED: string; CANCEL: string };
}
interface PickerDocsView {
  setSelectFolderEnabled(enabled: boolean): PickerDocsView;
  setIncludeFolders(included: boolean): PickerDocsView;
  setMimeTypes(mimeTypes: string): PickerDocsView;
  setParent(parentId: string): PickerDocsView;
}
interface PickerBuilder {
  addView(view: PickerDocsView): PickerBuilder;
  setOAuthToken(accessToken: string): PickerBuilder;
  setDeveloperKey(apiKey: string): PickerBuilder;
  setAppId(appId: string): PickerBuilder;
  setLocale(locale: string): PickerBuilder;
  setTitle(title: string): PickerBuilder;
  setCallback(callback: (pickerEvent: { action: string; docs?: { id: string; name: string }[] }) => void): PickerBuilder;
  build(): { setVisible(visible: boolean): void };
}
declare global {
  interface Window {
    gapi?: { load(libraryName: string, options: { callback: () => void; onerror: () => void }): void };
    google?: { picker?: PickerLibrary };
  }
}

/** Script nạp thư viện của Google. */
const GOOGLE_API_SCRIPT_URL = 'https://apis.google.com/js/api.js';
const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';

/** Đang / đã nạp thư viện Picker (nạp một lần cho cả trang). */
let pickerLibrary: Promise<PickerLibrary> | null = null;

/**
 * Nạp thư viện Picker của Google.
 * @returns  thư viện Picker
 * @throws   lỗi khi không tải được script (mất mạng, bị chặn)
 */
function loadPickerLibrary(): Promise<PickerLibrary> {
  pickerLibrary ??= new Promise<PickerLibrary>((resolve, reject) => {
    // Script api.js có rồi thì nạp phần picker, chưa có thì chèn script trước
    const loadPicker = () =>
      window.gapi!.load('picker', {
        callback: () => (window.google?.picker ? resolve(window.google.picker) : reject(new Error('Không có Google Picker.'))),
        onerror: () => reject(new Error('Không tải được Google Picker.')),
      });
    if (window.gapi) return loadPicker();
    const script = document.createElement('script');
    script.src = GOOGLE_API_SCRIPT_URL;
    script.async = true;
    script.onload = loadPicker;
    script.onerror = () => reject(new Error('Không tải được Google Picker.'));
    document.head.append(script);
  }).catch((error: unknown) => {
    // Lỗi thì lần bấm sau thử nạp lại
    pickerLibrary = null;
    throw error;
  });
  return pickerLibrary;
}

/** Thư mục Drive Admin chọn. */
export interface PickedDriveFolder {
  id: string;
  name: string;
}

/**
 * Mở Picker chọn một thư mục trên Drive.
 * @param session  accessToken (quyền drive.file của tài khoản đã kết nối), apiKey, appId do máy chủ trả (POST /backups/google-drive/picker)
 * @returns        thư mục đã chọn; bấm Hủy thì null
 * @throws         lỗi khi không tải được Picker
 */
export async function pickDriveFolder(session: { accessToken: string; apiKey: string; appId: string }): Promise<PickedDriveFolder | null> {
  const picker = await loadPickerLibrary();
  return new Promise((resolve) => {
    // Chỉ hiện thư mục, bắt đầu ở My Drive, chọn được thư mục
    const folderView = new picker.DocsView(picker.ViewId.FOLDERS)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(true)
      .setMimeTypes(DRIVE_FOLDER_MIME)
      .setParent('root');
    new picker.PickerBuilder()
      .addView(folderView)
      .setOAuthToken(session.accessToken)
      .setDeveloperKey(session.apiKey)
      .setAppId(session.appId)
      .setLocale('vi')
      .setTitle('Chọn thư mục lưu bản sao lưu')
      .setCallback((pickerEvent) => {
        const pickedFolder = pickerEvent.docs?.[0];
        if (pickerEvent.action === picker.Action.PICKED && pickedFolder) resolve({ id: pickedFolder.id, name: pickedFolder.name });
        else if (pickerEvent.action === picker.Action.CANCEL) resolve(null);
      })
      .build()
      .setVisible(true);
  });
}
