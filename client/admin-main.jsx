import React from 'react';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import { ClientCMS } from './ClientCMS.jsx';
import './admin.css';

createRoot(document.getElementById('root')).render(
  <HelmetProvider>
    <ClientCMS />
  </HelmetProvider>
);
