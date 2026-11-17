import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type Kind = 'info' | 'ok' | 'bad';
interface Toast { id: number; text: string; kind: Kind }

const Ctx = createContext<(text: string, kind?: Kind) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const push = useCallback((text: string, kind: Kind = 'info') => {
        const id = Date.now() + Math.random();
        setToasts(list => [...list.slice(-3), { id, text, kind }]);
        setTimeout(() => setToasts(list => list.filter(t => t.id !== id)), kind === 'bad' ? 7000 : 4200);
    }, []);
    return (
        <Ctx.Provider value={push}>
            {children}
            <div className="toasts" role="status" aria-live="polite">
                {toasts.map(t => (
                    <div key={t.id} className={'toast ' + t.kind} onClick={() => setToasts(list => list.filter(x => x.id !== t.id))}>{t.text}</div>
                ))}
            </div>
        </Ctx.Provider>
    );
}

export const useToast = () => useContext(Ctx);
