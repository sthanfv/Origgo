// Configuración web PÚBLICA de Firebase para el panel (Google Sign-In).
//
// Estas claves NO son secretas: solo identifican el proyecto en el navegador (Firebase las
// muestra públicamente por diseño). La seguridad real está en el servidor: se verifica el
// token de Google y se comprueba el correo contra la lista ADMIN_EMAILS (ver api/admin/*).
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyD_-DxEnPXBJYyJvHAsCY9cxyc3xvLkBnI',
  authDomain: 'hunter-pro-showcase.firebaseapp.com',
  projectId: 'hunter-pro-showcase',
  storageBucket: 'hunter-pro-showcase.firebasestorage.app',
  messagingSenderId: '851933155857',
  appId: '1:851933155857:web:44485e276743ac57f517b0',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
