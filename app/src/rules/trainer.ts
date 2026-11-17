// Ficha do treinador: classes (build), atributos e perícias humanas, testes fora de combate.
import type { AttributeKey, TrainerProfile } from '../model';
import { RULES } from './config';
import { roll, type Rng, type Roll } from './dice';

export const ATTRIBUTES: { key: AttributeKey; label: string; hint: string }[] = [
    { key: 'for', label: 'Força', hint: 'Carregar, empurrar, escalar.' },
    { key: 'agi', label: 'Agilidade', hint: 'Reflexos, equilíbrio, iniciativa.' },
    { key: 'vig', label: 'Vigor', hint: 'Fôlego, resistência, sobrevivência.' },
    { key: 'int', label: 'Intelecto', hint: 'Estudo, lógica, conhecimento.' },
    { key: 'per', label: 'Percepção', hint: 'Notar detalhes, rastrear.' },
    { key: 'car', label: 'Carisma', hint: 'Conversar, convencer, liderar.' }
];

export interface Skill {
    key: string;
    label: string;
    attribute: AttributeKey;
}

export const SKILLS: Skill[] = [
    { key: 'atletismo', label: 'Atletismo', attribute: 'for' },
    { key: 'acrobacia', label: 'Acrobacia', attribute: 'agi' },
    { key: 'furtividade', label: 'Furtividade', attribute: 'agi' },
    { key: 'sobrevivencia', label: 'Sobrevivência', attribute: 'vig' },
    { key: 'investigacao', label: 'Investigação', attribute: 'int' },
    { key: 'conhecimento', label: 'Conhecimento Pokémon', attribute: 'int' },
    { key: 'medicina', label: 'Medicina', attribute: 'int' },
    { key: 'percepcao', label: 'Percepção', attribute: 'per' },
    { key: 'rastreio', label: 'Rastreio', attribute: 'per' },
    { key: 'persuasao', label: 'Persuasão', attribute: 'car' },
    { key: 'intimidacao', label: 'Intimidação', attribute: 'car' },
    { key: 'adestramento', label: 'Adestramento', attribute: 'car' }
];

export interface TrainerClass {
    key: string;
    label: string;
    focus: string;
    passive: string;
    command: { name: string; description: string };
    skills: string[];
    /** Efeitos mecânicos usados pelo motor. */
    effects: {
        damageBonus?: number;      // +x% de dano dos Pokémon do treinador
        statBonus?: number;        // +x% em todos os stats (exceto HP)
        captureBonus?: number;     // +x pontos na rolagem de captura
        revealsWild?: boolean;     // vê natureza/habilidade/fraquezas de selvagens
        encounterReroll?: boolean; // pode rerrolar um encontro por dia
        commandStat?: 'atk' | 'spe' | 'heal' | 'accuracy';
    };
}

export const CLASSES: TrainerClass[] = [
    {
        key: 'treinador', label: 'Treinador', focus: 'Batalha',
        passive: 'Seus Pokémon causam +10% de dano.',
        command: { name: 'Foco Total', description: 'Uma vez por batalha: o Pokémon em campo ganha +1 estágio de Ataque e At. Especial.' },
        skills: ['atletismo', 'intimidacao'],
        effects: { damageBonus: 0.1, commandStat: 'atk' }
    },
    {
        key: 'criador', label: 'Criador', focus: 'Atributos',
        passive: 'Seus Pokémon têm +5% em todos os stats (exceto HP) e ganham amizade mais rápido.',
        command: { name: 'Cuidado', description: 'Uma vez por batalha: cura 20% do HP máximo do Pokémon em campo.' },
        skills: ['medicina', 'adestramento'],
        effects: { statBonus: 0.05, commandStat: 'heal' }
    },
    {
        key: 'pesquisador', label: 'Pesquisador', focus: 'Conhecimento',
        passive: 'Vê natureza, habilidade e fraquezas de Pokémon selvagens; +10 na rolagem de captura.',
        command: { name: 'Análise', description: 'Uma vez por batalha: o próximo golpe do seu Pokémon não erra.' },
        skills: ['conhecimento', 'investigacao'],
        effects: { revealsWild: true, captureBonus: 10, commandStat: 'accuracy' }
    },
    {
        key: 'ranger', label: 'Ranger', focus: 'Exploração',
        passive: 'Pode rerrolar um encontro aleatório por dia e tem vantagem para atravessar o terreno.',
        command: { name: 'Terreno', description: 'Uma vez por batalha: o Pokémon em campo ganha +1 estágio de Velocidade.' },
        skills: ['sobrevivencia', 'rastreio'],
        effects: { encounterReroll: true, commandStat: 'spe' }
    }
];

export const classByKey = (key?: string | null) => CLASSES.find(c => c.key === key) ?? null;

export const emptyAttributes = (): Record<AttributeKey, number> => ({ for: 0, agi: 0, vig: 0, int: 0, per: 0, car: 0 });

export function attributePointsUsed(attributes: Record<AttributeKey, number>): number {
    return Object.values(attributes).reduce((sum, v) => sum + v, 0);
}

export function validateSheet(trainerClass: string, attributes: Record<AttributeKey, number>, skills: string[]): string | null {
    if (!classByKey(trainerClass)) return 'Escolha uma classe.';
    const used = attributePointsUsed(attributes);
    if (used !== RULES.trainer.attributePoints) return `Distribua exatamente ${RULES.trainer.attributePoints} pontos de atributo (${used} usados).`;
    if (Object.values(attributes).some(v => v < RULES.trainer.attributeMin || v > RULES.trainer.attributeMax)) return `Cada atributo vai de ${RULES.trainer.attributeMin} a ${RULES.trainer.attributeMax}.`;
    if (skills.length !== RULES.trainer.chosenSkills) return `Escolha ${RULES.trainer.chosenSkills} perícias além das da classe.`;
    return null;
}

/** Perícias treinadas = as da classe + as escolhidas. */
export function trainedSkills(trainer: Pick<TrainerProfile, 'trainerClass' | 'skills'>): string[] {
    return [...new Set([...(classByKey(trainer.trainerClass)?.skills ?? []), ...(trainer.skills ?? [])])];
}

export function skillBonus(trainer: Pick<TrainerProfile, 'trainerClass' | 'skills' | 'attributes'>, skillKey: string): number {
    const skill = SKILLS.find(s => s.key === skillKey);
    if (!skill) return 0;
    const attribute = trainer.attributes?.[skill.attribute] ?? 0;
    return attribute + (trainedSkills(trainer).includes(skillKey) ? RULES.trainer.proficiency : 0);
}

/** Teste de perícia: 1d20 + atributo + proficiência (se treinada). */
export function skillCheck(trainer: Pick<TrainerProfile, 'trainerClass' | 'skills' | 'attributes'>, skillKey: string, rng?: Rng): Roll {
    const bonus = skillBonus(trainer, skillKey);
    return roll('1d20' + (bonus >= 0 ? '+' : '') + bonus, rng);
}

export function attributeCheck(trainer: Pick<TrainerProfile, 'attributes'>, key: AttributeKey, rng?: Rng): Roll {
    const bonus = trainer.attributes?.[key] ?? 0;
    return roll('1d20+' + bonus, rng);
}
