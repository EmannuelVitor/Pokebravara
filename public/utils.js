// utils.js

function calculateStats(baseStats, level) {
    if (!baseStats) {
        console.error("baseStats indefinido para o Pokémon!");
        return { maxHp: 10, currentHp: 10, atk: 5, def: 5, speed: 5 };
    }
    const maxHp = Math.floor(((2 * baseStats.hp) * level) / 100) + level + 10;
    const atk = Math.floor(((2 * baseStats.atk) * level) / 100) + 5;
    const def = Math.floor(((2 * baseStats.def) * level) / 100) + 5;
    const speed = Math.floor(((2 * baseStats.speed) * level) / 100) + 5;
    return { maxHp, currentHp: maxHp, atk, def, speed };
}

// --- Catálogo compartilhado (antes copiado em pc.js, mypc.js, time.js, trainers.js) ---

// Lista única de Pokémon: principal + iniciais (com stats base de reserva).
function getAllPokemon() {
    const byId = new Map();
    masterPokemonList.forEach(p => byId.set(p.id, p));
    Object.values(starterData).flat(2).forEach(starter => {
        if (byId.has(starter.id)) return;
        const master = masterPokemonList.find(p => p.nationalId === starter.nationalId);
        byId.set(starter.id, {
            ...starter,
            baseStats: master ? master.baseStats : { hp: 45, atk: 49, def: 49, speed: 45 }
        });
    });
    return Array.from(byId.values());
}

const itemCatalog = [
    {
        technicalName: 'potion',
        name: 'Potion',
        description: 'Cura 20 HP de um Pokémon.',
        image: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/potion.png',
        heal: 20
    },
    {
        technicalName: 'super-potion',
        name: 'Super Potion',
        description: 'Cura 50 HP de um Pokémon.',
        image: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/super-potion.png',
        heal: 50
    }
];

// --- Status com forma (nunca só cor) -----------------------------------------
const statusLabels = {
    none: 'Normal', ok: 'Normal', poisoned: 'Envenenado', paralyzed: 'Paralisado',
    burned: 'Queimado', asleep: 'Dormindo', frozen: 'Congelado', fainted: 'Caído'
};
const statusGlyphs = {
    poisoned: '<path d="M12 3s6 6.2 6 10.5a6 6 0 0 1-12 0C6 9.2 12 3 12 3Z"/>',
    paralyzed: '<path d="M13 3 5 13h6l-1 8 8-10h-6l1-8Z"/>',
    burned: '<path d="M12 3c.6 3 4 4.8 4 9a4 4 0 0 1-8 0c0-1.7.8-2.8 1.7-3.9C10.5 6.8 11.7 5.4 12 3Z"/>',
    asleep: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z"/>',
    frozen: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/>',
    fainted: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/>'
};

function statusLabel(status) {
    return statusLabels[status] || statusLabels.none;
}

// Ícone SVG do status ('' para Normal). Cor vem do CSS (.status-glyph.<status>).
function statusIcon(status) {
    const glyph = statusGlyphs[status];
    if (!glyph) return '';
    return '<svg class="status-glyph ' + status + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
        + 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="'
        + statusLabel(status) + '">' + glyph + '</svg>';
}

// --- Avatar com reserva: inicial do nome sobre cor estável (matiz de brasa) ---
function avatarDataUri(name) {
    const text = String(name || '?').trim();
    const initial = (text[0] || '?').toUpperCase().replace(/[&<>"']/g, '?');
    let hash = 0;
    for (const character of text) hash = (hash * 31 + character.charCodeAt(0)) % 360;
    const hue = 8 + (hash % 52);
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
        + '<rect width="64" height="64" fill="hsl(' + hue + ' 55% 24%)"/>'
        + '<text x="32" y="33" text-anchor="middle" dominant-baseline="central" '
        + 'font-family="sans-serif" font-size="30" font-weight="700" fill="hsl(' + hue + ' 90% 82%)">' + initial + '</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function setAvatar(img, url, name) {
    const fallback = avatarDataUri(name);
    img.onerror = () => { img.onerror = null; img.src = fallback; };
    img.src = url || fallback;
    img.hidden = false;
}
