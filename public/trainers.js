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

    const trainersGrid = document.getElementById('trainers-grid');
    const spinner = document.getElementById('spinner');
    const detailsModal = document.getElementById('details-modal');
    const detailsCloseBtn = document.getElementById('details-close-btn');
    const detailsAvatar = document.getElementById('details-avatar');
    const detailsTrainerName = document.getElementById('details-trainer-name');
    const detailsRealName = document.getElementById('details-real-name');
    const detailsAge = document.getElementById('details-age');
    const detailsHeight = document.getElementById('details-height');
    const detailsGender = document.getElementById('details-gender');
    const detailsDesc = document.getElementById('details-desc');
    const campaignSelect = document.getElementById('campaign-select');
    const pcToggle = document.getElementById('pc-toggle');
    const detailsPokemonTeam = document.getElementById('details-pokemon-team');
    const healAllBtn = document.getElementById('heal-all-btn');
    const editPokemonModal = document.getElementById('edit-pokemon-modal');
    const editPokemonForm = document.getElementById('edit-pokemon-form');
    const editPkmnCloseBtn = document.getElementById('edit-pkmn-close-btn');
    const editPkmnTitle = document.getElementById('edit-pkmn-title');
    const pcLink = document.getElementById('pc-link');
    const bagLink = document.getElementById('bag-link');

    // --- BUSCA DE POKÉMON (lista principal + iniciais) ---
    const allPokemon = getAllPokemon();
    const findPokemon = id => allPokemon.find(p => p.id === id);

    const clean = value => String(value ?? '').trim();

    // --- VARIÁVEIS GLOBAIS ---
    let currentUser = null;
    let currentTrainerId = null;
    let currentTrainerData = {};

    // --- LÓGICA DE AUTENTICAÇÃO E CARREGAMENTO ---
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            db.collection('users').doc(user.uid).get().then(doc => {
                if (doc.exists && doc.data().level === 'Professor') {
                    setupEventListeners();
                    return fetchTrainers();
                } else {
                    deferToast('Acesso restrito a professores.', 'error');
                    window.location.href = 'menu.html';
                }
            }).catch(() => showPageError('Não foi possível carregar os dados dos treinadores. Recarregue a página.'));
        } else {
            window.location.href = 'index.html';
        }
    });

    async function fetchTrainers() {
        spinner.classList.remove('hidden');
        trainersGrid.innerHTML = '';
        const querySnapshot = await db.collection('users').where('level', '==', 'Treinador').get();
        document.getElementById('trainers-count').textContent = querySnapshot.size === 1 ? '1 treinador cadastrado' : querySnapshot.size + ' treinadores cadastrados';
        querySnapshot.forEach(doc => {
            const trainerData = doc.data();
            const trainerId = doc.id;
            const name = clean(trainerData.trainerName) || 'Sem nome';
            const teamSize = Array.isArray(trainerData.team) ? trainerData.team.length : 0;
            const card = document.createElement('div');
            card.className = 'trainer-card';
            card.innerHTML = `<img alt=""><h3>${escapeText(name)}</h3><p class="trainer-meta">${teamSize} Pokémon${trainerData.campaign ? ' · ' + escapeText(trainerData.campaign) : ''}</p>`;
            setAvatar(card.querySelector('img'), trainerData.imageUrl, name);
            activateCard(card, () => openTrainerDetails(trainerId, trainerData));
            trainersGrid.appendChild(card);
        });
        spinner.classList.add('hidden');
    }

    function openTrainerDetails(trainerId, trainerData) {
        currentTrainerId = trainerId;
        currentTrainerData = trainerData;
        pcLink.href = 'pc.html?trainer=' + encodeURIComponent(trainerId);
        bagLink.href = 'bag.html?trainer=' + encodeURIComponent(trainerId);
        const name = clean(trainerData.trainerName) || 'Sem nome';
        setAvatar(detailsAvatar, trainerData.imageUrl, name);
        detailsTrainerName.textContent = name;
        detailsRealName.textContent = clean(trainerData.realName) || 'Não informado';
        const tags = [
            [detailsAge, trainerData.age ? trainerData.age + ' anos' : ''],
            [detailsHeight, trainerData.height ? trainerData.height + ' cm' : ''],
            [detailsGender, clean(trainerData.gender)]
        ];
        for (const [node, text] of tags) {
            node.textContent = text;
            node.hidden = !text;
        }
        const description = clean(trainerData.description);
        detailsDesc.textContent = description;
        detailsDesc.hidden = !description;
        document.getElementById('details-desc-label').hidden = !description;
        campaignSelect.value = trainerData.campaign || 'Brasa';
        pcToggle.checked = trainerData.pcUnlocked || false;
        displayTeam(trainerData.team || []);
        const needsHealing = (trainerData.team || []).some(p => p.currentHp < p.maxHp || (p.statusCondition && p.statusCondition !== 'none'));
        healAllBtn.disabled = !needsHealing;
        healAllBtn.textContent = needsHealing ? 'Curar todos' : 'Equipe saudável';
        detailsModal.classList.remove('hidden');
    }

     function displayTeam(team) {
        detailsPokemonTeam.innerHTML = '';
        if (!team || team.length === 0) {
            detailsPokemonTeam.innerHTML = '<p>Este treinador não possui Pokémon no time.</p>';
            return;
        }
        team.forEach((teamPokemon, index) => {
            const masterInfo = findPokemon(teamPokemon.pokemonId);
            if (!masterInfo) return;

            const card = document.createElement('div');
            card.className = `team-pokemon-card ${teamPokemon.currentHp === 0 || teamPokemon.statusCondition === 'fainted' ? 'fainted' : ''}`;
            const hpPercent = (teamPokemon.maxHp > 0) ? (teamPokemon.currentHp / teamPokemon.maxHp) * 100 : 0;
            let hpColorClass = hpPercent <= 20 ? 'critical' : hpPercent <= 50 ? 'low' : '';
            const statusIconHtml = statusIcon(teamPokemon.statusCondition) ? `<div class="status-icon">${statusIcon(teamPokemon.statusCondition)}</div>` : '';

            card.innerHTML = `
                ${statusIconHtml}
                <img src="${teamPokemon.isShiny && masterInfo.imageShiny ? masterInfo.imageShiny : masterInfo.image}" alt="${masterInfo.name}">
                <h4>${escapeText(clean(teamPokemon.nickname) || masterInfo.name)} ${teamPokemon.isShiny ? '✨' : ''}</h4>
                <div class="pokemon-info">Lvl: ${escapeText(teamPokemon.level)}</div>
                <div class="hp-bar"><div class="hp-value ${hpColorClass}" style="width: ${hpPercent}%"></div></div>
                <div class="pokemon-info">HP: ${escapeText(teamPokemon.currentHp)} / ${escapeText(teamPokemon.maxHp)}</div>
                <div class="pokemon-info">Status: ${escapeText(statusLabel(teamPokemon.statusCondition))}</div>`;
            
            activateCard(card, () => openEditPokemonModal(teamPokemon, index));
            detailsPokemonTeam.appendChild(card);
        });
    }
    

    async function refreshTrainerDetails(trainerId) {
        const doc = await db.collection('users').doc(trainerId).get();
        if (doc.exists) {
            openTrainerDetails(trainerId, doc.data());
        }
    }

    function updateTrainerData(trainerId, dataToUpdate) {
        const trainerRef = db.collection('users').doc(trainerId);
        return trainerRef.update(dataToUpdate)
            .then(() => {
                console.log("Dados do treinador atualizados:", dataToUpdate);
                currentTrainerData = { ...currentTrainerData, ...dataToUpdate };
            })
            .catch(error => console.error("Erro ao atualizar dados: ", error));
    }

    function openEditPokemonModal(pokemon, index) {
        const masterInfo = findPokemon(pokemon.pokemonId);
        editPkmnTitle.textContent = `Gerenciar ${pokemon.nickname || masterInfo.name}`;
        
        const currentHpInput = document.getElementById('edit-currentHp');
        const statusSelect = document.getElementById('edit-status');
        
        currentHpInput.value = pokemon.currentHp;
        currentHpInput.max = pokemon.maxHp;
        statusSelect.value = [...statusSelect.options].some(o => o.value === pokemon.statusCondition) ? pokemon.statusCondition : 'none';

        editPokemonForm.onsubmit = async (e) => {
            e.preventDefault();
            
            const updatedTeam = JSON.parse(JSON.stringify(currentTrainerData.team));
            const updatedPokemon = updatedTeam[index];

            updatedPokemon.currentHp = Number(currentHpInput.value);
            updatedPokemon.statusCondition = statusSelect.value;

            if (updatedPokemon.currentHp > updatedPokemon.maxHp) updatedPokemon.currentHp = updatedPokemon.maxHp;
            if (updatedPokemon.currentHp <= 0) {
                updatedPokemon.currentHp = 0;
                updatedPokemon.statusCondition = 'fainted';
            }
            
            spinner.classList.remove('hidden');
            try {
                await db.collection('users').doc(currentTrainerId).update({ team: updatedTeam });
                editPokemonModal.classList.add('hidden');
                await refreshTrainerDetails(currentTrainerId);
            } catch (error) {
                console.error('Falha ao salvar Pokémon', error.code);
                showToast('Não foi possível salvar as alterações. Confira a conexão e tente novamente.', 'error');
            } finally {
                spinner.classList.add('hidden');
            }
        };

        editPokemonModal.classList.remove('hidden');
    }
    

    function setupEventListeners() {
        detailsCloseBtn.addEventListener('click', () => detailsModal.classList.add('hidden'));
        editPkmnCloseBtn.addEventListener('click', () => editPokemonModal.classList.add('hidden'));
        
        campaignSelect.addEventListener('change', (e) => {
            if (currentTrainerId) updateTrainerData(currentTrainerId, { campaign: e.target.value });
        });

        pcToggle.addEventListener('change', (e) => {
            if (currentTrainerId) updateTrainerData(currentTrainerId, { pcUnlocked: e.target.checked });
        });
        
        healAllBtn.addEventListener('click', () => {
            if (currentTrainerId && currentTrainerData.team) {
                const healedTeam = currentTrainerData.team.map(p => ({ ...p, currentHp: p.maxHp, statusCondition: 'none' }));
                spinner.classList.remove('hidden');
                updateTrainerData(currentTrainerId, { team: healedTeam })
                    .then(() => refreshTrainerDetails(currentTrainerId))
                    .finally(() => spinner.classList.add('hidden'));
            }
        });
        
        // Adicione aqui outros listeners que você precisar
    }
});
