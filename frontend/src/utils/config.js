// Single source for the backend URL. In production set VITE_BACKEND_URL to the
// Railway URL; locally it falls back to the dev server so nothing needs setup.
// (Vite only exposes vars prefixed with VITE_, read via import.meta.env.)
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'
