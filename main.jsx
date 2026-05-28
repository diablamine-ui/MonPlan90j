import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Hide loader when React mounts
const hideLoader = () => {
  const loader = document.getElementById('loader')
  if (loader) {
    loader.style.opacity = '0'
    loader.style.transition = 'opacity 0.4s ease'
    setTimeout(() => loader.remove(), 400)
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(<App />)
setTimeout(hideLoader, 100)
