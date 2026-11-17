import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { updateTrainer } from '../lib/db';
import { useToast } from '../lib/toast';
import type { AttributeKey } from '../model';
import type { Roll } from '../rules/dice';
import { attributeCheck, ATTRIBUTES, classByKey, emptyAttributes, skillBonus, skillCheck, SKILLS, trainedSkills, validateSheet } from '../rules/trainer';
import { setAvatarFallback } from '../ui/avatar';
import { Icon } from '../ui/icons';
import { DiceResult, Modal, Money } from '../ui/ui';
import SheetForm, { type SheetValue } from './SheetForm';

export default function Sheet() {
    const { profile } = useAuth();
    const toast = useToast();
    const [sheet, setSheet] = useState<SheetValue>({ trainerClass: '', attributes: emptyAttributes(), skills: [] });
    const [busy, setBusy] = useState(false);
    const [check, setCheck] = useState<{ label: string; roll: Roll; again: () => Roll } | null>(null);
    const [dc, setDc] = useState(12);
    if (!profile) return null;
    const cls = classByKey(profile.trainerClass);

    if (!cls) {
        return (
            <div className="page">
                <div className="page-head"><div><p className="eyebrow">Ficha</p><h1>Complete sua ficha</h1><p>Seu personagem foi criado antes do sistema de classes. Escolha agora — depois disso, só o Mestre pode alterar.</p></div></div>
                <div className="card stack" style={{ gap: 18 }}>
                    <SheetForm value={sheet} onChange={setSheet} />
                    <div className="row" style={{ justifyContent: 'flex-end' }}>
                        <button className="btn primary" disabled={busy} onClick={async () => {
                            const problem = validateSheet(sheet.trainerClass, sheet.attributes, sheet.skills);
                            if (problem) { toast(problem, 'bad'); return; }
                            setBusy(true);
                            try { await updateTrainer(profile.id, sheet); toast('Ficha salva!', 'ok'); }
                            catch { toast('Não foi possível salvar a ficha.', 'bad'); }
                            setBusy(false);
                        }}>Salvar ficha</button>
                    </div>
                </div>
            </div>
        );
    }

    const trained = trainedSkills(profile);
    const rollSkill = (key: string, label: string) => { const again = () => skillCheck(profile, key); setCheck({ label, roll: again(), again }); };
    const rollAttr = (key: AttributeKey, label: string) => { const again = () => attributeCheck(profile, key); setCheck({ label, roll: again(), again }); };

    return (
        <div className="page rise">
            <section className="card hero">
                <div className="row" style={{ alignItems: 'flex-start', gap: 22 }}>
                    <img className="avatar lg" alt="" src={profile.imageUrl || undefined} ref={img => setAvatarFallback(img, profile.trainerName)} />
                    <div className="stack" style={{ flex: 1, gap: 8 }}>
                        <p className="eyebrow">{cls.label} · {cls.focus}</p>
                        <h1>{profile.trainerName}</h1>
                        <p className="muted">{[profile.age && profile.age + ' anos', profile.height && profile.height + ' cm', profile.gender, profile.campaign && 'Campanha ' + profile.campaign].filter(Boolean).join(' · ')}</p>
                        {profile.description && <p>{profile.description}</p>}
                    </div>
                    <dl className="kv" style={{ minWidth: 240 }}>
                        <div><dt>Dinheiro</dt><dd><Money value={profile.money ?? 0} /></dd></div>
                        <div><dt>Insígnias</dt><dd>{profile.badges?.length ? profile.badges.join(', ') : 'Nenhuma'}</dd></div>
                    </dl>
                </div>
            </section>

            <div className="grid cols-2">
                <section className="card stack">
                    <h2>Classe: {cls.label}</h2>
                    <p><strong>Passiva.</strong> {cls.passive}</p>
                    <p><strong>{cls.command.name}.</strong> <span className="muted">{cls.command.description}</span></p>
                </section>
                <section className="card stack">
                    <div className="row between"><h2>Testes</h2>
                        <label className="row small muted">Dificuldade <input className="input num" style={{ width: 70, minHeight: 34 }} type="number" min={1} max={40} value={dc} onChange={e => setDc(Number(e.target.value) || 10)} /></label>
                    </div>
                    <p className="small muted">Clique em um atributo ou perícia para rolar 1d20 + bônus. O Mestre define a dificuldade.</p>
                </section>
            </div>

            <section className="stack">
                <h2>Atributos</h2>
                <div className="grid cols-3">
                    {ATTRIBUTES.map(a => (
                        <button key={a.key} className="card row between" style={{ cursor: 'pointer', textAlign: 'left' }} onClick={() => rollAttr(a.key, a.label)}>
                            <div><strong>{a.label}</strong><p className="tiny muted">{a.hint}</p></div>
                            <span className="die" style={{ animation: 'none' }}>+{profile.attributes?.[a.key] ?? 0}</span>
                        </button>
                    ))}
                </div>
            </section>

            <section className="stack">
                <h2>Perícias</h2>
                <div className="grid cols-3">
                    {SKILLS.map(s => {
                        const bonus = skillBonus(profile, s.key);
                        const isTrained = trained.includes(s.key);
                        return (
                            <button key={s.key} className="card flat row between" style={{ cursor: 'pointer', textAlign: 'left', borderColor: isTrained ? 'color-mix(in oklch, var(--action) 50%, transparent)' : undefined }} onClick={() => rollSkill(s.key, s.label)}>
                                <div><strong>{s.label}</strong><p className="tiny muted">{ATTRIBUTES.find(a => a.key === s.attribute)?.label}{isTrained ? ' · treinada' : ''}</p></div>
                                <span className="row tiny" style={{ gap: 6 }}><Icon name="dice" /><span className="num" style={{ fontSize: '1rem', fontWeight: 700 }}>{bonus >= 0 ? '+' : ''}{bonus}</span></span>
                            </button>
                        );
                    })}
                </div>
            </section>

            <Modal open={Boolean(check)} onClose={() => setCheck(null)} title={check ? 'Teste de ' + check.label : ''} subtitle={check?.roll.expression}
                footer={<button className="btn primary" onClick={() => check && setCheck({ ...check, roll: check.again() })}>Rolar de novo</button>}>
                {check && <DiceResult roll={check.roll} target={dc} />}
            </Modal>
        </div>
    );
}
