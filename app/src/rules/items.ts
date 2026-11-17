// Itens da mochila, por categoria, com preço de loja e efeito.
import type { StatusCondition } from './status';

export type ItemCategory = 'balls' | 'healing' | 'tms' | 'key' | 'berries' | 'evolution';

export const CATEGORY_LABEL: Record<ItemCategory, string> = {
    balls: 'Pokébolas', healing: 'Cura', tms: 'TMs', key: 'Itens-chave', berries: 'Frutas', evolution: 'Evolução'
};
export const CATEGORY_ORDER: ItemCategory[] = ['balls', 'healing', 'berries', 'tms', 'evolution', 'key'];

export interface ItemDef {
    slug: string;
    name: string;
    category: ItemCategory;
    price: number | null; // null = não vende na loja
    description: string;
    /** Pokébolas */
    ballMultiplier?: number;
    /** Cura */
    heal?: number | 'full';
    healFraction?: number;
    cures?: StatusCondition[] | 'all';
    revive?: number; // fração do HP ao reviver
    restorePP?: number;
    /** Evolução por item (slug da PokeAPI) */
    evolutionItem?: string;
    /** TM: golpe ensinado */
    move?: string;
    sprite?: string;
}

const S = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/';

export const ITEMS: ItemDef[] = [
    { slug: 'poke-ball', name: 'Poké Ball', category: 'balls', price: 200, ballMultiplier: 1, description: 'Pokébola padrão.' },
    { slug: 'great-ball', name: 'Great Ball', category: 'balls', price: 600, ballMultiplier: 1.5, description: 'Captura melhor que a Poké Ball (x1,5).' },
    { slug: 'ultra-ball', name: 'Ultra Ball', category: 'balls', price: 1200, ballMultiplier: 2, description: 'Alta chance de captura (x2).' },
    { slug: 'master-ball', name: 'Master Ball', category: 'balls', price: null, ballMultiplier: 255, description: 'Captura garantida.' },

    { slug: 'potion', name: 'Potion', category: 'healing', price: 300, heal: 20, description: 'Cura 20 HP.' },
    { slug: 'super-potion', name: 'Super Potion', category: 'healing', price: 700, heal: 50, description: 'Cura 50 HP.' },
    { slug: 'hyper-potion', name: 'Hyper Potion', category: 'healing', price: 1500, heal: 120, description: 'Cura 120 HP.' },
    { slug: 'max-potion', name: 'Max Potion', category: 'healing', price: 2500, heal: 'full', description: 'Cura todo o HP.' },
    { slug: 'full-restore', name: 'Full Restore', category: 'healing', price: 3000, heal: 'full', cures: 'all', description: 'Cura todo o HP e qualquer status.' },
    { slug: 'revive', name: 'Revive', category: 'healing', price: 2000, revive: 0.5, description: 'Revive com metade do HP.' },
    { slug: 'antidote', name: 'Antidote', category: 'healing', price: 100, cures: ['poison'], description: 'Cura envenenamento.' },
    { slug: 'paralyze-heal', name: 'Paralyze Heal', category: 'healing', price: 200, cures: ['paralysis'], description: 'Cura paralisia.' },
    { slug: 'burn-heal', name: 'Burn Heal', category: 'healing', price: 250, cures: ['burn'], description: 'Cura queimadura.' },
    { slug: 'awakening', name: 'Awakening', category: 'healing', price: 250, cures: ['sleep'], description: 'Acorda o Pokémon.' },
    { slug: 'ice-heal', name: 'Ice Heal', category: 'healing', price: 250, cures: ['freeze'], description: 'Descongela o Pokémon.' },
    { slug: 'full-heal', name: 'Full Heal', category: 'healing', price: 600, cures: 'all', description: 'Cura qualquer status.' },
    { slug: 'ether', name: 'Ether', category: 'healing', price: 1200, restorePP: 10, description: 'Recupera 10 PP de todos os golpes.' },

    { slug: 'oran-berry', name: 'Oran Berry', category: 'berries', price: 80, heal: 10, description: 'Cura 10 HP.' },
    { slug: 'sitrus-berry', name: 'Sitrus Berry', category: 'berries', price: 250, healFraction: 0.25, description: 'Cura 1/4 do HP máximo.' },
    { slug: 'cheri-berry', name: 'Cheri Berry', category: 'berries', price: 120, cures: ['paralysis'], description: 'Cura paralisia.' },
    { slug: 'pecha-berry', name: 'Pecha Berry', category: 'berries', price: 120, cures: ['poison'], description: 'Cura envenenamento.' },
    { slug: 'rawst-berry', name: 'Rawst Berry', category: 'berries', price: 120, cures: ['burn'], description: 'Cura queimadura.' },
    { slug: 'chesto-berry', name: 'Chesto Berry', category: 'berries', price: 120, cures: ['sleep'], description: 'Acorda o Pokémon.' },
    { slug: 'aspear-berry', name: 'Aspear Berry', category: 'berries', price: 120, cures: ['freeze'], description: 'Descongela o Pokémon.' },
    { slug: 'leppa-berry', name: 'Leppa Berry', category: 'berries', price: 300, restorePP: 10, description: 'Recupera 10 PP de todos os golpes.' },

    { slug: 'fire-stone', name: 'Fire Stone', category: 'evolution', price: 3000, evolutionItem: 'fire-stone', description: 'Faz certas espécies evoluírem.' },
    { slug: 'water-stone', name: 'Water Stone', category: 'evolution', price: 3000, evolutionItem: 'water-stone', description: 'Faz certas espécies evoluírem.' },
    { slug: 'thunder-stone', name: 'Thunder Stone', category: 'evolution', price: 3000, evolutionItem: 'thunder-stone', description: 'Faz certas espécies evoluírem.' },
    { slug: 'leaf-stone', name: 'Leaf Stone', category: 'evolution', price: 3000, evolutionItem: 'leaf-stone', description: 'Faz certas espécies evoluírem.' },
    { slug: 'moon-stone', name: 'Moon Stone', category: 'evolution', price: 3000, evolutionItem: 'moon-stone', description: 'Faz certas espécies evoluírem.' },
    { slug: 'sun-stone', name: 'Sun Stone', category: 'evolution', price: 3000, evolutionItem: 'sun-stone', description: 'Faz certas espécies evoluírem.' },
    { slug: 'shiny-stone', name: 'Shiny Stone', category: 'evolution', price: 3000, evolutionItem: 'shiny-stone', description: 'Faz certas espécies evoluírem.' },
    { slug: 'dusk-stone', name: 'Dusk Stone', category: 'evolution', price: 3000, evolutionItem: 'dusk-stone', description: 'Faz certas espécies evoluírem.' },
    { slug: 'dawn-stone', name: 'Dawn Stone', category: 'evolution', price: 3000, evolutionItem: 'dawn-stone', description: 'Faz certas espécies evoluírem.' },
    { slug: 'ice-stone', name: 'Ice Stone', category: 'evolution', price: 3000, evolutionItem: 'ice-stone', description: 'Faz certas espécies evoluírem.' },

    { slug: 'town-map', name: 'Mapa da Região', category: 'key', price: null, description: 'Mostra as rotas e cidades da campanha.' },
    { slug: 'bicycle', name: 'Bicicleta', category: 'key', price: null, description: 'Viagens mais rápidas entre rotas.' },
    { slug: 'camping-gear', name: 'Kit de Acampamento', category: 'key', price: 1500, description: 'Permite acampar fora dos Centros Pokémon.' }
];

/** TMs são criadas sob demanda: slug "tm:<golpe>". */
export function tmItem(move: string, moveName: string): ItemDef {
    return { slug: 'tm:' + move, name: 'TM ' + moveName, category: 'tms', price: 3000, move, description: 'Ensina ' + moveName + ' a um Pokémon compatível.' };
}

const bySlug = new Map(ITEMS.map(i => [i.slug, i]));

export function itemBySlug(slug: string): ItemDef | null {
    if (slug.startsWith('tm:')) {
        const move = slug.slice(3);
        return tmItem(move, move.split('-').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' '));
    }
    return bySlug.get(slug) ?? null;
}

export const itemSprite = (slug: string) => (slug.startsWith('tm:') ? S + 'tm-normal.png' : S + slug + '.png');
