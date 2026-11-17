import { useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router';
import { logout, useAuth } from '../lib/auth';
import { useActiveBattles } from '../lib/db';
import { setAvatarFallback } from './avatar';
import { Icon } from './icons';
import { Modal } from './ui';

interface Item { to: string; label: string; icon: string; badge?: number }

export default function Shell({ children }: { children: ReactNode }) {
    const { user, profile, isProfessor } = useAuth();
    const battles = useActiveBattles(user?.uid, isProfessor);
    const [more, setMore] = useState(false);
    const live = battles.filter(b => b.status === 'active').length;

    const player: Item[] = [
        { to: '/', label: 'Início', icon: 'home' },
        { to: '/ficha', label: 'Ficha', icon: 'sheet' },
        { to: '/time', label: 'Time', icon: 'team' },
        { to: '/pc', label: 'PC', icon: 'pc' },
        { to: '/mochila', label: 'Mochila', icon: 'bag' },
        { to: '/pokedex', label: 'Pokédex', icon: 'dex' },
        { to: '/mapa', label: 'Mapa', icon: 'map' },
        { to: '/loja', label: 'Loja', icon: 'shop' },
        { to: '/campanha', label: 'Campanha', icon: 'campaign' },
        { to: '/batalha', label: 'Batalha', icon: 'battle', badge: live }
    ];
    const master: Item[] = [
        { to: '/', label: 'Painel', icon: 'master' },
        { to: '/treinadores', label: 'Treinadores', icon: 'trainers' },
        { to: '/mapa', label: 'Mapa e encontros', icon: 'map' },
        { to: '/mestre/campanha', label: 'NPCs e facções', icon: 'campaign' },
        { to: '/batalha', label: 'Batalhas', icon: 'battle', badge: live },
        { to: '/pokedex', label: 'Pokédex', icon: 'dex' }
    ];
    const items = isProfessor ? master : player;
    const mobileMain = isProfessor ? [items[0], items[1], items[2], items[4]] : [items[0], items[2], items[9], items[6]];
    const name = profile?.trainerName || profile?.professorName || 'Treinador';

    const link = (item: Item, onClick?: () => void) => (
        <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} onClick={onClick}>
            <Icon name={item.icon} />{item.label}
            {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
        </NavLink>
    );

    return (
        <div className="shell">
            <a href="#conteudo" className="sr-only">Ir para o conteúdo</a>
            <aside className="rail">
                <Link to="/" className="brand"><span className="brand-mark"><Icon name="brand" /></span>PokeBravara</Link>
                <nav className="nav-group" aria-label="Principal">
                    <span className="eyebrow">{isProfessor ? 'Mestre' : 'Aventura'}</span>
                    {items.map(i => link(i))}
                </nav>
                <div className="rail-user">
                    <img className="avatar" alt="" src={profile?.imageUrl || undefined} ref={img => setAvatarFallback(img, name)} />
                    <div>
                        <strong>{name}</strong>
                        <span className="tiny muted">{isProfessor ? 'Professor' : profile?.campaign ? 'Campanha ' + profile.campaign : 'Treinador'}</span>
                    </div>
                    <button className="btn ghost icon" onClick={() => logout()} aria-label="Sair" title="Sair"><Icon name="logout" /></button>
                </div>
            </aside>

            <header className="topbar">
                <Link to="/" className="brand"><span className="brand-mark"><Icon name="brand" /></span>PokeBravara</Link>
                <button className="btn ghost icon" onClick={() => logout()} aria-label="Sair"><Icon name="logout" /></button>
            </header>

            <main className="main" id="conteudo">{children}</main>

            <nav className="tabbar" aria-label="Principal">
                {mobileMain.map(item => (
                    <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
                        <Icon name={item.icon} />{item.label.split(' ')[0]}{item.badge ? ` (${item.badge})` : ''}
                    </NavLink>
                ))}
                <button onClick={() => setMore(true)}><Icon name="plus" />Mais</button>
            </nav>
            <Modal open={more} onClose={() => setMore(false)} title="Menu">
                <nav className="stack" aria-label="Todas as páginas">{items.map(i => link(i, () => setMore(false)))}</nav>
            </Modal>
        </div>
    );
}
