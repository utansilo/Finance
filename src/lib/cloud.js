import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  getRedirectResult, signOut, onAuthStateChanged,
} from 'firebase/auth';
import { getFirestore, doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
};

export const cloudEnabled = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
);

let app = null;
let auth = null;
let db = null;
let provider = null;

if (cloudEnabled) {
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  provider = new GoogleAuthProvider();
}

export { auth, db };
export { signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, doc, onSnapshot, setDoc, serverTimestamp };

export async function loginGoogle() {
  if (!cloudEnabled) throw new Error('Firebase belum dikonfigurasi (isi .env dulu)');
  // Coba popup dulu di semua perangkat (lebih tahan terhadap
  // error "missing initial state" yang sering muncul di redirect + Safari/iOS).
  // Redirect hanya sebagai fallback kalau popup diblokir.
  try {
    return await signInWithPopup(auth, provider);
  } catch (e) {
    if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/cancelled-popup-request') {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw e;
  }
}

export async function logoutGoogle() {
  if (!cloudEnabled) return;
  return signOut(auth);
}

// Satu dokumen per user: users/{uid} berisi semua state aplikasi
export function userDoc(uid) {
  return doc(db, 'users', uid);
}
