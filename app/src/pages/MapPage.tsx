import { useState } from 'react';
import { useNavigate } from 'react-router';
import { SPECIES, speciesById, sprite } from '../data';
import { useAuth } from '../lib/auth';
import { CAMPAIGNS, campaignId, createBattleDoc, saveCampaign, updateTrainer, useCampaign, useDex, useTrainers } from '../lib/db';
import { trainerName } from '../lib/normalize';
import { useToast } from '../lib/toast';
import type { Campaign, EncounterEntry, Region, RegionKind } from '../model';
import { quantityOf } from '../rules/bag';
import { createBattle, wildPokemon } from '../rules/battle';
import { RULES } from '../rules/config';
import { randomInt, roll, weightedPick, type Roll } from '../rules/dice';
import { fieldHelpers, FIELD_SKILLS, fieldSkillByKey } from '../rules/field';
import { displayName, rest } from '../rules/pokemon';
import { classByKey } from '../rules/trainer';
import { Icon } from '../ui/icons';
import { Sprite } from '../ui/pokemon';
import { DiceResult, Empty, Modal, Switch } from '../ui/ui';
import { rarityOf } from './Pokedex';

const KIND_LABEL: Record<RegionKind, string> = { cidade: 'Cidade', rota: 'Rota', caverna: 'Caverna', floresta: 'Floresta', agua: 'Corpo d’água', montanha: 'Montanha' };
const WEATHERS = ['limpo', 'chuva', 'sol forte', 'neve', 'neblina', 'tempestade de areia'];

export default function MapPage() {
    const { profile, isProfessor, user } = useAuth();
    const [campaignKey, setCampaignKey] = useState(campaignId(profile?.campaign));
    const campaign = useCampaign(isProfessor ? campaignKey : campaignId(profile?.campaign));
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [editing, setEditing] = useState<Region | null>(null);
    const dex = useDex(isProfessor ? undefined : user?.uid);
    if (!campaign) return null;
    const selected = campaign.regions.find(r => r.id === (selectedId ?? campaign.location)) ?? null;
    const here = campaign.regions.find(r => r.id === campaign.location);

    return (
        <div className="page">
            <div className="page-head">
                <div><p className="eyebrow">Exploração · Campanha {campaign.name}</p><h1>Mapa</h1>
                    <p>{here ? <>Grupo em <strong>{here.name}</strong> · clima {campaign.weather}.</> : 'O grupo ainda não tem posição no mapa.'}</p></div>
                {isProfessor && (
                    <div className="row">
                        <select className="input" style={{ width: 'auto' }} value={campaignKey} onChange={e => { setCampaignKey(e.target.value); setSelectedId(null); }} aria-label="Campanha">
                            {CAMPAIGNS.map(c => <option key={c.id} value={c.id}>Campanha {c.name}</option>)}
                        </select>
                        <button className="btn primary" onClick={() => setEditing(newRegion(campaign))}><Icon name="plus" />Nova área</button>
                    </div>
                )}
            </div>

            {campaign.regions.length === 0 ? (
                <Empty icon="map" title="Mapa vazio">{isProfessor ? 'Crie cidades, rotas, cavernas e florestas com suas tabelas de encontro.' : 'O Mestre ainda não montou o mapa da campanha.'}</Empty>
            ) : (
                <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.5fr) minmax(300px, 1fr)', alignItems: 'start' }}>
                    <div className="map" role="group" aria-label="Mapa da região">
                        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                            {campaign.regions.flatMap(r => r.connections.map(to => {
                                const other = campaign.regions.find(x => x.id === to);
                                if (!other || other.id < r.id) return null;
                                return <line key={r.id + to} x1={r.x} y1={r.y} x2={other.x} y2={other.y} stroke="oklch(0.6 0.08 60 / .55)" strokeWidth="0.6" strokeDasharray="1.6 1.2" vectorEffect="non-scaling-stroke" />;
                            }))}
                        </svg>
                        {campaign.regions.map(r => (
                            <button key={r.id} className={'map-node' + (r.id === campaign.location ? ' here' : '') + (r.id === selected?.id ? ' selected' : '')} style={{ left: r.x + '%', top: r.y + '%' }} onClick={() => setSelectedId(r.id)}>
                                <i><Icon name={r.kind} /></i><span>{r.name}</span>
                            </button>
                        ))}
                    </div>
                    {selected ? <RegionPanel region={selected} campaign={campaign} isProfessor={isProfessor} dex={dex} onEdit={() => setEditing(selected)} /> : <Empty icon="map" title="Selecione uma área" />}
                </div>
            )}

            {isProfessor && <MasterField campaign={campaign} />}

            {editing && <RegionEditor region={editing} campaign={campaign} onClose={() => setEditing(null)} />}
        </div>
    );
}

function newRegion(c: Campaign): Region {
    return { id: 'r' + Date.now().toString(36), name: '', kind: 'rota', biome: '', description: '', pokemonCenter: false, mart: false, requires: [], encounters: [], connections: c.location ? [c.location] : [], x: 50, y: 50 };
}

function RegionPanel({ region, campaign, isProfessor, dex, onEdit }: { region: Region; campaign: Campaign; isProfessor: boolean; dex: Map<number, string>; onEdit: () => void }) {
    const { profile } = useAuth();
    const toast = useToast();
    const total = region.encounters.reduce((s, e) => s + e.weight, 0);
    const team = profile?.team ?? [];
    return (
        <aside className="card stack">
            <div className="row between">
                <div><p className="eyebrow">{KIND_LABEL[region.kind]}{region.biome ? ' · ' + region.biome : ''}</p><h2>{region.name}</h2></div>
                {isProfessor && <button className="btn small" onClick={onEdit}><Icon name="edit" />Editar</button>}
            </div>
            {region.description && <p className="muted">{region.description}</p>}
            <div className="chips">
                {region.id === campaign.location && <span className="chip on">Grupo aqui</span>}
                {region.pokemonCenter && <span className="chip">Centro Pokémon</span>}
                {region.mart && <span className="chip">Poké Mart</span>}
            </div>
            {region.requires.length > 0 && (
                <div className="stack" style={{ gap: 6 }}>
                    <p className="eyebrow">Obstáculos</p>
                    {region.requires.map(key => {
                        const skill = fieldSkillByKey(key);
                        const helpers = fieldHelpers(team, key);
                        return (
                            <div key={key} className="row between small">
                                <span><strong>{skill?.label ?? key}</strong> <span className="muted">{skill?.description}</span></span>
                                {!isProfessor && <span className={'chip ' + (helpers.length ? 'on' : '')}>{helpers.length ? displayName(helpers[0]) : 'Ninguém no time'}</span>}
                            </div>
                        );
                    })}
                </div>
            )}
            <div className="stack" style={{ gap: 6 }}>
                <p className="eyebrow">Pokémon da área</p>
                {region.encounters.length === 0 ? <p className="small muted">Nenhum encontro nesta área.</p> : region.encounters.map((e, i) => {
                    const s = speciesById(e.pokemonId);
                    const known = isProfessor || (dex.get(e.pokemonId) ?? 'unknown') !== 'unknown';
                    return (
                        <div key={i} className="row between" style={{ padding: '4px 0' }}>
                            <span className="row" style={{ gap: 8 }}>
                                <img src={sprite(s?.dex ?? 0)} alt="" width={36} height={36} style={{ imageRendering: 'pixelated', filter: known ? undefined : 'brightness(0)' }} />
                                <strong>{known ? s?.name : '???'}</strong>
                            </span>
                            <span className="row tiny"><span className="chip">{rarityOf(e.weight, total)}</span><span className="muted num">Nv. {e.minLevel}–{e.maxLevel}</span>{e.weather && <span className="muted">{e.weather}</span>}</span>
                        </div>
                    );
                })}
            </div>
            {isProfessor && region.id !== campaign.location && (
                <button className="btn primary" onClick={async () => {
                    await saveCampaign({ ...campaign, location: region.id, log: [...campaign.log, { at: Date.now(), text: 'O grupo chegou em ' + region.name }] });
                    toast('Grupo movido para ' + region.name, 'ok');
                }}><Icon name="map" />Mover o grupo para cá</button>
            )}
        </aside>
    );
}

// ------------------------------------------------------------- ferramentas do Mestre no mapa
function MasterField({ campaign }: { campaign: Campaign }) {
    const { user } = useAuth();
    const toast = useToast();
    const navigate = useNavigate();
    const all = useTrainers(true) ?? [];
    const trainers = all.filter(t => campaignId(t.campaign) === campaign.id);
    const [chosen, setChosen] = useState<string[] | null>(null);
    const [encounter, setEncounter] = useState<{ roll: Roll; entry: EncounterEntry; level: number } | null>(null);
    const [busy, setBusy] = useState(false);
    const here = campaign.regions.find(r => r.id === campaign.location);
    const party = chosen ?? trainers.map(t => t.id);
    const group = trainers.filter(t => party.includes(t.id));
    const hasRanger = group.some(t => classByKey(t.trainerClass)?.effects.encounterReroll);
    const hasCampKit = group.some(t => quantityOf(t.bag ?? [], 'camping-gear') > 0);

    function rollEncounter() {
        if (!here) return;
        const table = here.encounters.filter(e => !e.weather || e.weather === campaign.weather);
        const d20 = roll('1d20');
        const entry = weightedPick(table);
        if (!entry || d20.total < 8) {
            setEncounter(null);
            toast(`1d20 = ${d20.total}: ${entry ? 'nenhum Pokémon apareceu (precisa de 8+).' : 'não há encontros para este clima.'}`);
            return;
        }
        setEncounter({ roll: d20, entry, level: randomInt(entry.minLevel, entry.maxLevel) });
    }

    async function startWild() {
        if (!encounter || !user || !group.length) return;
        setBusy(true);
        try {
            const wild = wildPokemon(encounter.entry.pokemonId, encounter.level);
            const battle = createBattle({
                campaign: campaign.id,
                createdBy: user.uid,
                trainers: group.map(t => ({ uid: t.id, name: trainerName(t), classKey: t.trainerClass ?? null, agility: t.attributes?.agi ?? 0, team: t.team ?? [] })),
                enemy: { kind: 'wild', name: 'Selvagem', npcId: null, reward: 0, badge: null, team: [wild] }
            });
            const id = await createBattleDoc(battle);
            navigate('/batalha/' + id);
        } catch {
            toast('Não foi possível criar a batalha.', 'bad');
        }
        setBusy(false);
    }

    async function restGroup(kind: 'short' | 'camp' | 'center') {
        setBusy(true);
        try {
            await Promise.all(group.map(t => {
                const team = (t.team ?? []).map(p => kind === 'short' ? rest(p, RULES.rest.shortRestHeal, false, 0)
                    : kind === 'camp' ? rest(p, RULES.rest.campHeal, RULES.rest.campRestoresPP, RULES.friendship.camp + (classByKey(t.trainerClass)?.key === 'criador' ? 2 : 0))
                    : rest(p, 1, true, 0));
                return updateTrainer(t.id, { team });
            }));
            await saveCampaign({ ...campaign, log: [...campaign.log, { at: Date.now(), text: kind === 'camp' ? 'O grupo acampou.' : kind === 'short' ? 'O grupo fez um descanso curto.' : 'O grupo descansou no Centro Pokémon.' }] });
            toast(kind === 'camp' ? 'Acampamento: HP, PP e amizade recuperados.' : kind === 'short' ? 'Descanso curto aplicado.' : 'Time do grupo curado.', 'ok');
        } catch {
            toast('Não foi possível aplicar o descanso.', 'bad');
        }
        setBusy(false);
    }

    return (
        <section className="card stack" style={{ gap: 16 }}>
            <div className="row between">
                <h2>Mesa do Mestre</h2>
                <label className="row small">Clima
                    <select className="input" style={{ width: 'auto' }} value={campaign.weather} onChange={e => saveCampaign({ ...campaign, weather: e.target.value })}>
                        {WEATHERS.map(w => <option key={w}>{w}</option>)}
                    </select>
                </label>
            </div>
            <div className="stack" style={{ gap: 6 }}>
                <p className="eyebrow">Grupo ({group.length})</p>
                {trainers.length === 0 ? <p className="small muted">Nenhum treinador nesta campanha. Defina a campanha na página de Treinadores.</p> : (
                    <div className="chips">
                        {trainers.map(t => {
                            const on = party.includes(t.id);
                            return <button key={t.id} className={'chip' + (on ? ' on' : '')} aria-pressed={on} onClick={() => setChosen(on ? party.filter(x => x !== t.id) : [...party, t.id])}>{trainerName(t)}</button>;
                        })}
                    </div>
                )}
            </div>
            <div className="grid cols-3">
                <div className="card flat stack">
                    <strong>Encontro aleatório</strong>
                    <p className="small muted">{here ? `Em ${here.name}: 1d20 (8+ aparece) e a tabela da área por peso, filtrada pelo clima.` : 'Mova o grupo para uma área primeiro.'}</p>
                    <div className="row">
                        <button className="btn primary" disabled={!here || !here.encounters.length} onClick={rollEncounter}><Icon name="dice" />Rolar encontro</button>
                        {encounter && hasRanger && <button className="btn" onClick={rollEncounter}>Rerrolar (Ranger)</button>}
                    </div>
                    {encounter && (
                        <div className="stack">
                            <DiceResult roll={encounter.roll} />
                            <div className="row">
                                <Sprite p={{ pokemonId: encounter.entry.pokemonId }} />
                                <div><strong>{speciesById(encounter.entry.pokemonId)?.name}</strong><p className="small muted">Nível {encounter.level}</p></div>
                            </div>
                            <button className="btn primary" disabled={busy || !group.length} onClick={startWild}><Icon name="battle" />Iniciar batalha</button>
                        </div>
                    )}
                </div>
                <div className="card flat stack">
                    <strong>Descanso</strong>
                    <p className="small muted">Descanso curto: +{RULES.rest.shortRestHeal * 100}% HP. Acampamento (precisa de Kit): +{RULES.rest.campHeal * 100}% HP, PP cheio, +{RULES.friendship.camp} de amizade.</p>
                    <div className="row">
                        <button className="btn" disabled={busy || !group.length} onClick={() => restGroup('short')}>Descanso curto</button>
                        <button className="btn" disabled={busy || !group.length || !hasCampKit} title={hasCampKit ? undefined : 'Ninguém do grupo tem Kit de Acampamento'} onClick={() => restGroup('camp')}><Icon name="camp" />Acampar</button>
                    </div>
                    {here?.pokemonCenter && <button className="btn" disabled={busy || !group.length} onClick={() => restGroup('center')}><Icon name="heal" />Curar no Centro Pokémon</button>}
                </div>
                <div className="card flat stack">
                    <strong>Diário da campanha</strong>
                    <div className="log" style={{ maxHeight: 180 }}>
                        {campaign.log.length === 0 ? <p className="muted">Nada registrado ainda.</p> : [...campaign.log].reverse().slice(0, 12).map((l, i) => <p key={i}><span className="tiny faint">{new Date(l.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span> {l.text}</p>)}
                    </div>
                </div>
            </div>
        </section>
    );
}

// ------------------------------------------------------------- editor de área
function RegionEditor({ region, campaign, onClose }: { region: Region; campaign: Campaign; onClose: () => void }) {
    const toast = useToast();
    const [r, setR] = useState<Region>(structuredClone(region));
    const [pick, setPick] = useState('');
    const exists = campaign.regions.some(x => x.id === region.id);
    const set = (patch: Partial<Region>) => setR({ ...r, ...patch });

    async function save() {
        if (!r.name.trim()) { toast('Dê um nome à área.', 'bad'); return; }
        const regions = exists ? campaign.regions.map(x => (x.id === r.id ? r : x)) : [...campaign.regions, r];
        // conexões são de mão dupla
        const linked = regions.map(x => x.id === r.id ? x : { ...x, connections: r.connections.includes(x.id) ? [...new Set([...x.connections, r.id])] : x.connections.filter(c => c !== r.id) });
        await saveCampaign({ ...campaign, regions: linked, location: campaign.location ?? r.id });
        toast('Área salva.', 'ok');
        onClose();
    }

    async function remove() {
        if (!confirm(`Apagar ${r.name || 'esta área'}? As conexões com ela também somem.`)) return;
        await saveCampaign({ ...campaign, regions: campaign.regions.filter(x => x.id !== r.id).map(x => ({ ...x, connections: x.connections.filter(c => c !== r.id) })), location: campaign.location === r.id ? null : campaign.location });
        onClose();
    }

    const updateEntry = (i: number, patch: Partial<EncounterEntry>) => set({ encounters: r.encounters.map((e, j) => (j === i ? { ...e, ...patch } : e)) });

    return (
        <Modal open onClose={onClose} wide title={exists ? 'Editar área' : 'Nova área'}
            footer={<>{exists && <button className="btn danger" onClick={remove}><Icon name="trash" />Apagar</button>}<button className="btn ghost" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={save}>Salvar área</button></>}>
            <div className="grid cols-2">
                <label className="field"><span>Nome</span><input className="input" value={r.name} onChange={e => set({ name: e.target.value })} placeholder="Rota 1, Cidade Brasa…" /></label>
                <label className="field"><span>Tipo</span>
                    <select className="input" value={r.kind} onChange={e => set({ kind: e.target.value as RegionKind })}>{Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                </label>
                <label className="field"><span>Bioma</span><input className="input" value={r.biome} onChange={e => set({ biome: e.target.value })} placeholder="campo, vulcão, pântano…" /></label>
                <div className="field"><span>Serviços</span><div className="row"><Switch checked={r.pokemonCenter} onChange={v => set({ pokemonCenter: v })} label="Centro Pokémon" /><Switch checked={r.mart} onChange={v => set({ mart: v })} label="Poké Mart" /></div></div>
                <label className="field"><span>Posição horizontal ({r.x}%)</span><input type="range" min={4} max={96} value={r.x} onChange={e => set({ x: Number(e.target.value) })} /></label>
                <label className="field"><span>Posição vertical ({r.y}%)</span><input type="range" min={6} max={94} value={r.y} onChange={e => set({ y: Number(e.target.value) })} /></label>
            </div>
            <label className="field"><span>Descrição</span><textarea className="input" value={r.description} onChange={e => set({ description: e.target.value })} /></label>
            <div className="field"><span>Ligada a</span>
                <div className="chips">{campaign.regions.filter(x => x.id !== r.id).map(x => {
                    const on = r.connections.includes(x.id);
                    return <button key={x.id} type="button" className={'chip' + (on ? ' on' : '')} aria-pressed={on} onClick={() => set({ connections: on ? r.connections.filter(c => c !== x.id) : [...r.connections, x.id] })}>{x.name}</button>;
                })}</div>
            </div>
            <div className="field"><span>Obstáculos (habilidades de campo necessárias)</span>
                <div className="chips">{FIELD_SKILLS.map(s => {
                    const on = r.requires.includes(s.key);
                    return <button key={s.key} type="button" className={'chip' + (on ? ' on' : '')} aria-pressed={on} onClick={() => set({ requires: on ? r.requires.filter(c => c !== s.key) : [...r.requires, s.key] })}>{s.label}</button>;
                })}</div>
            </div>
            <div className="stack">
                <p className="eyebrow">Tabela de encontros (peso maior = mais comum)</p>
                {r.encounters.map((e, i) => (
                    <div key={i} className="row card flat" style={{ padding: 8 }}>
                        <img src={sprite(speciesById(e.pokemonId)?.dex ?? 0)} alt="" width={36} height={36} style={{ imageRendering: 'pixelated' }} />
                        <strong style={{ minWidth: 110 }}>{speciesById(e.pokemonId)?.name}</strong>
                        <label className="row tiny">Nv.<input className="input num" style={{ width: 64, minHeight: 32 }} type="number" min={1} max={100} value={e.minLevel} onChange={ev => updateEntry(i, { minLevel: Number(ev.target.value) })} />–<input className="input num" style={{ width: 64, minHeight: 32 }} type="number" min={1} max={100} value={e.maxLevel} onChange={ev => updateEntry(i, { maxLevel: Math.max(e.minLevel, Number(ev.target.value)) })} /></label>
                        <label className="row tiny">Peso<input className="input num" style={{ width: 64, minHeight: 32 }} type="number" min={1} max={100} value={e.weight} onChange={ev => updateEntry(i, { weight: Number(ev.target.value) })} /></label>
                        <select className="input" style={{ width: 'auto', minHeight: 32 }} value={e.weather ?? ''} onChange={ev => updateEntry(i, { weather: ev.target.value || null })} aria-label="Clima">
                            <option value="">qualquer clima</option>{WEATHERS.map(w => <option key={w}>{w}</option>)}
                        </select>
                        <button type="button" className="btn ghost icon small" aria-label="Remover" onClick={() => set({ encounters: r.encounters.filter((_, j) => j !== i) })}><Icon name="close" /></button>
                    </div>
                ))}
                <div className="row">
                    <select className="input" style={{ maxWidth: 280 }} value={pick} onChange={e => setPick(e.target.value)} aria-label="Pokémon para adicionar">
                        <option value="">Adicionar Pokémon…</option>
                        {SPECIES.map(s => <option key={s.id} value={s.id}>#{String(s.id).padStart(3, '0')} {s.name}</option>)}
                    </select>
                    <button type="button" className="btn" disabled={!pick} onClick={() => { set({ encounters: [...r.encounters, { pokemonId: Number(pick), minLevel: 3, maxLevel: 6, weight: 20, weather: null }] }); setPick(''); }}><Icon name="plus" />Adicionar</button>
                </div>
            </div>
        </Modal>
    );
}
