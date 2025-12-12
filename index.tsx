import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './MainApp';
import { AuthProvider } from './context/AuthContext';
import './services/i18n';
import './index.css';
import { Toaster } from './components/ui/sonner';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AuthProvider>
      <App />
      <Toaster />
    </AuthProvider>
  </React.StrictMode>
);