import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage } from 'firebase/storage';

// Configuração pública do app web (não é segredo; o acesso é controlado pelas regras do Firestore/Storage).
const app = initializeApp({
    apiKey: 'AIzaSyBvO7AhGjeFcpEZ0usym5s0Vlexo5Bm4Fo',
    authDomain: 'pokemonbravara.firebaseapp.com',
    projectId: 'pokemonbravara',
    storageBucket: 'pokemonbravara.firebasestorage.app',
    messagingSenderId: '914558463830',
    appId: '1:914558463830:web:badafa61d490d74698f0f7'
});

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

/** Só em desenvolvimento: `VITE_EMULATORS=1 npm run dev` usa os emuladores locais do Firebase. */
export const usingEmulators = import.meta.env.DEV && import.meta.env.VITE_EMULATORS === '1';
if (usingEmulators) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectStorageEmulator(storage, '127.0.0.1', 9199);
}
