import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register the service worker for installability + offline support (PWA).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const base = (import.meta as any).env?.BASE_URL || '/';
    navigator.serviceWorker.register(`${base}sw.js`).catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
