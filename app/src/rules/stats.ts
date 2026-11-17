// Stats (HP, Ataque, Defesa, At. Especial, Def. Especial, Velocidade) e Naturezas (+10% / -10%).

export type StatKey = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';
export type BattleStat = Exclude<StatKey, 'hp'>;
export type Stats = Record<StatKey, number>;

export const STAT_KEYS: StatKey[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
export const STAT_LABEL: Record<StatKey, string> = {
    hp: 'HP', atk: 'Ataque', def: 'Defesa', spa: 'At. Especial', spd: 'Def. Especial', spe: 'Velocidade'
};
export const STAT_SHORT: Record<StatKey, string> = { hp: 'HP', atk: 'ATK', def: 'DEF', spa: 'SpA', spd: 'SpD', spe: 'VEL' };

export interface Nature {
    name: string;
    label: string;
    up: BattleStat | null;
    down: BattleStat | null;
}

const N = (name: string, label: string, up: BattleStat | null, down: BattleStat | null): Nature => ({ name, label, up, down });

export const NATURES: Nature[] = [
    N('hardy', 'Resistente', null, null), N('lonely', 'Solitária', 'atk', 'def'), N('brave', 'Corajosa', 'atk', 'spe'),
    N('adamant', 'Firme', 'atk', 'spa'), N('naughty', 'Travessa', 'atk', 'spd'), N('bold', 'Ousada', 'def', 'atk'),
    N('docile', 'Dócil', null, null), N('relaxed', 'Relaxada', 'def', 'spe'), N('impish', 'Marota', 'def', 'spa'),
    N('lax', 'Descuidada', 'def', 'spd'), N('timid', 'Tímida', 'spe', 'atk'), N('hasty', 'Apressada', 'spe', 'def'),
    N('serious', 'Séria', null, null), N('jolly', 'Alegre', 'spe', 'spa'), N('naive', 'Ingênua', 'spe', 'spd'),
    N('modest', 'Modesta', 'spa', 'atk'), N('mild', 'Amena', 'spa', 'def'), N('quiet', 'Quieta', 'spa', 'spe'),
    N('bashful', 'Acanhada', null, null), N('rash', 'Imprudente', 'spa', 'spd'), N('calm', 'Calma', 'spd', 'atk'),
    N('gentle', 'Gentil', 'spd', 'def'), N('sassy', 'Atrevida', 'spd', 'spe'), N('careful', 'Cuidadosa', 'spd', 'spa'),
    N('quirky', 'Peculiar', null, null)
];

export const natureByName = (name?: string | null): Nature => NATURES.find(n => n.name === name) ?? NATURES[0];

export function natureMultiplier(nature: Nature, stat: StatKey): number {
    if (stat === 'hp') return 1;
    if (nature.up === stat) return 1.1;
    if (nature.down === stat) return 0.9;
    return 1;
}

/** Mesma fórmula que o site já usava para HP/ATK/DEF/VEL (sem IV/EV), estendida aos 6 stats e à natureza. */
export function calcStats(base: Stats, level: number, natureName?: string | null): Stats {
    const nature = natureByName(natureName);
    const lv = Math.max(1, Math.min(100, Math.floor(level)));
    const out = {} as Stats;
    for (const key of STAT_KEYS) {
        const core = Math.floor((2 * base[key] * lv) / 100);
        out[key] = key === 'hp' ? core + lv + 10 : Math.floor((core + 5) * natureMultiplier(nature, key));
    }
    return out;
}

/** Estágios de batalha (-6 a +6), como nos jogos. */
export function stageMultiplier(stage: number): number {
    const s = Math.max(-6, Math.min(6, stage));
    return s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
}
