import { Link } from 'react-router';
import { useAuth } from '../lib/auth';
import { campaignId, useActiveBattles, useCampaign, useDex } from '../lib/db';
import { slotsUsed } from '../rules/bag';
import { RULES } from '../rules/config';
import { classByKey } from '../rules/trainer';
import { Icon } from '../ui/icons';
import { MonCard } from '../ui/pokemon';
import { Empty, Money } from '../ui/ui';

export default function Home() {
    const { user, profile } = useAuth();
    const campaign = useCampaign(campaignId(profile?.campaign));
    const battles = useActiveBattles(user?.uid, false);
    const dex = useDex(user?.uid);
    if (!profile) return null;
    const team = profile.team ?? [];
    const cls = classByKey(profile.trainerClass);
    const here = campaign?.regions.find(r => r.id === campaign.location);
    const captured = [...dex.values()].filter(s => s === 'captured').length;
    const fainted = team.filter(p => p.statusCondition === 'fainted').length;
    const pending = team.filter(p => p.pendingEvolution).length;

    return (
        <div className="page rise">
            {!cls && (
                <Link to="/ficha" className="card row between" style={{ textDecoration: 'none', borderColor: 'var(--action)' }}>
                    <div><strong>Sua ficha está incompleta</strong><p className="small muted">Escolha classe, atributos e perícias para usar o sistema novo.</p></div>
                    <span className="btn primary small">Completar ficha</span>
                </Link>
            )}
            {battles.map(b => (
                <Link key={b.id} to={'/batalha/' + b.id} className="card row between" style={{ textDecoration: 'none', borderColor: 'var(--bad)' }}>
                    <div className="row"><Icon name="battle" /><div><strong>Batalha em andamento — rodada {b.round}</strong><p className="small muted">Contra {b.enemy.kind === 'wild' ? 'um Pokémon selvagem' : b.enemy.name}. Escolha sua ação.</p></div></div>
                    <span className="btn primary small">Entrar</span>
                </Link>
            ))}

            <section className="card hero">
                <div className="row between" style={{ alignItems: 'flex-start' }}>
                    <div className="stack" style={{ gap: 8 }}>
                        <p className="eyebrow">{profile.campaign ? 'Campanha ' + profile.campaign : 'Sem campanha'}{cls ? ' · ' + cls.label : ''}</p>
                        <h1>Bem-vindo de volta, {profile.trainerName}.</h1>
                        <p className="muted">{here ? <>O grupo está em <strong style={{ color: 'var(--ink)' }}>{here.name}</strong>{here.pokemonCenter ? ' · Centro Pokémon' : ''}{here.mart ? ' · Loja' : ''}.</> : 'O Mestre ainda não marcou onde o grupo está.'}</p>
                    </div>
                    <dl className="kv" style={{ minWidth: 280 }}>
                        <div><dt>Dinheiro</dt><dd><Money value={profile.money ?? 0} /></dd></div>
                        <div><dt>Insígnias</dt><dd className="num">{profile.badges?.length ?? 0}</dd></div>
                        <div><dt>Pokédex</dt><dd className="num">{captured} capturados</dd></div>
                    </dl>
                </div>
            </section>

            <section className="stack">
                <div className="row between">
                    <h2>Seu time <span className="muted small num">{team.length}/{RULES.party.max}{fainted ? ` · ${fainted} caído(s)` : ''}{pending ? ` · ${pending} pronto(s) para evoluir` : ''}</span></h2>
                    <Link to="/time" className="btn ghost small">Abrir time<Icon name="arrow" /></Link>
                </div>
                {team.length ? (
                    <div className="grid cols-3 rise">{team.map(p => <Link key={p.uid} to="/time" style={{ textDecoration: 'none', display: 'grid' }}><MonCard p={p} /></Link>)}</div>
                ) : <Empty title="Nenhum Pokémon ainda">O Professor entrega seu primeiro Pokémon — ou capture um nas rotas.</Empty>}
            </section>

            <section className="grid cols-4 rise">
                {[
                    { to: '/mochila', icon: 'bag', title: 'Mochila', text: `${slotsUsed(profile.bag ?? [])}/${RULES.bag.slots} espaços` },
                    { to: '/pc', icon: 'pc', title: 'PC', text: `${profile.pc?.length ?? 0} Pokémon guardados` },
                    { to: '/mapa', icon: 'map', title: 'Mapa', text: here ? here.name : 'Ver a região' },
                    { to: '/ficha', icon: 'sheet', title: 'Ficha', text: 'Atributos e testes' }
                ].map(c => (
                    <Link key={c.to} to={c.to} className="card row" style={{ textDecoration: 'none' }}>
                        <span className="brand-mark" style={{ background: 'var(--surface-3)', color: 'var(--accent)' }}><Icon name={c.icon} /></span>
                        <div><strong>{c.title}</strong><p className="small muted">{c.text}</p></div>
                    </Link>
                ))}
            </section>
        </div>
    );
}
