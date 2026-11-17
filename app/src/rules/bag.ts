// Mochila: pilhas, limite de espaço por pilha e categorias.
import type { BagEntry } from '../model';
import { RULES } from './config';
import { itemBySlug } from './items';

/** Nomes do site v1. */
const LEGACY: Record<string, string> = { potion: 'potion', 'super-potion': 'super-potion' };

export function normalizeBag(raw: unknown): BagEntry[] {
    if (!Array.isArray(raw)) return [];
    const merged = new Map<string, number>();
    for (const entry of raw) {
        const slug = LEGACY[entry?.technicalName] ?? entry?.technicalName;
        const qty = Math.floor(Number(entry?.quantity) || 0);
        if (!slug || qty <= 0 || !itemBySlug(slug)) continue;
        merged.set(slug, (merged.get(slug) ?? 0) + qty);
    }
    return [...merged].map(([technicalName, quantity]) => ({ technicalName, quantity }));
}

/** Quantos espaços a mochila ocupa (pilhas de até RULES.bag.stack; itens-chave não contam). */
export function slotsUsed(bag: BagEntry[]): number {
    return bag.reduce((sum, e) => (itemBySlug(e.technicalName)?.category === 'key' ? sum : sum + Math.ceil(e.quantity / RULES.bag.stack)), 0);
}

export function quantityOf(bag: BagEntry[], slug: string): number {
    return bag.find(e => e.technicalName === slug)?.quantity ?? 0;
}

export function addItem(bag: BagEntry[], slug: string, quantity: number): { bag: BagEntry[]; error: string | null } {
    const next = bag.map(e => ({ ...e }));
    const entry = next.find(e => e.technicalName === slug);
    if (entry) entry.quantity += quantity;
    else next.push({ technicalName: slug, quantity });
    if (slotsUsed(next) > RULES.bag.slots) return { bag, error: `A mochila está cheia (${RULES.bag.slots} espaços).` };
    return { bag: next, error: null };
}

export function removeItem(bag: BagEntry[], slug: string, quantity = 1): { bag: BagEntry[]; error: string | null } {
    if (quantityOf(bag, slug) < quantity) return { bag, error: 'Quantidade insuficiente.' };
    const next = bag.map(e => (e.technicalName === slug ? { ...e, quantity: e.quantity - quantity } : e)).filter(e => e.quantity > 0);
    return { bag: next, error: null };
}
