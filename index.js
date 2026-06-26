import React from 'react';
import ReactDOM from 'react-dom/client';
import HabitRPG from './HabitRPG_Pro';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <HabitRPG />
  </React.StrictMode>
);

// 註冊 Service Worker（PWA 離線支援）
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch(() => {/* 靜默失敗，不影響主功能 */});
  });
}
