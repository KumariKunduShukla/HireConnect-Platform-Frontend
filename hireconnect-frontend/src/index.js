import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Foolproof GitHub OAuth interceptor at the entry point
const params = new URLSearchParams(window.location.search);
if (params.has('code') && !window.location.pathname.includes('/login')) {
  window.location.href = `/login${window.location.search}`;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
