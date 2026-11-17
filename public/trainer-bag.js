const status = document.getElementById('bag-status');

async function loadBag(user) {
    if (!user) {
        window.location.replace('index.html');
        return;
    }
    const trainerId = new URLSearchParams(location.search).get('trainer');
    try {
        const users = firebase.firestore().collection('users');
        const professor = await users.doc(user.uid).get();
        if (professor.data()?.level !== 'Professor') {
            window.location.replace('menu.html');
            return;
        }
        if (!trainerId || trainerId.includes('/')) {
            status.textContent = 'Selecione um treinador no painel para abrir a mochila.';
            return;
        }
        const trainer = (await users.doc(trainerId).get()).data();
        if (trainer?.level !== 'Treinador') {
            status.textContent = 'Treinador não encontrado.';
            return;
        }
        document.getElementById('bag-title').textContent = 'Mochila de ' + (trainer.trainerName || 'treinador');
        const items = Array.isArray(trainer.bag) ? trainer.bag.filter(item => item?.quantity > 0 && item.technicalName) : [];
        if (!items.length) {
            status.textContent = 'A mochila está vazia.';
            return;
        }
        const list = document.getElementById('trainer-bag');
        const itemNames = new Map(itemCatalog.map(item => [item.technicalName, item.name]));
        list.replaceChildren(...items.map(item => {
            const row = document.createElement('li');
            row.textContent = (itemNames.get(item.technicalName) || item.technicalName) + ' × ' + item.quantity;
            return row;
        }));
        list.hidden = false;
        status.hidden = true;
    } catch {
        status.textContent = 'Não foi possível carregar a mochila. Recarregue a página para tentar novamente.';
        status.classList.add('error');
    }
}

if (typeof firebase !== 'undefined' && typeof firebase.auth === 'function' && typeof firebase.firestore === 'function') {
    firebase.auth().onAuthStateChanged(loadBag);
} else {
    status.textContent = 'O serviço do jogo não carregou. Confira a conexão e recarregue a página.';
    status.classList.add('error');
}
