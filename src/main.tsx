import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Explicitly register Service Worker for PWABuilder & offline support
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/sw.js')
    .then((registration) => {
      console.log('BikeReady Service Worker active with scope:', registration.scope);
    })
    .catch((error) => {
      console.error('Service Worker registration failed:', error);
    });
}

createRoot(document.getElementById('root')!).render(<App />);
