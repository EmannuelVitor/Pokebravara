import type { PokemonInstance, TrainerProfile } from '../model';
import { normalizeBag } from '../rules/bag';
import { normalizePokemon } from '../rules/pokemon';
import { speciesById } from '../data';

const trimmed = (value: unknown) => (typeof value === 'string' ? value.trim() : undefined);

export function normalizeTeam(raw: unknown, offset = 0): PokemonInstance[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .filter(p => p && speciesById(Number(p.pokemonId)))
        .map((p, i) => normalizePokemon({ ...p, pokemonId: Number(p.pokemonId) }, i + offset));
}

export function normalizeTrainer(id: string, data: Record<string, unknown>): TrainerProfile {
    return {
        ...(data as Partial<TrainerProfile>),
        id,
        level: data.level === 'Professor' ? 'Professor' : 'Treinador',
        email: String(data.email ?? ''),
        trainerName: trimmed(data.trainerName),
        professorName: trimmed(data.professorName),
        realName: trimmed(data.realName),
        description: trimmed(data.description),
        team: normalizeTeam(data.team, 0),
        pc: normalizeTeam(data.pc, 100),
        bag: normalizeBag(data.bag),
        money: Number.isFinite(data.money) ? Number(data.money) : 0,
        badges: Array.isArray(data.badges) ? (data.badges as string[]) : [],
        skills: Array.isArray(data.skills) ? (data.skills as string[]) : []
    };
}

export const trainerName = (t: Pick<TrainerProfile, 'trainerName' | 'professorName'> | null | undefined) =>
    t?.trainerName || t?.professorName || 'Sem nome';

/** Remove undefined (o Firestore rejeita). */
export function clean<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}
