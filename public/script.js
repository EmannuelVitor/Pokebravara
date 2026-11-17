const login = document.getElementById('google-login-btn');
const loginError = document.getElementById('login-error');
const loginLabel = login.querySelector('span');

function showLoginError(message) {
    loginError.textContent = message;
    loginError.hidden = false;
}

if (typeof firebase === 'undefined' || typeof firebase.auth !== 'function') {
    showLoginError('O serviço de login não carregou. Confira a conexão e recarregue a página.');
} else {
    const auth = firebase.auth();
    auth.onAuthStateChanged(user => {
        if (user) window.location.replace('menu.html');
        else login.disabled = false;
    }, () => showLoginError('Não foi possível verificar sua sessão. Recarregue a página para tentar novamente.'));

    login.addEventListener('click', async () => {
        login.disabled = true;
        loginError.hidden = true;
        loginLabel.textContent = 'Conectando…';
        const provider = new firebase.auth.GoogleAuthProvider();
        try {
            await auth.signInWithPopup(provider);
        } catch (error) {
            if (error.code === 'auth/popup-blocked' || error.code === 'auth/operation-not-supported-in-this-environment') {
                // celulares e navegadores embutidos costumam bloquear pop-up: segue por redirecionamento
                loginLabel.textContent = 'Redirecionando…';
                try {
                    await auth.signInWithRedirect(provider);
                    return;
                } catch { /* cai na mensagem de erro abaixo */ }
            }
            const messages = {
                'auth/popup-closed-by-user': 'A janela do Google foi fechada. Clique em Entrar com Google para tentar novamente.',
                'auth/popup-blocked': 'Permita pop-ups para este site e tente novamente.',
                'auth/unauthorized-domain': 'Este endereço precisa ser autorizado no Firebase para o login com Google.'
            };
            showLoginError(messages[error.code] || 'Não foi possível entrar com Google. Tente novamente.');
            login.disabled = false;
            loginLabel.textContent = 'Entrar com Google';
        }
    });
}
