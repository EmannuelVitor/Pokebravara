// Motor de batalha por turnos. Função pura: recebe o estado + ações e devolve o novo estado e o registro.
// O Mestre aperta "Resolver rodada"; jogadores só escolhem ações. Tudo aqui pode ser testado sem Firebase.
import { moveBySlug, speciesById, STRUGGLE, type Move } from '../data';
import type { PokemonInstance } from '../model';
import { attemptCapture } from './capture';
import { RULES } from './config';
import { calcDamage, hits } from './damage';
import { randomInt, rollDie, type Rng } from './dice';
import { itemBySlug } from './items';
import { createPokemon, displayName, evolutionAvailable, gainXp, statsOf, useItemOn } from './pokemon';
import { stageMultiplier, type BattleStat, type Stats } from './stats';
import { ailmentToStatus, canAct, endOfTurnDamage, immuneToStatus, STATUS_LABEL } from './status';
import { classByKey } from './trainer';
import { effectiveness, effectivenessLabel } from './types';
import { splitXp } from './xp';

export type Stages = Record<BattleStat | 'acc' | 'eva', number>;
const zeroStages = (): Stages => ({ atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 });

export interface BattleTrainer {
    uid: string;
    name: string;
    classKey: string | null;
    agility: number;
    team: PokemonInstance[];
    active: number;           // índice no time; -1 = sem Pokémon em condição
    commandUsed: boolean;
    sureHit: boolean;
    out: boolean;
}

export interface BattleEnemy {
    kind: 'wild' | 'npc';
    name: string;
    npcId: string | null;
    reward: number;
    badge: string | null;
    team: PokemonInstance[];
    active: number;
}

export interface PlayerAction {
    move?: number | null;     // índice do golpe do Pokémon ativo
    target?: string | null;   // (inimigo) uid do treinador alvo
    trainer?: { type: 'item'; item: string; target: number } | { type: 'switch'; to: number } | { type: 'ball'; item: string } | { type: 'run' } | null;
    command?: boolean;
}

export interface CaptureRecord {
    uid: string;              // treinador que capturou
    pokemon: PokemonInstance;
}

export interface XpRecord {
    uid: string;              // treinador
    pokemonUid: string;
    name: string;
    amount: number;
    levelsGained: number;
    newLevel: number;
    learned: string[];
    canLearn: string[];
    evolution: number | null;
}

export interface Battle {
    id?: string;
    campaign: string;
    status: 'active' | 'ended';
    outcome: 'players' | 'enemy' | 'captured' | 'fled' | 'cancelled' | null;
    round: number;
    createdBy: string;
    createdAt: number;
    participants: string[];
    trainers: Record<string, BattleTrainer>;
    enemy: BattleEnemy;
    stages: Record<string, Stages>;
    /** Pokémon dos jogadores que enfrentaram cada inimigo (para dividir XP). */
    fought: Record<string, string[]>;
    actions: Record<string, PlayerAction | null>;
    log: { round: number; text: string; kind?: 'hit' | 'faint' | 'info' | 'capture' | 'xp' | 'status' }[];
    captures: CaptureRecord[];
    xp: XpRecord[];
    seen: number[];           // espécies vistas (Pokédex)
    consumed: Record<string, string[]>; // itens gastos por treinador
    applied: boolean;
}

// ----------------------------------------------------------------- criação
export function createBattle(input: {
    campaign: string;
    createdBy: string;
    trainers: { uid: string; name: string; classKey: string | null; agility: number; team: PokemonInstance[] }[];
    enemy: Omit<BattleEnemy, 'active'>;
}): Battle {
    const trainers: Record<string, BattleTrainer> = {};
    for (const t of input.trainers) {
        const active = t.team.findIndex(p => p.statusCondition !== 'fainted' && p.currentHp > 0);
        trainers[t.uid] = { ...t, team: t.team.map(p => ({ ...p })), active, commandUsed: false, sureHit: false, out: active < 0 };
    }
    const enemyActive = input.enemy.team.findIndex(p => p.currentHp > 0);
    const battle: Battle = {
        campaign: input.campaign,
        status: 'active',
        outcome: null,
        round: 1,
        createdBy: input.createdBy,
        createdAt: Date.now(),
        participants: input.trainers.map(t => t.uid),
        trainers,
        enemy: { ...input.enemy, team: input.enemy.team.map(p => ({ ...p })), active: enemyActive },
        stages: {},
        fought: {},
        actions: {},
        log: [],
        captures: [],
        xp: [],
        seen: [],
        consumed: {},
        applied: false
    };
    const first = enemyPokemon(battle);
    if (first) {
        battle.log.push({ round: 1, kind: 'info', text: input.enemy.kind === 'wild' ? `Um ${displayName(first)} selvagem (Nv. ${first.level}) apareceu!` : `${input.enemy.name} enviou ${displayName(first)} (Nv. ${first.level})!` });
        battle.seen = [first.pokemonId];
    }
    markFought(battle);
    return battle;
}

/** Gera o Pokémon de um encontro selvagem. */
export function wildPokemon(pokemonId: number, level: number, rng?: Rng): PokemonInstance {
    const p = createPokemon(pokemonId, level, { rng, isShiny: (rng ?? Math.random)() < 1 / 512 });
    return p;
}

// ----------------------------------------------------------------- consultas
export const enemyPokemon = (b: Battle): PokemonInstance | null => (b.enemy.active >= 0 ? b.enemy.team[b.enemy.active] ?? null : null);
export const activeOf = (t: BattleTrainer): PokemonInstance | null => (t.active >= 0 ? t.team[t.active] ?? null : null);
const stagesOf = (b: Battle, p: PokemonInstance) => (b.stages[p.uid] ??= zeroStages());
const alive = (p: PokemonInstance | null | undefined) => Boolean(p && p.currentHp > 0 && p.statusCondition !== 'fainted');

function effectiveStats(b: Battle, p: PokemonInstance, owner: BattleTrainer | null): Stats {
    const base = statsOf(p);
    const stages = stagesOf(b, p);
    const bonus = 1 + (classByKey(owner?.classKey)?.effects.statBonus ?? 0);
    return {
        hp: base.hp,
        atk: Math.floor(base.atk * stageMultiplier(stages.atk) * bonus),
        def: Math.floor(base.def * stageMultiplier(stages.def) * bonus),
        spa: Math.floor(base.spa * stageMultiplier(stages.spa) * bonus),
        spd: Math.floor(base.spd * stageMultiplier(stages.spd) * bonus),
        spe: Math.floor(base.spe * stageMultiplier(stages.spe) * bonus * (p.statusCondition === 'paralysis' ? 0.5 : 1))
    };
}

/** Iniciativa: Velocidade efetiva + Agilidade do treinador x RULES.battle.agilityInitiative. */
export function initiative(b: Battle, p: PokemonInstance, owner: BattleTrainer | null): number {
    return effectiveStats(b, p, owner).spe + (owner ? owner.agility * RULES.battle.agilityInitiative : 0);
}

function markFought(b: Battle) {
    const enemy = enemyPokemon(b);
    if (!enemy) return;
    const list = (b.fought[enemy.uid] ??= []);
    for (const t of Object.values(b.trainers)) {
        const p = activeOf(t);
        if (alive(p) && !list.includes(p!.uid)) list.push(p!.uid);
    }
}

const say = (b: Battle, text: string, kind: Battle['log'][number]['kind'] = 'info') => b.log.push({ round: b.round, text, kind });

/** Golpe que o inimigo usaria: o de maior dano esperado contra o alvo, com um pouco de acaso. */
export function chooseEnemyMove(b: Battle, rng: Rng = Math.random): { move: number; target: string | null } {
    const enemy = enemyPokemon(b);
    const targets = Object.values(b.trainers).filter(t => alive(activeOf(t)));
    if (!enemy || !targets.length) return { move: 0, target: null };
    const target = targets[randomInt(0, targets.length - 1, rng)];
    const defender = activeOf(target)!;
    const defTypes = speciesById(defender.pokemonId)?.types ?? [];
    const scored = enemy.moves.map((slot, index) => {
        const move = moveBySlug(slot.slug);
        const power = slot.pp > 0 ? (move.power ?? 20) : 0;
        return { index, score: power * effectiveness(move.type, defTypes) * (0.75 + rng() * 0.5) };
    });
    scored.sort((a, b) => b.score - a.score);
    return { move: scored[0]?.index ?? 0, target: target.uid };
}

// ----------------------------------------------------------------- resolução
export function resolveRound(input: Battle, rng: Rng = Math.random): Battle {
    const b: Battle = structuredClone(input);
    if (b.status !== 'active') return b;
    const actions = b.actions;
    const switched = new Set<string>();

    // 1) Ações de treinador (item, troca, Pokébola, fugir) — acontecem antes dos golpes.
    for (const t of Object.values(b.trainers)) {
        const act = actions[t.uid]?.trainer;
        if (!act || t.out) continue;
        if (act.type === 'switch') {
            const next = t.team[act.to];
            if (alive(next) && act.to !== t.active) {
                const prev = activeOf(t);
                if (prev) b.stages[prev.uid] = zeroStages();
                t.active = act.to;
                switched.add(t.uid);
                say(b, `${t.name} chamou ${prev ? displayName(prev) : ''} de volta e enviou ${displayName(next)}!`);
            }
        } else if (act.type === 'item') {
            const target = t.team[act.target];
            if (target) {
                const used = useItemOn(target, act.item);
                if (used.ok) t.team[act.target] = used.pokemon;
                say(b, `${t.name}: ${used.message}`, used.ok ? 'info' : 'status');
                if (used.ok) consume(b, t.uid, act.item);
            }
        } else if (act.type === 'ball') {
            consume(b, t.uid, act.item);
            const enemy = enemyPokemon(b);
            if (b.enemy.kind !== 'wild' || !enemy) {
                say(b, 'Não dá para capturar o Pokémon de outro treinador!', 'status');
                continue;
            }
            const species = speciesById(enemy.pokemonId);
            const ball = itemBySlug(act.item);
            const result = attemptCapture({
                captureRate: species?.captureRate ?? 45,
                maxHp: statsOf(enemy).hp,
                currentHp: enemy.currentHp,
                status: enemy.statusCondition,
                ballMultiplier: ball?.ballMultiplier ?? 1,
                classBonus: classByKey(t.classKey)?.effects.captureBonus ?? 0
            }, rng);
            say(b, `${t.name} lançou uma ${ball?.name ?? 'Pokébola'}! ${result.breakdown}`, 'capture');
            if (result.success) {
                say(b, `Peguei! ${displayName(enemy)} foi capturado por ${t.name}!`, 'capture');
                b.captures.push({ uid: t.uid, pokemon: { ...enemy, caughtBy: t.uid, caughtAt: Date.now(), friendship: RULES.friendship.start } });
                awardXp(b, enemy, null);
                return finish(b, 'captured');
            }
            say(b, `${displayName(enemy)} escapou da Pokébola!`, 'capture');
        } else if (act.type === 'run') {
            if (b.enemy.kind !== 'wild') { say(b, 'Não dá para fugir de uma batalha contra treinador!', 'status'); continue; }
            const enemy = enemyPokemon(b);
            const mine = activeOf(t);
            const d = rollDie(20, rng) + t.agility;
            const fast = mine && enemy && initiative(b, mine, t) >= initiative(b, enemy, null);
            if (fast || d >= 12) {
                say(b, `${t.name} fugiu com o grupo! (1d20+${t.agility} = ${d}${fast ? ', mais rápido' : ''})`);
                return finish(b, 'fled');
            }
            say(b, `${t.name} tentou fugir, mas não conseguiu (1d20+${t.agility} = ${d}).`, 'status');
        }
    }

    // 2) Comandos de classe (ação bônus, 1x por batalha).
    for (const t of Object.values(b.trainers)) {
        if (!actions[t.uid]?.command || t.commandUsed || t.out) continue;
        const cls = classByKey(t.classKey);
        const p = activeOf(t);
        if (!cls || !alive(p)) continue;
        t.commandUsed = true;
        const st = stagesOf(b, p!);
        if (cls.effects.commandStat === 'atk') { st.atk = Math.min(6, st.atk + 1); st.spa = Math.min(6, st.spa + 1); }
        if (cls.effects.commandStat === 'spe') st.spe = Math.min(6, st.spe + 1);
        if (cls.effects.commandStat === 'accuracy') t.sureHit = true;
        if (cls.effects.commandStat === 'heal') {
            const max = statsOf(p!).hp;
            p!.currentHp = Math.min(max, p!.currentHp + Math.ceil(max * 0.2));
        }
        say(b, `${t.name} usou ${cls.command.name}! ${cls.command.description.replace('Uma vez por batalha: ', '')}`);
    }

    // 3) Golpes, por prioridade e iniciativa.
    interface Turn { side: 'player' | 'enemy'; trainer: BattleTrainer | null; pokemon: PokemonInstance; moveIndex: number; target: string | null; order: number; priority: number }
    const turns: Turn[] = [];
    for (const t of Object.values(b.trainers)) {
        const p = activeOf(t);
        const act = actions[t.uid];
        if (t.out || !alive(p) || switched.has(t.uid) || act?.move === null || act?.move === undefined) continue;
        const move = p!.moves[act.move] ? moveBySlug(p!.moves[act.move].slug) : STRUGGLE;
        turns.push({ side: 'player', trainer: t, pokemon: p!, moveIndex: act.move, target: null, priority: move.priority, order: initiative(b, p!, t) + rng() });
    }
    const enemy = enemyPokemon(b);
    if (alive(enemy)) {
        const act = actions.enemy ?? chooseEnemyMove(b, rng);
        const moveIndex = act.move ?? 0;
        const move = enemy!.moves[moveIndex] ? moveBySlug(enemy!.moves[moveIndex].slug) : STRUGGLE;
        turns.push({ side: 'enemy', trainer: null, pokemon: enemy!, moveIndex, target: act.target ?? null, priority: move.priority, order: initiative(b, enemy!, null) + rng() });
    }
    turns.sort((x, y) => y.priority - x.priority || y.order - x.order);

    for (const turn of turns) {
        if (b.status !== 'active') break;
        if (!alive(turn.pokemon)) continue;
        // alvo atual
        let defender: PokemonInstance | null;
        let defenderOwner: BattleTrainer | null = null;
        if (turn.side === 'player') {
            defender = enemyPokemon(b);
        } else {
            const candidates = Object.values(b.trainers).filter(t => alive(activeOf(t)));
            defenderOwner = candidates.find(t => t.uid === turn.target) ?? candidates[randomInt(0, Math.max(0, candidates.length - 1), rng)] ?? null;
            defender = defenderOwner ? activeOf(defenderOwner) : null;
        }
        if (!alive(defender)) continue;
        useMove(b, turn.pokemon, turn.trainer, turn.moveIndex, defender!, defenderOwner, rng);
        if (turn.side === 'player' && !alive(enemyPokemon(b))) handleEnemyFaint(b, turn.pokemon.uid);
        if (turn.side === 'enemy' && defenderOwner && !alive(defender)) handlePlayerFaint(b, defenderOwner);
        if (!alive(turn.pokemon)) {
            if (turn.side === 'player' && turn.trainer) handlePlayerFaint(b, turn.trainer);
            else handleEnemyFaint(b, null);
        }
    }

    // 4) Fim da rodada: queimadura e veneno.
    if (b.status === 'active') {
        const everyone: { p: PokemonInstance; owner: BattleTrainer | null }[] = Object.values(b.trainers).map(t => ({ p: activeOf(t)!, owner: t }));
        everyone.push({ p: enemyPokemon(b)!, owner: null });
        for (const { p, owner } of everyone) {
            if (!alive(p)) continue;
            const dmg = endOfTurnDamage(p.statusCondition, statsOf(p).hp);
            if (!dmg) continue;
            p.currentHp = Math.max(0, p.currentHp - dmg);
            say(b, `${displayName(p)} sofreu ${dmg} de dano por estar ${STATUS_LABEL[p.statusCondition].toLowerCase()}.`, 'status');
            if (p.currentHp === 0) {
                if (owner) handlePlayerFaint(b, owner, p);
                else handleEnemyFaint(b, null);
            }
        }
    }

    if (b.status === 'active') {
        b.round += 1;
        markFought(b);
    }
    b.actions = {};
    return b;
}

function consume(b: Battle, uid: string, item: string) {
    (b.consumed[uid] ??= []).push(item);
}

function useMove(b: Battle, attacker: PokemonInstance, owner: BattleTrainer | null, moveIndex: number, defender: PokemonInstance, defenderOwner: BattleTrainer | null, rng: Rng) {
    const name = displayName(attacker);
    const check = canAct(attacker.statusCondition, attacker.sleepTurns ?? 0, rng);
    attacker.statusCondition = check.status;
    attacker.sleepTurns = check.sleepTurns;
    if (check.message) say(b, `${name} ${check.message}`, 'status');
    if (!check.acts) return;

    const slot = attacker.moves[moveIndex];
    let move: Move = STRUGGLE;
    if (slot && slot.pp > 0) {
        move = moveBySlug(slot.slug);
        slot.pp -= 1;
    } else if (attacker.moves.some(m => m.pp > 0) && slot) {
        say(b, `${name} está sem PP em ${moveBySlug(slot.slug).name}.`, 'status');
        return;
    }
    say(b, `${name} usou ${move.name}!`);

    const sure = Boolean(owner?.sureHit && move.cls !== 'status');
    if (owner && sure) owner.sureHit = false;
    const selfTarget = move.target === 'user' || move.target === 'users-field' || move.target === 'user-and-allies';
    const atkStages = stagesOf(b, attacker);
    const defStages = stagesOf(b, defender);
    const hit = selfTarget ? { hit: true, roll: 0, needed: 100 } : hits(move, atkStages.acc, defStages.eva, rng, sure);
    if (!hit.hit) {
        say(b, `Errou! (1d100 = ${hit.roll}, precisava ≤ ${hit.needed})`, 'status');
        return;
    }

    const attackerTypes = speciesById(attacker.pokemonId)?.types ?? [];
    const defenderTypes = speciesById(defender.pokemonId)?.types ?? [];
    if (move.power && move.cls !== 'status') {
        const a = effectiveStats(b, attacker, owner);
        const d = effectiveStats(b, defender, defenderOwner);
        const result = calcDamage({
            level: attacker.level,
            attack: move.cls === 'physical' ? a.atk : a.spa,
            defense: move.cls === 'physical' ? d.def : d.spd,
            move,
            attackerTypes,
            defenderTypes,
            burned: attacker.statusCondition === 'burn',
            classDamageBonus: classByKey(owner?.classKey)?.effects.damageBonus ?? 0
        }, rng);
        const dealt = Math.min(defender.currentHp, result.damage);
        defender.currentHp -= dealt;
        const tags = [result.critical ? 'Acerto crítico!' : '', effectivenessLabel(result.effectiveness)].filter(Boolean).join(' ');
        say(b, `${displayName(defender)} perdeu ${dealt} HP. ${tags} (${result.breakdown})`.trim(), 'hit');
        if (move === STRUGGLE) {
            const recoil = Math.max(1, Math.floor(statsOf(attacker).hp / 4));
            attacker.currentHp = Math.max(0, attacker.currentHp - recoil);
            say(b, `${name} sofreu ${recoil} de dano de recuo.`, 'status');
        }
        if (move.drain && dealt > 0) {
            const amount = Math.max(1, Math.floor((dealt * Math.abs(move.drain)) / 100));
            if (move.drain > 0) attacker.currentHp = Math.min(statsOf(attacker).hp, attacker.currentHp + amount);
            else attacker.currentHp = Math.max(0, attacker.currentHp - amount);
            say(b, move.drain > 0 ? `${name} recuperou ${amount} HP.` : `${name} sofreu ${amount} de recuo.`, 'status');
        }
        if (defender.currentHp === 0) {
            defender.statusCondition = 'fainted';
            say(b, `${displayName(defender)} caiu!`, 'faint');
            return;
        }
        if (result.effectiveness === 0) return;
    }
    if (move.healing > 0) {
        const max = statsOf(attacker).hp;
        const amount = Math.floor((max * move.healing) / 100);
        attacker.currentHp = Math.min(max, attacker.currentHp + amount);
        say(b, `${name} recuperou ${amount} HP.`, 'status');
    }
    const ailment = ailmentToStatus(move.ailment);
    const chance = move.ailmentChance || (move.cls === 'status' ? 100 : 0);
    if (ailment && ailment !== 'fainted' && defender.statusCondition === 'none' && rng() * 100 < chance) {
        if (immuneToStatus(ailment, defenderTypes)) say(b, `${displayName(defender)} é imune a esse efeito.`, 'status');
        else {
            defender.statusCondition = ailment;
            if (ailment === 'sleep') defender.sleepTurns = randomInt(RULES.battle.sleepTurns[0], RULES.battle.sleepTurns[1], rng);
            say(b, `${displayName(defender)} ficou ${STATUS_LABEL[ailment].toLowerCase()}!`, 'status');
        }
    }
    if (move.statChanges.length && (move.statChance === 0 ? move.cls === 'status' : rng() * 100 < move.statChance)) {
        const target = selfTarget || move.statChanges.every(c => c.change > 0) && move.cls === 'status' && move.target !== 'selected-pokemon' && move.target !== 'all-opponents' ? attacker : defender;
        const stages = stagesOf(b, target);
        for (const change of move.statChanges) {
            const key = (change.stat === 'accuracy' ? 'acc' : change.stat === 'evasion' ? 'eva' : change.stat) as keyof Stages;
            if (!(key in stages)) continue;
            stages[key] = Math.max(-6, Math.min(6, stages[key] + change.change));
            say(b, `${key.toUpperCase()} de ${displayName(target)} ${change.change > 0 ? 'subiu' : 'caiu'} (${stages[key] > 0 ? '+' : ''}${stages[key]}).`, 'status');
        }
    }
}

function awardXp(b: Battle, defeated: PokemonInstance, directUid: string | null) {
    const species = speciesById(defeated.pokemonId);
    const fought = (b.fought[defeated.uid] ?? []).filter(uid => Object.values(b.trainers).some(t => t.team.some(p => p.uid === uid && alive(p))));
    if (!species || !fought.length) return;
    const shares = splitXp(species.baseXp, defeated.level, fought, directUid, b.enemy.kind === 'npc');
    for (const share of shares) {
        for (const t of Object.values(b.trainers)) {
            const index = t.team.findIndex(p => p.uid === share.key);
            if (index < 0) continue;
            const result = gainXp(t.team[index], share.amount);
            t.team[index] = result.pokemon;
            b.xp.push({ uid: t.uid, pokemonUid: share.key, name: displayName(result.pokemon), amount: share.amount, levelsGained: result.levelsGained, newLevel: result.pokemon.level, learned: result.learned, canLearn: result.canLearn, evolution: result.evolution ?? evolutionAvailable(result.pokemon, 'level') });
            say(b, `${displayName(result.pokemon)} ganhou ${share.amount} XP${share.direct ? ' (bônus de participação direta)' : ''}.${result.levelsGained ? ` Subiu para o nível ${result.pokemon.level}!` : ''}${result.learned.length ? ` Aprendeu ${result.learned.map(m => moveBySlug(m).name).join(', ')}.` : ''}${result.evolution ? ' Está pronto para evoluir!' : ''}`, 'xp');
        }
    }
}

function handleEnemyFaint(b: Battle, directUid: string | null) {
    const fallen = enemyPokemon(b);
    if (!fallen || alive(fallen)) return;
    fallen.statusCondition = 'fainted';
    awardXp(b, fallen, directUid);
    const next = b.enemy.team.findIndex(p => alive(p));
    if (next < 0) {
        say(b, b.enemy.kind === 'wild' ? 'Vitória!' : `${b.enemy.name} foi derrotado!${b.enemy.reward ? ` Recompensa: ₽${b.enemy.reward}.` : ''}`, 'faint');
        finish(b, 'players');
        return;
    }
    b.enemy.active = next;
    const p = b.enemy.team[next];
    if (!b.seen.includes(p.pokemonId)) b.seen.push(p.pokemonId);
    say(b, `${b.enemy.name} enviou ${displayName(p)} (Nv. ${p.level})!`);
    markFought(b);
}

function handlePlayerFaint(b: Battle, t: BattleTrainer, pokemon?: PokemonInstance) {
    const p = pokemon ?? activeOf(t);
    if (p) { p.statusCondition = 'fainted'; p.currentHp = 0; }
    if (!t.team.some(alive)) {
        t.out = true;
        say(b, `${t.name} não tem mais Pokémon em condição de lutar!`, 'faint');
    } else {
        say(b, `${t.name} precisa enviar outro Pokémon.`, 'status');
    }
    if (Object.values(b.trainers).every(x => x.out)) {
        say(b, 'O grupo foi derrotado...', 'faint');
        finish(b, 'enemy');
    }
}

function finish(b: Battle, outcome: NonNullable<Battle['outcome']>): Battle {
    b.status = 'ended';
    b.outcome = outcome;
    b.actions = {};
    return b;
}

/** Itens gastos durante a batalha (para descontar da mochila ao aplicar o resultado). */
export function consumedItems(b: Battle, uid: string): string[] {
    return b.consumed?.[uid] ?? [];
}

/** O jogador precisa trocar de Pokémon antes de poder atacar? */
export function needsSwitch(t: BattleTrainer): boolean {
    return !t.out && !alive(activeOf(t));
}

export { alive as isAlive };
