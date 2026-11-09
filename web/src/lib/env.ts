/* Cờ đọc từ file .env. Khi build, Vite thay sẵn giá trị nên phần bị tắt không có trong bản build. */

/** true khi VITE_APP_ENV = "dev": hiện các phần JUST FOR DEMO. */
export const SHOW_DEMO = import.meta.env.VITE_APP_ENV === 'dev';
