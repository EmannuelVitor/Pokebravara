// Acesso ao Firestore. Toda escrita passa por aqui.
import {
    addDoc, collection, doc, getDocs, onSnapshot, query, setDoc, updateDoc, where, writeBatch
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../firebase';
import type { BagEntry, Campaign, PokemonInstance, TrainerProfile } from '../model';
import { addItem, removeItem } from '../rules/bag';
import type { Battle } from '../rules/battle';
import { consumedItems } from '../rules/battle';
import { RULES } from '../rules/config';
import { clean, normalizeTrainer } from './normalize';

// ----------------------------------------------------------------- treinadores
export const updateTrainer = (uid: string, patch: Partial<TrainerProfile>) => updateDoc(doc(db, 'users', uid), clean(patch) as Record<string, unknown>);

export function useTrainers(enabled: boolean) {
    const [trainers, setTrainers] = useState<TrainerProfile[] | null>(null);
    useEffect(() => {
        if (!enabled) return;
        return onSnapshot(query(collection(db, 'users'), where('level', '==', 'Treinador')), snap => {
            setTrainers(snap.docs.map(d => normalizeTrainer(d.id, d.data())).sort((a, b) => (a.trainerName ?? '').localeCompare(b.trainerName ?? '')));
        }, () => setTrainers([]));
    }, [enabled]);
    return trainers;
}

export function useTrainer(uid: string | undefined) {
    const [trainer, setTrainer] = useState<TrainerProfile | null | undefined>(undefined);
    useEffect(() => {
        if (!uid) return;
        return onSnapshot(doc(db, 'users', uid), snap => setTrainer(snap.exists() ? normalizeTrainer(snap.id, snap.data()) : null), () => setTrainer(null));
    }, [uid]);
    return trainer;
}

/** Coloca um Pokémon no time (se houver vaga) ou no PC. */
export function placePokemon(team: PokemonInstance[], pc: PokemonInstance[], p: PokemonInstance) {
    if (team.length < RULES.party.max) return { team: [...team, p], pc, where: 'time' as const };
    return { team, pc: [...pc, p], where: 'PC' as const };
}

export function changeBag(bag: BagEntry[], slug: string, delta: number): { bag: BagEntry[]; error: string | null } {
    return delta >= 0 ? addItem(bag, slug, delta) : removeItem(bag, slug, -delta);
}

// ----------------------------------------------------------------- Pokédex
export type DexStatus = 'unknown' | 'sighted' | 'captured';

export function useDex(uid: string | undefined) {
    const [dex, setDex] = useState<Map<number, DexStatus>>(new Map());
    useEffect(() => {
        if (!uid) return;
        return onSnapshot(collection(db, 'users', uid, 'pokedex'), snap => {
            setDex(new Map(snap.docs.map(d => [Number(d.id), (d.data().status as DexStatus) ?? 'sighted'])));
        }, error => { console.warn('Pokédex:', error.code); setDex(new Map()); });
    }, [uid]);
    return dex;
}

export async function markDex(uid: string, entries: { pokemonId: number; status: DexStatus }[], current?: Map<number, DexStatus>) {
    const batch = writeBatch(db);
    let count = 0;
    for (const { pokemonId, status } of entries) {
        if (current?.get(pokemonId) === 'captured' || (status === 'sighted' && current?.get(pokemonId) === 'sighted')) continue;
        batch.set(doc(db, 'users', uid, 'pokedex', String(pokemonId)), { status }, { merge: true });
        count++;
    }
    if (count) await batch.commit();
}

// ----------------------------------------------------------------- campanha
export const CAMPAIGNS = [{ id: 'brasa', name: 'Brasa' }, { id: 'fogo', name: 'Fogo' }];
export const campaignId = (name?: string | null) => (name ?? 'Brasa').toLowerCase();

export const emptyCampaign = (id: string): Campaign => ({
    id, name: CAMPAIGNS.find(c => c.id === id)?.name ?? id, location: null, weather: 'limpo', regions: [], npcs: [], factions: [], log: []
});

export function useCampaign(id: string | null | undefined) {
    const [campaign, setCampaign] = useState<Campaign | null>(null);
    useEffect(() => {
        if (!id) return;
        return onSnapshot(doc(db, 'campaigns', id), snap => setCampaign(snap.exists() ? { ...emptyCampaign(id), ...(snap.data() as Campaign), id } : emptyCampaign(id)), () => setCampaign(emptyCampaign(id)));
    }, [id]);
    return campaign;
}

export const saveCampaign = (c: Campaign) => setDoc(doc(db, 'campaigns', c.id), clean({ ...c, log: c.log.slice(-60) }));

// ----------------------------------------------------------------- batalhas
export function useActiveBattles(uid: string | undefined, professor: boolean) {
    const [battles, setBattles] = useState<Battle[]>([]);
    useEffect(() => {
        if (!uid) return;
        // um filtro só por consulta (dispensa índice composto); o status é filtrado aqui
        const q = professor
            ? query(collection(db, 'battles'), where('createdBy', '==', uid))
            : query(collection(db, 'battles'), where('participants', 'array-contains', uid));
        return onSnapshot(q, snap => setBattles(snap.docs
            .map(d => ({ ...(d.data() as Battle), id: d.id }))
            .filter(b => b.status === 'active' || (professor && !b.applied && b.outcome !== 'cancelled'))
            .sort((a, b) => b.createdAt - a.createdAt)), () => setBattles([]));
    }, [uid, professor]);
    return battles;
}

export function useBattle(id: string | undefined) {
    const [battle, setBattle] = useState<Battle | null | undefined>(undefined);
    useEffect(() => {
        if (!id) return;
        return onSnapshot(doc(db, 'battles', id), snap => setBattle(snap.exists() ? { ...(snap.data() as Battle), id: snap.id } : null), () => setBattle(null));
    }, [id]);
    return battle;
}

export async function createBattleDoc(battle: Battle): Promise<string> {
    const ref = await addDoc(collection(db, 'battles'), clean(battle));
    return ref.id;
}

export const saveBattle = (b: Battle) => setDoc(doc(db, 'battles', b.id!), clean({ ...b, id: undefined, log: b.log.slice(-200) }));

export const submitAction = (battleId: string, uid: string, action: unknown) =>
    updateDoc(doc(db, 'battles', battleId), { ['actions.' + uid]: clean(action) });

/**
 * Aplica o resultado da batalha nos treinadores: HP/XP/golpes do time, capturas (time ou PC),
 * itens gastos, recompensa, insígnia e Pokédex. Só o Mestre chama.
 */
export async function applyBattle(b: Battle) {
    const snaps = await getDocs(query(collection(db, 'users'), where('level', '==', 'Treinador')));
    const profiles = new Map(snaps.docs.map(d => [d.id, normalizeTrainer(d.id, d.data())]));
    const batch = writeBatch(db);
    const seen = [...new Set([...b.seen, ...b.enemy.team.map(p => p.pokemonId)])];
    for (const uid of b.participants) {
        const profile = profiles.get(uid);
        const bt = b.trainers[uid];
        if (!profile || !bt) continue;
        // time: mantém quem não estava na batalha (não deveria ocorrer) e atualiza quem estava
        let team = profile.team!.map(p => bt.team.find(x => x.uid === p.uid) ?? p);
        let pc = profile.pc ?? [];
        for (const capture of b.captures.filter(c => c.uid === uid)) {
            const placed = placePokemon(team, pc, capture.pokemon);
            team = placed.team;
            pc = placed.pc;
        }
        let bag = profile.bag ?? [];
        for (const item of consumedItems(b, uid)) bag = removeItem(bag, item, 1).bag;
        const patch: Partial<TrainerProfile> = { team, pc, bag };
        if (b.outcome === 'players' && b.enemy.kind === 'npc') {
            patch.money = (profile.money ?? 0) + Math.floor(b.enemy.reward / Math.max(1, b.participants.length));
            if (b.enemy.badge && !(profile.badges ?? []).includes(b.enemy.badge)) patch.badges = [...(profile.badges ?? []), b.enemy.badge];
        }
        batch.update(doc(db, 'users', uid), clean(patch) as Record<string, unknown>);
        for (const pokemonId of seen) batch.set(doc(db, 'users', uid, 'pokedex', String(pokemonId)), { status: 'sighted' }, { merge: true });
        for (const capture of b.captures.filter(c => c.uid === uid)) batch.set(doc(db, 'users', uid, 'pokedex', String(capture.pokemon.pokemonId)), { status: 'captured' });
    }
    batch.update(doc(db, 'battles', b.id!), { applied: true });
    await batch.commit();
}
