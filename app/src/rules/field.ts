// Habilidades de mapa (HMs e montarias): quem do time consegue superar cada obstáculo.
import { speciesById } from '../data';
import type { PokemonInstance } from '../model';

export interface FieldSkill {
    key: string;
    label: string;
    description: string;
    moves: string[];          // golpes que concedem a habilidade
    types: string[];          // ou tipos que concedem
    minLevel: number;
}

export const FIELD_SKILLS: FieldSkill[] = [
    { key: 'surf', label: 'Nadar', description: 'Atravessar lagos, rios e o mar.', moves: ['surf', 'waterfall', 'dive'], types: ['water'], minLevel: 20 },
    { key: 'fly', label: 'Voar', description: 'Viajar para cidades já visitadas.', moves: ['fly'], types: ['flying'], minLevel: 25 },
    { key: 'cut', label: 'Cortar', description: 'Abrir caminho em arbustos e mata fechada.', moves: ['cut', 'leaf-blade', 'slash', 'x-scissor'], types: ['grass', 'bug'], minLevel: 10 },
    { key: 'strength', label: 'Força', description: 'Empurrar pedras grandes.', moves: ['strength'], types: ['fighting'], minLevel: 20 },
    { key: 'rock-smash', label: 'Quebrar Pedras', description: 'Destruir rochas que bloqueiam a passagem.', moves: ['rock-smash', 'brick-break'], types: ['fighting', 'rock', 'ground'], minLevel: 12 },
    { key: 'flash', label: 'Iluminar', description: 'Enxergar em cavernas escuras.', moves: ['flash'], types: ['electric', 'fire'], minLevel: 8 },
    { key: 'climb', label: 'Escalar', description: 'Subir paredões e encostas.', moves: ['rock-climb'], types: ['rock', 'ground'], minLevel: 25 }
];

export const fieldSkillByKey = (key: string) => FIELD_SKILLS.find(s => s.key === key);

/** Um Pokémon pode usar a habilidade se conhece um dos golpes, ou se tem o tipo e o nível mínimo. */
export function canUseField(p: PokemonInstance, skill: FieldSkill): boolean {
    if (p.statusCondition === 'fainted') return false;
    if (p.moves.some(m => skill.moves.includes(m.slug))) return true;
    const types = speciesById(p.pokemonId)?.types ?? [];
    return p.level >= skill.minLevel && types.some(t => skill.types.includes(t));
}

export function fieldHelpers(team: PokemonInstance[], skillKey: string): PokemonInstance[] {
    const skill = fieldSkillByKey(skillKey);
    return skill ? team.filter(p => canUseField(p, skill)) : [];
}
