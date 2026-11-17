// Criação, normalização (dados antigos), XP/nível, evolução e itens aplicados a um Pokémon.
import { speciesById, moveBySlug, MOVES, type Species } from '../data';
import type { MoveSlot, PokemonInstance } from '../model';
import { RULES } from './config';
import { randomInt, type Rng } from './dice';
import { itemBySlug } from './items';
import { calcStats, NATURES, type Stats } from './stats';
import { normalizeStatus } from './status';
import { levelForXp, xpForLevel } from './xp';

export const newUid = (rng: Rng = Math.random) =>
    Date.now().toString(36) + Math.floor(rng() * 36 ** 6).toString(36).padStart(6, '0');

/** Os 4 golpes mais recentes que a espécie aprende até o nível. */
export function defaultMoves(species: Species, level: number): MoveSlot[] {
    const known = species.learnset.filter(m => m.level <= level && MOVES[m.move]);
    const picked = known.slice(-4);
    return picked.map(m => ({ slug: m.move, pp: moveBySlug(m.move).pp }));
}

export interface CreateOptions {
    nickname?: string;
    isShiny?: boolean;
    nature?: string;
    ability?: string;
    caughtBy?: string;
    rng?: Rng;
}

export function createPokemon(pokemonId: number, level: number, options: CreateOptions = {}): PokemonInstance {
    const rng = options.rng ?? Math.random;
    const species = speciesById(pokemonId);
    if (!species) throw new Error('Espécie desconhecida: ' + pokemonId);
    const regular = species.abilities.filter(a => !a.hidden);
    const ability = options.ability ?? (regular[randomInt(0, Math.max(0, regular.length - 1), rng)] ?? species.abilities[0])?.slug ?? '';
    const nature = options.nature ?? NATURES[randomInt(0, NATURES.length - 1, rng)].name;
    const stats = calcStats(species.base, level, nature);
    return {
        uid: newUid(rng),
        pokemonId,
        nickname: options.nickname || undefined,
        level,
        xp: xpForLevel(species.growth, level),
        nature,
        ability,
        isShiny: options.isShiny ?? false,
        currentHp: stats.hp,
        maxHp: stats.hp,
        statusCondition: 'none',
        moves: defaultMoves(species, level),
        friendship: RULES.friendship.start,
        caughtBy: options.caughtBy,
        caughtAt: Date.now()
    };
}

/** Completa Pokémon salvos pelo site v1 (sem natureza, golpes, XP...) sem mudar o que já existe. */
export function normalizePokemon(raw: Partial<PokemonInstance> & { pokemonId: number }, index = 0): PokemonInstance {
    const species = speciesById(raw.pokemonId);
    const level = Math.max(1, Math.min(100, Number(raw.level) || 1));
    const nature = raw.nature || 'hardy';
    const maxHp = species ? calcStats(species.base, level, nature).hp : Number(raw.maxHp) || 10;
    const currentHp = Math.max(0, Math.min(maxHp, Number.isFinite(Number(raw.currentHp)) ? Number(raw.currentHp) : maxHp));
    const status = currentHp === 0 ? 'fainted' : normalizeStatus(raw.statusCondition);
    return {
        uid: raw.uid || `legacy-${raw.pokemonId}-${index}`,
        pokemonId: raw.pokemonId,
        nickname: raw.nickname && raw.nickname.trim() !== species?.name ? raw.nickname.trim() : undefined,
        level,
        xp: Number.isFinite(raw.xp) ? Number(raw.xp) : species ? xpForLevel(species.growth, level) : 0,
        nature,
        ability: raw.ability || species?.abilities[0]?.slug || '',
        isShiny: Boolean(raw.isShiny),
        gender: raw.gender ?? null,
        currentHp,
        maxHp,
        statusCondition: status,
        sleepTurns: raw.sleepTurns ?? 0,
        moves: raw.moves?.length ? raw.moves : species ? defaultMoves(species, level) : [],
        friendship: Number.isFinite(raw.friendship) ? Number(raw.friendship) : RULES.friendship.start,
        heldItem: raw.heldItem ?? null,
        caughtBy: raw.caughtBy,
        caughtAt: raw.caughtAt,
        pendingEvolution: raw.pendingEvolution ?? null
    };
}

export function statsOf(p: PokemonInstance): Stats {
    const species = speciesById(p.pokemonId);
    if (!species) return { hp: p.maxHp, atk: 5, def: 5, spa: 5, spd: 5, spe: 5 };
    return calcStats(species.base, p.level, p.nature);
}

export const displayName = (p: PokemonInstance) => p.nickname?.trim() || speciesById(p.pokemonId)?.name || 'Pokémon';

export interface LevelUpResult {
    pokemon: PokemonInstance;
    levelsGained: number;
    learned: string[];        // golpes aprendidos automaticamente (havia espaço)
    canLearn: string[];       // golpes disponíveis que exigem trocar um golpe
    evolution: number | null; // espécie para a qual pode evoluir agora
}

/** Soma XP; sobe de nível, recalcula HP mantendo o dano sofrido, oferece golpes e evolução. */
export function gainXp(p: PokemonInstance, amount: number): LevelUpResult {
    const species = speciesById(p.pokemonId);
    if (!species) return { pokemon: p, levelsGained: 0, learned: [], canLearn: [], evolution: null };
    const xp = p.xp + Math.max(0, Math.floor(amount));
    const level = Math.min(100, levelForXp(species.growth, xp));
    const levelsGained = level - p.level;
    if (levelsGained <= 0) return { pokemon: { ...p, xp }, levelsGained: 0, learned: [], canLearn: [], evolution: null };

    const before = calcStats(species.base, p.level, p.nature).hp;
    const after = calcStats(species.base, level, p.nature).hp;
    const moves = [...p.moves];
    const learned: string[] = [];
    const canLearn: string[] = [];
    for (const entry of species.learnset) {
        if (entry.level <= p.level || entry.level > level || !MOVES[entry.move]) continue;
        if (moves.some(m => m.slug === entry.move)) continue;
        if (moves.length < 4) {
            moves.push({ slug: entry.move, pp: moveBySlug(entry.move).pp });
            learned.push(entry.move);
        } else {
            canLearn.push(entry.move);
        }
    }
    const friendship = Math.min(RULES.friendship.max, p.friendship + RULES.friendship.levelUp * levelsGained);
    const next: PokemonInstance = {
        ...p,
        xp,
        level,
        maxHp: after,
        currentHp: p.statusCondition === 'fainted' ? p.currentHp : Math.min(after, p.currentHp + (after - before)),
        moves,
        friendship
    };
    const evolution = evolutionAvailable(next, 'level');
    return { pokemon: { ...next, pendingEvolution: evolution ?? next.pendingEvolution ?? null }, levelsGained, learned, canLearn, evolution };
}

/** Qual evolução está disponível para o gatilho dado (só para espécies que existem no PokeBravara). */
export function evolutionAvailable(p: PokemonInstance, trigger: 'level' | 'item' | 'trade', item?: string): number | null {
    const species = speciesById(p.pokemonId);
    if (!species) return null;
    for (const evo of species.evolutions) {
        if (evo.to === null) continue;
        if (trigger === 'level' && evo.trigger === 'level' && evo.minLevel !== null && p.level >= evo.minLevel) return evo.to;
        if (trigger === 'level' && evo.trigger === 'friendship' && p.friendship >= RULES.friendship.evolve) return evo.to;
        if (trigger === 'item' && evo.trigger === 'item' && evo.item === item) return evo.to;
        if (trigger === 'trade' && evo.trigger === 'trade') return evo.to;
    }
    return null;
}

/** Evolui mantendo nível, natureza, golpes e a fração de HP. */
export function evolve(p: PokemonInstance, to: number): PokemonInstance {
    const target = speciesById(to);
    if (!target) return p;
    const oldMax = statsOf(p).hp;
    const newMax = calcStats(target.base, p.level, p.nature).hp;
    const sameAbilityIndex = speciesById(p.pokemonId)?.abilities.findIndex(a => a.slug === p.ability) ?? 0;
    const ability = target.abilities[Math.max(0, sameAbilityIndex)]?.slug ?? target.abilities[0]?.slug ?? p.ability;
    const keepNickname = p.nickname && p.nickname !== speciesById(p.pokemonId)?.name;
    return {
        ...p,
        pokemonId: to,
        nickname: keepNickname ? p.nickname : undefined,
        ability,
        maxHp: newMax,
        currentHp: p.statusCondition === 'fainted' ? 0 : Math.max(1, Math.round((p.currentHp / oldMax) * newMax)),
        pendingEvolution: null
    };
}

export interface ItemUse {
    ok: boolean;
    pokemon: PokemonInstance;
    message: string;
}

/** Usa um item de cura/fruta/evolução em um Pokémon. */
export function useItemOn(p: PokemonInstance, slug: string): ItemUse {
    const item = itemBySlug(slug);
    const name = displayName(p);
    if (!item) return { ok: false, pokemon: p, message: 'Item desconhecido.' };
    const max = statsOf(p).hp;

    if (item.evolutionItem) {
        const to = evolutionAvailable(p, 'item', item.evolutionItem);
        if (to === null) return { ok: false, pokemon: p, message: `${item.name} não tem efeito em ${name}.` };
        return { ok: true, pokemon: evolve(p, to), message: `${name} evoluiu para ${speciesById(to)?.name}!` };
    }
    if (item.move) {
        const species = speciesById(p.pokemonId);
        if (p.moves.some(m => m.slug === item.move)) return { ok: false, pokemon: p, message: `${name} já conhece esse golpe.` };
        if (!species?.learnset.some(m => m.move === item.move) && !MOVES[item.move!]) return { ok: false, pokemon: p, message: 'Golpe incompatível.' };
        if (p.moves.length >= 4) return { ok: false, pokemon: p, message: `${name} já tem 4 golpes. Esqueça um golpe antes.` };
        return { ok: true, pokemon: { ...p, moves: [...p.moves, { slug: item.move!, pp: moveBySlug(item.move!).pp }] }, message: `${name} aprendeu ${moveBySlug(item.move!).name}!` };
    }
    if (item.revive) {
        if (p.statusCondition !== 'fainted') return { ok: false, pokemon: p, message: `${name} não está caído.` };
        return { ok: true, pokemon: { ...p, statusCondition: 'none', currentHp: Math.max(1, Math.floor(max * item.revive)) }, message: `${name} foi revivido!` };
    }
    if (p.statusCondition === 'fainted') return { ok: false, pokemon: p, message: `${name} está caído. Use um Revive.` };

    let next = { ...p };
    let changed = false;
    const healAmount = item.heal === 'full' ? max : item.heal ?? (item.healFraction ? Math.floor(max * item.healFraction) : 0);
    if (healAmount > 0 && next.currentHp < max) {
        next.currentHp = Math.min(max, next.currentHp + healAmount);
        changed = true;
    }
    if (item.cures && next.statusCondition !== 'none' && (item.cures === 'all' || item.cures.includes(next.statusCondition))) {
        next = { ...next, statusCondition: 'none', sleepTurns: 0 };
        changed = true;
    }
    if (item.restorePP) {
        const moves = next.moves.map(m => ({ ...m, pp: Math.min(moveBySlug(m.slug).pp, m.pp + item.restorePP!) }));
        if (moves.some((m, i) => m.pp !== next.moves[i].pp)) {
            next = { ...next, moves };
            changed = true;
        }
    }
    if (!changed) return { ok: false, pokemon: p, message: `${item.name} não teria efeito em ${name}.` };
    return { ok: true, pokemon: next, message: `${item.name} usado em ${name}.` };
}

/** Cura completa (Centro Pokémon). */
export function fullHeal(p: PokemonInstance): PokemonInstance {
    return { ...p, currentHp: statsOf(p).hp, statusCondition: 'none', sleepTurns: 0, moves: p.moves.map(m => ({ ...m, pp: moveBySlug(m.slug).pp })) };
}

/** Descanso/acampamento: cura uma fração, opcionalmente restaura PP e aumenta amizade. */
export function rest(p: PokemonInstance, healFraction: number, restorePP: boolean, friendship: number): PokemonInstance {
    if (p.statusCondition === 'fainted') return { ...p, friendship: Math.min(RULES.friendship.max, p.friendship + friendship) };
    const max = statsOf(p).hp;
    return {
        ...p,
        currentHp: Math.min(max, p.currentHp + Math.ceil(max * healFraction)),
        statusCondition: p.statusCondition === 'sleep' ? 'none' : p.statusCondition,
        moves: restorePP ? p.moves.map(m => ({ ...m, pp: moveBySlug(m.slug).pp })) : p.moves,
        friendship: Math.min(RULES.friendship.max, p.friendship + friendship)
    };
}
