import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import LibraryPage from './LibraryPage.jsx'
import StudentPortal from './StudentPortal.jsx'

// Simple client-side router
const path = window.location.pathname;

let ComponentToRender = App;

if (path.startsWith('/lib/')) {
  ComponentToRender = LibraryPage;
} else if (path.startsWith('/student/')) {
  ComponentToRender = StudentPortal;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ComponentToRender />
  </React.StrictMode>
)
