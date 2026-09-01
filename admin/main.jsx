import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { ClientCMS } from '../client/ClientCMS.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter basename="/admin">
        <ClientCMS />
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
);
