import { useState } from 'react';
import { abilityBySlug, artwork, moveBySlug, speciesById, sprite, type Move } from '../data';
import type { PokemonInstance } from '../model';
import { RULES } from '../rules/config';
import { displayName, evolutionAvailable, evolve, statsOf } from '../rules/pokemon';
import { natureByName, STAT_KEYS, STAT_LABEL } from '../rules/stats';
import { STATUS_RULE } from '../rules/status';
import { defensiveProfile, typeColor, typeLabel } from '../rules/types';
import { levelProgress } from '../rules/xp';
import { Icon } from './icons';
import { Bar, HpBar, StatusPill, Tabs, TypeBadge } from './ui';

export function Sprite({ p, size = 'md' }: { p: Pick<PokemonInstance, 'pokemonId' | 'isShiny'>; size?: 'md' | 'lg' }) {
    const species = speciesById(p.pokemonId);
    if (!species) return <div className="sprite-box" />;
    return (
        <div className={'sprite-box ' + (size === 'lg' ? 'lg' : '')}>
            <img className="sprite" src={size === 'lg' ? artwork(species.dex, p.isShiny) : sprite(species.dex, p.isShiny)} alt="" loading="lazy" />
        </div>
    );
}

export function MonCard({ p, onClick, selected, extra }: { p: PokemonInstance; onClick?: () => void; selected?: boolean; extra?: React.ReactNode }) {
    const species = speciesById(p.pokemonId);
    const max = statsOf(p).hp;
    const xp = species ? levelProgress(species.growth, p.xp) : null;
    return (
        <button type="button" className={'mon' + (p.statusCondition === 'fainted' ? ' fainted' : '') + (selected ? ' selected' : '')} onClick={onClick}>
            <Sprite p={p} />
            <div className="stack" style={{ gap: 5, minWidth: 0 }}>
                <div className="row between" style={{ flexWrap: 'nowrap' }}>
                    <span className="mon-name">
                        <strong>{displayName(p)}</strong>
                        {p.isShiny && <Icon name="star" className="shiny" />}
                    </span>
                    <span className="tiny muted num">Nv. {p.level}</span>
                </div>
                <div className="row" style={{ gap: 4 }}>
                    {species?.types.map(t => <TypeBadge key={t} type={t} />)}
                    <StatusPill status={p.statusCondition} />
                    {p.pendingEvolution ? <span className="chip on tiny">Evoluir!</span> : null}
                </div>
                <HpBar current={p.currentHp} max={max} />
                {xp && <Bar kind="xp" ratio={xp.ratio} label="Experiência" />}
                {extra}
            </div>
        </button>
    );
}

export function MoveCard({ move, pp, onClick, disabled, children }: { move: Move; pp?: number; onClick?: () => void; disabled?: boolean; children?: React.ReactNode }) {
    const body = (
        <>
            <div className="move-head">
                <span>{move.name}</span>
                {pp !== undefined && <span className="tiny muted num">PP {pp}/{move.pp}</span>}
            </div>
            <div className="row tiny muted" style={{ gap: 8 }}>
                <span style={{ color: typeColor(move.type), fontWeight: 700 }}>{typeLabel(move.type)}</span>
                <span>{move.cls === 'physical' ? 'Físico' : move.cls === 'special' ? 'Especial' : 'Status'}</span>
                {move.power ? <span className="num">Poder {move.power}</span> : null}
                <span className="num">Precisão {move.accuracy ?? '—'}</span>
            </div>
            {move.effect && <p className="tiny faint">{move.effect}</p>}
            {children}
        </>
    );
    const style = { '--mt': typeColor(move.type) } as React.CSSProperties;
    return onClick ? <button type="button" className="move" style={style} onClick={onClick} disabled={disabled}>{body}</button> : <div className="move" style={style}>{body}</div>;
}

export interface DetailActions {
    onChange?: (next: PokemonInstance) => void;   // salvar alterações (apelido, golpes, evolução)
    allowEvolve?: boolean;
}

/** Conteúdo completo da ficha de um Pokémon (usado dentro de um Modal). */
export function PokemonDetail({ p, actions, reveal = true }: { p: PokemonInstance; actions?: DetailActions; reveal?: boolean }) {
    const [tab, setTab] = useState<'resumo' | 'golpes' | 'evolucao'>('resumo');
    const [nickname, setNickname] = useState(p.nickname ?? '');
    const species = speciesById(p.pokemonId);
    if (!species) return <p>Espécie desconhecida.</p>;
    const stats = statsOf(p);
    const nature = natureByName(p.nature);
    const ability = abilityBySlug(p.ability);
    const xp = levelProgress(species.growth, p.xp);
    const evolutionTo = p.pendingEvolution ?? evolutionAvailable(p, 'level');
    const learnable = species.learnset.filter(m => m.level <= p.level && !p.moves.some(x => x.slug === m.move));
    const profile = defensiveProfile(species.types);

    return (
        <div className="stack" style={{ gap: 18 }}>
            <div className="row" style={{ alignItems: 'flex-start', gap: 20 }}>
                <Sprite p={p} size="lg" />
                <div className="stack" style={{ flex: 1, minWidth: 220 }}>
                    <div className="row">{species.types.map(t => <TypeBadge key={t} type={t} />)}<StatusPill status={p.statusCondition} /></div>
                    <p className="muted small">#{String(species.dex).padStart(4, '0')} {species.name} · {species.height} m · {species.weight} kg</p>
                    <HpBar current={p.currentHp} max={stats.hp} />
                    <div className="stack" style={{ gap: 3 }}>
                        <Bar kind="xp" ratio={xp.ratio} label="Experiência" />
                        <span className="tiny muted num">Nv. {p.level} · {xp.level >= 100 ? 'nível máximo' : `${xp.current}/${xp.needed} XP para o próximo nível`}</span>
                    </div>
                    <dl className="kv">
                        <div><dt>Natureza</dt><dd>{nature.label}{nature.up && <span className="tiny muted"> +{STAT_LABEL[nature.up]} −{STAT_LABEL[nature.down!]}</span>}</dd></div>
                        <div><dt>Habilidade</dt><dd>{ability?.name ?? '—'}</dd></div>
                        <div><dt>Amizade</dt><dd className="num">{p.friendship}/{RULES.friendship.max}</dd></div>
                    </dl>
                    {p.statusCondition !== 'none' && p.statusCondition !== 'fainted' && <p className="tiny muted">{STATUS_RULE[p.statusCondition]}</p>}
                </div>
            </div>

            <Tabs label="Seções do Pokémon" value={tab} onChange={setTab} items={[
                { value: 'resumo', label: 'Stats' },
                { value: 'golpes', label: `Golpes (${p.moves.length}/4)` },
                { value: 'evolucao', label: 'Evolução' }
            ]} />

            {tab === 'resumo' && (
                <div className="grid cols-2">
                    <div className="stat-grid">
                        {STAT_KEYS.map(key => {
                            const mod = key !== 'hp' && nature.up === key ? 'up' : key !== 'hp' && nature.down === key ? 'down' : '';
                            return (
                                <div key={key} className="stat-line">
                                    <span className={mod}>{STAT_LABEL[key]}{mod === 'up' ? ' ▲' : mod === 'down' ? ' ▼' : ''}</span>
                                    <Bar ratio={stats[key] / Math.max(stats.hp, 200)} label={STAT_LABEL[key]} />
                                    <span className="num" style={{ textAlign: 'right' }}>{stats[key]}</span>
                                </div>
                            );
                        })}
                        <p className="tiny faint">Base da espécie: {STAT_KEYS.map(k => species.base[k]).join(' / ')}</p>
                    </div>
                    <div className="stack">
                        {ability && <div className="card flat"><p className="eyebrow">Habilidade</p><strong>{ability.name}</strong><p className="small muted">{ability.effect}</p></div>}
                        {reveal && (
                            <div className="card flat stack">
                                <p className="eyebrow">Fraquezas e resistências</p>
                                <div className="chips">{profile.weak.map(([t, m]) => <span key={t} className="chip" style={{ color: typeColor(t) }}>{typeLabel(t)} x{m}</span>)}</div>
                                <div className="chips">{profile.resist.map(([t, m]) => <span key={t} className="chip">{typeLabel(t)} x{m}</span>)}{profile.immune.map(t => <span key={t} className="chip">{typeLabel(t)} x0</span>)}</div>
                            </div>
                        )}
                        <p className="small muted">{species.description}</p>
                    </div>
                </div>
            )}

            {tab === 'golpes' && (
                <div className="stack">
                    <div className="grid cols-2">
                        {p.moves.map(slot => (
                            <MoveCard key={slot.slug} move={moveBySlug(slot.slug)} pp={slot.pp}>
                                {actions?.onChange && p.moves.length > 1 && (
                                    <button className="btn ghost small" style={{ justifySelf: 'start' }} onClick={() => actions.onChange!({ ...p, moves: p.moves.filter(m => m.slug !== slot.slug) })}>Esquecer</button>
                                )}
                            </MoveCard>
                        ))}
                    </div>
                    {actions?.onChange && learnable.length > 0 && (
                        <>
                            <p className="eyebrow">Golpes que pode aprender {p.moves.length >= 4 && '(esqueça um golpe para liberar espaço)'}</p>
                            <div className="grid cols-2">
                                {learnable.map(m => (
                                    <MoveCard key={m.move} move={moveBySlug(m.move)} disabled={p.moves.length >= 4}
                                        onClick={() => actions.onChange!({ ...p, moves: [...p.moves, { slug: m.move, pp: moveBySlug(m.move).pp }] })}>
                                        <span className="tiny muted">Nível {m.level || 1} · clique para aprender</span>
                                    </MoveCard>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            {tab === 'evolucao' && (
                <div className="stack">
                    {species.evolutions.length === 0 && <p className="muted">{species.name} não evolui.</p>}
                    {species.evolutions.map(evo => {
                        const ready = evo.to !== null && evo.to === evolutionTo;
                        const how = evo.trigger === 'level' ? `Nível ${evo.minLevel}` : evo.trigger === 'item' ? `Item: ${evo.item?.replace(/-/g, ' ')}` : evo.trigger === 'friendship' ? `Amizade ${RULES.friendship.evolve}+ ao subir de nível` : evo.trigger === 'trade' ? 'Troca (o Mestre confirma)' : 'Condição especial (o Mestre decide)';
                        return (
                            <div key={evo.toDex} className="card flat row between">
                                <div className="row">
                                    {evo.to !== null ? <Sprite p={{ pokemonId: evo.to, isShiny: p.isShiny }} /> : <div className="sprite-box" />}
                                    <div>
                                        <strong>{evo.toName}</strong>
                                        <p className="small muted">{how}{evo.to === null && ' · fora da Pokédex desta campanha'}</p>
                                    </div>
                                </div>
                                {actions?.onChange && actions.allowEvolve && ready && (
                                    <div className="row">
                                        <button className="btn ghost small" onClick={() => actions.onChange!({ ...p, pendingEvolution: null })}>Agora não</button>
                                        <button className="btn primary small" onClick={() => actions.onChange!(evolve(p, evo.to!))}>Evoluir</button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {actions?.onChange && (
                <form className="row" onSubmit={e => { e.preventDefault(); actions.onChange!({ ...p, nickname: nickname.trim() || undefined }); }}>
                    <label className="field" style={{ flex: 1 }}>
                        <span>Apelido</span>
                        <input className="input" value={nickname} maxLength={20} placeholder={species.name} onChange={e => setNickname(e.target.value)} />
                    </label>
                    <button className="btn" style={{ alignSelf: 'end' }} disabled={(p.nickname ?? '') === nickname.trim()}>Salvar apelido</button>
                </form>
            )}
        </div>
    );
}
