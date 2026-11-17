const portalIcons = {
    brand: '<path d="M12 2.8c.9 2.8 4.6 4.3 4.6 8.2a4.6 4.6 0 0 1-9.2 0c0-1.5.7-2.5 1.5-3.5C9.9 6.4 11.6 5.2 12 2.8Z"/><path d="M3.5 15c1.6 3.6 4.9 6 8.5 6s6.9-2.4 8.5-6"/>',
    ball: '<circle cx="12" cy="12" r="9"/><path d="M3 12h6m6 0h6"/><circle cx="12" cy="12" r="3"/>',
    id: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M6 16c0-3 6-3 6 0m3-6h3m-3 4h3"/>',
    team: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2m1-15a3 3 0 0 1 0 6m5 9v-2a4 4 0 0 0-3-4"/>',
    pc: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M12 17v4m-4 0h8"/>',
    bag: '<rect x="5" y="6" width="14" height="15" rx="3"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M8 13h8v4H8z"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>'
};

function portalIcon(name, cssClass = '') {
    return '<svg class="' + cssClass + '" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">' + portalIcons[name] + '</svg>';
}

document.querySelectorAll('[data-icon]').forEach(element => {
    element.innerHTML = portalIcon(element.dataset.icon);
});

function showPortalHeroArt() {
    const art = document.createElement('div');
    art.className = 'hero-art';
    art.setAttribute('aria-hidden', 'true');
    for (const name of ['lucario', 'charizard', 'pikachu']) {
        const image = document.createElement('img');
        image.className = 'art-' + name;
        image.src = 'assets/' + name + '.png';
        image.alt = '';
        image.width = 475;
        image.height = 475;
        art.append(image);
    }
    document.querySelector('.hero')?.append(art);
}

showPortalHeroArt();
