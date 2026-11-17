import { useState } from 'react';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth, usingEmulators } from '../firebase';
import { login } from '../lib/auth';
import { Icon } from '../ui/icons';

export default function Login() {
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    return (
        <main className="login">
            <div className="login-card">
                <div className="login-copy">
                    <span className="row" style={{ gap: 10, fontFamily: 'var(--display)', fontWeight: 800, fontSize: '1.2rem' }}>
                        <span className="brand-mark"><Icon name="brand" /></span>PokeBravara
                    </span>
                    <h1>Sua campanha <em>continua aqui.</em></h1>
                    <p className="muted">Ficha do treinador, time, Pokédex, mapa e batalhas da mesa — tudo num lugar só. O Mestre conduz, os dados decidem.</p>
                    <div className="stack">
                        <button className="btn primary" style={{ justifySelf: 'start', minHeight: 48, paddingInline: 22 }} disabled={busy}
                            onClick={async () => { setBusy(true); setError(await login()); setBusy(false); }}>
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.6 12.2c0-.7-.1-1.3-.2-1.9H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.4ZM12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5a6 6 0 0 1-9-3.2H3.1v2.6A10 10 0 0 0 12 22ZM6.4 13.9a6 6 0 0 1 0-3.8V7.5H3.1a10 10 0 0 0 0 9l3.3-2.6ZM12 6c1.5 0 2.8.5 3.8 1.5l2.8-2.8A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.9 5.5l3.3 2.6A6 6 0 0 1 12 6Z" /></svg>
                            {busy ? 'Conectando…' : 'Entrar com Google'}
                        </button>
                        {error && <p role="alert" style={{ color: 'var(--bad-ink)' }}>{error}</p>}
                        {usingEmulators && (
                            <div className="row">
                                {['mestre@teste.dev', 'ash@teste.dev', 'misty@teste.dev', 'novo@teste.dev'].map(email => (
                                    <button key={email} className="btn small" onClick={() => signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub: email.split('@')[0], email, email_verified: true, name: email.split('@')[0] })))}>Teste: {email.split('@')[0]}</button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <div className="login-art" aria-hidden="true"><img src="/assets/charizard.png" alt="" /></div>
            </div>
        </main>
    );
}
