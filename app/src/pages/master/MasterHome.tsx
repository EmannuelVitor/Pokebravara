import { Link } from 'react-router';
import { useAuth } from '../../lib/auth';
import { CAMPAIGNS, useActiveBattles, useCampaign, useTrainers } from '../../lib/db';
import { trainerName } from '../../lib/normalize';
import { displayName, statsOf } from '../../rules/pokemon';
import { setAvatarFallback } from '../../ui/avatar';
import { Icon } from '../../ui/icons';
import { Empty } from '../../ui/ui';

function CampaignCard({ id, name }: { id: string; name: string }) {
    const c = useCampaign(id);
    const here = c?.regions.find(r => r.id === c.location);
    return (
        <Link to="/mapa" className="card stack" style={{ textDecoration: 'none' }}>
            <p className="eyebrow">Campanha</p>
            <h2>{name}</h2>
            <p className="small muted">{here ? `Grupo em ${here.name} · clima ${c?.weather}` : 'Sem posição no mapa'}</p>
            <p className="tiny faint">{c?.regions.length ?? 0} áreas · {c?.npcs.length ?? 0} NPCs · {c?.factions.length ?? 0} facções</p>
        </Link>
    );
}

export default function MasterHome() {
    const { user, profile } = useAuth();
    const trainers = useTrainers(true);
    const battles = useActiveBattles(user?.uid, true);
    const hurt = (trainers ?? []).flatMap(t => (t.team ?? []).filter(p => p.currentHp < statsOf(p).hp || p.statusCondition !== 'none').map(p => ({ t, p })));

    return (
        <div className="page rise">
            <section className="card hero">
                <p className="eyebrow">Painel do Mestre</p>
                <h1>Olá, {profile?.professorName}.</h1>
                <p className="muted">{trainers ? `${trainers.length} treinadores · ${battles.filter(b => b.status === 'active').length} batalha(s) em andamento.` : 'Carregando treinadores…'}</p>
            </section>

            {battles.length > 0 && (
                <section className="stack">
                    <h2>Batalhas</h2>
                    <div className="grid cols-3">
                        {battles.map(b => (
                            <Link key={b.id} to={'/batalha/' + b.id} className="card row between" style={{ textDecoration: 'none', borderColor: b.status === 'active' ? 'var(--bad)' : 'var(--line)' }}>
                                <div><strong>{b.enemy.kind === 'wild' ? 'Selvagem' : b.enemy.name}</strong><p className="small muted">{b.status === 'active' ? `Rodada ${b.round} · ${Object.keys(b.actions ?? {}).length}/${b.participants.length} ações` : 'Encerrada · falta aplicar o resultado'}</p></div>
                                <Icon name="arrow" />
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            <section className="grid cols-2">{CAMPAIGNS.map(c => <CampaignCard key={c.id} {...c} />)}</section>

            <section className="stack">
                <div className="row between"><h2>Treinadores</h2><Link className="btn ghost small" to="/treinadores">Ver todos<Icon name="arrow" /></Link></div>
                {!trainers?.length ? <Empty icon="trainers" title="Nenhum treinador ainda" /> : (
                    <div className="grid cols-3">
                        {trainers.slice(0, 9).map(t => (
                            <Link key={t.id} to={'/treinadores/' + t.id} className="card row" style={{ textDecoration: 'none' }}>
                                <img className="avatar" alt="" src={t.imageUrl || undefined} ref={img => setAvatarFallback(img, t.trainerName)} />
                                <div style={{ minWidth: 0 }}><strong>{trainerName(t)}</strong><p className="small muted">{t.team?.length ?? 0} Pokémon · {t.campaign ?? 'sem campanha'}{t.trainerClass ? '' : ' · ficha incompleta'}</p></div>
                            </Link>
                        ))}
                    </div>
                )}
            </section>

            {hurt.length > 0 && (
                <section className="card stack">
                    <h2>Pokémon feridos</h2>
                    <div className="chips">{hurt.slice(0, 24).map(({ t, p }) => <Link key={t.id + p.uid} to={'/treinadores/' + t.id} className="chip">{trainerName(t)}: {displayName(p)} {p.currentHp}/{statsOf(p).hp}</Link>)}</div>
                </section>
            )}
        </div>
    );
}
