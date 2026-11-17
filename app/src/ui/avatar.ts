/** Avatar de reserva: inicial do nome sobre uma cor de brasa estável. */
export function avatarDataUri(name?: string | null): string {
    const text = String(name || '?').trim();
    const initial = (text[0] || '?').toUpperCase().replace(/[&<>"']/g, '?');
    let hash = 0;
    for (const ch of text) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
    const hue = 8 + (hash % 52);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="hsl(${hue} 55% 24%)"/><text x="32" y="33" text-anchor="middle" dominant-baseline="central" font-family="sans-serif" font-size="30" font-weight="700" fill="hsl(${hue} 90% 82%)">${initial}</text></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/** Use como ref de <img>: troca pela inicial se não houver foto ou se ela falhar. */
export function setAvatarFallback(img: HTMLImageElement | null, name?: string | null) {
    if (!img) return;
    const fallback = avatarDataUri(name);
    img.onerror = () => { img.onerror = null; img.src = fallback; };
    if (!img.getAttribute('src')) img.src = fallback;
}
