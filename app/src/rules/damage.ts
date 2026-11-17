// Cálculo de dano (fórmula dos jogos) com o detalhamento mostrado ao Mestre.
import type { Move } from '../data';
import { RULES } from './config';
import type { Rng } from './dice';
import { effectiveness } from './types';

export interface DamageInput {
    level: number;
    attack: number;           // Ataque ou At. Especial já com estágios
    defense: number;          // Defesa ou Def. Especial já com estágios
    move: Move;
    attackerTypes: string[];
    defenderTypes: string[];
    burned: boolean;
    classDamageBonus?: number;
    forceCrit?: boolean;
}

export interface DamageResult {
    damage: number;
    effectiveness: number;
    critical: boolean;
    stab: boolean;
    random: number;
    breakdown: string;
}

export function calcDamage(input: DamageInput, rng: Rng = Math.random): DamageResult {
    const { move } = input;
    const typeMult = effectiveness(move.type, input.defenderTypes);
    if (!move.power || move.cls === 'status') {
        return { damage: 0, effectiveness: typeMult, critical: false, stab: false, random: 1, breakdown: 'Golpe de status.' };
    }
    if (typeMult === 0) {
        return { damage: 0, effectiveness: 0, critical: false, stab: false, random: 1, breakdown: 'O alvo é imune a esse tipo.' };
    }
    const critical = input.forceCrit ?? rng() < RULES.battle.critChance;
    const stab = input.attackerTypes.includes(move.type);
    const random = 0.85 + rng() * 0.15;
    const base = Math.floor(Math.floor((Math.floor((2 * input.level) / 5 + 2) * move.power * input.attack) / Math.max(1, input.defense)) / 50) + 2;
    let total = base;
    const parts = [`base ${base}`];
    if (critical) { total *= RULES.battle.critMultiplier; parts.push(`crítico x${RULES.battle.critMultiplier}`); }
    if (stab) { total *= RULES.battle.stab; parts.push(`mesmo tipo x${RULES.battle.stab}`); }
    if (typeMult !== 1) { total *= typeMult; parts.push(`tipo x${typeMult}`); }
    if (input.burned && move.cls === 'physical') { total *= 0.5; parts.push('queimado x0,5'); }
    if (input.classDamageBonus) { total *= 1 + input.classDamageBonus; parts.push(`classe +${Math.round(input.classDamageBonus * 100)}%`); }
    total *= random;
    parts.push(`variação x${random.toFixed(2)}`);
    const damage = Math.max(1, Math.floor(total));
    return { damage, effectiveness: typeMult, critical, stab, random, breakdown: parts.join(' · ') + ` = ${damage}` };
}

/** Teste de acerto: 1d100 ≤ precisão. */
export function hits(move: Move, accuracyStage: number, evasionStage: number, rng: Rng = Math.random, sure = false): { hit: boolean; roll: number; needed: number } {
    if (sure || move.accuracy === null) return { hit: true, roll: 0, needed: 100 };
    const stage = Math.max(-6, Math.min(6, accuracyStage - evasionStage));
    const mult = stage >= 0 ? (3 + stage) / 3 : 3 / (3 - stage);
    const needed = Math.min(100, Math.round(move.accuracy * mult));
    const r = 1 + Math.floor(rng() * 100);
    return { hit: r <= needed, roll: r, needed };
}
