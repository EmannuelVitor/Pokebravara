// Gera os dados das espécies (stats completos, habilidades, evoluções, golpes) a partir da PokeAPI,
// mantendo os ids próprios do PokeBravara (1–145 Pokédex regional, 146+ iniciais) usados no Firestore.
// Uso: npm run data   (as respostas ficam em scripts/.cache para não repetir chamadas)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1');
const CACHE = path.join(ROOT, '.cache');
const OUT = path.join(ROOT, '..', 'src', 'data');
fs.mkdirSync(CACHE, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

// ---------- dados atuais do site (ids próprios + descrições do Mestre) ----------
const legacySource = fs.readFileSync(path.join(ROOT, '..', '..', 'public', 'database.js'), 'utf8');
const sandbox = {};
vm.runInNewContext(legacySource + ';this.m=masterPokemonList;this.s=starterData;', sandbox);
const legacy = [];
for (const p of sandbox.m) legacy.push({ id: p.id, dex: p.nationalId, description: p.description, regional: true });
for (const [generation, lines] of Object.entries(sandbox.s)) {
    lines.forEach((line, lineIndex) => line.forEach((p, stage) => {
        const dex = Number(p.image.match(/\/(\d+)\.png$/)[1]);
        legacy.push({ id: p.id, dex, starter: { generation, line: lineIndex, stage } });
    }));
}

// ---------- PokeAPI com cache e concorrência limitada ----------
async function get(url) {
    const file = path.join(CACHE, url.replace(/^https:\/\/pokeapi\.co\/api\/v2\//, '').replace(/[^\w]+/g, '_') + '.json');
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    for (let attempt = 1; ; attempt++) {
        try {
            const res = await fetch(url, { headers: { 'User-Agent': 'pokebravara-data-builder' } });
            if (!res.ok) throw new Error(res.status + ' ' + url);
            const json = await res.json();
            fs.writeFileSync(file, JSON.stringify(json));
            return json;
        } catch (error) {
            if (attempt >= 4) throw error;
            await new Promise(r => setTimeout(r, 800 * attempt));
        }
    }
}
async function pool(items, size, fn) {
    const results = new Array(items.length);
    let next = 0;
    await Promise.all(Array.from({ length: size }, async () => {
        while (next < items.length) {
            const i = next++;
            results[i] = await fn(items[i], i);
        }
    }));
    return results;
}
const API = 'https://pokeapi.co/api/v2/';
const flavor = (entries, field = 'flavor_text') => {
    const pick = lang => entries?.filter(e => e.language.name === lang).at(-1)?.[field];
    return (pick('es') || pick('en') || '').replace(/[\n\f­]+/g, ' ').replace(/\s+/g, ' ').trim();
};
const englishName = names => names?.find(n => n.language.name === 'en')?.name;

const VERSION_ORDER = ['scarlet-violet', 'sword-shield', 'ultra-sun-ultra-moon', 'sun-moon', 'omega-ruby-alpha-sapphire', 'x-y',
    'black-2-white-2', 'black-white', 'heartgold-soulsilver', 'platinum', 'emerald', 'firered-leafgreen'];
const STAT = { hp: 'hp', attack: 'atk', defense: 'def', 'special-attack': 'spa', 'special-defense': 'spd', speed: 'spe' };

console.log('espécies:', legacy.length);
const pokemon = await pool(legacy, 8, l => get(API + 'pokemon/' + l.dex));
const species = await pool(pokemon, 8, p => get(p.species.url));
const chainUrls = [...new Set(species.map(s => s.evolution_chain?.url).filter(Boolean))];
const chains = new Map((await pool(chainUrls, 8, u => get(u))).map((c, i) => [chainUrls[i], c]));

const idByDex = new Map();
for (const l of legacy) if (!idByDex.has(l.dex)) idByDex.set(l.dex, l.id);
const dexFromUrl = url => Number(url.match(/\/(\d+)\/?$/)[1]);

function evolutionsOf(chain, dex) {
    const find = node => (dexFromUrl(node.species.url) === dex ? node : node.evolves_to.map(find).find(Boolean));
    const node = find(chain.chain);
    if (!node) return [];
    return node.evolves_to.map(next => {
        const d = next.evolution_details.at(-1) || {};
        const trigger = d.trigger?.name;
        const toDex = dexFromUrl(next.species.url);
        return {
            toDex,
            to: idByDex.get(toDex) ?? null,
            toName: next.species.name.replace(/(^|-)\w/g, s => s.toUpperCase()).replace(/-/g, ' '),
            trigger: trigger === 'level-up' ? (d.min_happiness ? 'friendship' : d.min_level ? 'level' : 'other')
                : trigger === 'use-item' ? 'item' : trigger === 'trade' ? 'trade' : 'other',
            minLevel: d.min_level ?? null,
            item: d.item?.name ?? d.held_item?.name ?? null,
            minFriendship: d.min_happiness ?? null
        };
    });
}

const moveSlugs = new Set();
const abilitySlugs = new Set();
const out = legacy.map((l, i) => {
    const p = pokemon[i];
    const s = species[i];
    const base = Object.fromEntries(p.stats.map(st => [STAT[st.stat.name], st.base_stat]));
    let learnset = [];
    for (const vg of VERSION_ORDER) {
        learnset = p.moves.flatMap(m => m.version_group_details
            .filter(v => v.version_group.name === vg && v.move_learn_method.name === 'level-up')
            .map(v => ({ move: m.move.name, level: v.level_learned_at })));
        if (learnset.length) break;
    }
    learnset.sort((a, b) => a.level - b.level || a.move.localeCompare(b.move));
    learnset = learnset.filter((m, j, all) => all.findIndex(x => x.move === m.move) === j);
    learnset.forEach(m => moveSlugs.add(m.move));
    p.abilities.forEach(a => abilitySlugs.add(a.ability.name));
    return {
        id: l.id,
        dex: l.dex,
        name: englishName(s.names) || p.name,
        types: p.types.map(t => t.type.name),
        base,
        abilities: p.abilities.map(a => ({ slug: a.ability.name, hidden: a.is_hidden })),
        captureRate: s.capture_rate,
        growth: s.growth_rate.name,
        baseXp: p.base_experience ?? 60,
        legendary: s.is_legendary || s.is_mythical,
        height: p.height / 10,
        weight: p.weight / 10,
        description: l.description || flavor(s.flavor_text_entries),
        evolutions: s.evolution_chain ? evolutionsOf(chains.get(s.evolution_chain.url), l.dex) : [],
        learnset,
        regional: Boolean(l.regional),
        starter: l.starter ?? null
    };
});

console.log('golpes:', moveSlugs.size, 'habilidades:', abilitySlugs.size);
const moveList = [...moveSlugs];
const moveData = await pool(moveList, 8, slug => get(API + 'move/' + slug));
const moves = Object.fromEntries(moveData.map((m, i) => {
    const effect = (m.effect_entries.find(e => e.language.name === 'en')?.short_effect || '').replace(/\$effect_chance/g, String(m.effect_chance ?? ''));
    return [moveList[i], {
        name: englishName(m.names) || m.name,
        type: m.type.name,
        cls: m.damage_class?.name ?? 'status',
        power: m.power,
        accuracy: m.accuracy,
        pp: m.pp,
        priority: m.priority,
        target: m.target?.name,
        effect,
        ailment: m.meta?.ailment?.name && m.meta.ailment.name !== 'none' ? m.meta.ailment.name : null,
        ailmentChance: m.meta?.ailment_chance ?? 0,
        drain: m.meta?.drain ?? 0,
        healing: m.meta?.healing ?? 0,
        flinch: m.meta?.flinch_chance ?? 0,
        statChanges: m.stat_changes.map(c => ({ stat: STAT[c.stat.name] ?? c.stat.name, change: c.change })),
        statChance: m.meta?.stat_chance ?? 0
    }];
}));

const abilityList = [...abilitySlugs];
const abilityData = await pool(abilityList, 8, slug => get(API + 'ability/' + slug));
const abilities = Object.fromEntries(abilityData.map((a, i) => [abilityList[i], {
    name: englishName(a.names) || a.name,
    effect: a.effect_entries.find(e => e.language.name === 'en')?.short_effect || flavor(a.flavor_text_entries)
}]));

fs.writeFileSync(path.join(OUT, 'species.json'), JSON.stringify(out));
fs.writeFileSync(path.join(OUT, 'moves.json'), JSON.stringify(moves));
fs.writeFileSync(path.join(OUT, 'abilities.json'), JSON.stringify(abilities));
const size = f => (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0) + ' KB';
console.log('ok', size('species.json'), size('moves.json'), size('abilities.json'));
