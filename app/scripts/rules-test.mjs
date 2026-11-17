// Testa firestore.rules contra o emulador via REST (sem dependências).
const HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const BASE = `http://${HOST}/v1/projects/demo-test/databases/(default)/documents`;

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const token = (uid, email) => b64({ alg: 'none', typ: 'JWT' }) + '.' + b64({ user_id: uid, sub: uid, email, email_verified: true, firebase: { sign_in_provider: 'google.com' } }) + '.';

function enc(v) {
    if (v === null) return { nullValue: null };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number') return { integerValue: String(v) };
    if (typeof v === 'string') return { stringValue: v };
    return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
}
const fields = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, enc(v)]));

async function call(auth, method, path, body, query = '') {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) headers.Authorization = 'Bearer ' + auth;
    const res = await fetch(path.startsWith(':') ? `${BASE}${path}${query}` : `${BASE}/${path}${query}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });
    return res.status;
}
const seed = (path, data) => call('owner', 'PATCH', path, { fields: fields(data) });
const mask = keys => '?' + keys.map(k => 'updateMask.fieldPaths=' + k).join('&');

const T1 = token('t1', 't1@x.com');
const T2 = token('t2', 't2@x.com');
const PROF = token('prof1', 'prof@x.com');
const NEW = token('n1', 'new@x.com');
const NEWPROF = token('p2', 'newprof@x.com');
const NOTPROF = token('n2', 'fake@x.com');

let failures = 0;
function expect(name, status, allowed) {
    const ok = allowed ? status === 200 : status === 403;
    if (!ok) failures++;
    console.log((ok ? 'OK   ' : 'FALHA') + ' ' + name + ' -> ' + status + (allowed ? ' (esperado permitir)' : ' (esperado negar)'));
}

(async () => {
    await seed('roles/professors', { emails: ['prof@x.com', 'newprof@x.com'] });
    await seed('users/prof1', { level: 'Professor', email: 'prof@x.com', professorName: 'Prof' });
    for (const id of ['t1', 't2']) {
        await seed('users/' + id, { level: 'Treinador', email: id + '@x.com', trainerName: id, team: [], pc: [], bag: [], pcUnlocked: false, campaign: 'Brasa', createdAt: 1 });
    }

    expect('treinador lê o próprio perfil', await call(T1, 'GET', 'users/t1'), true);
    expect('treinador NÃO lê perfil de outro', await call(T1, 'GET', 'users/t2'), false);
    const listQuery = { structuredQuery: { from: [{ collectionId: 'users' }], where: { fieldFilter: { field: { fieldPath: 'level' }, op: 'EQUAL', value: { stringValue: 'Treinador' } } } } };
    expect('treinador NÃO lista usuários', await call(T1, 'POST', ':runQuery', listQuery), false);
    expect('professor lê perfil de treinador', await call(PROF, 'GET', 'users/t1'), true);
    expect('professor lista treinadores', await call(PROF, 'POST', ':runQuery', listQuery), true);
    expect('usuário logado lê roles/professors', await call(T1, 'GET', 'roles/professors'), true);
    expect('sem login NÃO lê perfil', await call('', 'GET', 'users/t1'), false);

    expect('treinador atualiza o próprio time', await call(T1, 'PATCH', 'users/t1', { fields: fields({ team: [{ pokemonId: 1 }] }) }, mask(['team'])), true);
    expect('treinador atualiza a própria mochila', await call(T1, 'PATCH', 'users/t1', { fields: fields({ bag: [{ technicalName: 'potion', quantity: 1 }] }) }, mask(['bag'])), true);
    expect('treinador NÃO se promove a Professor', await call(T1, 'PATCH', 'users/t1', { fields: fields({ level: 'Professor' }) }, mask(['level'])), false);
    expect('treinador NÃO libera o próprio PC', await call(T1, 'PATCH', 'users/t1', { fields: fields({ pcUnlocked: true }) }, mask(['pcUnlocked'])), false);
    expect('treinador NÃO muda a campanha', await call(T1, 'PATCH', 'users/t1', { fields: fields({ campaign: 'Fogo' }) }, mask(['campaign'])), false);
    expect('treinador NÃO edita outro treinador', await call(T1, 'PATCH', 'users/t2', { fields: fields({ team: [] }) }, mask(['team'])), false);

    expect('professor libera PC de treinador', await call(PROF, 'PATCH', 'users/t1', { fields: fields({ pcUnlocked: true }) }, mask(['pcUnlocked'])), true);
    expect('professor muda campanha', await call(PROF, 'PATCH', 'users/t1', { fields: fields({ campaign: 'Fogo' }) }, mask(['campaign'])), true);
    expect('professor edita time e PC', await call(PROF, 'PATCH', 'users/t1', { fields: fields({ team: [], pc: [] }) }, mask(['team', 'pc'])), true);
    expect('professor NÃO altera level de treinador', await call(PROF, 'PATCH', 'users/t1', { fields: fields({ level: 'Professor' }) }, mask(['level'])), false);

    const trainerProfile = { level: 'Treinador', realName: 'N', trainerName: 'Novo', gender: 'Masculino', age: 12, height: 150, description: '', imageUrl: 'x', email: 'new@x.com', createdAt: 1 };
    expect('cadastro válido de treinador', await call(NEW, 'PATCH', 'users/n1', { fields: fields(trainerProfile) }), true);
    expect('cadastro NÃO nasce com PC liberado', await call(token('n3', 'n3@x.com'), 'PATCH', 'users/n3', { fields: fields({ ...trainerProfile, email: 'n3@x.com', pcUnlocked: true }) }), false);
    expect('cadastro NÃO nasce com mochila', await call(token('n4', 'n4@x.com'), 'PATCH', 'users/n4', { fields: fields({ ...trainerProfile, email: 'n4@x.com', bag: [{ technicalName: 'potion', quantity: 99 }] }) }), false);
    expect('cadastro NÃO cria perfil de outro uid', await call(NEW, 'PATCH', 'users/outro', { fields: fields(trainerProfile) }), false);
    expect('e-mail não listado NÃO vira Professor', await call(NOTPROF, 'PATCH', 'users/n2', { fields: fields({ level: 'Professor', professorName: 'X', email: 'fake@x.com', imageUrl: '', createdAt: 1 }) }), false);
    expect('e-mail listado vira Professor', await call(NEWPROF, 'PATCH', 'users/p2', { fields: fields({ level: 'Professor', professorName: 'P', email: 'newprof@x.com', imageUrl: '', createdAt: 1 }) }), true);

    expect('treinador grava a própria Pokédex', await call(T1, 'PATCH', 'users/t1/pokedex/5', { fields: fields({ status: 'sighted' }) }), true);
    expect('treinador NÃO grava Pokédex de outro', await call(T1, 'PATCH', 'users/t2/pokedex/5', { fields: fields({ status: 'captured' }) }), false);
    expect('ninguém grava roles/professors', await call(PROF, 'PATCH', 'roles/professors', { fields: fields({ emails: ['x@x.com'] }) }), false);
    expect('ninguém apaga perfil', await call(T1, 'DELETE', 'users/t1'), false);


    // ---------------- v2
    await seed('users/t3', { level: 'Treinador', email: 't3@x.com', trainerName: 't3', money: 500, team: [], bag: [] });
    const T3 = token('t3', 't3@x.com');
    expect('v2: dono gasta dinheiro', await call(T3, 'PATCH', 'users/t3', { fields: fields({ money: 200 }) }, mask(['money'])), true);
    expect('v2: dono NÃO aumenta o dinheiro', await call(T3, 'PATCH', 'users/t3', { fields: fields({ money: 99999 }) }, mask(['money'])), false);
    expect('v2: dono completa ficha antiga', await call(T3, 'PATCH', 'users/t3', { fields: fields({ trainerClass: 'ranger', attributes: { for: 2 }, skills: ['furtividade'] }) }, mask(['trainerClass', 'attributes', 'skills'])), true);
    expect('v2: dono NÃO troca de classe depois', await call(T3, 'PATCH', 'users/t3', { fields: fields({ trainerClass: 'treinador' }) }, mask(['trainerClass'])), false);
    expect('v2: dono NÃO se dá insígnia', await call(T3, 'PATCH', 'users/t3', { fields: fields({ badges: ['x'] }) }, mask(['badges'])), false);
    expect('v2: Mestre dá dinheiro e insígnia', await call(PROF, 'PATCH', 'users/t3', { fields: fields({ money: 5000, badges: ['Brasa'] }) }, mask(['money', 'badges'])), true);
    const sheet = { ...trainerProfile, email: 'n5@x.com', trainerClass: 'treinador', attributes: { for: 2 }, skills: ['furtividade'], money: 3000 };
    expect('v2: cadastro com ficha e dinheiro inicial', await call(token('n5', 'n5@x.com'), 'PATCH', 'users/n5', { fields: fields(sheet) }), true);
    expect('v2: cadastro NÃO começa rico', await call(token('n6', 'n6@x.com'), 'PATCH', 'users/n6', { fields: fields({ ...sheet, email: 'n6@x.com', money: 999999 }) }), false);
    expect('v2: Mestre grava Pokédex do treinador', await call(PROF, 'PATCH', 'users/t1/pokedex/9', { fields: fields({ status: 'captured' }) }), true);

    expect('v2: Mestre cria campanha', await call(PROF, 'PATCH', 'campaigns/brasa', { fields: fields({ name: 'Brasa', regions: [] }) }), true);
    expect('v2: treinador lê campanha', await call(T1, 'GET', 'campaigns/brasa'), true);
    expect('v2: treinador NÃO edita campanha', await call(T1, 'PATCH', 'campaigns/brasa', { fields: fields({ name: 'X' }) }), false);

    expect('v2: Mestre cria batalha', await call(PROF, 'PATCH', 'battles/b1', { fields: fields({ status: 'active', createdBy: 'prof1', participants: ['t1', 't2'], actions: {}, round: 1 }) }), true);
    expect('v2: participante lê a batalha', await call(T1, 'GET', 'battles/b1'), true);
    expect('v2: outro treinador NÃO lê', await call(T3, 'GET', 'battles/b1'), false);
    const battleQuery = { structuredQuery: { from: [{ collectionId: 'battles' }], where: { fieldFilter: { field: { fieldPath: 'participants' }, op: 'ARRAY_CONTAINS', value: { stringValue: 't1' } } } } };
    expect('v2: participante lista as próprias batalhas', await call(T1, 'POST', ':runQuery', battleQuery), true);
    expect('v2: participante envia a própria ação', await call(T1, 'PATCH', 'battles/b1', { fields: fields({ actions: { t1: { move: 0 } } }) }, mask(['actions'])), true);
    expect('v2: participante NÃO escreve ação de outro', await call(T1, 'PATCH', 'battles/b1', { fields: fields({ actions: { t1: { move: 0 }, t2: { move: 1 } } }) }, mask(['actions'])), false);
    expect('v2: participante NÃO muda o resultado', await call(T1, 'PATCH', 'battles/b1', { fields: fields({ status: 'ended' }) }, mask(['status'])), false);
    expect('v2: Mestre resolve a rodada', await call(PROF, 'PATCH', 'battles/b1', { fields: fields({ round: 2, actions: {} }) }, mask(['round', 'actions'])), true);

    console.log(failures ? `\n${failures} FALHA(S)` : '\nTodas as regras se comportaram como esperado.');
    process.exit(failures ? 1 : 0);
})();
