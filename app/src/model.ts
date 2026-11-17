// Formatos guardados no Firestore. Campos opcionais = dados antigos do site v1 continuam válidos
// e são completados por normalizePokemon/normalizeTrainer.
import type { StatusCondition } from './rules/status';

export interface MoveSlot {
    slug: string;
    pp: number;
}

export interface PokemonInstance {
    uid: string;              // id estável da criatura (gerado)
    pokemonId: number;        // id da espécie no PokeBravara
    nickname?: string;
    level: number;
    xp: number;
    nature: string;
    ability: string;
    isShiny?: boolean;
    gender?: 'm' | 'f' | null;
    currentHp: number;
    maxHp: number;            // guardado para compatibilidade; sempre recalculado
    statusCondition: StatusCondition;
    sleepTurns?: number;
    moves: MoveSlot[];
    friendship: number;
    heldItem?: string | null;
    caughtBy?: string;
    caughtAt?: number;
    pendingEvolution?: number | null;
}

export interface BagEntry {
    technicalName: string;    // slug do item (nome de campo do site v1)
    quantity: number;
}

export type Level = 'Treinador' | 'Professor';
export type AttributeKey = 'for' | 'agi' | 'vig' | 'int' | 'per' | 'car';

export interface TrainerProfile {
    id: string;
    level: Level;
    email: string;
    trainerName?: string;
    professorName?: string;
    realName?: string;
    gender?: string;
    age?: number;
    height?: number;
    description?: string;
    imageUrl?: string;
    campaign?: string;
    pcUnlocked?: boolean;
    // ficha v2
    trainerClass?: string;
    attributes?: Record<AttributeKey, number>;
    skills?: string[];
    money?: number;
    badges?: string[];
    team?: PokemonInstance[];
    pc?: PokemonInstance[];
    bag?: BagEntry[];
}

export type RegionKind = 'cidade' | 'rota' | 'caverna' | 'floresta' | 'agua' | 'montanha';

export interface EncounterEntry {
    pokemonId: number;
    minLevel: number;
    maxLevel: number;
    weight: number;
    weather?: string | null;
}

export interface Region {
    id: string;
    name: string;
    kind: RegionKind;
    biome: string;
    description: string;
    pokemonCenter: boolean;
    mart: boolean;
    requires: string[];       // habilidades de campo necessárias (surf, cut...)
    encounters: EncounterEntry[];
    connections: string[];
    x: number;                // posição no mapa (0–100)
    y: number;
}

export interface Npc {
    id: string;
    name: string;
    role: 'lider' | 'professor' | 'rival' | 'campeao' | 'vilao' | 'civil';
    faction: string | null;
    regionId: string | null;
    notes: string;
    badge?: string | null;
    reward: number;
    team: PokemonInstance[];
    visible: boolean;         // jogadores já conhecem este NPC
    defeatedBy?: string[];
}

export interface Faction {
    id: string;
    name: string;
    kind: 'vila' | 'aliada' | 'neutra';
    threat: number;           // 0–5
    description: string;
    goals: string;
    visible: boolean;
}

export interface Campaign {
    id: string;               // "brasa" | "fogo"
    name: string;
    location: string | null;  // região atual do grupo
    weather: string;
    regions: Region[];
    npcs: Npc[];
    factions: Faction[];
    log: { at: number; text: string }[];
}
