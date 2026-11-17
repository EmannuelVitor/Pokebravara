// Escolha de classe, atributos e perícias — usado no cadastro e para completar fichas antigas.
import type { AttributeKey } from '../model';
import { RULES } from '../rules/config';
import { attributePointsUsed, ATTRIBUTES, CLASSES, classByKey, SKILLS } from '../rules/trainer';

export interface SheetValue {
    trainerClass: string;
    attributes: Record<AttributeKey, number>;
    skills: string[];
}

export default function SheetForm({ value, onChange }: { value: SheetValue; onChange: (v: SheetValue) => void }) {
    const used = attributePointsUsed(value.attributes);
    const left = RULES.trainer.attributePoints - used;
    const cls = classByKey(value.trainerClass);
    const set = (patch: Partial<SheetValue>) => onChange({ ...value, ...patch });

    return (
        <div className="stack" style={{ gap: 22 }}>
            <section className="stack">
                <div><p className="eyebrow">1 · Classe</p><p className="small muted">Define seu estilo e um comando especial usado uma vez por batalha.</p></div>
                <div className="grid cols-2">
                    {CLASSES.map(c => (
                        <button key={c.key} type="button" className={'mon' + (value.trainerClass === c.key ? ' selected' : '')} style={{ gridTemplateColumns: '1fr' }}
                            onClick={() => set({ trainerClass: c.key, skills: value.skills.filter(s => !c.skills.includes(s)) })}>
                            <div className="stack" style={{ gap: 6 }}>
                                <div className="row between"><strong style={{ fontFamily: 'var(--display)', fontSize: '1.1rem' }}>{c.label}</strong><span className="chip">{c.focus}</span></div>
                                <p className="small">{c.passive}</p>
                                <p className="small muted"><strong>{c.command.name}:</strong> {c.command.description}</p>
                                <p className="tiny faint">Perícias: {c.skills.map(s => SKILLS.find(k => k.key === s)?.label).join(', ')}</p>
                            </div>
                        </button>
                    ))}
                </div>
            </section>

            <section className="stack">
                <div className="row between">
                    <div><p className="eyebrow">2 · Atributos</p><p className="small muted">Distribua {RULES.trainer.attributePoints} pontos (de {RULES.trainer.attributeMin} a {RULES.trainer.attributeMax} cada). Somam nos testes de 1d20.</p></div>
                    <span className={'chip ' + (left === 0 ? 'on' : '')}>{left} restantes</span>
                </div>
                <div className="grid cols-3">
                    {ATTRIBUTES.map(a => (
                        <div key={a.key} className="card flat row between">
                            <div><strong>{a.label}</strong><p className="tiny muted">{a.hint}</p></div>
                            <div className="row" style={{ gap: 6 }}>
                                <button type="button" className="btn small icon" aria-label={'Diminuir ' + a.label} disabled={value.attributes[a.key] <= RULES.trainer.attributeMin}
                                    onClick={() => set({ attributes: { ...value.attributes, [a.key]: value.attributes[a.key] - 1 } })}>−</button>
                                <strong className="num" style={{ width: 22, textAlign: 'center', fontSize: '1.2rem' }}>{value.attributes[a.key]}</strong>
                                <button type="button" className="btn small icon" aria-label={'Aumentar ' + a.label} disabled={left <= 0 || value.attributes[a.key] >= RULES.trainer.attributeMax}
                                    onClick={() => set({ attributes: { ...value.attributes, [a.key]: value.attributes[a.key] + 1 } })}>+</button>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="stack">
                <div className="row between">
                    <div><p className="eyebrow">3 · Perícias</p><p className="small muted">Escolha {RULES.trainer.chosenSkills} além das da classe. Perícias treinadas somam +{RULES.trainer.proficiency}.</p></div>
                    <span className={'chip ' + (value.skills.length === RULES.trainer.chosenSkills ? 'on' : '')}>{value.skills.length}/{RULES.trainer.chosenSkills}</span>
                </div>
                <div className="chips">
                    {SKILLS.map(s => {
                        const fromClass = cls?.skills.includes(s.key);
                        const on = fromClass || value.skills.includes(s.key);
                        return (
                            <button key={s.key} type="button" className={'chip' + (on ? ' on' : '')} disabled={fromClass} title={fromClass ? 'Já vem da classe' : undefined}
                                aria-pressed={on}
                                onClick={() => {
                                    if (value.skills.includes(s.key)) set({ skills: value.skills.filter(k => k !== s.key) });
                                    else if (value.skills.length < RULES.trainer.chosenSkills) set({ skills: [...value.skills, s.key] });
                                }}>
                                {s.label} <span className="tiny" style={{ opacity: .7 }}>({ATTRIBUTES.find(a => a.key === s.attribute)?.label})</span>
                            </button>
                        );
                    })}
                </div>
            </section>
        </div>
    );
}
