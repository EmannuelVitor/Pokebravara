const byId = id => document.getElementById(id);
const status = byId('menu-status');
const retry = byId('retry-profile');
const form = byId('registration-form');
const submit = byId('submit-btn');
const signOut = byId('sign-out');
const menu = byId('main-menu');
const registration = byId('registration-panel');

const destinations = {
    id: ['ID de Treinador', 'Seu cartão e dados do personagem.', 'id-treinador.html', 'oklch(0.82 0.12 65)'],
    ball: ['Pokédex', 'Espécies da região e seus registros.', 'pokedex.html', 'oklch(0.75 0.16 25)'],
    team: ['Time', 'Pokémon ativos, HP e condições.', 'time.html', 'oklch(0.86 0.15 85)'],
    pc: ['PC', 'Caixa e organização de Pokémon.', 'mypc.html', 'oklch(0.78 0.16 50)'],
    bag: ['Mochila', 'Itens disponíveis para a aventura.', 'time.html#mochila', 'oklch(0.7 0.11 60)'],
    professorPc: ['PC dos treinadores', 'Times e caixas de todos os treinadores.', 'pc.html', 'oklch(0.78 0.16 50)'],
    trainers: ['Treinadores', 'Perfis, campanhas e times.', 'trainers.html', 'oklch(0.76 0.15 35)']
};

function showStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle('error', isError);
    status.hidden = !message;
}

let dbRef = null;

function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function teamStrip(team) {
    const catalog = getAllPokemon();
    const list = element('ul', 'team-strip');
    list.setAttribute('aria-label', 'Seu time');
    for (let index = 0; index < 6; index++) {
        const member = team[index];
        if (!member) {
            list.append(element('li', 'team-member empty', 'Vazio'));
            continue;
        }
        const info = catalog.find(entry => entry.id === member.pokemonId);
        const item = element('li', 'team-member' + (member.currentHp === 0 ? ' fainted' : ''));
        const picture = element('img');
        picture.alt = '';
        picture.src = info ? (member.isShiny && info.imageShiny ? info.imageShiny : info.image) : '';
        const percent = member.maxHp > 0 ? Math.round(member.currentHp / member.maxHp * 100) : 0;
        const bar = element('div', 'hp-bar');
        const fill = element('div', 'hp-value' + (percent <= 20 ? ' critical' : percent <= 50 ? ' low' : ''));
        fill.style.width = percent + '%';
        bar.append(fill);
        item.append(
            picture,
            element('strong', '', member.nickname || info?.name || 'Pokémon'),
            bar,
            element('span', 'team-hp', member.currentHp + ' / ' + member.maxHp)
        );
        const glyph = statusIcon(member.statusCondition);
        if (glyph) {
            const badge = element('span', 'team-status');
            badge.innerHTML = glyph;
            item.append(badge);
        }
        list.append(item);
    }
    return list;
}

function plural(count, singular, pluralForm) {
    return count + ' ' + (count === 1 ? singular : pluralForm);
}

function renderMenu(profile) {
    const professor = profile.level === 'Professor';
    const name = profile.trainerName || profile.professorName || profile.name || 'Aventureiro';
    byId('user-name-display').textContent = name;
    byId('user-level-display').textContent = (profile.level || 'Treinador') + (profile.campaign ? ' · ' + profile.campaign : '');
    setAvatar(byId('user-avatar'), profile.imageUrl, name);
    document.documentElement.dataset.campaign = String(profile.campaign || '').toLowerCase();

    const team = Array.isArray(profile.team) ? profile.team : [];
    const pc = Array.isArray(profile.pc) ? profile.pc : [];
    const bag = Array.isArray(profile.bag) ? profile.bag : [];
    const fainted = team.filter(member => member?.currentHp === 0).length;
    const bagTotal = bag.reduce((total, item) => total + (Number(item?.quantity) || 0), 0);

    const dynamic = professor ? {} : {
        team: team.length ? team.length + '/6 no time' + (fainted ? ' · ' + plural(fainted, 'caído', 'caídos') : '') : 'Nenhum Pokémon no time ainda.',
        pc: profile.pcUnlocked ? plural(pc.length, 'Pokémon na caixa', 'Pokémon na caixa') : 'Aguardando liberação do Professor.',
        bag: bagTotal ? plural(bagTotal, 'item', 'itens') : 'Mochila vazia.'
    };

    const head = element('div', 'dash-head');
    head.append(
        element('p', 'campaign-tag', profile.campaign ? 'Campanha ' + profile.campaign : professor ? 'Professor' : 'Sem campanha'),
        element('h1', '', 'Bem-vindo de volta, ' + name + '.'),
        element('p', '', professor
            ? 'Acompanhe os treinadores, os times e as caixas da campanha.'
            : 'Seu time, sua mochila e o que a campanha preparou para hoje.')
    );
    const dashboard = byId('dashboard');
    dashboard.replaceChildren(head);
    if (professor) {
        const stat = element('p', 'dash-stat', 'Contando treinadores…');
        dashboard.append(stat);
        if (dbRef) {
            dbRef.collection('users').where('level', '==', 'Treinador').get().then(snapshot => {
                stat.textContent = plural(snapshot.size, 'treinador na campanha', 'treinadores na campanha');
            }).catch(() => { stat.hidden = true; });
        } else {
            stat.hidden = true;
        }
    } else {
        dashboard.append(element('h2', 'dash-title', 'Seu time'), teamStrip(team));
    }

    const links = professor ? ['ball', 'trainers', 'professorPc'] : ['id', 'ball', 'team', 'pc', 'bag'];
    byId('menu-buttons').replaceChildren(...links.map(key => {
        const [title, description, href, color] = destinations[key];
        const link = element('a', 'menu-card');
        link.href = href;
        link.style.setProperty('--tile', color);
        const icon = element('span', 'tile-icon');
        icon.innerHTML = portalIcon({ trainers: 'team', professorPc: 'pc' }[key] || key);
        link.append(icon, element('strong', '', title), element('span', 'tile-text', dynamic[key] || description));
        return link;
    }));
    showStatus('');
    byId('user-header').hidden = false;
    registration.hidden = true;
    menu.hidden = false;
}

if (typeof firebase === 'undefined' || typeof firebase.auth !== 'function' || typeof firebase.firestore !== 'function' || typeof firebase.storage !== 'function') {
    showStatus('Os serviços do jogo não carregaram. Confira a conexão e recarregue a página.', true);
} else {
    const auth = firebase.auth();
    const db = firebase.firestore();
    dbRef = db;

    async function loadProfile(user) {
        showStatus('Carregando seu perfil…');
        retry.hidden = true;
        try {
            const reference = db.collection('users').doc(user.uid);
            const snapshot = await reference.get();
            if (snapshot.exists) {
                renderMenu(snapshot.data());
                return;
            }
            const professors = await db.collection('roles').doc('professors').get();
            if (professors.data()?.emails?.includes(user.email)) {
                const profile = {
                    level: 'Professor',
                    professorName: user.displayName || 'Novo Professor',
                    email: user.email,
                    imageUrl: user.photoURL || '',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                await reference.set(profile);
                renderMenu(profile);
                return;
            }
            showStatus('');
            registration.hidden = false;
            form.elements.realName.focus();
        } catch (error) {
            console.error('Falha ao carregar perfil', error.code);
            showStatus('Não foi possível carregar seu perfil.', true);
            retry.hidden = false;
        }
    }

    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.replace('index.html');
            return;
        }
        signOut.hidden = false;
        loadProfile(user);
    }, () => showStatus('Não foi possível verificar sua sessão. Recarregue a página.', true));

    retry.addEventListener('click', () => {
        if (auth.currentUser) loadProfile(auth.currentUser);
    });
    signOut.addEventListener('click', async () => {
        signOut.disabled = true;
        try {
            await auth.signOut();
        } catch {
            showStatus('Não foi possível sair. Tente novamente.', true);
            signOut.disabled = false;
        }
    });

    form.addEventListener('submit', async event => {
        event.preventDefault();
        const user = auth.currentUser;
        if (!user || submit.disabled) return;
        const fields = new FormData(form);
        const errorMessage = byId('registration-error');
        const names = ['realName', 'trainerName'];
        for (const name of names) {
            if (!fields.get(name).trim()) {
                errorMessage.textContent = 'Preencha seu nome e o nome do personagem.';
                errorMessage.hidden = false;
                form.elements[name].focus();
                return;
            }
        }

        const image = fields.get('image');
        if (!image.size || !['image/png', 'image/jpeg', 'image/gif'].includes(image.type)) {
            errorMessage.textContent = 'Escolha uma imagem PNG, JPEG ou GIF.';
            errorMessage.hidden = false;
            form.elements.image.focus();
            return;
        }

        errorMessage.hidden = true;
        submit.disabled = true;
        signOut.disabled = true;
        submit.textContent = 'Salvando perfil…';
        try {
            const upload = await firebase.storage().ref('profile_images/' + user.uid + '/' + image.name).put(image);
            const profile = {
                level: 'Treinador',
                realName: fields.get('realName').trim(),
                trainerName: fields.get('trainerName').trim(),
                gender: fields.get('gender'),
                age: Number(fields.get('age')),
                height: Number(fields.get('height')),
                description: fields.get('description').trim(),
                imageUrl: await upload.ref.getDownloadURL(),
                email: user.email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            await db.collection('users').doc(user.uid).set(profile);
            form.reset();
            renderMenu(profile);
            menu.querySelector('.menu-card')?.focus();
        } catch (error) {
            console.error('Falha ao salvar perfil', error.code);
            errorMessage.textContent = 'Não foi possível salvar o perfil. Confira a conexão e tente novamente.';
            errorMessage.hidden = false;
        } finally {
            submit.disabled = false;
            signOut.disabled = false;
            submit.textContent = 'Iniciar aventura';
        }
    });
}
