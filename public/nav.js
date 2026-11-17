// Barra de navegação global das páginas internas.
// Desktop: barra no topo. Celular: links numa barra fixa embaixo.
(() => {
    if (typeof firebase === 'undefined' || typeof firebase.auth !== 'function' || typeof firebase.firestore !== 'function') return;

    const LINKS = {
        trainer: [
            ['Início', 'menu.html'],
            ['Pokédex', 'pokedex.html'],
            ['Time', 'time.html'],
            ['PC', 'mypc.html'],
            ['Mochila', 'time.html#mochila'],
            ['Meu cartão', 'id-treinador.html']
        ],
        professor: [
            ['Início', 'menu.html'],
            ['Pokédex', 'pokedex.html'],
            ['Treinadores', 'trainers.html'],
            ['PC dos treinadores', 'pc.html']
        ]
    };

    const page = () => location.pathname.split('/').pop() || 'index.html';

    function isCurrent(href) {
        const [path, hash] = href.split('#');
        if (path !== page()) return false;
        if (path === 'time.html') return Boolean(hash) === (location.hash === '#mochila');
        return true;
    }

    let root = null;
    let links = [];

    function renderLinks(list) {
        list.replaceChildren(...links.map(([label, href]) => {
            const item = document.createElement('li');
            const anchor = document.createElement('a');
            anchor.href = href;
            anchor.textContent = label;
            if (isCurrent(href)) anchor.setAttribute('aria-current', 'page');
            item.append(anchor);
            return item;
        }));
    }

    function build(profile, auth) {
        links = LINKS[profile.level === 'Professor' ? 'professor' : 'trainer'];
        document.documentElement.dataset.campaign = String(profile.campaign || '').toLowerCase();

        root = document.createElement('div');
        root.className = 'app-nav';

        const skip = document.createElement('a');
        skip.className = 'skip-link';
        skip.href = '#conteudo';
        skip.textContent = 'Ir para o conteúdo';

        const bar = document.createElement('div');
        bar.className = 'app-nav-bar';

        const brand = document.createElement('a');
        brand.className = 'app-nav-brand';
        brand.href = 'menu.html';
        brand.textContent = 'PokeBravara';

        const nav = document.createElement('nav');
        nav.className = 'app-nav-links';
        nav.setAttribute('aria-label', 'Principal');
        const list = document.createElement('ul');
        nav.append(list);
        renderLinks(list);

        const user = document.createElement('div');
        user.className = 'app-nav-user';
        const name = document.createElement('span');
        name.textContent = profile.trainerName || profile.professorName || profile.name || 'Aventureiro';
        const out = document.createElement('button');
        out.type = 'button';
        out.className = 'app-nav-signout';
        out.textContent = 'Sair';
        out.addEventListener('click', async () => {
            out.disabled = true;
            try {
                await auth.signOut();
                window.location.replace('index.html');
            } catch {
                out.disabled = false;
                if (window.showToast) window.showToast('Não foi possível sair. Tente novamente.', 'error');
            }
        });
        user.append(name, out);

        bar.append(brand, nav, user);
        root.append(skip, bar);
        document.body.prepend(root);

        const main = document.querySelector('main');
        if (main) {
            if (!main.id) main.id = 'conteudo';
            skip.href = '#' + main.id;
        } else {
            skip.hidden = true;
        }
        document.body.classList.add('has-app-nav');

        window.addEventListener('hashchange', () => renderLinks(list));
    }

    const auth = firebase.auth();
    auth.onAuthStateChanged(async user => {
        if (!user || root) return;
        try {
            const snapshot = await firebase.firestore().collection('users').doc(user.uid).get();
            if (!snapshot.exists) return;
            build(snapshot.data(), auth);
        } catch {
            /* a própria página já mostra o erro de carregamento */
        }
    });
})();
