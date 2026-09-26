// Configuración web PÚBLICA de Firebase para el panel (Google Sign-In).
//
// Estas claves NO son secretas: solo identifican el proyecto en el navegador (Firebase las
// muestra públicamente por diseño). La seguridad real está en el servidor: se verifica el
// token de Google y se comprueba el correo contra la lista ADMIN_EMAILS (ver api/admin/*).
import { initializeApp } from 'firebase/app';
import {
  browserSessionPersistence,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
} from 'firebase/auth';

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
// Inicio de sesión solo para esta pestaña: al cerrarla (o cerrar el navegador) hay que volver a
// entrar. Es lo estándar en paneles de administración; la vitrina pública no usa este módulo.
setPersistence(auth, browserSessionPersistence).catch(() => {});
export const googleProvider = new GoogleAuthProvider();
