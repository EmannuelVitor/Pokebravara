// Primeiro acesso: cria o perfil do Professor (e-mail autorizado) ou a ficha do treinador.
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useState } from 'react';
import { db, storage } from '../firebase';
import { logout, useAuth } from '../lib/auth';
import { RULES } from '../rules/config';
import { emptyAttributes, validateSheet } from '../rules/trainer';
import { Icon } from '../ui/icons';
import SheetForm, { type SheetValue } from './SheetForm';

export default function Onboarding() {
    const { user, listedProfessor } = useAuth();
    const [step, setStep] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [info, setInfo] = useState({ realName: user?.displayName ?? '', trainerName: '', gender: '', age: '', height: '', description: '' });
    const [photo, setPhoto] = useState<File | null>(null);
    const [sheet, setSheet] = useState<SheetValue>({ trainerClass: '', attributes: emptyAttributes(), skills: [] });

    if (!user) return null;

    async function createProfessor() {
        setBusy(true);
        try {
            await setDoc(doc(db, 'users', user!.uid), { level: 'Professor', professorName: user!.displayName || 'Professor', email: user!.email, imageUrl: user!.photoURL || '', createdAt: serverTimestamp() });
        } catch {
            setError('Não foi possível criar o perfil de Professor.');
            setBusy(false);
        }
    }

    async function createTrainer() {
        const problem = validateSheet(sheet.trainerClass, sheet.attributes, sheet.skills);
        if (problem) { setError(problem); return; }
        if (photo && (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(photo.type) || photo.size > 5 * 1024 * 1024)) {
            setError('A foto precisa ser PNG, JPEG, GIF ou WebP de até 5 MB.');
            return;
        }
        setBusy(true);
        setError(null);
        try {
            let imageUrl = '';
            if (photo) {
                const upload = await uploadBytes(ref(storage, `profile_images/${user!.uid}/avatar-${Date.now()}`), photo, { contentType: photo.type });
                imageUrl = await getDownloadURL(upload.ref);
            }
            await setDoc(doc(db, 'users', user!.uid), {
                level: 'Treinador',
                email: user!.email,
                realName: info.realName.trim(),
                trainerName: info.trainerName.trim(),
                gender: info.gender,
                age: Number(info.age) || 0,
                height: Number(info.height) || 0,
                description: info.description.trim(),
                imageUrl,
                trainerClass: sheet.trainerClass,
                attributes: sheet.attributes,
                skills: sheet.skills,
                money: RULES.trainer.startingMoney,
                createdAt: serverTimestamp()
            });
        } catch {
            setError('Não foi possível salvar a ficha. Confira a conexão e tente de novo.');
            setBusy(false);
        }
    }

    if (listedProfessor) {
        return (
            <main className="login">
                <div className="card hero stack" style={{ maxWidth: 520 }}>
                    <span className="brand-mark"><Icon name="master" /></span>
                    <h1>Bem-vindo, Professor.</h1>
                    <p className="muted">Seu e-mail está na lista de Mestres. Crie seu perfil para gerenciar treinadores, mapa, encontros e batalhas.</p>
                    {error && <p role="alert" style={{ color: 'var(--bad-ink)' }}>{error}</p>}
                    <div className="row"><button className="btn primary" disabled={busy} onClick={createProfessor}>Criar perfil de Professor</button><button className="btn ghost" onClick={() => logout()}>Sair</button></div>
                </div>
            </main>
        );
    }

    const infoValid = info.realName.trim() && info.trainerName.trim();
    return (
        <main className="main" style={{ maxWidth: 1000, margin: '0 auto' }}>
            <div className="page">
                <div className="page-head">
                    <div><p className="eyebrow">Novo treinador · passo {step + 1} de 2</p><h1>{step === 0 ? 'Quem é seu personagem?' : 'Monte sua ficha'}</h1></div>
                    <button className="btn ghost" onClick={() => logout()}><Icon name="logout" />Sair</button>
                </div>
                <div className="card">
                    {step === 0 ? (
                        <form className="stack" style={{ gap: 16 }} onSubmit={e => { e.preventDefault(); if (infoValid) setStep(1); }}>
                            <div className="grid cols-2">
                                <label className="field"><span>Seu nome</span><input className="input" required value={info.realName} onChange={e => setInfo({ ...info, realName: e.target.value })} autoComplete="name" /></label>
                                <label className="field"><span>Nome do personagem</span><input className="input" required maxLength={30} value={info.trainerName} onChange={e => setInfo({ ...info, trainerName: e.target.value })} /></label>
                                <label className="field"><span>Gênero</span>
                                    <select className="input" value={info.gender} onChange={e => setInfo({ ...info, gender: e.target.value })}>
                                        <option value="">Prefiro não dizer</option><option>Masculino</option><option>Feminino</option><option>Não-binário</option>
                                    </select>
                                </label>
                                <label className="field"><span>Idade</span><input className="input" type="number" min={10} max={99} value={info.age} onChange={e => setInfo({ ...info, age: e.target.value })} /></label>
                                <label className="field"><span>Altura (cm)</span><input className="input" type="number" min={100} max={250} value={info.height} onChange={e => setInfo({ ...info, height: e.target.value })} /></label>
                                <label className="field"><span>Foto do personagem (opcional)</span><input className="input" type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={e => setPhoto(e.target.files?.[0] ?? null)} /></label>
                            </div>
                            <label className="field"><span>Descrição (até 180 caracteres)</span><textarea className="input" maxLength={180} value={info.description} onChange={e => setInfo({ ...info, description: e.target.value })} /></label>
                            <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn primary" disabled={!infoValid}>Continuar<Icon name="arrow" /></button></div>
                        </form>
                    ) : (
                        <div className="stack" style={{ gap: 20 }}>
                            <SheetForm value={sheet} onChange={setSheet} />
                            {error && <p role="alert" style={{ color: 'var(--bad-ink)' }}>{error}</p>}
                            <div className="row between">
                                <button className="btn ghost" onClick={() => setStep(0)}>Voltar</button>
                                <button className="btn primary" disabled={busy} onClick={createTrainer}>{busy ? 'Salvando…' : 'Começar a aventura'}</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
