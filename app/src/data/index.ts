import speciesJson from './species.json';
import movesJson from './moves.json';
import abilitiesJson from './abilities.json';
import type { Stats } from '../rules/stats';

export interface Evolution {
    toDex: number;
    to: number | null;
    toName: string;
    trigger: 'level' | 'item' | 'friendship' | 'trade' | 'other';
    minLevel: number | null;
    item: string | null;
    minFriendship: number | null;
}

export interface Species {
    id: number;
    dex: number;
    name: string;
    types: string[];
    base: Stats;
    abilities: { slug: string; hidden: boolean }[];
    captureRate: number;
    growth: string;
    baseXp: number;
    legendary: boolean;
    height: number;
    weight: number;
    description: string;
    evolutions: Evolution[];
    learnset: { move: string; level: number }[];
    regional: boolean;
    starter: { generation: string; line: number; stage: number } | null;
}

export interface Move {
    name: string;
    type: string;
    cls: 'physical' | 'special' | 'status';
    power: number | null;
    accuracy: number | null;
    pp: number;
    priority: number;
    target?: string;
    effect: string;
    ailment: string | null;
    ailmentChance: number;
    drain: number;
    healing: number;
    flinch: number;
    statChanges: { stat: string; change: number }[];
    statChance: number;
}

export interface Ability {
    name: string;
    effect: string;
}

export const SPECIES = speciesJson as Species[];
export const MOVES = movesJson as Record<string, Move>;
export const ABILITIES = abilitiesJson as Record<string, Ability>;

const byId = new Map(SPECIES.map(s => [s.id, s]));
export const speciesById = (id: number): Species | undefined => byId.get(id);

/** Golpe genérico usado quando um Pokémon não tem golpes com dano (Struggle). */
export const STRUGGLE: Move = {
    name: 'Struggle', type: 'normal', cls: 'physical', power: 50, accuracy: null, pp: 1, priority: 0,
    effect: 'Usado quando não há PP. O usuário sofre 1/4 do próprio HP máximo.', ailment: null, ailmentChance: 0,
    drain: 0, healing: 0, flinch: 0, statChanges: [], statChance: 0
};
export const moveBySlug = (slug: string): Move => MOVES[slug] ?? STRUGGLE;
export const abilityBySlug = (slug?: string | null): Ability | null => (slug ? ABILITIES[slug] ?? null : null);

const SPRITE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
export const artwork = (dex: number, shiny = false) => `${SPRITE}/other/official-artwork/${shiny ? 'shiny/' : ''}${dex}.png`;
/** Sprite pequeno e de tamanho uniforme (96px) para slots e listas. */
export const sprite = (dex: number, shiny = false) => `${SPRITE}/${shiny ? 'shiny/' : ''}${dex}.png`;

export const prettySlug = (slug: string) => slug.split('-').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ');
