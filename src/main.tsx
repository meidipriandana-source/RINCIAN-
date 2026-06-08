import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Intercept Google OAuth implicit redirection hash before React mounts
if (window.location.hash && (window.location.hash.includes("access_token") || window.location.hash.includes("token"))) {
  try {
    const params = new URLSearchParams(window.location.hash.substring(1));
    const token = params.get("access_token");
    if (token) {
      localStorage.setItem("gdrive_access_token", token);
      localStorage.setItem("gdrive_access_token_expires_at", (Date.now() + 3550 * 1000).toString());
      localStorage.setItem("apbd_2026_google_linked", "true");
      
      if (window.opener) {
        try {
          window.opener.postMessage({ type: "GOOGLE_OAUTH_TOKEN", token }, window.location.origin);
        } catch (postErr) {
          console.warn("Could not postMessage to opener:", postErr);
        }
      }
      
      // Delay slightly and close
      setTimeout(() => {
        window.close();
      }, 300);
    }
  } catch (e) {
    console.error("Error handling Google OAuth redirect hash:", e);
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

