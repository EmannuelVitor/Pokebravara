// Experiência: curvas de crescimento por espécie e divisão de XP após nocautear ou capturar.
import { RULES } from './config';

export type Growth = 'fast' | 'medium' | 'medium-slow' | 'slow' | 'slow-then-very-fast' | 'fast-then-very-slow';

/** XP total necessária para estar em um nível (fórmulas oficiais dos jogos). */
export function xpForLevel(growth: string, level: number): number {
    const n = Math.max(1, Math.min(100, level));
    if (n === 1) return 0;
    const n3 = n ** 3;
    switch (growth) {
        case 'fast': return Math.floor((4 * n3) / 5);
        case 'medium-slow': return Math.max(0, Math.floor((6 / 5) * n3 - 15 * n * n + 100 * n - 140));
        case 'slow': return Math.floor((5 * n3) / 4);
        case 'slow-then-very-fast': // erratic
            if (n < 50) return Math.floor((n3 * (100 - n)) / 50);
            if (n < 68) return Math.floor((n3 * (150 - n)) / 100);
            if (n < 98) return Math.floor((n3 * Math.floor((1911 - 10 * n) / 3)) / 500);
            return Math.floor((n3 * (160 - n)) / 100);
        case 'fast-then-very-slow': // fluctuating
            if (n < 15) return Math.floor((n3 * (Math.floor((n + 1) / 3) + 24)) / 50);
            if (n < 36) return Math.floor((n3 * (n + 14)) / 50);
            return Math.floor((n3 * (Math.floor(n / 2) + 32)) / 50);
        default: return n3; // medium (medium-fast)
    }
}

export function levelForXp(growth: string, xp: number): number {
    let level = 1;
    while (level < 100 && xpForLevel(growth, level + 1) <= xp) level++;
    return level;
}

/** Progresso dentro do nível atual (0–1) para a barra de XP. */
export function levelProgress(growth: string, xp: number) {
    const level = levelForXp(growth, xp);
    const start = xpForLevel(growth, level);
    const end = level >= 100 ? start : xpForLevel(growth, level + 1);
    return { level, current: xp - start, needed: end - start, ratio: end > start ? (xp - start) / (end - start) : 1 };
}

export interface XpShare {
    key: string;
    amount: number;
    direct: boolean;
}

/**
 * XP de um Pokémon nocauteado/capturado, dividida entre quem participou.
 * Quem derrubou ou capturou (participação direta) recebe o bônus de RULES.xp.directBonus.
 */
export function splitXp(baseXp: number, defeatedLevel: number, participants: string[], direct: string | null, trainerBattle = false): XpShare[] {
    if (!participants.length) return [];
    const total = Math.floor(((baseXp * defeatedLevel) / 7) * (trainerBattle ? RULES.xp.trainerBattleMultiplier : 1) * RULES.xp.multiplier);
    const share = Math.max(1, Math.floor(total / participants.length));
    return participants.map(key => ({
        key,
        direct: key === direct,
        amount: key === direct ? Math.floor(share * (1 + RULES.xp.directBonus)) : share
    }));
}
