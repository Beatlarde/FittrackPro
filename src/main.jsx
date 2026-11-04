import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import SectionBoundary from './components/shared/SectionBoundary.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SectionBoundary nombre="FitTrack Pro" pantallaCompleta>
      <App />
    </SectionBoundary>
  </StrictMode>,
)
