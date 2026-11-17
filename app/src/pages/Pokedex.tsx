import { useMemo, useState } from 'react';
import { abilityBySlug, artwork, SPECIES, type Species } from '../data';
import { useAuth } from '../lib/auth';
import { campaignId, useCampaign, useDex, type DexStatus } from '../lib/db';
import type { Campaign } from '../model';
import { STAT_KEYS, STAT_LABEL } from '../rules/stats';
import { classByKey } from '../rules/trainer';
import { defensiveProfile, TYPES, typeColor, typeLabel } from '../rules/types';
import { Bar, Empty, Modal, Tabs, TypeBadge } from '../ui/ui';

type Scope = 'regional' | 'iniciais' | 'todas';

export function rarityOf(weight: number, total: number) {
    const share = total > 0 ? weight / total : 0;
    return share >= 0.3 ? 'Comum' : share >= 0.1 ? 'Incomum' : 'Raro';
}

export function habitats(campaign: Campaign | null, pokemonId: number) {
    if (!campaign) return [];
    return campaign.regions.flatMap(region => {
        const total = region.encounters.reduce((s, e) => s + e.weight, 0);
        return region.encounters.filter(e => e.pokemonId === pokemonId).map(e => ({ region, entry: e, rarity: rarityOf(e.weight, total) }));
    });
}

export default function Pokedex() {
    const { user, profile, isProfessor } = useAuth();
    const dex = useDex(isProfessor ? undefined : user?.uid);
    const campaign = useCampaign(campaignId(profile?.campaign));
    const [scope, setScope] = useState<Scope>('regional');
    const [term, setTerm] = useState('');
    const [type, setType] = useState('');
    const [status, setStatus] = useState<'all' | DexStatus>('all');
    const [open, setOpen] = useState<Species | null>(null);
    const researcher = classByKey(profile?.trainerClass)?.effects.revealsWild;

    const statusOf = (s: Species): DexStatus => (isProfessor ? 'captured' : dex.get(s.id) ?? 'unknown');
    const list = useMemo(() => SPECIES.filter(s => scope === 'todas' || (scope === 'regional' ? s.regional : Boolean(s.starter))), [scope]);
    const captured = list.filter(s => statusOf(s) === 'captured').length;
    const sighted = list.filter(s => statusOf(s) === 'sighted').length;
    const q = term.trim().toLowerCase();
    const visible = list.filter(s => {
        const st = statusOf(s);
        if (status !== 'all' && st !== status) return false;
        if (type && (st === 'unknown' || !s.types.includes(type))) return false;
        if (!q) return true;
        if (/^#?\d+$/.test(q)) return s.id === Number(q.replace('#', ''));
        return st !== 'unknown' && s.name.toLowerCase().includes(q);
    });

    return (
        <div className="page">
            <div className="page-head">
                <div><p className="eyebrow">Pokédex {profile?.campaign ? '· Campanha ' + profile.campaign : ''}</p><h1>Pokédex</h1>
                    <p>{isProfessor ? `${list.length} espécies.` : `${captured} capturados · ${sighted} avistados · ${list.length} espécies.`} Locais e raridade vêm das tabelas de encontro do Mestre.</p></div>
                <Tabs label="Lista" value={scope} onChange={setScope} items={[{ value: 'regional', label: 'Regional' }, { value: 'iniciais', label: 'Iniciais' }, { value: 'todas', label: 'Todas' }]} />
            </div>
            <div className="row">
                <input className="input" style={{ maxWidth: 260 }} type="search" placeholder="Nome ou número…" value={term} onChange={e => setTerm(e.target.value)} aria-label="Buscar na Pokédex" />
                <select className="input" style={{ maxWidth: 180 }} value={type} onChange={e => setType(e.target.value)} aria-label="Filtrar por tipo">
                    <option value="">Todos os tipos</option>{TYPES.map(t => <option key={t} value={t}>{typeLabel(t)}</option>)}
                </select>
                {!isProfessor && (
                    <div className="chips" role="group" aria-label="Status">
                        {(['all', 'captured', 'sighted', 'unknown'] as const).map(s => (
                            <button key={s} className={'chip' + (status === s ? ' on' : '')} aria-pressed={status === s} onClick={() => setStatus(s)}>
                                {s === 'all' ? 'Todos' : s === 'captured' ? 'Capturados' : s === 'sighted' ? 'Avistados' : 'Desconhecidos'}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {visible.length === 0 ? <Empty icon="dex" title="Nenhum Pokémon com esse filtro" /> : (
                <div className="grid cols-4">
                    {visible.map(s => {
                        const st = statusOf(s);
                        return (
                            <button key={s.id} className="card stack" style={{ cursor: st === 'unknown' ? 'default' : 'pointer', justifyItems: 'center', textAlign: 'center', gap: 6, borderColor: st === 'captured' ? 'color-mix(in oklch, var(--action) 40%, transparent)' : undefined }}
                                onClick={() => st !== 'unknown' && setOpen(s)} aria-disabled={st === 'unknown'}>
                                <span className="tiny faint num" style={{ justifySelf: 'start' }}>#{String(s.id).padStart(3, '0')}{st === 'captured' && !isProfessor ? ' · capturado' : ''}</span>
                                <img src={artwork(s.dex)} alt="" loading="lazy" style={{ width: 110, height: 110, objectFit: 'contain', filter: st === 'unknown' ? 'brightness(0) drop-shadow(0 0 1px oklch(1 0 0 / .35))' : undefined }} />
                                <strong>{st === 'unknown' ? '???' : s.name}</strong>
                                <div className="row" style={{ justifyContent: 'center', gap: 4 }}>{st !== 'unknown' && s.types.map(t => <TypeBadge key={t} type={t} />)}</div>
                            </button>
                        );
                    })}
                </div>
            )}

            <Modal open={Boolean(open)} onClose={() => setOpen(null)} wide title={open?.name} subtitle={open ? `#${String(open.id).padStart(3, '0')} · nacional #${open.dex}` : ''}>
                {open && <SpeciesDetail s={open} campaign={campaign} full={isProfessor || statusOf(open) === 'captured' || Boolean(researcher)} />}
            </Modal>
        </div>
    );
}

function SpeciesDetail({ s, campaign, full }: { s: Species; campaign: Campaign | null; full: boolean }) {
    const places = habitats(campaign, s.id);
    const profile = defensiveProfile(s.types);
    return (
        <div className="grid cols-2">
            <div className="stack">
                <img src={artwork(s.dex)} alt="" style={{ width: 220, height: 220, objectFit: 'contain', justifySelf: 'center' }} />
                <div className="row">{s.types.map(t => <TypeBadge key={t} type={t} />)}{s.legendary && <span className="chip on">Lendário</span>}</div>
                <p className="muted">{s.description}</p>
                <dl className="kv">
                    <div><dt>Altura</dt><dd>{s.height} m</dd></div>
                    <div><dt>Peso</dt><dd>{s.weight} kg</dd></div>
                    <div><dt>Captura</dt><dd className="num">{s.captureRate}/255</dd></div>
                </dl>
            </div>
            <div className="stack">
                <p className="eyebrow">Onde encontrar</p>
                {places.length === 0 ? <p className="small muted">Ainda não aparece nas tabelas de encontro da campanha.</p> : (
                    <div className="stack" style={{ gap: 6 }}>
                        {places.map(({ region, entry, rarity }) => (
                            <div key={region.id} className="row between card flat" style={{ padding: '8px 12px' }}>
                                <span><strong>{region.name}</strong> <span className="tiny muted">{region.biome}</span></span>
                                <span className="row tiny"><span className="chip">{rarity}</span><span className="num muted">Nv. {entry.minLevel}–{entry.maxLevel}</span></span>
                            </div>
                        ))}
                    </div>
                )}
                <p className="eyebrow">Fraquezas</p>
                <div className="chips">{profile.weak.map(([t, m]) => <span key={t} className="chip" style={{ color: typeColor(t) }}>{typeLabel(t)} x{m}</span>)}</div>
                {full ? (
                    <>
                        <p className="eyebrow">Stats base</p>
                        <div className="stat-grid">
                            {STAT_KEYS.map(k => (
                                <div key={k} className="stat-line"><span>{STAT_LABEL[k]}</span><Bar ratio={s.base[k] / 180} label={STAT_LABEL[k]} /><span className="num" style={{ textAlign: 'right' }}>{s.base[k]}</span></div>
                            ))}
                        </div>
                        <p className="eyebrow">Habilidades</p>
                        <div className="stack" style={{ gap: 6 }}>
                            {s.abilities.map(a => (
                                <div key={a.slug} className="small"><strong>{abilityBySlug(a.slug)?.name ?? a.slug}</strong>{a.hidden && <span className="tiny faint"> (oculta)</span>} <span className="muted">{abilityBySlug(a.slug)?.effect}</span></div>
                            ))}
                        </div>
                    </>
                ) : <p className="small faint">Capture este Pokémon (ou jogue de Pesquisador) para ver stats e habilidades.</p>}
            </div>
        </div>
    );
}
