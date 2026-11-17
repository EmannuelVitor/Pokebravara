// Dados de mesa. Todas as rolagens passam por aqui para poderem ser testadas (rng injetável)
// e mostradas na tela com o resultado de cada dado.

export type Rng = () => number;

export interface Roll {
    expression: string;
    dice: number[];
    modifier: number;
    total: number;
}

export function rollDie(sides: number, rng: Rng = Math.random): number {
    return 1 + Math.floor(rng() * sides);
}

/** Rola uma expressão simples como "1d20+3", "2d6" ou "1d100". */
export function roll(expression: string, rng: Rng = Math.random): Roll {
    const match = expression.replace(/\s+/g, '').match(/^(\d*)d(\d+)([+-]\d+)?$/i);
    if (!match) throw new Error('Expressão de dado inválida: ' + expression);
    const count = Number(match[1] || 1);
    const sides = Number(match[2]);
    const modifier = Number(match[3] || 0);
    const dice = Array.from({ length: count }, () => rollDie(sides, rng));
    return { expression, dice, modifier, total: dice.reduce((sum, d) => sum + d, 0) + modifier };
}

/** Escolhe um item de uma tabela com pesos (encontros, recompensas). */
export function weightedPick<T extends { weight: number }>(table: T[], rng: Rng = Math.random): T | null {
    const total = table.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
    if (total <= 0) return null;
    let target = rng() * total;
    for (const entry of table) {
        target -= Math.max(0, entry.weight);
        if (target < 0) return entry;
    }
    return table[table.length - 1];
}

export function randomInt(min: number, max: number, rng: Rng = Math.random): number {
    return min + Math.floor(rng() * (max - min + 1));
}

/** Gerador determinístico para testes. */
export function seeded(seed: number): Rng {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
