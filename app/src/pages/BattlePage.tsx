import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { moveBySlug, speciesById } from '../data';
import { useAuth } from '../lib/auth';
import { applyBattle, saveBattle, saveCampaign, submitAction, useActiveBattles, useBattle, useCampaign, useTrainer } from '../lib/db';
import { useToast } from '../lib/toast';
import type { PokemonInstance } from '../model';
import { activeOf, chooseEnemyMove, consumedItems, enemyPokemon, isAlive, needsSwitch, resolveRound, type Battle, type BattleTrainer, type PlayerAction } from '../rules/battle';
import { captureChance } from '../rules/capture';
import { itemBySlug } from '../rules/items';
import { displayName, statsOf } from '../rules/pokemon';
import { NATURES } from '../rules/stats';
import { classByKey } from '../rules/trainer';
import { effectiveness, effectivenessLabel } from '../rules/types';
import { Icon } from '../ui/icons';
import { MoveCard, Sprite } from '../ui/pokemon';
import { Empty, HpBar, Loading, StatusPill, TypeBadge } from '../ui/ui';

export default function BattlePage() {
    const { id } = useParams();
    return id ? <BattleView id={id} /> : <BattleList />;
}

function BattleList() {
    const { user, isProfessor } = useAuth();
    const battles = useActiveBattles(user?.uid, isProfessor);
    return (
        <div className="page">
            <div className="page-head"><div><p className="eyebrow">Combate</p><h1>Batalhas</h1><p>{isProfessor ? 'Crie batalhas pelo Mapa (encontros) ou pelos NPCs.' : 'Quando o Mestre iniciar uma batalha com você, ela aparece aqui.'}</p></div></div>
            {battles.length === 0 ? <Empty icon="battle" title="Nenhuma batalha em andamento" /> : (
                <div className="grid cols-3">
                    {battles.map(b => (
                        <Link key={b.id} to={'/batalha/' + b.id} className="card stack" style={{ textDecoration: 'none' }}>
                            <p className="eyebrow">{b.status === 'active' ? `Rodada ${b.round}` : 'Encerrada · aplicar resultado'}</p>
                            <h2>{b.enemy.kind === 'wild' ? 'Pokémon selvagem' : b.enemy.name}</h2>
                            <p className="small muted">{Object.values(b.trainers).map(t => t.name).join(', ')}</p>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}

function BattleView({ id }: { id: string }) {
    const { user, isProfessor } = useAuth();
    const battle = useBattle(id);
    const toast = useToast();
    const campaign = useCampaign(battle?.campaign);
    const [enemyAction, setEnemyAction] = useState<{ move: number; target: string | null } | null>(null);
    const [busy, setBusy] = useState(false);
    if (battle === undefined) return <Loading />;
    if (!battle) return <Empty icon="battle" title="Batalha não encontrada">Ela pode ter sido apagada, ou você não participa dela.</Empty>;

    const enemy = enemyPokemon(battle);
    const me = user ? battle.trainers[user.uid] : undefined;
    const researcher = isProfessor || Object.values(battle.trainers).some(t => t.uid === user?.uid && classByKey(t.classKey)?.effects.revealsWild);
    const pending = Object.values(battle.trainers).filter(t => !t.out && !battle.actions?.[t.uid]);

    async function resolve() {
        setBusy(true);
        try {
            const next = resolveRound({ ...battle!, actions: { ...battle!.actions, ...(enemyAction ? { enemy: enemyAction } : {}) } });
            await saveBattle(next);
            setEnemyAction(null);
        } catch {
            toast('Não foi possível resolver a rodada.', 'bad');
        }
        setBusy(false);
    }

    async function apply() {
        setBusy(true);
        try {
            await applyBattle(battle!);
            if (campaign) {
                const npcs = battle!.enemy.npcId && battle!.outcome === 'players'
                    ? campaign.npcs.map(n => n.id === battle!.enemy.npcId ? { ...n, visible: true, defeatedBy: [...new Set([...(n.defeatedBy ?? []), ...battle!.participants])] } : n)
                    : campaign.npcs;
                const what = battle!.outcome === 'captured' ? `${battle!.captures.map(c => displayName(c.pokemon)).join(', ')} foi capturado` : battle!.outcome === 'players' ? `vitória contra ${battle!.enemy.kind === 'wild' ? 'um selvagem' : battle!.enemy.name}` : battle!.outcome === 'fled' ? 'o grupo fugiu' : 'o grupo foi derrotado';
                await saveCampaign({ ...campaign, npcs, log: [...campaign.log, { at: Date.now(), text: 'Batalha: ' + what + '.' }] });
            }
            toast('Resultado aplicado nas fichas.', 'ok');
        } catch {
            toast('Não foi possível aplicar o resultado.', 'bad');
        }
        setBusy(false);
    }

    return (
        <div className="page">
            <div className="page-head">
                <div>
                    <p className="eyebrow">{battle.status === 'active' ? `Rodada ${battle.round}` : 'Batalha encerrada'} · {battle.enemy.kind === 'wild' ? 'encontro selvagem' : 'treinador ' + battle.enemy.name}</p>
                    <h1>{battle.status === 'active' ? 'Batalha' : outcomeLabel(battle)}</h1>
                </div>
                {isProfessor && battle.status === 'active' && (
                    <button className="btn ghost" onClick={async () => { if (confirm('Cancelar esta batalha sem aplicar nada?')) await saveBattle({ ...battle, status: 'ended', outcome: 'cancelled', applied: true }); }}>Cancelar batalha</button>
                )}
            </div>

            <section className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', alignItems: 'start' }}>
                <div className="card hero stack">
                    <p className="eyebrow">{battle.enemy.kind === 'wild' ? 'Selvagem' : battle.enemy.name} · {battle.enemy.team.filter(isAlive).length}/{battle.enemy.team.length} em pé</p>
                    {enemy ? <Combatant p={enemy} reveal={researcher} /> : <p className="muted">Sem Pokémon em campo.</p>}
                    {battle.enemy.kind === 'wild' && enemy && researcher && (
                        <p className="small muted">Chance de captura com Poké Ball agora: {captureChance({ captureRate: speciesById(enemy.pokemonId)?.captureRate ?? 45, maxHp: statsOf(enemy).hp, currentHp: enemy.currentHp, status: enemy.statusCondition, ballMultiplier: 1 })}%</p>
                    )}
                </div>
                <div className="stack">
                    {Object.values(battle.trainers).map(t => {
                        const p = activeOf(t);
                        return (
                            <div key={t.uid} className="card stack" style={{ borderColor: t.uid === user?.uid ? 'color-mix(in oklch, var(--action) 50%, transparent)' : undefined }}>
                                <div className="row between">
                                    <strong>{t.name}{classByKey(t.classKey) ? <span className="tiny muted"> · {classByKey(t.classKey)!.label}</span> : null}</strong>
                                    {battle.status === 'active' && <span className={'chip ' + (battle.actions?.[t.uid] ? 'on' : '')}>{t.out ? 'Fora' : battle.actions?.[t.uid] ? 'Pronto' : 'Escolhendo…'}</span>}
                                </div>
                                {p ? <Combatant p={p} reveal compact /> : <p className="small muted">Sem Pokémon em condição.</p>}
                            </div>
                        );
                    })}
                </div>
            </section>

            {battle.status === 'active' && me && !me.out && <ActionPanel battle={battle} trainer={me} />}
            {battle.status === 'active' && isProfessor && (
                <section className="card stack">
                    <div className="row between">
                        <h2>Mesa do Mestre</h2>
                        <span className="small muted">{pending.length ? `Aguardando: ${pending.map(t => t.name).join(', ')}` : 'Todos escolheram.'}</span>
                    </div>
                    {enemy && (
                        <div className="row">
                            <label className="field" style={{ minWidth: 220 }}><span>Golpe do inimigo</span>
                                <select className="input" value={enemyAction?.move ?? ''} onChange={e => setEnemyAction(e.target.value === '' ? null : { move: Number(e.target.value), target: enemyAction?.target ?? null })}>
                                    <option value="">Automático (melhor golpe)</option>
                                    {enemy.moves.map((m, i) => <option key={m.slug} value={i}>{moveBySlug(m.slug).name} (PP {m.pp})</option>)}
                                </select>
                            </label>
                            <label className="field" style={{ minWidth: 200 }}><span>Alvo</span>
                                <select className="input" value={enemyAction?.target ?? ''} onChange={e => setEnemyAction({ move: enemyAction?.move ?? chooseEnemyMove(battle).move, target: e.target.value || null })}>
                                    <option value="">Aleatório</option>
                                    {Object.values(battle.trainers).filter(t => isAlive(activeOf(t))).map(t => <option key={t.uid} value={t.uid}>{t.name}</option>)}
                                </select>
                            </label>
                            <button className="btn primary" style={{ alignSelf: 'end' }} disabled={busy} onClick={resolve}><Icon name="dice" />Resolver rodada</button>
                        </div>
                    )}
                    <details>
                        <summary className="small muted" style={{ cursor: 'pointer' }}>Escolher a ação por um jogador ausente</summary>
                        <div className="stack" style={{ marginTop: 12 }}>
                            {Object.values(battle.trainers).filter(t => !t.out).map(t => <ActionPanel key={t.uid} battle={battle} trainer={t} compact />)}
                        </div>
                    </details>
                </section>
            )}

            {battle.status === 'ended' && (
                <section className="card stack">
                    <h2>Resultado</h2>
                    {battle.captures.map(c => <p key={c.pokemon.uid}><strong>{battle.trainers[c.uid]?.name}</strong> capturou {displayName(c.pokemon)} (Nv. {c.pokemon.level}).</p>)}
                    {battle.xp.length > 0 && (
                        <div className="chips">{battle.xp.map((x, i) => <span key={i} className="chip">{x.name} +{x.amount} XP{x.levelsGained ? ` → Nv. ${x.newLevel}` : ''}{x.evolution ? ' · evolui!' : ''}</span>)}</div>
                    )}
                    {battle.outcome === 'players' && battle.enemy.kind === 'npc' && battle.enemy.reward > 0 && <p>Recompensa: ₽ {battle.enemy.reward} dividida entre o grupo{battle.enemy.badge ? ` e a ${battle.enemy.badge}` : ''}.</p>}
                    {isProfessor && !battle.applied && battle.outcome !== 'cancelled' && <button className="btn primary" style={{ justifySelf: 'start' }} disabled={busy} onClick={apply}>Aplicar nas fichas (HP, XP, capturas, itens, recompensa)</button>}
                    {battle.applied && <p className="small muted">Resultado já aplicado nas fichas.</p>}
                    {!isProfessor && !battle.applied && <p className="small muted">Aguardando o Mestre aplicar o resultado.</p>}
                </section>
            )}

            <section className="card stack">
                <h2>Registro</h2>
                <div className="log" aria-live="polite">
                    {[...battle.log].reverse().map((l, i) => <p key={battle.log.length - i} className={l.kind ?? ''}><span className="tiny faint">R{l.round} </span>{l.text}</p>)}
                </div>
            </section>
        </div>
    );
}

function outcomeLabel(b: Battle) {
    return { players: 'Vitória!', enemy: 'Derrota', captured: 'Capturado!', fled: 'Fuga', cancelled: 'Cancelada' }[b.outcome ?? 'cancelled'] ?? 'Encerrada';
}

function Combatant({ p, reveal, compact }: { p: PokemonInstance; reveal?: boolean; compact?: boolean }) {
    const species = speciesById(p.pokemonId);
    const max = statsOf(p).hp;
    return (
        <div className="row" style={{ alignItems: 'center', gap: 16 }}>
            <Sprite p={p} size={compact ? 'md' : 'lg'} />
            <div className="stack" style={{ flex: 1, gap: 6, minWidth: 160 }}>
                <div className="row between"><h3>{displayName(p)}{p.isShiny && <Icon name="star" className="shiny" />}</h3><span className="small muted num">Nv. {p.level}</span></div>
                <div className="row" style={{ gap: 4 }}>{species?.types.map(t => <TypeBadge key={t} type={t} />)}<StatusPill status={p.statusCondition} /></div>
                <HpBar current={p.currentHp} max={max} showText={reveal !== false} />
                {reveal && !compact && <p className="tiny muted">Natureza {NATURES.find(n => n.name === p.nature)?.label} · {p.ability.replace(/-/g, ' ')}</p>}
            </div>
        </div>
    );
}

function ActionPanel({ battle, trainer, compact }: { battle: Battle; trainer: BattleTrainer; compact?: boolean }) {
    const toast = useToast();
    const profile = useTrainer(trainer.uid);
    const current = battle.actions?.[trainer.uid] ?? null;
    const [draft, setDraft] = useState<PlayerAction>(current ?? {});
    const p = activeOf(trainer);
    const enemy = enemyPokemon(battle);
    const cls = classByKey(trainer.classKey);
    const forced = needsSwitch(trainer);
    const used = consumedItems(battle, trainer.uid);
    const bag = (profile?.bag ?? []).map(e => ({ ...e, quantity: e.quantity - used.filter(x => x === e.technicalName).length })).filter(e => e.quantity > 0);
    const balls = bag.filter(e => itemBySlug(e.technicalName)?.category === 'balls');
    const heals = bag.filter(e => ['healing', 'berries'].includes(itemBySlug(e.technicalName)?.category ?? ''));
    const reveal = cls?.effects.revealsWild;

    async function send(action: PlayerAction) {
        try {
            await submitAction(battle.id!, trainer.uid, action);
            toast('Ação enviada. Você pode mudar até o Mestre resolver a rodada.', 'ok');
        } catch {
            toast('Não foi possível enviar a ação.', 'bad');
        }
    }

    const describe = (a: PlayerAction | null) => {
        if (!a) return 'nenhuma';
        const parts = [];
        if (a.trainer?.type === 'switch') parts.push('trocar para ' + displayName(trainer.team[a.trainer.to]));
        if (a.trainer?.type === 'item') parts.push(itemBySlug(a.trainer.item)?.name + ' em ' + displayName(trainer.team[a.trainer.target]));
        if (a.trainer?.type === 'ball') parts.push('lançar ' + itemBySlug(a.trainer.item)?.name);
        if (a.trainer?.type === 'run') parts.push('fugir');
        if (a.command) parts.push(cls?.command.name);
        if (a.move !== null && a.move !== undefined && p) parts.push(moveBySlug(p.moves[a.move]?.slug ?? '').name);
        return parts.join(' + ') || 'nenhuma';
    };

    return (
        <section className="card stack" style={compact ? { boxShadow: 'none' } : undefined}>
            <div className="row between">
                <h2>{compact ? trainer.name : 'Sua ação'}</h2>
                <span className="small muted">Enviada: <strong>{describe(current)}</strong></span>
            </div>
            {forced && <p style={{ color: 'var(--bad-ink)' }}>Seu Pokémon caiu. Escolha outro para entrar.</p>}

            {!forced && p && (
                <div className="stack">
                    <p className="eyebrow">Golpe de {displayName(p)}</p>
                    <div className="grid cols-2">
                        {p.moves.map((m, i) => {
                            const move = moveBySlug(m.slug);
                            const mult = enemy ? effectiveness(move.type, speciesById(enemy.pokemonId)?.types ?? []) : 1;
                            return (
                                <MoveCard key={m.slug} move={move} pp={m.pp} disabled={m.pp <= 0}
                                    onClick={() => setDraft({ ...draft, move: draft.move === i ? null : i, trainer: draft.trainer?.type === 'switch' ? null : draft.trainer })}>
                                    <span className="row tiny" style={{ gap: 6 }}>
                                        {draft.move === i && <span className="chip on">Escolhido</span>}
                                        {reveal && move.cls !== 'status' && effectivenessLabel(mult) && <span className="chip">{effectivenessLabel(mult)}</span>}
                                    </span>
                                </MoveCard>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="grid cols-3">
                <div className="stack" style={{ gap: 6 }}>
                    <p className="eyebrow">Trocar Pokémon</p>
                    <div className="chips">
                        {trainer.team.map((x, i) => i === trainer.active || !isAlive(x) ? null : (
                            <button key={x.uid} className={'chip' + (draft.trainer?.type === 'switch' && draft.trainer.to === i ? ' on' : '')}
                                onClick={() => setDraft({ ...draft, move: null, trainer: draft.trainer?.type === 'switch' && draft.trainer.to === i ? null : { type: 'switch', to: i } })}>
                                {displayName(x)} <span className="num tiny">{x.currentHp}/{statsOf(x).hp}</span>
                            </button>
                        ))}
                    </div>
                </div>
                {!forced && (
                    <div className="stack" style={{ gap: 6 }}>
                        <p className="eyebrow">Usar item</p>
                        {heals.length === 0 ? <span className="tiny muted">Sem itens de cura.</span> : (
                            <select className="input" value={draft.trainer?.type === 'item' ? `${draft.trainer.item}|${draft.trainer.target}` : ''}
                                onChange={e => { const [item, target] = e.target.value.split('|'); setDraft({ ...draft, trainer: item ? { type: 'item', item, target: Number(target) } : null }); }}>
                                <option value="">—</option>
                                {heals.flatMap(h => trainer.team.map((x, i) => <option key={h.technicalName + i} value={`${h.technicalName}|${i}`}>{itemBySlug(h.technicalName)?.name} (x{h.quantity}) → {displayName(x)}</option>))}
                            </select>
                        )}
                    </div>
                )}
                {!forced && battle.enemy.kind === 'wild' && (
                    <div className="stack" style={{ gap: 6 }}>
                        <p className="eyebrow">Capturar ou fugir</p>
                        <div className="chips">
                            {balls.map(b => (
                                <button key={b.technicalName} className={'chip' + (draft.trainer?.type === 'ball' && draft.trainer.item === b.technicalName ? ' on' : '')}
                                    onClick={() => setDraft({ ...draft, trainer: draft.trainer?.type === 'ball' && draft.trainer.item === b.technicalName ? null : { type: 'ball', item: b.technicalName } })}>
                                    <Icon name="ball" />{itemBySlug(b.technicalName)?.name} x{b.quantity}
                                </button>
                            ))}
                            <button className={'chip' + (draft.trainer?.type === 'run' ? ' on' : '')} onClick={() => setDraft({ ...draft, trainer: draft.trainer?.type === 'run' ? null : { type: 'run' } })}><Icon name="run" />Fugir</button>
                        </div>
                        {balls.length === 0 && <span className="tiny muted">Sem Pokébolas na mochila.</span>}
                    </div>
                )}
            </div>

            {cls && !trainer.commandUsed && !forced && (
                <label className="row small" style={{ cursor: 'pointer' }}>
                    <input type="checkbox" checked={Boolean(draft.command)} onChange={e => setDraft({ ...draft, command: e.target.checked })} />
                    <span><strong>{cls.command.name}</strong> (ação bônus, 1x por batalha) — <span className="muted">{cls.command.description.replace('Uma vez por batalha: ', '')}</span></span>
                </label>
            )}

            <div className="row" style={{ justifyContent: 'flex-end' }}>
                <span className="tiny muted" style={{ marginRight: 'auto' }}>Ação do treinador (item, troca, Pokébola, fuga) acontece antes dos golpes. Trocar ocupa o turno do Pokémon.</span>
                <button className="btn primary" disabled={forced ? draft.trainer?.type !== 'switch' : draft.move == null && !draft.trainer && !draft.command} onClick={() => send(draft)}>Confirmar ação</button>
            </div>
        </section>
    );
}
