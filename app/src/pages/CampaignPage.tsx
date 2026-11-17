import { useAuth } from '../lib/auth';
import { campaignId, useCampaign } from '../lib/db';
import type { Faction, Npc } from '../model';
import { displayName } from '../rules/pokemon';
import { Sprite } from '../ui/pokemon';
import { Empty } from '../ui/ui';

export const ROLE_LABEL: Record<Npc['role'], string> = { lider: 'Líder de Ginásio', professor: 'Professor', rival: 'Rival', campeao: 'Campeão', vilao: 'Vilão', civil: 'Civil' };
export const FACTION_LABEL: Record<Faction['kind'], string> = { vila: 'Ameaça', aliada: 'Aliada', neutra: 'Neutra' };

export function ThreatMeter({ value }: { value: number }) {
    return <span className="row tiny" style={{ gap: 3 }} aria-label={`Ameaça ${value} de 5`}>{Array.from({ length: 5 }, (_, i) => <i key={i} style={{ width: 10, height: 10, borderRadius: 3, background: i < value ? 'var(--bad)' : 'var(--line)' }} />)}</span>;
}

export default function CampaignPage() {
    const { profile, isProfessor } = useAuth();
    const campaign = useCampaign(campaignId(profile?.campaign));
    if (!campaign) return null;
    const npcs = campaign.npcs.filter(n => isProfessor || n.visible);
    const factions = campaign.factions.filter(f => isProfessor || f.visible);
    const region = (id: string | null) => campaign.regions.find(r => r.id === id)?.name;

    return (
        <div className="page">
            <div className="page-head"><div><p className="eyebrow">Campanha {campaign.name}</p><h1>Personagens e facções</h1><p>Quem você já conheceu na jornada: líderes de ginásio, rivais, professores e as forças que movem a região.</p></div></div>

            <section className="stack">
                <h2>Pessoas</h2>
                {npcs.length === 0 ? <Empty icon="trainers" title="Ninguém por aqui ainda" /> : (
                    <div className="grid cols-3 rise">
                        {npcs.map(n => (
                            <article key={n.id} className="card stack">
                                <div className="row between"><div><p className="eyebrow">{ROLE_LABEL[n.role]}</p><h3>{n.name}</h3></div>{n.badge && <span className="chip on">{n.badge}</span>}</div>
                                <p className="small muted">{[region(n.regionId), campaign.factions.find(f => f.id === n.faction)?.name].filter(Boolean).join(' · ')}</p>
                                {n.notes && <p className="small">{n.notes}</p>}
                                {n.team.length > 0 && <div className="row" style={{ gap: 4 }}>{n.team.map(p => <span key={p.uid} title={displayName(p)}><Sprite p={p} /></span>)}</div>}
                                {n.defeatedBy?.includes(profile?.id ?? '') && <span className="chip">Você venceu</span>}
                            </article>
                        ))}
                    </div>
                )}
            </section>

            <section className="stack">
                <h2>Facções</h2>
                {factions.length === 0 ? <Empty icon="campaign" title="Nenhuma facção conhecida" /> : (
                    <div className="grid cols-2 rise">
                        {factions.map(f => (
                            <article key={f.id} className="card stack">
                                <div className="row between"><div><p className="eyebrow">{FACTION_LABEL[f.kind]}</p><h3>{f.name}</h3></div><ThreatMeter value={f.threat} /></div>
                                <p className="small">{f.description}</p>
                                {f.goals && <p className="small muted"><strong>Objetivos:</strong> {f.goals}</p>}
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
