(() => {

if (typeof firebase === 'undefined' || typeof firebase.auth !== 'function' || typeof firebase.firestore !== 'function') {
        showPageError('Os serviços do jogo não carregaram. Confira a conexão e recarregue a página.');
        return;
    }
const auth = firebase.auth();
const db = firebase.firestore();

// --- ELEMENTOS DO DOM ---
const pokedexGrid = document.getElementById('pokedex-grid');
const spinner = document.getElementById('spinner');
const searchContainer = document.getElementById('search-container');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const pageTitle = document.querySelector('h1');
const btnTabPokedex = document.getElementById('btn-tab-pokedex');
const btnTabIniciais = document.getElementById('btn-tab-iniciais');
const searchPreview = document.getElementById('search-preview');
const interactionModal = document.getElementById('interaction-modal');
const modalPokemonName = document.getElementById('modal-pokemon-name');
const modalInteractionImage = document.getElementById('modal-interaction-image');
const detailsModal = document.getElementById('details-modal');
const detailsImage = document.getElementById('details-image');
const detailsNumber = document.getElementById('details-number');
const detailsName = document.getElementById('details-name');
const detailsTypes = document.getElementById('details-types');
const detailsDesc = document.getElementById('details-desc');
const detailsStats = document.getElementById('details-stats');
const filterContainer = document.getElementById('filter-container');
const filterInput = document.getElementById('filter-input');
const statusFilters = document.getElementById('status-filters');
const dexCounter = document.getElementById('dex-counter');

// --- VARIÁVEIS GLOBAIS ---
let currentUser = null;
let userPokedexProgress = new Map();
let currentLevel = 'Treinador';
let filterTerm = '';
let filterStatus = 'all';

// --- LÓGICA DE AUTENTICAÇÃO ---
auth.onAuthStateChanged(user => {
    if (user) {
        spinner.classList.remove('hidden');
        currentUser = user;
        db.collection('users').doc(user.uid).get().then(doc => {
            if (doc.exists) {
                currentLevel = doc.data().level;
                loadPokedexData();
            } else {
                console.warn("Usuário autenticado sem perfil no Firestore. Redirecionando para o menu.");
                window.location.href = 'menu.html';
            }
        }).catch(error => {
            console.error("Erro ao buscar perfil:", error);
            showPageError('Não foi possível carregar seu perfil. Recarregue a página para tentar novamente.');
        });
    } else {
        console.log("Nenhum usuário logado, redirecionando para o login.");
        window.location.href = 'index.html';
    }
});

// --- FUNÇÕES PRINCIPAIS DE RENDERIZAÇÃO ---
async function loadPokedexData() {
    if (currentLevel === 'Treinador') {
        try {
            const snapshot = await db.collection('users').doc(currentUser.uid).collection('pokedex').get();
            userPokedexProgress.clear();
            
            console.log(`Buscando progresso da Pokédex... Encontrados ${snapshot.size} registros.`);

            snapshot.forEach(doc => {
                userPokedexProgress.set(Number(doc.id), doc.data());
            });
        } catch (error) {
            console.error("Erro CRÍTICO ao buscar progresso da Pokédex:", error);
            showToast("Não foi possível carregar seu progresso da Pokédex. Recarregue a página para tentar novamente.", 'error');
        }
    }
    // O resto da lógica continua a mesma
    renderContent(location.hash === '#iniciais' ? 'iniciais' : 'pokedex');
    spinner.classList.add('hidden');  
}
function renderContent(tabName) {
    pokedexGrid.innerHTML = '';
    if (tabName === 'iniciais') {
        pageTitle.textContent = 'Pokémon Iniciais';
        btnTabIniciais.classList.add('active');
        btnTabPokedex.classList.remove('active');
        if (searchContainer) searchContainer.classList.add('hidden');
        filterContainer.classList.add('hidden');
        displayStarters();
    } else {
        pageTitle.textContent = 'Pokédex';
        btnTabPokedex.classList.add('active');
        btnTabIniciais.classList.remove('active');
        if (currentLevel === 'Treinador' && searchContainer) {
            searchContainer.classList.remove('hidden');
        }
        filterContainer.classList.remove('hidden');
        statusFilters.classList.toggle('hidden', currentLevel !== 'Treinador');
        displayPokedex();
    }
}

function displayPokedex() {
    pokedexGrid.innerHTML = '';
    
    // Mapeia a lista mestre para uma lista de exibição
    const displayList = masterPokemonList.map(pokemon => {
        let status = 'unknown'; // O padrão para treinador é 'desconhecido'
        let isShiny = false;
        
        // Se o usuário for Professor, o status de todos é 'captured'
        if (currentLevel === 'Professor') {
            status = 'captured';
        } 
        // Se for Treinador, verifica o progresso individual salvo no Firestore
        else if (userPokedexProgress.has(pokemon.id)) {
            const progress = userPokedexProgress.get(pokemon.id);
            status = progress.status;
            isShiny = progress.isShiny || false;
        }

        // Retorna um novo objeto com o status e shiny corretos para exibição
        return { ...pokemon, status: status, isShiny: isShiny };
    });

    updateCounter(displayList);

    const numeric = /^#?\d+$/.test(filterTerm) ? Number(filterTerm.replace('#', '')) : null;
    const visibleList = displayList.filter(pokemon => {
        if (filterStatus !== 'all' && pokemon.status !== filterStatus) return false;
        if (!filterTerm) return true;
        if (numeric !== null) return pokemon.id === numeric;
        // nomes de espécies ainda desconhecidas não podem ser descobertos pela busca
        return pokemon.status !== 'unknown' && pokemon.name.toLowerCase().includes(filterTerm);
    });
    if (!visibleList.length) {
        const empty = document.createElement('p');
        empty.className = 'dex-empty';
        empty.textContent = 'Nenhum Pokémon encontrado com esse filtro.';
        pokedexGrid.appendChild(empty);
        return;
    }

    // Agora desenha os cards na tela usando a lista de exibição
    visibleList.forEach(pokemon => {
        const card = document.createElement('div');
        card.className = `pokemon-card ${pokemon.status}`;

        if (pokemon.status !== 'unknown' || currentLevel === 'Professor') {
            activateCard(card, () => showDetailsModal(pokemon));
            card.style.cursor = 'pointer';
        }

        let pokemonName = pokemon.name;
        if (['Tinkaton', 'Sylveon'].includes(pokemon.name)) {
            pokemonName += ' ❤️';
        }
        const pokemonDBUrl = `https://pokemondb.net/pokedex/${pokemon.name.toLowerCase()}`;
        const nameHtml = `<a href="${pokemonDBUrl}" target="_blank" rel="noopener noreferrer" class="pokemon-name-link">${pokemonName}</a>`;
        
        const paddedId = `#${String(pokemon.id).padStart(3, '0')}`;
        // Para Professores, sempre mostra a imagem normal, para Treinadores, depende se é shiny
        const imageUrl = (currentLevel === 'Professor' || !pokemon.isShiny) ? pokemon.image : pokemon.imageShiny;

        let cardContent = '';
        if (pokemon.status === 'unknown') {
            cardContent = `<img class="pokemon-image" loading="lazy" decoding="async" src="${pokemon.image}" alt="?" style="filter: brightness(0);"><p class="pokemon-number">${paddedId}</p><h3 class="pokemon-name">???</h3>`;
        } else if (pokemon.status === 'sighted') {
            cardContent = `<img class="pokemon-image" loading="lazy" decoding="async" src="${imageUrl}" alt="${pokemon.name}"><p class="pokemon-number">${paddedId}</p><h3 class="pokemon-name">${nameHtml}</h3>`;
        } else { // captured
            cardContent = `<img class="pokemon-image" loading="lazy" decoding="async" src="${imageUrl}" alt="${pokemon.name}"><p class="pokemon-number">${paddedId}</p><h3 class="pokemon-name">${nameHtml}</h3><div class="pokemon-stats">HP: ${pokemon.baseStats.hp} | ATK: ${pokemon.baseStats.atk}</div><div class="pokemon-stats">DEF: ${pokemon.baseStats.def} | SPEED: ${pokemon.baseStats.speed}</div>`;
        }

        card.innerHTML = cardContent;
        if (pokemon.status === 'captured') {
            const pokeballIcon = document.createElement('div');
            pokeballIcon.className = 'captured-icon';
            card.appendChild(pokeballIcon);
        }
        pokedexGrid.appendChild(card);
    });
}

function updateCounter(list) {
    const total = list.length;
    if (currentLevel !== 'Treinador') {
        dexCounter.textContent = total + ' espécies';
        return;
    }
    const captured = list.filter(p => p.status === 'captured').length;
    const sighted = list.filter(p => p.status === 'sighted').length;
    dexCounter.textContent = captured + ' capturados · ' + sighted + ' avistados · ' + total + ' espécies';
}

function displayStarters() {
    pokedexGrid.innerHTML = '';
    for (const generation in starterData) {
        const section = document.createElement('section');
        section.className = 'generation-section';
        const title = document.createElement('h2');
        title.className = 'generation-title';
        title.textContent = generation;
        section.appendChild(title);

        starterData[generation].forEach(evolutionLine => {
            const lineDiv = document.createElement('div');
            lineDiv.className = 'starter-line';
            evolutionLine.forEach(pokemon => {
                const card = document.createElement('div');
                card.className = 'starter-card';
                activateCard(card, () => showDetailsModal(pokemon));
                card.style.cursor = 'pointer';
                const typesHtml = pokemon.type.map(type => `<span class="type-badge" style="background-color: ${typeColors[type] || '#777'}">${type}</span>`).join('');
                let pokemonName = pokemon.name;
                if (pokemon.name === 'Meowscarada') {
                    pokemonName += ' ❤️';
                }
                const pokemonDBUrl = `https://pokemondb.net/pokedex/${pokemon.name.toLowerCase()}`;
                const nameHtml = `<a href="${pokemonDBUrl}" target="_blank" rel="noopener noreferrer" class="pokemon-name-link">${pokemonName}</a>`;
                card.innerHTML = `<img class="pokemon-image" loading="lazy" decoding="async" src="${pokemon.image}" alt="${pokemon.name}"><h3 class="starter-name">${nameHtml}</h3><p class="starter-info">#${String(pokemon.id).padStart(3, '0')}</p><div class="starter-types">${typesHtml}</div>`;
                lineDiv.appendChild(card);
            });
            section.appendChild(lineDiv);
        });
        pokedexGrid.appendChild(section);
    }
}

// --- FUNÇÕES DE MODAL E EVENTOS ---

function showDetailsModal(pokemon) {
    detailsImage.src = pokemon.image;
    detailsNumber.textContent = `#${String(pokemon.id).padStart(3, '0')}`;
    let pokemonName = pokemon.name;
    if (['Tinkaton', 'Sylveon', 'Meowscarada'].includes(pokemon.name)) {
        pokemonName += ' ❤️';
    }
    detailsName.innerHTML = `<a href="https://pokemondb.net/pokedex/${pokemon.name.toLowerCase()}" target="_blank" rel="noopener noreferrer" class="pokemon-name-link">${pokemonName}</a>`;
    detailsTypes.innerHTML = (pokemon.types || []).map(type => `<span class="type-badge" style="background-color: ${typeColors[type] || '#777'}">${type}</span>`).join('');
    detailsDesc.textContent = pokemon.description || 'Descrição não disponível.';
    detailsStats.innerHTML = '';

    // MUDANÇA AQUI: if (pokemon.stats) virou if (pokemon.baseStats)
    if (pokemon.baseStats) {
        const statOrder = ['hp', 'atk', 'def', 'speed'];
        statOrder.forEach(statName => {
            if (pokemon.baseStats.hasOwnProperty(statName)) {
                // MUDANÇA AQUI: pokemon.stats[statName] virou pokemon.baseStats[statName]
                const statValue = pokemon.baseStats[statName];
                const statRow = document.createElement('div');
                statRow.className = 'stat-row';
                statRow.innerHTML = `<span class="stat-name">${statName}</span><div class="stat-bar"><div class="stat-value" style="width: ${Math.min(statValue / 1.5, 100)}%; background-color: var(--accent);"></div></div><span class="stat-number">${statValue}</span>`;
                detailsStats.appendChild(statRow);
            }
        });
    }

    detailsModal.classList.remove('hidden');
}

function openInteractionModal(pokemon) {
    const btnAvistar = document.getElementById('btn-avistar');
    const btnCapturar = document.getElementById('btn-capturar');
    modalPokemonName.textContent = `#${String(pokemon.id).padStart(3, '0')} - ${pokemon.name}`;
    if (modalInteractionImage) {
        modalInteractionImage.src = pokemon.image;
        const status = userPokedexProgress.get(pokemon.id)?.status || 'unknown';
        if (currentLevel === 'Treinador' && status === 'unknown') {
            modalInteractionImage.style.filter = 'brightness(0)';
        } else {
            modalInteractionImage.style.filter = 'none';
        }
    }
    const newBtnAvistar = btnAvistar.cloneNode(true);
    btnAvistar.parentNode.replaceChild(newBtnAvistar, btnAvistar);
    const newBtnCapturar = btnCapturar.cloneNode(true);
    btnCapturar.parentNode.replaceChild(newBtnCapturar, btnCapturar);
    newBtnAvistar.addEventListener('click', () => updatePokemonStatus(pokemon.id, 'sighted'));
    newBtnCapturar.addEventListener('click', () => updatePokemonStatus(pokemon.id, 'captured'));
    interactionModal.classList.remove('hidden');
}

function updatePokemonStatus(pokemonId, newStatus) {
    const docRef = db.collection('users').doc(currentUser.uid).collection('pokedex').doc(String(pokemonId));
    docRef.set({ status: newStatus }, { merge: true }).then(() => {
        closeInteractionModal();
        userPokedexProgress.set(pokemonId, { ...userPokedexProgress.get(pokemonId), status: newStatus });
        renderContent('pokedex');
    }).catch(error => console.error("Erro ao atualizar status:", error));
}

function closeInteractionModal() {
    if (interactionModal) {
        interactionModal.classList.add('hidden');
    }
}

// --- EVENT LISTENERS ---
function selectTab(tabName) {
    history.replaceState(null, '', tabName === 'iniciais' ? '#iniciais' : location.pathname + location.search);
    renderContent(tabName);
}
btnTabPokedex.addEventListener('click', () => selectTab('pokedex'));
btnTabIniciais.addEventListener('click', () => selectTab('iniciais'));
window.addEventListener('hashchange', () => { if (currentUser) renderContent(location.hash === '#iniciais' ? 'iniciais' : 'pokedex'); });

filterInput.addEventListener('input', () => {
    filterTerm = filterInput.value.trim().toLowerCase();
    displayPokedex();
});
statusFilters.addEventListener('click', event => {
    const chip = event.target.closest('.chip');
    if (!chip) return;
    filterStatus = chip.dataset.status;
    statusFilters.querySelectorAll('.chip').forEach(button => {
        const active = button === chip;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
    });
    displayPokedex();
});

searchInput.addEventListener('input', () => {
    const id = Number(searchInput.value);
    const pokemon = masterPokemonList.find(p => p.id === id);
    if (pokemon && searchPreview) {
        searchPreview.src = pokemon.image;
        searchPreview.style.opacity = '1';
        const status = userPokedexProgress.get(id)?.status || 'unknown';
        if (currentLevel === 'Treinador' && status === 'unknown') {
            searchPreview.style.filter = 'brightness(0)';
        } else {
            searchPreview.style.filter = 'none';
        }
    } else if (searchPreview) {
        searchPreview.style.opacity = '0.3';
        searchPreview.style.filter = 'none';
    }
});

searchBtn.addEventListener('click', () => {
    if (!searchInput.value) return;
    const id = Number(searchInput.value);
    const pokemon = masterPokemonList.find(p => p.id === id);
    if (pokemon) {
        openInteractionModal(pokemon);
    } else {
        showToast('Pokémon com este número não existe na Pokédex!', 'error');
    }
});

const interactionCloseBtn = document.querySelector('.interaction-close-btn');
if (interactionCloseBtn) {
    interactionCloseBtn.addEventListener('click', closeInteractionModal);
}

const detailsCloseBtn = document.getElementById('details-close-btn');
if (detailsCloseBtn) {
    detailsCloseBtn.addEventListener('click', () => detailsModal.classList.add('hidden'));
}
if (detailsModal) {
    detailsModal.addEventListener('click', (e) => {
        if (e.target === detailsModal) {
            detailsModal.classList.add('hidden');
        }
    });
}
})();
