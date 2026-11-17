// Tabela de tipos (Super Efetivo x2, Pouco Efetivo x0.5, Imune x0).

export const TYPES = ['normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground',
    'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'] as const;
export type PokemonType = (typeof TYPES)[number];

export const TYPE_LABEL: Record<PokemonType, string> = {
    normal: 'Normal', fire: 'Fogo', water: 'Água', electric: 'Elétrico', grass: 'Planta', ice: 'Gelo',
    fighting: 'Lutador', poison: 'Venenoso', ground: 'Terrestre', flying: 'Voador', psychic: 'Psíquico',
    bug: 'Inseto', rock: 'Pedra', ghost: 'Fantasma', dragon: 'Dragão', dark: 'Sombrio', steel: 'Aço', fairy: 'Fada'
};

export const TYPE_COLOR: Record<PokemonType, string> = {
    normal: '#A8A878', fire: '#F08030', water: '#6890F0', electric: '#F8D030', grass: '#78C850', ice: '#98D8D8',
    fighting: '#C03028', poison: '#A040A0', ground: '#E0C068', flying: '#A890F0', psychic: '#F85888',
    bug: '#A8B820', rock: '#B8A038', ghost: '#705898', dragon: '#7038F8', dark: '#705848', steel: '#B8B8D0', fairy: '#EE99AC'
};

// atacante -> defensor -> multiplicador (só o que não é 1)
const CHART: Partial<Record<PokemonType, Partial<Record<PokemonType, number>>>> = {
    normal: { rock: 0.5, ghost: 0, steel: 0.5 },
    fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
    water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
    electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
    grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
    ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
    fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
    poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
    ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
    flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
    psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
    bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
    rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
    ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
    dragon: { dragon: 2, steel: 0.5, fairy: 0 },
    dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
    steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
    fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 }
};

export function effectiveness(attack: string, defenders: string[]): number {
    const row = CHART[attack as PokemonType] ?? {};
    return defenders.reduce((total, defender) => total * (row[defender as PokemonType] ?? 1), 1);
}

export function effectivenessLabel(multiplier: number): string {
    if (multiplier === 0) return 'Não afeta';
    if (multiplier >= 4) return 'Super efetivo (x4)';
    if (multiplier >= 2) return 'Super efetivo (x2)';
    if (multiplier <= 0.25) return 'Pouco efetivo (x0,25)';
    if (multiplier < 1) return 'Pouco efetivo (x0,5)';
    return '';
}

/** Fraquezas/resistências de uma espécie, para a Pokédex e para o Pesquisador. */
export function defensiveProfile(defenders: string[]) {
    const weak: [PokemonType, number][] = [];
    const resist: [PokemonType, number][] = [];
    const immune: PokemonType[] = [];
    for (const type of TYPES) {
        const m = effectiveness(type, defenders);
        if (m === 0) immune.push(type);
        else if (m > 1) weak.push([type, m]);
        else if (m < 1) resist.push([type, m]);
    }
    return { weak, resist, immune };
}

export const typeLabel = (type: string) => TYPE_LABEL[type as PokemonType] ?? type;
export const typeColor = (type: string) => TYPE_COLOR[type as PokemonType] ?? '#777';
