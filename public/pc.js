document.addEventListener('DOMContentLoaded', () => {

    if (typeof firebase === 'undefined' || typeof firebase.auth !== 'function' || typeof firebase.firestore !== 'function') {
        showPageError('Os serviços do jogo não carregaram. Confira a conexão e recarregue a página.');
        return;
    }
    const auth = firebase.auth();
    const db = firebase.firestore();

    const spinner = document.getElementById('spinner');
    const pageLayout = document.querySelector('.page-layout');
    const trainerListUl = document.getElementById('trainer-list');
    const pcTitle = document.getElementById('pc-title');
    const trainerDisplay = document.getElementById('trainer-display');
    const trainerTeamGrid = document.getElementById('trainer-team-grid');
    const pcBoxGrid = document.getElementById('pc-box-grid');
    const detailsPanel = document.getElementById('pokemon-details-panel');
    const panelPlaceholder = detailsPanel.querySelector('.panel-placeholder');
    const panelContent = detailsPanel.querySelector('.panel-content');
    const detailsImage = document.getElementById('details-image');
    const detailsName = document.getElementById('details-name');
    const detailsInfo = document.getElementById('details-info');
    const detailsStats = document.getElementById('details-stats');
    const moveToPcBtn = document.getElementById('move-to-pc-btn');
    const moveToTeamBtn = document.getElementById('move-to-team-btn');
    const addPokemonBtn = document.getElementById('add-pokemon-btn');
    const addPokemonModal = document.getElementById('add-pokemon-modal');
    const addPokemonForm = document.getElementById('add-pokemon-form');
    const pokemonSelect = document.getElementById('pokemon-select');
    const addPkmnCloseBtn = document.getElementById('add-pkmn-close-btn');
    
    // --- VARIÁVEIS GLOBAIS ---
    let allTrainers = [];
    let currentSelectedTrainerId = null;
    let selectedPokemon = null;
    let selectedPokemonOrigin = null;
    let selectedPokemonIndex = -1;
    let allAddablePokemon = [];

    // --- INICIALIZAÇÃO E AUTENTICAÇÃO ---
    auth.onAuthStateChanged(user => {
        if (user) {
            db.collection('users').doc(user.uid).get().then(doc => {
                if (doc.exists && doc.data().level === 'Professor') {
                    prepareAddablePokemonList();
                    return loadAllTrainers();
                } else {
                    deferToast('Acesso restrito a professores.', 'error');
                    window.location.href = 'menu.html';
                }
            }).catch(() => showPageError('Não foi possível carregar os dados dos treinadores. Recarregue a página.'));
        } else {
            window.location.href = 'index.html';
        }
    });

    function prepareAddablePokemonList() {
        allAddablePokemon = getAllPokemon();
    }

    async function loadAllTrainers() {
        spinner.classList.remove('hidden');
        const querySnapshot = await db.collection('users').where('level', '==', 'Treinador').get();
        allTrainers = [];
        querySnapshot.forEach(doc => {
            allTrainers.push({ id: doc.id, ...doc.data() });
        });
        renderTrainerList();
        spinner.classList.add('hidden');
        pageLayout.classList.remove('hidden');
        const trainer = new URLSearchParams(location.search).get('trainer');
        if (allTrainers.some(entry => entry.id === trainer)) selectTrainer(trainer);
    }

    function renderTrainerList() {
        trainerListUl.innerHTML = '';
        allTrainers.forEach(trainer => {
            const li = document.createElement('li');
            li.dataset.trainerId = trainer.id;
            li.innerHTML = `
                <img alt="">
                <span>${escapeText(trainer.trainerName)}</span>
            `;
            setAvatar(li.querySelector('img'), trainer.imageUrl, trainer.trainerName);
            activateCard(li, () => selectTrainer(trainer.id));
            trainerListUl.appendChild(li);
        });
    }

    function selectTrainer(trainerId) {
        currentSelectedTrainerId = trainerId;
        const trainerData = allTrainers.find(t => t.id === trainerId);
        if (!trainerData) return;

        document.querySelectorAll('#trainer-list li').forEach(item => {
            item.classList.toggle('active', item.dataset.trainerId === trainerId);
        });
        
        clearPokemonSelection();
        trainerDisplay.classList.remove('hidden');
        addPokemonBtn.classList.remove('hidden');
        pcTitle.innerHTML = `Time e PC de <span>${escapeText(trainerData.trainerName)}</span>`;
        
        renderTeam(trainerData);
        renderPC(trainerData);
    }

    // --- FUNÇÕES DE EXIBIÇÃO ---
    function renderTeam(trainerData) {
        trainerTeamGrid.innerHTML = '';
        const team = trainerData.team || [];
        document.querySelector('.trainer-team-section h3').textContent = 'Time Atual (' + team.length + '/6)';
        if (team.length === 0) {
            trainerTeamGrid.innerHTML = '<p style="color:#aaa; width: 100%;">Time vazio.</p>';
            return;
        }
        team.forEach((pokemon, index) => {
            const masterInfo = allAddablePokemon.find(p => p.id === pokemon.pokemonId);
            if (!masterInfo) return;
            const slot = document.createElement('div');
            slot.className = `team-slot ${pokemon.currentHp === 0 ? 'fainted' : ''}`;
            slot.dataset.origin = 'team';
            slot.dataset.index = index;
            slot.innerHTML = `<img src="${pokemon.isShiny && masterInfo.imageShiny ? masterInfo.imageShiny : masterInfo.image}" alt="${masterInfo.name}"><span class="pokemon-slot-tooltip">${escapeText(pokemon.nickname || masterInfo.name)} (Lvl ${escapeText(pokemon.level)})</span>`;
            activateCard(slot, () => selectPokemon(pokemon, 'team', index));
            trainerTeamGrid.appendChild(slot);
        });
    }

    function renderPC(trainerData) {
        pcBoxGrid.innerHTML = '';
        const pc = trainerData.pc || [];
        document.querySelector('.pc-box-container h3').textContent = 'PC Box (' + pc.length + ' Pokémon)';
        for (let i = 0; i < Math.max(50, pc.length); i++) {
            const slot = document.createElement('div');
            slot.className = 'pc-slot';
            if (pc[i]) {
                const pokemon = pc[i];
                const masterInfo = allAddablePokemon.find(p => p.id === pokemon.pokemonId);
                if (masterInfo) {
                    slot.classList.add('occupied');
                    slot.dataset.origin = 'pc';
                    slot.dataset.index = i;
                    slot.innerHTML = `<img src="${pokemon.isShiny && masterInfo.imageShiny ? masterInfo.imageShiny : masterInfo.image}" alt="${masterInfo.name}"><span class="pokemon-slot-tooltip">${escapeText(pokemon.nickname || masterInfo.name)} (Lvl ${escapeText(pokemon.level)})</span>`;
                    activateCard(slot, () => selectPokemon(pokemon, 'pc', i));
                }
            }
            pcBoxGrid.appendChild(slot);
        }
    }

    function selectPokemon(pokemon, origin, index) {
        document.querySelectorAll('.team-slot.selected, .pc-slot.selected').forEach(s => s.classList.remove('selected'));
        const selector = origin === 'team' ? '#trainer-team-grid .team-slot' : '#pc-box-grid .pc-slot';
        const clickedSlot = document.querySelectorAll(selector)[index];
        if (clickedSlot) clickedSlot.classList.add('selected');

        selectedPokemon = pokemon;
        selectedPokemonOrigin = origin;
        selectedPokemonIndex = index;
        
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
        const owner = allTrainers.find(t => t.id === currentSelectedTrainerId);
        const teamSize = (owner?.team || []).length;
        moveToTeamBtn.disabled = teamSize >= 6;
        moveToTeamBtn.textContent = teamSize >= 6 ? 'Time cheio (6/6)' : 'Mover para o Time';
        moveToTeamBtn.title = teamSize >= 6 ? 'Mova um Pokémon do time para o PC antes.' : '';
        moveToPcBtn.disabled = teamSize <= 1;
        moveToPcBtn.title = teamSize <= 1 ? 'O treinador precisa manter pelo menos um Pokémon no time.' : '';
        
        panelPlaceholder.classList.add('hidden');
        panelContent.classList.remove('hidden');
    }

    function clearPokemonSelection() {
        selectedPokemon = null;
        panelContent.classList.add('hidden');
        panelPlaceholder.classList.remove('hidden');
        document.querySelectorAll('.team-slot.selected, .pc-slot.selected').forEach(s => s.classList.remove('selected'));
    }

    // --- AÇÕES DO PROFESSOR (BOTÕES) ---
    async function updateAndRefresh(trainerId, dataToUpdate) {
        spinner.classList.remove('hidden');
        try {
            await db.collection('users').doc(trainerId).update(dataToUpdate);
            const trainerIndex = allTrainers.findIndex(t => t.id === trainerId);
            if (trainerIndex !== -1) {
                allTrainers[trainerIndex] = { ...allTrainers[trainerIndex], ...dataToUpdate };
            }
            selectTrainer(trainerId);
            return true;
        } catch (error) {
            console.error('Falha ao salvar alterações', error.code);
            showToast('Não foi possível salvar a alteração. Confira a conexão e tente novamente.', 'error');
            return false;
        } finally {
            spinner.classList.add('hidden');
        }
    }

    moveToPcBtn.addEventListener('click', () => {
        if (!selectedPokemon || selectedPokemonOrigin !== 'team') return;
        const currentTrainerData = allTrainers.find(t => t.id === currentSelectedTrainerId);
        if ((currentTrainerData.team || []).length <= 1) {
            showToast("O treinador precisa ter pelo menos um Pokémon no time!", 'error');
            return;
        }
        const team = [...(currentTrainerData.team || [])];
        const pc = [...(currentTrainerData.pc || [])];
        const [pokemonToMove] = team.splice(selectedPokemonIndex, 1);
        pc.push(pokemonToMove);
        updateAndRefresh(currentSelectedTrainerId, { team, pc });
    });

    moveToTeamBtn.addEventListener('click', () => {
        if (!selectedPokemon || selectedPokemonOrigin !== 'pc') return;
        const currentTrainerData = allTrainers.find(t => t.id === currentSelectedTrainerId);
        if ((currentTrainerData.team || []).length >= 6) {
            showToast("O time do treinador já está cheio!", 'error');
            return;
        }
        const team = [...(currentTrainerData.team || [])];
        const pc = [...(currentTrainerData.pc || [])];
        const [pokemonToMove] = pc.splice(selectedPokemonIndex, 1);
        team.push(pokemonToMove);
        updateAndRefresh(currentSelectedTrainerId, { team, pc });
    });
    
    addPokemonBtn.addEventListener('click', () => {
        if (!currentSelectedTrainerId) return;
        pokemonSelect.innerHTML = allAddablePokemon
            .sort((a, b) => (a.id) - (b.id))
            .map(p => `<option value="${p.id}">${String(p.id).padStart(3, '0')} - ${p.name}</option>`)
            .join('');
        addPokemonForm.reset();
        addPokemonModal.classList.remove('hidden');
    });

    addPokemonForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pokemonId = Number(pokemonSelect.value);
        const level = Number(document.getElementById('pokemon-level').value);
        const nickname = document.getElementById('pokemon-nickname').value;
        const isShiny = document.getElementById('pokemon-shiny').checked;
        const masterInfo = allAddablePokemon.find(p => p.id === pokemonId);
        
        if (!masterInfo || !masterInfo.baseStats) {
            showToast("Erro: O Pokémon selecionado não tem stats base definidos.", 'error');
            return;
        }

        const stats = calculateStats(masterInfo.baseStats, level);
        const newPokemon = {
            pokemonId, level, isShiny, statusCondition: 'none',
            nickname: nickname || masterInfo.name, ...stats
        };
        const currentTrainerData = allTrainers.find(t => t.id === currentSelectedTrainerId);
        const team = [...(currentTrainerData.team || [])];
        const pc = [...(currentTrainerData.pc || [])];
        
        const toTeam = team.length < 6;
        (toTeam ? team : pc).push(newPokemon);

        if (!(await updateAndRefresh(currentSelectedTrainerId, { team, pc }))) return;
        addPokemonModal.classList.add('hidden');
        showToast(toTeam ? `${newPokemon.nickname} foi adicionado ao time!` : `${newPokemon.nickname} foi enviado para o PC!`, 'success');
    });

    addPkmnCloseBtn.addEventListener('click', () => addPokemonModal.classList.add('hidden'));
});




