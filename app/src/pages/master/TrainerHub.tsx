// Hub do treinador para o Mestre: ficha, time, PC, mochila, dinheiro e insígnias num lugar só.
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { CAMPAIGNS, changeBag, placePokemon, updateTrainer, useTrainer } from '../../lib/db';
import { trainerName } from '../../lib/normalize';
import { useToast } from '../../lib/toast';
import type { PokemonInstance, TrainerProfile } from '../../model';
import { CATEGORY_LABEL, ITEMS, itemBySlug, itemSprite } from '../../rules/items';
import { MOVES, moveBySlug } from '../../data';
import { RULES } from '../../rules/config';
import { displayName, evolutionAvailable, evolve, fullHeal, gainXp, statsOf } from '../../rules/pokemon';
import { STATUS_LABEL, type StatusCondition } from '../../rules/status';
import { ATTRIBUTES, CLASSES, SKILLS, trainedSkills } from '../../rules/trainer';
import { setAvatarFallback } from '../../ui/avatar';
import { Icon } from '../../ui/icons';
import { MonCard, PokemonDetail } from '../../ui/pokemon';
import { Empty, Loading, Modal, Money, Switch, Tabs } from '../../ui/ui';
import PokemonPicker from './PokemonPicker';

type Tab = 'ficha' | 'time' | 'pc' | 'mochila';

export default function TrainerHub() {
    const { id } = useParams();
    const trainer = useTrainer(id);
    const toast = useToast();
    const [tab, setTab] = useState<Tab>('time');
    if (trainer === undefined) return <Loading />;
    if (!trainer) return <Empty icon="trainers" title="Treinador não encontrado" />;

    const save = async (patch: Partial<TrainerProfile>, message = 'Salvo.') => {
        try { await updateTrainer(trainer.id, patch); toast(message, 'ok'); }
        catch { toast('Não foi possível salvar.', 'bad'); }
    };

    return (
        <div className="page">
            <Link to="/treinadores" className="btn ghost small" style={{ justifySelf: 'start' }}>‹ Treinadores</Link>
            <section className="card hero row" style={{ alignItems: 'flex-start', gap: 20 }}>
                <img className="avatar lg" alt="" src={trainer.imageUrl || undefined} ref={img => setAvatarFallback(img, trainer.trainerName)} />
                <div className="stack" style={{ flex: 1, gap: 6 }}>
                    <p className="eyebrow">{CLASSES.find(c => c.key === trainer.trainerClass)?.label ?? 'Ficha incompleta'}</p>
                    <h1>{trainerName(trainer)}</h1>
                    <p className="muted small">{[trainer.realName, trainer.age && trainer.age + ' anos', trainer.height && trainer.height + ' cm', trainer.gender].filter(Boolean).join(' · ')}</p>
                    {trainer.description && <p className="small">{trainer.description}</p>}
                </div>
                <div className="stack" style={{ minWidth: 240 }}>
                    <label className="field"><span>Campanha</span>
                        <select className="input" value={trainer.campaign ?? ''} onChange={e => save({ campaign: e.target.value || undefined }, 'Campanha atualizada.')}>
                            <option value="">Nenhuma</option>{CAMPAIGNS.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                    </label>
                    <Switch checked={Boolean(trainer.pcUnlocked)} onChange={v => save({ pcUnlocked: v }, v ? 'PC liberado.' : 'PC bloqueado.')} label="PC liberado fora do Centro" />
                </div>
            </section>

            <Tabs label="Seções" value={tab} onChange={setTab} items={[
                { value: 'time', label: `Time (${trainer.team?.length ?? 0})` },
                { value: 'pc', label: `PC (${trainer.pc?.length ?? 0})` },
                { value: 'mochila', label: 'Mochila e dinheiro' },
                { value: 'ficha', label: 'Ficha' }
            ]} />

            {tab === 'time' && <PokemonList trainer={trainer} where="team" save={save} />}
            {tab === 'pc' && <PokemonList trainer={trainer} where="pc" save={save} />}
            {tab === 'mochila' && <BagEditor trainer={trainer} save={save} />}
            {tab === 'ficha' && <SheetEditor trainer={trainer} save={save} />}
        </div>
    );
}

function PokemonList({ trainer, where, save }: { trainer: TrainerProfile; where: 'team' | 'pc'; save: (p: Partial<TrainerProfile>, m?: string) => Promise<void> }) {
    const list = (where === 'team' ? trainer.team : trainer.pc) ?? [];
    const [openUid, setOpenUid] = useState<string | null>(null);
    const [xp, setXp] = useState(100);
    const open = list.find(p => p.uid === openUid) ?? null;
    const write = (next: PokemonInstance[], message?: string) => save(where === 'team' ? { team: next } : { pc: next }, message);
    const replace = (p: PokemonInstance) => list.map(x => (x.uid === p.uid ? p : x));

    return (
        <div className="stack">
            <div className="card stack">
                <div className="row between"><h2>Entregar Pokémon</h2>{where === 'team' && <button className="btn" onClick={() => write(list.map(fullHeal), 'Time curado.')}><Icon name="heal" />Curar todos</button>}</div>
                <PokemonPicker label="Entregar" onAdd={p => {
                    if (where === 'team') {
                        const placed = placePokemon(trainer.team ?? [], trainer.pc ?? [], { ...p, caughtBy: trainer.id });
                        save({ team: placed.team, pc: placed.pc }, `${displayName(p)} foi para o ${placed.where}.`);
                    } else write([...list, { ...p, caughtBy: trainer.id }], `${displayName(p)} foi para o PC.`);
                }} />
            </div>
            {list.length === 0 ? <Empty title={where === 'team' ? 'Time vazio' : 'PC vazio'} /> : (
                <div className="grid cols-3">{list.map(p => <MonCard key={p.uid} p={p} onClick={() => setOpenUid(p.uid)} />)}</div>
            )}

            <Modal open={Boolean(open)} onClose={() => setOpenUid(null)} wide title={open ? displayName(open) : ''} subtitle="Edição do Mestre">
                {open && (
                    <div className="stack" style={{ gap: 18 }}>
                        <div className="card flat stack">
                            <p className="eyebrow">Ajustes rápidos</p>
                            <div className="row">
                                <label className="field" style={{ width: 120 }}><span>HP ({statsOf(open).hp} máx.)</span>
                                    <input className="input num" type="number" min={0} max={statsOf(open).hp} defaultValue={open.currentHp} key={open.uid + open.currentHp}
                                        onBlur={e => { const hp = Math.max(0, Math.min(statsOf(open).hp, Number(e.target.value) || 0)); if (hp !== open.currentHp) write(replace({ ...open, currentHp: hp, statusCondition: hp === 0 ? 'fainted' : open.statusCondition === 'fainted' ? 'none' : open.statusCondition }), 'HP ajustado.'); }} />
                                </label>
                                <label className="field" style={{ width: 160 }}><span>Status</span>
                                    <select className="input" value={open.statusCondition} onChange={e => { const s = e.target.value as StatusCondition; write(replace({ ...open, statusCondition: s, currentHp: s === 'fainted' ? 0 : Math.max(1, open.currentHp) }), 'Status ajustado.'); }}>
                                        {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                    </select>
                                </label>
                                <label className="field" style={{ width: 120 }}><span>Amizade</span>
                                    <input className="input num" type="number" min={0} max={RULES.friendship.max} defaultValue={open.friendship} key={'f' + open.uid + open.friendship}
                                        onBlur={e => { const f = Math.max(0, Math.min(RULES.friendship.max, Number(e.target.value) || 0)); if (f !== open.friendship) write(replace({ ...open, friendship: f }), 'Amizade ajustada.'); }} />
                                </label>
                                <label className="field" style={{ width: 120 }}><span>Dar XP</span><input className="input num" type="number" min={1} value={xp} onChange={e => setXp(Number(e.target.value) || 0)} /></label>
                                <button className="btn" style={{ alignSelf: 'end' }} onClick={() => { const r = gainXp(open, xp); write(replace(r.pokemon), `+${xp} XP${r.levelsGained ? ` · nível ${r.pokemon.level}` : ''}${r.evolution ? ' · pode evoluir' : ''}`); }}>Dar XP</button>
                                <button className="btn" style={{ alignSelf: 'end' }} onClick={() => write(replace(fullHeal(open)), 'Curado.')}><Icon name="heal" />Curar</button>
                                {evolutionAvailable(open, 'trade') !== null && <button className="btn" style={{ alignSelf: 'end' }} onClick={() => write(replace(evolve(open, evolutionAvailable(open, 'trade')!)), 'Evoluiu por troca!')}>Evoluir (troca)</button>}
                            </div>
                            <TeachTm p={open} onTeach={next => write(replace(next), 'Golpe ensinado.')} />
                        </div>
                        <PokemonDetail p={open} actions={{ allowEvolve: true, onChange: next => write(replace(next), 'Alterações salvas.') }} />
                        <div className="row" style={{ justifyContent: 'flex-end' }}>
                            {where === 'team' ? <button className="btn" onClick={() => { save({ team: list.filter(x => x.uid !== open.uid), pc: [...(trainer.pc ?? []), open] }, 'Enviado ao PC.'); setOpenUid(null); }}>Mandar para o PC</button>
                                : <button className="btn" disabled={(trainer.team?.length ?? 0) >= RULES.party.max} onClick={() => { save({ pc: list.filter(x => x.uid !== open.uid), team: [...(trainer.team ?? []), open] }, 'Levado ao time.'); setOpenUid(null); }}>Levar ao time</button>}
                            <button className="btn danger" onClick={() => { if (confirm(`Soltar ${displayName(open)}? Ele sai da ficha do treinador.`)) { write(list.filter(x => x.uid !== open.uid), 'Pokémon solto.'); setOpenUid(null); } }}><Icon name="trash" />Soltar</button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}

function TeachTm({ p, onTeach }: { p: PokemonInstance; onTeach: (next: PokemonInstance) => void }) {
    const [move, setMove] = useState('');
    const all = Object.entries(MOVES).sort((a, b) => a[1].name.localeCompare(b[1].name));
    return (
        <div className="row">
            <select className="input" style={{ maxWidth: 260 }} value={move} onChange={e => setMove(e.target.value)} aria-label="Golpe para ensinar">
                <option value="">Ensinar qualquer golpe (Mestre)…</option>{all.map(([slug, m]) => <option key={slug} value={slug}>{m.name}</option>)}
            </select>
            <button className="btn small" disabled={!move || p.moves.length >= 4 || p.moves.some(m => m.slug === move)} onClick={() => { onTeach({ ...p, moves: [...p.moves, { slug: move, pp: moveBySlug(move).pp }] }); setMove(''); }}>Ensinar</button>
            {p.moves.length >= 4 && <span className="tiny muted">Já tem 4 golpes: esqueça um abaixo.</span>}
        </div>
    );
}

function BagEditor({ trainer, save }: { trainer: TrainerProfile; save: (p: Partial<TrainerProfile>, m?: string) => Promise<void> }) {
    const [item, setItem] = useState('potion');
    const [qty, setQty] = useState(1);
    const [tm, setTm] = useState('');
    const [money, setMoney] = useState(100);
    const toast = useToast();
    const bag = trainer.bag ?? [];
    const give = (slug: string, delta: number) => {
        const r = changeBag(bag, slug, delta);
        if (r.error) { toast(r.error, 'bad'); return; }
        save({ bag: r.bag }, delta > 0 ? `+${delta} ${itemBySlug(slug)?.name}` : `−${-delta} ${itemBySlug(slug)?.name}`);
    };
    return (
        <div className="grid cols-2" style={{ alignItems: 'start' }}>
            <section className="card stack">
                <h2>Dinheiro: <Money value={trainer.money ?? 0} /></h2>
                <div className="row">
                    <input className="input num" type="number" min={1} value={money} onChange={e => setMoney(Math.max(1, Number(e.target.value) || 1))} style={{ width: 130 }} aria-label="Valor" />
                    <button className="btn primary" onClick={() => save({ money: (trainer.money ?? 0) + money }, `+₽ ${money}`)}>Dar</button>
                    <button className="btn" onClick={() => save({ money: Math.max(0, (trainer.money ?? 0) - money) }, `−₽ ${money}`)}>Tirar</button>
                </div>
                <div className="divider" />
                <h2>Dar item</h2>
                <div className="row">
                    <select className="input" style={{ maxWidth: 240 }} value={item} onChange={e => setItem(e.target.value)} aria-label="Item">
                        {ITEMS.map(i => <option key={i.slug} value={i.slug}>{CATEGORY_LABEL[i.category]} · {i.name}</option>)}
                    </select>
                    <input className="input num" type="number" min={1} max={99} value={qty} onChange={e => setQty(Math.max(1, Number(e.target.value) || 1))} style={{ width: 80 }} aria-label="Quantidade" />
                    <button className="btn primary" onClick={() => give(item, qty)}>Dar</button>
                </div>
                <div className="row">
                    <select className="input" style={{ maxWidth: 240 }} value={tm} onChange={e => setTm(e.target.value)} aria-label="TM">
                        <option value="">Criar TM de um golpe…</option>{Object.entries(MOVES).sort((a, b) => a[1].name.localeCompare(b[1].name)).map(([slug, m]) => <option key={slug} value={slug}>{m.name}</option>)}
                    </select>
                    <button className="btn" disabled={!tm} onClick={() => give('tm:' + tm, 1)}>Dar TM</button>
                </div>
            </section>
            <section className="card stack">
                <h2>Mochila</h2>
                {bag.length === 0 ? <p className="muted">Vazia.</p> : bag.map(e => {
                    const i = itemBySlug(e.technicalName);
                    return (
                        <div key={e.technicalName} className="row between">
                            <span className="row"><img src={itemSprite(e.technicalName)} alt="" width={28} height={28} style={{ imageRendering: 'pixelated' }} /><strong>{i?.name}</strong><span className="chip num">x{e.quantity}</span></span>
                            <span className="row"><button className="btn small icon" aria-label="Tirar um" onClick={() => give(e.technicalName, -1)}>−</button><button className="btn small icon" aria-label="Dar mais um" onClick={() => give(e.technicalName, 1)}>+</button></span>
                        </div>
                    );
                })}
            </section>
        </div>
    );
}

function SheetEditor({ trainer, save }: { trainer: TrainerProfile; save: (p: Partial<TrainerProfile>, m?: string) => Promise<void> }) {
    const [badge, setBadge] = useState('');
    const trained = trainedSkills(trainer);
    return (
        <div className="grid cols-2" style={{ alignItems: 'start' }}>
            <section className="card stack">
                <h2>Classe e atributos</h2>
                <label className="field"><span>Classe</span>
                    <select className="input" value={trainer.trainerClass ?? ''} onChange={e => save({ trainerClass: e.target.value }, 'Classe alterada.')}>
                        <option value="">—</option>{CLASSES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                </label>
                <div className="grid cols-3">
                    {ATTRIBUTES.map(a => (
                        <label key={a.key} className="field"><span>{a.label}</span>
                            <input className="input num" type="number" min={0} max={10} defaultValue={trainer.attributes?.[a.key] ?? 0} key={a.key + (trainer.attributes?.[a.key] ?? 0)}
                                onBlur={e => { const v = Math.max(0, Math.min(10, Number(e.target.value) || 0)); if (v !== (trainer.attributes?.[a.key] ?? 0)) save({ attributes: { for: 0, agi: 0, vig: 0, int: 0, per: 0, car: 0, ...trainer.attributes, [a.key]: v } }, a.label + ' ajustado.'); }} />
                        </label>
                    ))}
                </div>
                <div className="field"><span>Perícias escolhidas</span>
                    <div className="chips">{SKILLS.map(s => {
                        const on = (trainer.skills ?? []).includes(s.key);
                        return <button key={s.key} className={'chip' + (on || trained.includes(s.key) ? ' on' : '')} onClick={() => save({ skills: on ? (trainer.skills ?? []).filter(k => k !== s.key) : [...(trainer.skills ?? []), s.key] }, 'Perícias atualizadas.')}>{s.label}</button>;
                    })}</div>
                </div>
            </section>
            <section className="card stack">
                <h2>Insígnias</h2>
                <div className="chips">{(trainer.badges ?? []).length === 0 ? <span className="muted">Nenhuma.</span> : trainer.badges!.map(b => <span key={b} className="chip on">{b}<button aria-label={'Remover ' + b} onClick={() => save({ badges: trainer.badges!.filter(x => x !== b) })}>×</button></span>)}</div>
                <form className="row" onSubmit={e => { e.preventDefault(); if (badge.trim()) { save({ badges: [...(trainer.badges ?? []), badge.trim()] }, 'Insígnia entregue.'); setBadge(''); } }}>
                    <input className="input" value={badge} onChange={e => setBadge(e.target.value)} placeholder="Insígnia Brasa" aria-label="Nova insígnia" />
                    <button className="btn primary">Entregar</button>
                </form>
            </section>
        </div>
    );
}
