// =====================================================================
// REGRAS AJUSTÁVEIS DO MESTRE
// Todos os números do sistema que não vêm dos jogos ficam aqui.
// Mude à vontade: o resto do site lê destes valores.
// =====================================================================

export const RULES = {
    party: { max: 6 },
    pc: { boxSize: 30, boxes: 8 },
    bag: {
        /** Espaços de pilhas na mochila (itens-chave não contam). */
        slots: 30,
        stack: 99
    },
    xp: {
        /** Multiplicador geral de XP da campanha. */
        multiplier: 1,
        /** Bônus de quem nocauteou ou capturou (0.5 = +50%). */
        directBonus: 0.5,
        /** Batalha contra treinador NPC rende mais. */
        trainerBattleMultiplier: 1.5
    },
    friendship: { start: 70, evolve: 220, max: 255, camp: 3, levelUp: 2 },
    battle: {
        critChance: 1 / 24,
        critMultiplier: 1.5,
        stab: 1.5,
        /** Bônus de iniciativa: velocidade do Pokémon + Agilidade do treinador x este valor. */
        agilityInitiative: 2,
        paralysisSkipChance: 0.25,
        freezeThawChance: 0.2,
        burnDamage: 1 / 16,
        poisonDamage: 1 / 8,
        sleepTurns: [1, 3] as [number, number]
    },
    capture: {
        /** Dado da captura. */
        die: 100,
        statusBonus: { sleep: 2, freeze: 2, paralysis: 1.5, burn: 1.5, poison: 1.5 } as Record<string, number>
    },
    rest: {
        /** Descanso curto em campo: fração do HP máximo recuperada. */
        shortRestHeal: 0.25,
        /** Acampamento: cura e PP. */
        campHeal: 0.5,
        campRestoresPP: true
    },
    trainer: {
        attributePoints: 12,
        attributeMin: 0,
        attributeMax: 5,
        proficiency: 2,
        startingMoney: 3000,
        chosenSkills: 2
    },
    rewards: {
        /** Recompensa base por vencer treinador NPC: nível médio do time x este valor. */
        perLevel: 40
    }
};
