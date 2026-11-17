document.addEventListener('DOMContentLoaded', () => {

    // =============================================================
    // CONFIGURAÇÃO DO FIREBASE
    // =============================================================
    if (typeof firebase === 'undefined' || typeof firebase.auth !== 'function' || typeof firebase.firestore !== 'function') {
        showPageError('Os serviços do jogo não carregaram. Confira a conexão e recarregue a página.');
        return;
    }
    const auth = firebase.auth();
    const db = firebase.firestore();

    const spinner = document.getElementById('spinner');
    const pcLockedContainer = document.getElementById('pc-locked-container');
    const pcUnlockedContainer = document.getElementById('pc-unlocked-container');
    const teamGrid = document.getElementById('team-grid');
    const pcGrid = document.getElementById('pc-grid');
    
    // Modal de Detalhes
    const detailsModal = document.getElementById('details-modal');
    const detailsCloseBtn = document.getElementById('details-close-btn');
    const detailsImage = document.getElementById('details-image');
    const detailsName = document.getElementById('details-name');
    const detailsInfo = document.getElementById('details-info');
    const detailsStats = document.getElementById('details-stats');
    const moveToPcBtn = document.getElementById('move-to-pc-btn');
    const moveToTeamBtn = document.getElementById('move-to-team-btn');


    // --- VARIÁVEIS GLOBAIS ---
    let currentUser = null;
    let trainerData = {};
    let selectedPokemon = { pokemon: null, origin: null, index: -1, element: null };
    let allAddablePokemon = []; // A "super lista" de todos os Pokémon

    // --- LÓGICA DE INICIALIZAÇÃO ---
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            // CORREÇÃO: Prepara a lista de Pokémon antes de verificar o acesso
            prepareAddablePokemonList();
            checkPCAccess();
        } else {
            window.location.href = 'index.html';
        }
    });

    // ADICIONADO: Função para criar a lista combinada de Pokémon
    function prepareAddablePokemonList() {
        allAddablePokemon = getAllPokemon();
    }

    async function checkPCAccess() {
        try {
            const userRef = db.collection('users').doc(currentUser.uid);
            const doc = await userRef.get();
            if (doc.exists) {
                trainerData = doc.data();
                if (trainerData.pcUnlocked === true) {
                    pcUnlockedContainer.classList.remove('hidden');
                    renderAll();
                } else {
                    pcLockedContainer.classList.remove('hidden');
                }
            } else {
                pcLockedContainer.classList.remove('hidden');
            }
        } catch (error) {
            console.error("Erro ao verificar acesso ao PC:", error);
            pcLockedContainer.classList.remove('hidden');
        } finally {
            spinner.classList.add('hidden');
        }
    }
    
    function renderAll() {
        renderTeam();
        renderPC();
    }

    // --- FUNÇÕES DE EXIBIÇÃO ---
    function renderTeam() {
        teamGrid.innerHTML = '';
        const team = trainerData.team || [];
        for (let i = 0; i < 6; i++) {
            const slot = createPokemonSlot(team[i], 'team', i);
            teamGrid.appendChild(slot);
        }
    }

    function renderPC() {
        pcGrid.innerHTML = '';
        const pc = trainerData.pc || [];
        for (let i = 0; i < Math.max(50, pc.length); i++) {
            const slot = createPokemonSlot(pc[i], 'pc', i);
            pcGrid.appendChild(slot);
        }
    }

    function createPokemonSlot(pokemon, origin, index) {
        const slot = document.createElement('div');
        slot.className = 'pokemon-slot';
        if (pokemon) {
            // CORREÇÃO: Agora 'allAddablePokemon' existe e a busca funciona
            const masterInfo = allAddablePokemon.find(p => p.id === pokemon.pokemonId);
            if (masterInfo) {
                slot.classList.add('occupied');
                const imageUrl = pokemon.isShiny && masterInfo.imageShiny ? masterInfo.imageShiny : masterInfo.image;
                slot.innerHTML = `
                    <img src="${imageUrl}" alt="${masterInfo.name}">
                    <span class="slot-tooltip">${escapeText(pokemon.nickname || masterInfo.name)} (Lvl ${escapeText(pokemon.level)})</span>`;
                activateCard(slot, () => openDetailsModal(pokemon, origin, index));
            }
        }
        return slot;
    }

    // --- LÓGICA DE INTERAÇÃO E MOVIMENTAÇÃO ---
    function openDetailsModal(pokemon, origin, index) {
        const masterInfo = allAddablePokemon.find(p => p.id === pokemon.pokemonId);
        
        detailsImage.src = pokemon.isShiny && masterInfo.imageShiny ? masterInfo.imageShiny : masterInfo.image;
        detailsName.textContent = `${pokemon.nickname || masterInfo.name} ${pokemon.isShiny ? '✨' : ''}`;
        detailsInfo.innerHTML = `Lvl: ${escapeText(pokemon.level)} | ${statusIcon(pokemon.statusCondition)}${escapeText(statusLabel(pokemon.statusCondition))}<br><span class="pokemon-location">${origin === 'team' ? 'Time · posição ' + (index + 1) : 'PC Box · slot ' + (index + 1)}</span>`;
        detailsStats.innerHTML = `
            <p><span>HP:</span> <span>${escapeText(pokemon.currentHp)} / ${escapeText(pokemon.maxHp)}</span></p>
            <p><span>Ataque:</span> <span>${escapeText(pokemon.atk)}</span></p>
            <p><span>Defesa:</span> <span>${escapeText(pokemon.def)}</span></p>
            <p><span>Velocidade:</span> <span>${escapeText(pokemon.speed)}</span></p>`;

        moveToPcBtn.classList.toggle('hidden', origin !== 'team');
        moveToTeamBtn.classList.toggle('hidden', origin !== 'pc');
        const teamSize = (trainerData.team || []).length;
        moveToTeamBtn.disabled = teamSize >= 6;
        moveToTeamBtn.textContent = teamSize >= 6 ? 'Time cheio (6/6)' : 'Mover para o Time';
        moveToPcBtn.disabled = teamSize <= 1;

        moveToPcBtn.onclick = () => movePokemon(index, 'team-to-pc');
        moveToTeamBtn.onclick = () => movePokemon(index, 'pc-to-team');

        detailsModal.classList.remove('hidden');
    }
    
    async function movePokemon(index, direction) {
        spinner.classList.remove('hidden');
        detailsModal.classList.add('hidden');

        const team = [...(trainerData.team || [])];
        const pc = [...(trainerData.pc || [])];

        if (direction === 'team-to-pc') {
            if (team.length <= 1) {
                showToast("Você precisa ter pelo menos um Pokémon no time!", 'error');
                spinner.classList.add('hidden');
                return;
            }
            const [pokemonToMove] = team.splice(index, 1);
            pc.unshift(pokemonToMove);
        } else { // pc-to-team
            if (team.length >= 6) {
                showToast("Seu time já está cheio (6 Pokémon)!", 'error');
                spinner.classList.add('hidden');
                return;
            }
            const [pokemonToMove] = pc.splice(index, 1);
            team.push(pokemonToMove);
        }

        try {
            await db.collection('users').doc(currentUser.uid).update({ team: team, pc: pc });
            trainerData.team = team;
            trainerData.pc = pc;
            renderAll();
        } catch (error) {
            console.error("Erro ao mover Pokémon:", error);
            showToast("Ocorreu um erro ao mover o Pokémon.", 'error');
        } finally {
            spinner.classList.add('hidden');
        }
    }
    
    detailsCloseBtn.addEventListener('click', () => detailsModal.classList.add('hidden'));
});

