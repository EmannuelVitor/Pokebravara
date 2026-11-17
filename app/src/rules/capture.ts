// Captura: rolagem de 1d100 contra uma chance que depende da vida atual, do status e da Pokébola.
import { RULES } from './config';
import { rollDie, type Rng } from './dice';
import type { StatusCondition } from './status';

export interface CaptureInput {
    captureRate: number;      // 3–255 (da espécie)
    maxHp: number;
    currentHp: number;
    status: StatusCondition;
    ballMultiplier: number;
    classBonus?: number;      // pontos somados à rolagem (Pesquisador)
}

export interface CaptureResult {
    chance: number;           // % de 0 a 100
    roll: number;             // 1d100
    bonus: number;
    success: boolean;
    breakdown: string;
}

/**
 * Chance baseada na fórmula dos jogos: a = ((3M − 2H) × taxa × bola) / 3M × status, chance = a / 255.
 * Na mesa, rola-se 1d100: sucesso se (rolagem − bônus da classe) ≤ chance.
 */
export function captureChance(input: CaptureInput): number {
    if (input.ballMultiplier >= 255) return 100;
    const M = Math.max(1, input.maxHp);
    const H = Math.max(1, Math.min(M, input.currentHp));
    const statusBonus = RULES.capture.statusBonus[input.status] ?? 1;
    const a = (((3 * M - 2 * H) * input.captureRate * input.ballMultiplier) / (3 * M)) * statusBonus;
    return Math.max(1, Math.min(100, Math.round((a / 255) * 100)));
}

export function attemptCapture(input: CaptureInput, rng?: Rng): CaptureResult {
    const chance = captureChance(input);
    const r = rollDie(RULES.capture.die, rng);
    const bonus = input.classBonus ?? 0;
    const effective = Math.max(1, r - bonus);
    const statusBonus = RULES.capture.statusBonus[input.status] ?? 1;
    return {
        chance,
        roll: r,
        bonus,
        success: effective <= chance,
        breakdown: `Chance ${chance}% (taxa ${input.captureRate}, HP ${input.currentHp}/${input.maxHp}, bola x${input.ballMultiplier}${statusBonus > 1 ? `, status x${statusBonus}` : ''}). Rolou ${r}${bonus ? ` − ${bonus} (classe) = ${effective}` : ''}.`
    };
}
