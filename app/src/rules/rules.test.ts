import { describe, expect, it } from 'vitest';
import { SPECIES, speciesById, type Move } from '../data';
import type { PokemonInstance } from '../model';
import { addItem, normalizeBag, removeItem, slotsUsed } from './bag';
import { chooseEnemyMove, createBattle, resolveRound, type Battle } from './battle';
import { attemptCapture, captureChance } from './capture';
import { RULES } from './config';
import { calcDamage } from './damage';
import { roll, seeded, weightedPick } from './dice';
import { canUseField, fieldSkillByKey } from './field';
import { createPokemon, evolutionAvailable, evolve, gainXp, normalizePokemon, statsOf, useItemOn } from './pokemon';
import { calcStats } from './stats';
import { skillBonus, validateSheet } from './trainer';
import { defensiveProfile, effectiveness } from './types';
import { levelForXp, splitXp, xpForLevel } from './xp';

const charmander = SPECIES.find(s => s.name === 'Charmander')!;
const lotad = SPECIES.find(s => s.name === 'Lotad')!;

describe('dados', () => {
    it('mantém os ids do site antigo', () => {
        expect(speciesById(1)?.name).toBe('Lotad');
        expect(speciesById(146)?.name).toBe('Bulbasaur');
        expect(SPECIES).toHaveLength(226);
        expect(SPECIES.every(s => s.learnset.length > 0)).toBe(true);
    });
});

describe('dados de mesa', () => {
    it('rola expressões e respeita o modificador', () => {
        const r = roll('2d6+3', seeded(1));
        expect(r.dice).toHaveLength(2);
        expect(r.total).toBe(r.dice[0] + r.dice[1] + 3);
        expect(() => roll('abc')).toThrow();
    });
    it('escolhe por peso', () => {
        const table = [{ weight: 0, v: 'a' }, { weight: 5, v: 'b' }];
        expect(weightedPick(table, seeded(3))?.v).toBe('b');
    });
});

describe('stats e naturezas', () => {
    it('com natureza neutra bate com a fórmula do site v1', () => {
        const legacy = (b: number, l: number) => Math.floor((2 * b * l) / 100) + 5;
        const s = calcStats(lotad.base, 20, 'hardy');
        expect(s.hp).toBe(Math.floor((2 * lotad.base.hp * 20) / 100) + 20 + 10);
        expect(s.atk).toBe(legacy(lotad.base.atk, 20));
    });
    it('aplica +10% e -10%', () => {
        const neutral = calcStats(charmander.base, 50, 'hardy');
        const modest = calcStats(charmander.base, 50, 'modest');
        expect(modest.spa).toBe(Math.floor(neutral.spa * 1.1));
        expect(modest.atk).toBe(Math.floor(neutral.atk * 0.9));
        expect(modest.hp).toBe(neutral.hp);
    });
});

describe('experiência', () => {
    it('curvas oficiais', () => {
        expect(xpForLevel('medium', 10)).toBe(1000);
        expect(xpForLevel('fast', 100)).toBe(800000);
        expect(xpForLevel('slow', 100)).toBe(1250000);
        expect(levelForXp('medium', 999)).toBe(9);
        expect(levelForXp('medium', 1000)).toBe(10);
    });
    it('divide XP e dá bônus a quem participou diretamente', () => {
        const shares = splitXp(70, 10, ['a', 'b'], 'a');
        const total = Math.floor((70 * 10) / 7);
        expect(shares.find(s => s.key === 'b')!.amount).toBe(Math.floor(total / 2));
        expect(shares.find(s => s.key === 'a')!.amount).toBe(Math.floor(Math.floor(total / 2) * (1 + RULES.xp.directBonus)));
    });
    it('sobe de nível, aprende golpes e oferece evolução', () => {
        const p = createPokemon(charmander.id, 15, { nature: 'hardy', rng: seeded(2) });
        const r = gainXp(p, xpForLevel(charmander.growth, 16) - p.xp);
        expect(r.pokemon.level).toBe(16);
        expect(r.evolution).toBe(150);
        expect(r.pokemon.currentHp).toBe(statsOf(r.pokemon).hp);
    });
});

describe('evolução', () => {
    it('por item, mantendo nível e fração de HP', () => {
        const lombre = createPokemon(2, 30, { nature: 'hardy', rng: seeded(4) });
        expect(evolutionAvailable(lombre, 'item', 'water-stone')).toBe(3);
        const half = { ...lombre, currentHp: Math.floor(lombre.maxHp / 2) };
        const used = useItemOn(half, 'water-stone');
        expect(used.ok).toBe(true);
        expect(used.pokemon.pokemonId).toBe(3);
        expect(used.pokemon.level).toBe(30);
        expect(Math.abs(used.pokemon.currentHp / statsOf(used.pokemon).hp - 0.5)).toBeLessThan(0.05);
    });
    it('não evolui para espécie fora do PokeBravara', () => {
        const outside = SPECIES.find(s => s.evolutions.length > 0 && s.evolutions.every(e => e.to === null) && s.evolutions.some(e => e.trigger === 'level'));
        expect(outside).toBeDefined();
        expect(evolutionAvailable(createPokemon(outside!.id, 100), 'level')).toBeNull();
    });
    it('evolve troca a espécie', () => {
        const c = createPokemon(charmander.id, 16, { rng: seeded(1) });
        expect(evolve(c, 150).pokemonId).toBe(150);
    });
});

describe('Pokémon antigos (site v1)', () => {
    it('ganham natureza, golpes e XP sem perder HP', () => {
        const legacy = { pokemonId: 149, nickname: 'Charmander', level: 5, currentHp: 12, maxHp: 19, statusCondition: 'burned', atk: 10 } as unknown as PokemonInstance;
        const p = normalizePokemon(legacy, 2);
        expect(p.nickname).toBeUndefined();
        expect(p.statusCondition).toBe('burn');
        expect(p.currentHp).toBe(12);
        expect(p.moves.length).toBeGreaterThan(0);
        expect(p.uid).toBe('legacy-149-2');
    });
    it('HP 0 vira caído', () => {
        expect(normalizePokemon({ pokemonId: 1, level: 5, currentHp: 0 }).statusCondition).toBe('fainted');
    });
});

describe('itens', () => {
    it('cura sem passar do máximo e cura status', () => {
        const p = { ...createPokemon(1, 20, { rng: seeded(5) }), currentHp: 5, statusCondition: 'poison' as const };
        const potion = useItemOn(p, 'potion');
        expect(potion.pokemon.currentHp).toBe(Math.min(statsOf(p).hp, 25));
        expect(useItemOn(p, 'antidote').pokemon.statusCondition).toBe('none');
        expect(useItemOn({ ...p, currentHp: statsOf(p).hp, statusCondition: 'none' }, 'potion').ok).toBe(false);
    });
    it('revive só em caído', () => {
        const p = { ...createPokemon(1, 20), currentHp: 0, statusCondition: 'fainted' as const };
        expect(useItemOn(p, 'potion').ok).toBe(false);
        expect(useItemOn(p, 'revive').pokemon.currentHp).toBeGreaterThan(0);
    });
});

describe('mochila', () => {
    it('limita espaços e quantidades', () => {
        const bag = normalizeBag([{ technicalName: 'potion', quantity: 3 }, { technicalName: 'xyz', quantity: 1 }]);
        expect(bag).toEqual([{ technicalName: 'potion', quantity: 3 }]);
        expect(removeItem(bag, 'potion', 5).error).toBeTruthy();
        expect(addItem(bag, 'poke-ball', 99 * RULES.bag.slots).error).toBeTruthy();
        expect(slotsUsed(addItem(bag, 'town-map', 1).bag)).toBe(1);
    });
});

describe('tipos', () => {
    it('multiplicadores', () => {
        expect(effectiveness('water', ['fire'])).toBe(2);
        expect(effectiveness('electric', ['ground'])).toBe(0);
        expect(effectiveness('grass', ['water', 'ground'])).toBe(4);
        expect(effectiveness('fire', ['water', 'rock'])).toBe(0.25);
        expect(defensiveProfile(['fire']).weak.map(w => w[0])).toContain('water');
    });
});

describe('dano', () => {
    it('STAB, tipo e queimadura', () => {
        const ember = { name: 'Ember', type: 'fire', cls: 'special', power: 40, accuracy: 100, pp: 25, priority: 0, effect: '', ailment: null, ailmentChance: 0, drain: 0, healing: 0, flinch: 0, statChanges: [], statChance: 0 } satisfies Move;
        const base = { level: 20, attack: 30, defense: 30, move: ember, attackerTypes: ['fire'], defenderTypes: ['grass'], burned: false, forceCrit: false };
        const strong = calcDamage(base, () => 0.99);
        const neutral = calcDamage({ ...base, attackerTypes: ['water'], defenderTypes: ['normal'] }, () => 0.99);
        expect(strong.stab).toBe(true);
        expect(strong.damage).toBeGreaterThan(neutral.damage * 2.5);
        expect(calcDamage({ ...base, defenderTypes: ['fire', 'water'] }, () => 0.5).effectiveness).toBe(0.25);
    });
});

describe('captura', () => {
    it('chance cresce com HP baixo, status e bola melhor', () => {
        const base = { captureRate: 45, maxHp: 100, currentHp: 100, status: 'none' as const, ballMultiplier: 1 };
        const full = captureChance(base);
        expect(captureChance({ ...base, currentHp: 1 })).toBeGreaterThan(full);
        expect(captureChance({ ...base, status: 'sleep' })).toBeGreaterThan(full);
        expect(captureChance({ ...base, ballMultiplier: 2 })).toBeGreaterThan(full);
        expect(captureChance({ ...base, ballMultiplier: 255 })).toBe(100);
        expect(attemptCapture({ ...base, ballMultiplier: 255 }, seeded(1)).success).toBe(true);
    });
});

describe('ficha do treinador', () => {
    it('valida pontos e perícias', () => {
        const attrs = { for: 2, agi: 2, vig: 2, int: 2, per: 2, car: 2 };
        expect(validateSheet('treinador', attrs, ['furtividade', 'persuasao'])).toBeNull();
        expect(validateSheet('treinador', { ...attrs, for: 3 }, ['furtividade', 'persuasao'])).toMatch(/12 pontos/);
        expect(skillBonus({ trainerClass: 'treinador', skills: [], attributes: attrs }, 'atletismo')).toBe(2 + RULES.trainer.proficiency);
        expect(skillBonus({ trainerClass: 'treinador', skills: [], attributes: attrs }, 'furtividade')).toBe(2);
    });
});

describe('habilidades de campo', () => {
    it('tipo + nível ou golpe', () => {
        const surf = fieldSkillByKey('surf')!;
        expect(canUseField(createPokemon(1, 25), surf)).toBe(true);   // Lotad (água)
        expect(canUseField(createPokemon(1, 5), surf)).toBe(false);
        expect(canUseField(createPokemon(charmander.id, 50), surf)).toBe(false);
    });
});

describe('batalha', () => {
    function setup(enemyLevel = 3): Battle {
        const mine = createPokemon(charmander.id, 30, { nature: 'hardy', rng: seeded(10) });
        const wild = createPokemon(lotad.id, enemyLevel, { nature: 'hardy', rng: seeded(11) });
        return createBattle({
            campaign: 'brasa', createdBy: 'prof',
            trainers: [{ uid: 'ash', name: 'Ash', classKey: 'treinador', agility: 3, team: [mine] }],
            enemy: { kind: 'wild', name: 'Selvagem', npcId: null, reward: 0, badge: null, team: [wild] }
        });
    }

    it('um Pokémon forte derruba o selvagem, ganha XP e a batalha termina', () => {
        let b = setup();
        for (let i = 0; i < 6 && b.status === 'active'; i++) {
            b = resolveRound({ ...b, actions: { ash: { move: 0 } } }, seeded(100 + i));
        }
        expect(b.status).toBe('ended');
        expect(b.outcome).toBe('players');
        expect(b.xp.length).toBe(1);
        expect(b.xp[0].amount).toBeGreaterThan(0);
        expect(b.log.some(l => l.kind === 'hit')).toBe(true);
    });

    it('gasta PP', () => {
        const b = setup(30);
        const pp = b.trainers.ash.team[0].moves[0].pp;
        const next = resolveRound({ ...b, actions: { ash: { move: 0 } } }, seeded(7));
        expect(next.trainers.ash.team[0].moves[0].pp).toBe(pp - 1);
    });

    it('Master Ball captura e registra', () => {
        const b = setup();
        const next = resolveRound({ ...b, actions: { ash: { trainer: { type: 'ball', item: 'master-ball' } } } }, seeded(1));
        expect(next.outcome).toBe('captured');
        expect(next.captures[0].uid).toBe('ash');
        expect(next.consumed.ash).toEqual(['master-ball']);
    });

    it('comando de classe só uma vez', () => {
        const b = setup(30);
        const r1 = resolveRound({ ...b, actions: { ash: { command: true } } }, seeded(2));
        expect(r1.trainers.ash.commandUsed).toBe(true);
        const uid = r1.trainers.ash.team[0].uid;
        const atk = r1.stages[uid]?.atk ?? 0;
        const r2 = resolveRound({ ...r1, actions: { ash: { command: true } } }, seeded(3));
        expect(r2.stages[uid]?.atk ?? 0).toBe(atk);
    });

    it('inimigo escolhe um golpe válido', () => {
        const b = setup(30);
        const choice = chooseEnemyMove(b, seeded(9));
        expect(choice.target).toBe('ash');
        expect(b.enemy.team[0].moves[choice.move]).toBeDefined();
    });

    it('grupo derrotado perde a batalha', () => {
        const mine = { ...createPokemon(lotad.id, 2, { rng: seeded(1) }), currentHp: 1 };
        const strong = createPokemon(charmander.id, 60, { rng: seeded(2) });
        let b = createBattle({
            campaign: 'brasa', createdBy: 'prof',
            trainers: [{ uid: 'ash', name: 'Ash', classKey: null, agility: 0, team: [mine] }],
            enemy: { kind: 'npc', name: 'Rival', npcId: 'r', reward: 500, badge: null, team: [strong] }
        });
        for (let i = 0; i < 5 && b.status === 'active'; i++) b = resolveRound({ ...b, actions: { ash: { move: 0 } } }, seeded(20 + i));
        expect(b.outcome).toBe('enemy');
    });
});
