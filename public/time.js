document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURAÇÃO DO FIREBASE ---
    if (typeof firebase === 'undefined' || typeof firebase.auth !== 'function' || typeof firebase.firestore !== 'function') {
        showPageError('Os serviços do jogo não carregaram. Confira a conexão e recarregue a página.');
        return;
    }
    const auth = firebase.auth();
    const db = firebase.firestore();

    // --- ITENS (catálogo em utils.js; aqui só o efeito) ---
    const masterItemList = itemCatalog.map(item => ({
        ...item,
        effect: pokemon => {
            if (pokemon.currentHp === 0 || pokemon.currentHp === pokemon.maxHp) return false;
            pokemon.currentHp = Math.min(pokemon.maxHp, pokemon.currentHp + item.heal);
            return true;
        }
    }));
    
    // --- ELEMENTOS DO DOM ---
    const spinner = document.getElementById('spinner');
    const pageContainer = document.getElementById('page-container');
    const teamGrid = document.getElementById('team-grid');
    const bagItems = document.getElementById('bag-items');
    const bagPlaceholder = document.getElementById('bag-placeholder');
    
    // --- VARIÁVEIS GLOBAIS ---
    let currentUser = null;
    let trainerData = {};
    let selectedPokemonIndex = -1; // NOVO: Guarda o Pokémon selecionado
    let allPokemonData = [];

    // --- INICIALIZAÇÃO ---
    function preparePokemonDataList() {
        if (typeof masterPokemonList === 'undefined' || typeof starterData === 'undefined') { return; }
        allPokemonData = getAllPokemon();
    }

    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            preparePokemonDataList();
            loadTrainerData();
        } else {
            window.location.href = 'index.html';
        }
    });

    async function loadTrainerData() {
        if (!currentUser || allPokemonData.length === 0) {
            spinner.classList.add('hidden');
            pageContainer.classList.remove('hidden');
            return;
        }
        const docRef = db.collection('users').doc(currentUser.uid);
        try {
            const doc = await docRef.get();
            if (doc.exists) {
                trainerData = doc.data();
            } else {
                window.location.replace('menu.html');
                return;
            }
            renderAll();
        } catch (error) {
            showModal(`Erro de Acesso: ${error.message}.`);
        } finally {
            spinner.classList.add('hidden');
            pageContainer.classList.remove('hidden');
            if (location.hash === '#mochila') document.getElementById('mochila').scrollIntoView();
        }
    }

    function renderAll() {
        renderTeam();
        renderBag();
    }

    // --- FUNÇÕES DE RENDERIZAÇÃO ---
    function renderTeam() {
        teamGrid.innerHTML = '';
        const team = trainerData.team || [];
        for (let i = 0; i < 6; i++) {
            const pokemon = team[i];
            const card = document.createElement('div');
            card.className = 'pokemon-card';
            card.dataset.index = i;

            if (pokemon) {
                const masterInfo = allPokemonData.find(p => p.id === pokemon.pokemonId);
                if (!masterInfo) {
                    card.innerHTML = `<div class="empty-slot">Erro!<br>ID Inválido</div>`;
                } else {
                    const hpPercent = (pokemon.maxHp > 0) ? (pokemon.currentHp / pokemon.maxHp) * 100 : 0;
                    let hpColorClass = hpPercent <= 20 ? 'critical' : hpPercent <= 50 ? 'low' : '';
                    card.classList.toggle('fainted', pokemon.currentHp === 0);
                    
                    const imageUrl = pokemon.isShiny && masterInfo.imageShiny ? masterInfo.imageShiny : masterInfo.image;
                    card.innerHTML = `
                        <div class="card-header">
                            <img src="${imageUrl}" alt="${masterInfo.name}">
                            <div class="pokemon-name-level">
                                <h3>${escapeText(pokemon.nickname || masterInfo.name)} ${pokemon.isShiny ? '✨' : ''}</h3>
                                <p>Lvl: ${escapeText(pokemon.level)}</p>
                            </div>
                        </div>
                        <div class="hp-bar"><div class="hp-value ${hpColorClass}" style="width: ${hpPercent}%"></div></div>
                        <p class="hp-text">${escapeText(pokemon.currentHp)} / ${escapeText(pokemon.maxHp)}</p>
                        <p class="status-display">${statusIcon(pokemon.statusCondition)}${escapeText(statusLabel(pokemon.statusCondition))}</p>
                    `;
                    activateCard(card, () => onPokemonClick(i));
                }
            } else {
                card.innerHTML = `<div class="empty-slot">Vazio</div>`;
            }
            teamGrid.appendChild(card);
        }
    }

    function renderBag() {
        bagItems.innerHTML = '';
        const bag = trainerData.bag || [];
        if (bag.length > 0) {
            bagPlaceholder.classList.add('hidden');
            bag.forEach((item, index) => {
                const itemInfo = masterItemList.find(i => i.technicalName === item.technicalName);
                if (itemInfo) {
                    const slot = document.createElement('div');
                    slot.className = 'item-slot';
                    slot.dataset.index = index;
                    slot.innerHTML = `
                        <img src="${itemInfo.image}" alt="${itemInfo.name}" title="${itemInfo.description}">
                        <span class="item-quantity">x${escapeText(item.quantity)}</span>`;
                    activateCard(slot, () => onItemClick(item, index));
                    bagItems.appendChild(slot);
                }
            });
        } else {
            bagPlaceholder.classList.remove('hidden');
        }
    }

    // --- LÓGICA DE INTERAÇÃO (MODIFICADA) ---
    function onPokemonClick(index) {
        if (selectedPokemonIndex === index) {
            deselectPokemon(); // Clicar novamente no mesmo Pokémon cancela a seleção
        } else if (trainerData.team[index]) {
            selectPokemon(index);
        }
    }

    function onItemClick(item, itemIndex) {
        if (selectedPokemonIndex === -1) {
            showModal("Por favor, selecione um Pokémon primeiro para usar um item.");
            return;
        }
        useItemOnSelectedPokemon(item, itemIndex);
    }
    
    function selectPokemon(index) {
        deselectPokemon(); // Garante que apenas um está selecionado de cada vez
        selectedPokemonIndex = index;
        const card = document.querySelector(`.pokemon-card[data-index="${index}"]`);
        if (card) {
            card.classList.add('selected');
        }
        const pokemon = trainerData.team[index];
        const masterInfo = allPokemonData.find(p => p.id === pokemon.pokemonId);
        showModal(`'${pokemon.nickname || masterInfo.name}' selecionado. Escolha um item da mochila.`);
    }

    function deselectPokemon() {
        if (selectedPokemonIndex !== -1) {
            const card = document.querySelector(`.pokemon-card[data-index="${selectedPokemonIndex}"]`);
            if (card) card.classList.remove('selected');
            selectedPokemonIndex = -1;
            hideModal();
        }
    }

    async function useItemOnSelectedPokemon(item, itemIndex) {
        const pokemon = trainerData.team[selectedPokemonIndex];
        const itemInfo = masterItemList.find(i => i.technicalName === item.technicalName);
        const pokemonName = pokemon.nickname || allPokemonData.find(p => p.id === pokemon.pokemonId).name;

        showConfirmationModal(`Usar ${itemInfo.name} em ${pokemonName}?`, async () => {
            const updatedPokemon = { ...pokemon };
            if (!itemInfo.effect(updatedPokemon)) {
                showModal(`Não é possível usar ${itemInfo.name} neste Pokémon.`);
                return;
            }

            const team = [...trainerData.team];
            team[selectedPokemonIndex] = updatedPokemon;
            const bag = trainerData.bag.map((entry, index) =>
                index === itemIndex ? { ...entry, quantity: entry.quantity - 1 } : entry
            ).filter(entry => entry.quantity > 0);

            spinner.classList.remove('hidden');
            try {
                await db.collection('users').doc(currentUser.uid).update({ team, bag });
                trainerData = { ...trainerData, team, bag };
                deselectPokemon();
                renderAll();
            } catch {
                showModal('Não foi possível usar o item. Confira a conexão e tente novamente.');
            } finally {
                spinner.classList.add('hidden');
            }
        });
    }

    // --- FUNÇÕES DO MODAL ---
    const modal = document.getElementById('confirmation-modal');
    const modalMessage = document.getElementById('modal-message');
    const confirmBtn = document.getElementById('confirm-btn');
    const cancelBtn = document.getElementById('cancel-btn');

    function showModal(message) {
         modalMessage.textContent = message;
         confirmBtn.style.display = 'none';
         cancelBtn.textContent = 'OK';
         cancelBtn.style.display = 'inline-block';
         modal.classList.remove('hidden');
         cancelBtn.onclick = hideModal;
    }

    function showConfirmationModal(message, onConfirm) {
        modalMessage.textContent = message;
        confirmBtn.style.display = 'inline-block';
        cancelBtn.textContent = 'Não';
        cancelBtn.style.display = 'inline-block';
        modal.classList.remove('hidden');
        confirmBtn.onclick = () => {
            hideModal();
            onConfirm();
        };
        cancelBtn.onclick = hideModal;
    }

    function hideModal() {
        modal.classList.add('hidden');
    }
});

