import { onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut, type User } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { auth, db, googleProvider } from '../firebase';
import type { TrainerProfile } from '../model';
import { normalizeTrainer } from './normalize';

interface AuthState {
    user: User | null;
    profile: TrainerProfile | null;
    loading: boolean;
    error: string | null;
    isProfessor: boolean;
    listedProfessor: boolean;
}

const Ctx = createContext<AuthState>({ user: null, profile: null, loading: true, error: null, isProfessor: false, listedProfessor: false });

export function AuthProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<AuthState>({ user: null, profile: null, loading: true, error: null, isProfessor: false, listedProfessor: false });

    useEffect(() => {
        let stopProfile: (() => void) | null = null;
        const stopAuth = onAuthStateChanged(auth, async user => {
            stopProfile?.();
            stopProfile = null;
            if (!user) {
                setState({ user: null, profile: null, loading: false, error: null, isProfessor: false, listedProfessor: false });
                return;
            }
            let listedProfessor = false;
            try {
                const roles = await getDoc(doc(db, 'roles', 'professors'));
                listedProfessor = Boolean(user.email && roles.data()?.emails?.includes(user.email));
            } catch { /* sem acesso: segue como treinador */ }
            stopProfile = onSnapshot(doc(db, 'users', user.uid), snapshot => {
                const profile = snapshot.exists() ? normalizeTrainer(snapshot.id, snapshot.data()) : null;
                setState({ user, profile, loading: false, error: null, isProfessor: profile?.level === 'Professor', listedProfessor });
            }, () => setState(s => ({ ...s, user, loading: false, error: 'Não foi possível carregar seu perfil.' })));
        });
        return () => { stopProfile?.(); stopAuth(); };
    }, []);

    useEffect(() => {
        document.documentElement.dataset.campaign = (state.profile?.campaign ?? '').toLowerCase();
    }, [state.profile?.campaign]);

    return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

export async function login(): Promise<string | null> {
    try {
        await signInWithPopup(auth, googleProvider);
        return null;
    } catch (error) {
        const code = (error as { code?: string }).code;
        if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
            await signInWithRedirect(auth, googleProvider);
            return null;
        }
        if (code === 'auth/popup-closed-by-user') return 'A janela do Google foi fechada. Tente de novo.';
        return 'Não foi possível entrar com o Google. Tente novamente.';
    }
}

export async function logout() {
    await signOut(auth);
    window.history.replaceState(null, '', '/');
}
