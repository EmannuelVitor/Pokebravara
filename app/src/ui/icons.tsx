// Ícones de traço próprios (sem biblioteca externa).
const paths: Record<string, string> = {
    brand: 'M12 2.8c.9 2.8 4.6 4.3 4.6 8.2a4.6 4.6 0 0 1-9.2 0c0-1.5.7-2.5 1.5-3.5C9.9 6.4 11.6 5.2 12 2.8Z M3.5 15c1.6 3.6 4.9 6 8.5 6s6.9-2.4 8.5-6',
    home: 'M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5M10 20v-5.5h4V20',
    sheet: 'M5 3h10l4 4v14H5z M15 3v4h4 M8.5 12h7M8.5 16h7M8.5 8h3',
    team: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M3 12h6m6 0h6 M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
    pc: 'M3 4h18v12H3z M8 20h8M12 16v4',
    bag: 'M6 8h12l1 12H5L6 8Z M9 8V6a3 3 0 0 1 6 0v2 M9 13h6',
    dex: 'M5 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5z M5 3v18 M9 8h6M9 12h6',
    map: 'M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5L9 4Z M9 4v13.5M15 6.5V20',
    battle: 'M4 20 14 10M14 4h6v6M10 14l-4 4M4 4l6 6M20 20l-6-6M16 12l4 4-2 2-4-4',
    shop: 'M4 9h16l-1 11H5L4 9Z M3 5h18v4H3z M10 13h4',
    master: 'M12 3 4 7v5c0 5 3.5 8 8 9 4.5-1 8-4 8-9V7l-8-4Z M9 12l2 2 4-4',
    trainers: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M2 21a7 7 0 0 1 14 0 M17 3a4 4 0 0 1 0 8 M22 21a7 7 0 0 0-4-6.3',
    campaign: 'M5 21V4l14 5-14 5',
    logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11',
    dice: 'M4 4h16v16H4z M8.5 8.5h.01M15.5 15.5h.01M15.5 8.5h.01M8.5 15.5h.01M12 12h.01',
    plus: 'M12 5v14M5 12h14',
    close: 'M6 6l12 12M18 6 6 18',
    heal: 'M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10Z M12 9v6M9 12h6',
    star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z',
    camp: 'M3 20h18M5 20 12 6l7 14M12 6V3M9.5 20l2.5-5 2.5 5',
    arrow: 'M5 12h14M13 6l6 6-6 6',
    edit: 'M4 20h4L19 9l-4-4L4 16v4Z M13.5 6.5l4 4',
    trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    swap: 'M7 7h12l-3-3M17 17H5l3 3',
    ball: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M3 12h6.5M14.5 12H21 M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z',
    run: 'M13 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z M7 21l3-6 3 2v4M10 15l1-5 4 3 3-1M8 10l3-2',
    cidade: 'M3 21h18M5 21V9l5-3v15M10 21V4l9 4v13M13 10h3M13 14h3',
    rota: 'M4 20c4-1 4-6 8-7s4-6 8-9 M4 20h.01M20 4h.01',
    caverna: 'M3 20c0-8 4-15 9-15s9 7 9 15H3Z M9 20c0-3 1.3-6 3-6s3 3 3 6',
    floresta: 'M12 3 6 11h3l-4 6h14l-4-6h3L12 3Z M12 17v4',
    agua: 'M3 12c2 0 2-2 4.5-2S9.5 12 12 12s2.5-2 4.5-2S19 12 21 12 M3 17c2 0 2-2 4.5-2s2 2 4.5 2 2.5-2 4.5-2 2.5 2 4.5 2',
    montanha: 'M3 20 9.5 8l4 6 2.5-4L21 20H3Z'
};

export function Icon({ name, className }: { name: string; className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={paths[name] ?? paths.ball} />
        </svg>
    );
}

const statusPaths: Record<string, string> = {
    poison: 'M12 3s6 6.2 6 10.5a6 6 0 0 1-12 0C6 9.2 12 3 12 3Z',
    paralysis: 'M13 3 5 13h6l-1 8 8-10h-6l1-8Z',
    burn: 'M12 3c.6 3 4 4.8 4 9a4 4 0 0 1-8 0c0-1.7.8-2.8 1.7-3.9C10.5 6.8 11.7 5.4 12 3Z',
    sleep: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z',
    freeze: 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9',
    fainted: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M9 9l6 6m0-6-6 6'
};

export function StatusGlyph({ status }: { status: string }) {
    const d = statusPaths[status];
    if (!d) return null;
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
    );
}
