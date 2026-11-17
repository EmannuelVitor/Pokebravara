// Popula o emulador local do Firestore com dados de teste (nunca toca no projeto real).
const BASE = 'http://127.0.0.1:8080/v1/projects/pokemonbravara/databases/(default)/documents';

function enc(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    if (typeof v === 'string') return { stringValue: v };
    return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
}
async function put(path, data) {
    const res = await fetch(`${BASE}/${path}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' }, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, enc(v)])) }) });
    if (!res.ok) throw new Error(path + ' ' + res.status + ' ' + (await res.text()));
}

// Cria (ou reaproveita) as contas Google falsas no emulador de Auth e descobre o uid de cada uma.
async function uidFor(email) {
    const sub = email.split('@')[0];
    const res = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=fake', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestUri: 'http://localhost', returnSecureToken: true, postBody: 'providerId=google.com&id_token=' + encodeURIComponent(JSON.stringify({ sub, email, email_verified: true, name: sub })) })
    });
    const json = await res.json();
    if (!json.localId) throw new Error('auth ' + JSON.stringify(json));
    return json.localId;
}
const UID = { mestre: await uidFor('mestre@teste.dev'), ash: await uidFor('ash@teste.dev'), misty: await uidFor('misty@teste.dev') };
console.log(UID);

await put('roles/professors', { emails: ['mestre@teste.dev'] });
await put('users/' + UID.mestre, { level: 'Professor', professorName: 'Prof. Carvalho', email: 'mestre@teste.dev', imageUrl: '' });
// Treinador no formato do site v1 (sem classe, sem natureza/golpes/XP)
await put('users/' + UID.ash, {
    level: 'Treinador', email: 'ash@teste.dev', trainerName: 'Ash', realName: 'Ash K.', gender: 'Masculino', age: 14, height: 150,
    description: 'Quer ser mestre Pokémon.', imageUrl: '', campaign: 'Brasa', pcUnlocked: false,
    team: [
        { pokemonId: 149, nickname: 'Charmander', level: 15, currentHp: 20, maxHp: 39, statusCondition: 'burned', isShiny: false, atk: 20, def: 18, speed: 22 },
        { pokemonId: 1, nickname: 'Folhinha', level: 13, currentHp: 0, maxHp: 35, statusCondition: 'fainted', isShiny: true, atk: 10, def: 10, speed: 10 }
    ],
    pc: [{ pokemonId: 2, nickname: 'Lombre', level: 22, currentHp: 50, maxHp: 50, statusCondition: 'none', atk: 20, def: 20, speed: 20 }],
    bag: [{ technicalName: 'potion', quantity: 5 }]
});
await put('users/' + UID.misty, {
    level: 'Treinador', email: 'misty@teste.dev', trainerName: 'Misty', realName: 'Misty W.', gender: 'Feminino', age: 15, height: 155, description: '', imageUrl: '',
    campaign: 'Brasa', trainerClass: 'pesquisador', attributes: { for: 1, agi: 3, vig: 2, int: 3, per: 2, car: 1 }, skills: ['furtividade', 'persuasao'], money: 3000,
    team: [], pc: [], bag: [{ technicalName: 'poke-ball', quantity: 5 }, { technicalName: 'great-ball', quantity: 2 }, { technicalName: 'potion', quantity: 3 }, { technicalName: 'water-stone', quantity: 1 }]
});
await put('campaigns/brasa', {
    id: 'brasa', name: 'Brasa', location: 'cidade-brasa', weather: 'limpo', log: [], factions: [
        { id: 'f1', name: 'Equipe Cinzas', kind: 'vila', threat: 3, description: 'Querem acordar o lendário do vulcão.', goals: 'Roubar as pedras de fogo do museu.', visible: true }
    ],
    npcs: [],
    regions: [
        { id: 'cidade-brasa', name: 'Cidade Brasa', kind: 'cidade', biome: 'vulcânico', description: 'Cidade ao pé do vulcão.', pokemonCenter: true, mart: true, requires: [], encounters: [], connections: ['rota-1'], x: 22, y: 60 },
        { id: 'rota-1', name: 'Rota 1', kind: 'rota', biome: 'campo', description: 'Grama alta e lagoas.', pokemonCenter: false, mart: false, requires: [], connections: ['cidade-brasa', 'caverna-cinza'], x: 48, y: 45,
          encounters: [{ pokemonId: 1, minLevel: 3, maxLevel: 6, weight: 50, weather: null }, { pokemonId: 4, minLevel: 4, maxLevel: 7, weight: 15, weather: null }] },
        { id: 'caverna-cinza', name: 'Caverna Cinza', kind: 'caverna', biome: 'subterrâneo', description: 'Escura e úmida.', pokemonCenter: false, mart: false, requires: ['flash'], connections: ['rota-1'], x: 76, y: 30,
          encounters: [{ pokemonId: 2, minLevel: 10, maxLevel: 14, weight: 30, weather: null }] }
    ]
});
console.log('emulador populado');
