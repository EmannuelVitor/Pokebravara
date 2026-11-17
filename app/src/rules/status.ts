// Condições de status e o efeito mecânico de cada uma.
import { RULES } from './config';
import type { Rng } from './dice';

export type StatusCondition = 'none' | 'paralysis' | 'burn' | 'poison' | 'sleep' | 'freeze' | 'fainted';

export const STATUS_LABEL: Record<StatusCondition, string> = {
    none: 'Normal', paralysis: 'Paralisado', burn: 'Queimado', poison: 'Envenenado',
    sleep: 'Dormindo', freeze: 'Congelado', fainted: 'Caído'
};

export const STATUS_RULE: Record<Exclude<StatusCondition, 'none'>, string> = {
    paralysis: 'Velocidade pela metade e 25% de chance de perder a ação no turno.',
    burn: 'Perde 1/16 do HP máximo por turno e causa metade do dano físico.',
    poison: 'Perde 1/8 do HP máximo por turno.',
    sleep: 'Não age por 1 a 3 turnos.',
    freeze: 'Não age; 20% de chance de descongelar no início do turno.',
    fainted: 'Sem HP. Não pode batalhar até ser revivido.'
};

/** Nomes antigos guardados no Firestore (site v1) e nomes da PokeAPI. */
const ALIASES: Record<string, StatusCondition> = {
    ok: 'none', none: 'none', '': 'none',
    paralyzed: 'paralysis', paralysis: 'paralysis',
    burned: 'burn', burn: 'burn',
    poisoned: 'poison', poison: 'poison',
    asleep: 'sleep', sleep: 'sleep',
    frozen: 'freeze', freeze: 'freeze',
    fainted: 'fainted'
};
export const normalizeStatus = (value?: string | null): StatusCondition => ALIASES[value ?? ''] ?? 'none';

/** Antes de agir: o Pokémon consegue agir neste turno? Pode alterar o status (acordar/descongelar). */
export function canAct(status: StatusCondition, sleepTurns: number, rng: Rng): { acts: boolean; status: StatusCondition; sleepTurns: number; message: string | null } {
    switch (status) {
        case 'fainted':
            return { acts: false, status, sleepTurns, message: 'está caído.' };
        case 'sleep':
            if (sleepTurns <= 0) return { acts: true, status: 'none', sleepTurns: 0, message: 'acordou!' };
            return { acts: false, status, sleepTurns: sleepTurns - 1, message: 'está dormindo.' };
        case 'freeze':
            if (rng() < RULES.battle.freezeThawChance) return { acts: true, status: 'none', sleepTurns, message: 'descongelou!' };
            return { acts: false, status, sleepTurns, message: 'está congelado.' };
        case 'paralysis':
            if (rng() < RULES.battle.paralysisSkipChance) return { acts: false, status, sleepTurns, message: 'está paralisado e não conseguiu se mover!' };
            return { acts: true, status, sleepTurns, message: null };
        default:
            return { acts: true, status, sleepTurns, message: null };
    }
}

/** Dano no fim do turno (queimadura e veneno). */
export function endOfTurnDamage(status: StatusCondition, maxHp: number): number {
    if (status === 'burn') return Math.max(1, Math.floor(maxHp * RULES.battle.burnDamage));
    if (status === 'poison') return Math.max(1, Math.floor(maxHp * RULES.battle.poisonDamage));
    return 0;
}

/** Imunidades de tipo a status. */
export function immuneToStatus(status: StatusCondition, types: string[]): boolean {
    if (status === 'burn') return types.includes('fire');
    if (status === 'poison') return types.includes('poison') || types.includes('steel');
    if (status === 'paralysis') return types.includes('electric');
    if (status === 'freeze') return types.includes('ice');
    return false;
}

/** Mapeia o "ailment" da PokeAPI para o nosso status. */
export function ailmentToStatus(ailment: string | null): StatusCondition | null {
    if (!ailment) return null;
    const s = normalizeStatus(ailment);
    return s === 'none' ? null : s;
}
