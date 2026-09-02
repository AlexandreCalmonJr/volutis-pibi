import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

import { ErrorBoundary } from './components/ErrorBoundary'

// Se um chunk JS falhar ao carregar após um novo deploy, recarrega a página automaticamente
window.addEventListener('vite:preloadError', (event) => {
  console.warn('Novo deploy detectado ou falha ao carregar chunk. Recarregando...', event);
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)


