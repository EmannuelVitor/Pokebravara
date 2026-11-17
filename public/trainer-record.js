const status = document.getElementById('record-status');
const record = document.getElementById('trainer-record');

async function loadTrainer(user) {
    if (!user) {
        window.location.replace('index.html');
        return;
    }
    try {
        const snapshot = await firebase.firestore().collection('users').doc(user.uid).get();
        const profile = snapshot.data();
        if (!profile || (profile.level && profile.level !== 'Treinador')) {
            window.location.replace('menu.html');
            return;
        }
        document.getElementById('trainer-title').textContent = profile.trainerName || profile.name || 'Treinador';
        document.getElementById('trainer-description').textContent = profile.description || '';
        const photo = document.getElementById('trainer-photo');
        setAvatar(photo, profile.imageUrl, profile.trainerName || profile.name);

        const facts = {
            'Nome': profile.realName,
            'Gênero': profile.gender,
            'Idade': profile.age && profile.age + ' anos',
            'Altura': profile.height && profile.height + ' cm',
            'Campanha': profile.campaign
        };
        const list = document.getElementById('trainer-facts');
        for (const [label, value] of Object.entries(facts)) {
            if (!value) continue;
            const group = document.createElement('div');
            const term = document.createElement('dt');
            const description = document.createElement('dd');
            term.textContent = label;
            description.textContent = value;
            group.append(term, description);
            list.append(group);
        }
        status.hidden = true;
        record.hidden = false;
    } catch {
        status.textContent = 'Não foi possível carregar seu cartão. Recarregue a página para tentar novamente.';
        status.classList.add('error');
    }
}

if (typeof firebase !== 'undefined' && typeof firebase.auth === 'function' && typeof firebase.firestore === 'function') {
    firebase.auth().onAuthStateChanged(loadTrainer);
} else {
    status.textContent = 'O serviço do jogo não carregou. Confira a conexão e recarregue a página.';
    status.classList.add('error');
}
