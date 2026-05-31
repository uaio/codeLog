import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initCodeLog } from './codelog';

// Initialize SDK at app startup regardless of current route
initCodeLog();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
