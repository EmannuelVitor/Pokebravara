import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../lib/auth';
import { CAMPAIGNS, campaignId, createBattleDoc, saveCampaign, useCampaign, useTrainers } from '../../lib/db';
import { trainerName } from '../../lib/normalize';
import { useToast } from '../../lib/toast';
import type { Campaign, Faction, Npc } from '../../model';
import { createBattle } from '../../rules/battle';
import { RULES } from '../../rules/config';
import { displayName } from '../../rules/pokemon';
import { Icon } from '../../ui/icons';
import { Sprite } from '../../ui/pokemon';
import { Empty, Modal, Switch } from '../../ui/ui';
import { FACTION_LABEL, ROLE_LABEL, ThreatMeter } from '../CampaignPage';
import PokemonPicker from './PokemonPicker';

export default function CampaignEditor() {
    const { profile } = useAuth();
    const [key, setKey] = useState(campaignId(profile?.campaign));
    const campaign = useCampaign(key);
    const [npc, setNpc] = useState<Npc | null>(null);
    const [faction, setFaction] = useState<Faction | null>(null);
    const [challenge, setChallenge] = useState<Npc | null>(null);
    if (!campaign) return null;

    return (
        <div className="page">
            <div className="page-head">
                <div><p className="eyebrow">Estrutura da campanha</p><h1>NPCs e facções</h1><p>Líderes de ginásio, professores, rivais, campeões e vilões — com times para batalhar, recompensas em ₽ e insígnias.</p></div>
                <div className="row">
                    <select className="input" style={{ width: 'auto' }} value={key} onChange={e => setKey(e.target.value)} aria-label="Campanha">{CAMPAIGNS.map(c => <option key={c.id} value={c.id}>Campanha {c.name}</option>)}</select>
                    <button className="btn" onClick={() => setFaction({ id: 'f' + Date.now().toString(36), name: '', kind: 'vila', threat: 2, description: '', goals: '', visible: false })}><Icon name="plus" />Facção</button>
                    <button className="btn primary" onClick={() => setNpc({ id: 'n' + Date.now().toString(36), name: '', role: 'lider', faction: null, regionId: campaign.location, notes: '', badge: null, reward: 1000, team: [], visible: false })}><Icon name="plus" />NPC</button>
                </div>
            </div>

            <section className="stack">
                <h2>NPCs</h2>
                {campaign.npcs.length === 0 ? <Empty icon="trainers" title="Nenhum NPC" /> : (
                    <div className="grid cols-3">
                        {campaign.npcs.map(n => (
                            <article key={n.id} className="card stack">
                                <div className="row between"><div><p className="eyebrow">{ROLE_LABEL[n.role]}{n.visible ? '' : ' · oculto'}</p><h3>{n.name}</h3></div>{n.badge && <span className="chip on">{n.badge}</span>}</div>
                                <p className="small muted">{campaign.regions.find(r => r.id === n.regionId)?.name ?? 'Sem local'} · recompensa ₽ {n.reward}</p>
                                <div className="row" style={{ gap: 4 }}>{n.team.map(p => <span key={p.uid} title={`${displayName(p)} Nv. ${p.level}`}><Sprite p={p} /></span>)}</div>
                                <div className="row">
                                    <button className="btn small" onClick={() => setNpc(structuredClone(n))}><Icon name="edit" />Editar</button>
                                    <button className="btn primary small" disabled={!n.team.length} onClick={() => setChallenge(n)}><Icon name="battle" />Batalhar</button>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>

            <section className="stack">
                <h2>Facções</h2>
                {campaign.factions.length === 0 ? <Empty icon="campaign" title="Nenhuma facção" /> : (
                    <div className="grid cols-2">
                        {campaign.factions.map(f => (
                            <button key={f.id} className="card stack" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setFaction(structuredClone(f))}>
                                <div className="row between"><div><p className="eyebrow">{FACTION_LABEL[f.kind]}{f.visible ? '' : ' · oculta'}</p><h3>{f.name}</h3></div><ThreatMeter value={f.threat} /></div>
                                <p className="small muted">{f.description}</p>
                            </button>
                        ))}
                    </div>
                )}
            </section>

            {npc && <NpcEditor npc={npc} campaign={campaign} onClose={() => setNpc(null)} />}
            {faction && <FactionEditor faction={faction} campaign={campaign} onClose={() => setFaction(null)} />}
            {challenge && <Challenge npc={challenge} campaign={campaign} onClose={() => setChallenge(null)} />}
        </div>
    );
}

function NpcEditor({ npc, campaign, onClose }: { npc: Npc; campaign: Campaign; onClose: () => void }) {
    const [n, setN] = useState(npc);
    const exists = campaign.npcs.some(x => x.id === npc.id);
    const set = (patch: Partial<Npc>) => setN({ ...n, ...patch });
    const save = async () => {
        if (!n.name.trim()) return;
        await saveCampaign({ ...campaign, npcs: exists ? campaign.npcs.map(x => (x.id === n.id ? n : x)) : [...campaign.npcs, n] });
        onClose();
    };
    return (
        <Modal open onClose={onClose} wide title={exists ? 'Editar NPC' : 'Novo NPC'}
            footer={<>{exists && <button className="btn danger" onClick={async () => { if (confirm('Apagar este NPC?')) { await saveCampaign({ ...campaign, npcs: campaign.npcs.filter(x => x.id !== n.id) }); onClose(); } }}><Icon name="trash" />Apagar</button>}<button className="btn ghost" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={!n.name.trim()} onClick={save}>Salvar</button></>}>
            <div className="grid cols-2">
                <label className="field"><span>Nome</span><input className="input" value={n.name} onChange={e => set({ name: e.target.value })} /></label>
                <label className="field"><span>Papel</span><select className="input" value={n.role} onChange={e => set({ role: e.target.value as Npc['role'] })}>{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                <label className="field"><span>Local</span><select className="input" value={n.regionId ?? ''} onChange={e => set({ regionId: e.target.value || null })}><option value="">—</option>{campaign.regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
                <label className="field"><span>Facção</span><select className="input" value={n.faction ?? ''} onChange={e => set({ faction: e.target.value || null })}><option value="">—</option>{campaign.factions.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
                <label className="field"><span>Recompensa (₽)</span><input className="input num" type="number" min={0} value={n.reward} onChange={e => set({ reward: Number(e.target.value) || 0 })} /></label>
                <label className="field"><span>Insígnia ao vencer</span><input className="input" value={n.badge ?? ''} placeholder="Insígnia Chama" onChange={e => set({ badge: e.target.value || null })} /></label>
            </div>
            <label className="field"><span>Notas do Mestre / falas</span><textarea className="input" value={n.notes} onChange={e => set({ notes: e.target.value })} /></label>
            <Switch checked={n.visible} onChange={v => set({ visible: v })} label="Jogadores já conhecem este NPC" />
            <div className="stack">
                <p className="eyebrow">Time ({n.team.length}/{RULES.party.max}) · sugestão de recompensa: ₽ {Math.round((n.team.reduce((s, p) => s + p.level, 0) / Math.max(1, n.team.length)) * RULES.rewards.perLevel)}</p>
                <div className="grid cols-3">
                    {n.team.map(p => (
                        <div key={p.uid} className="card flat row between">
                            <span className="row"><Sprite p={p} /><span><strong>{displayName(p)}</strong><p className="tiny muted">Nv. {p.level}</p></span></span>
                            <button className="btn ghost icon small" aria-label="Remover" onClick={() => set({ team: n.team.filter(x => x.uid !== p.uid) })}><Icon name="close" /></button>
                        </div>
                    ))}
                </div>
                {n.team.length < RULES.party.max && <PokemonPicker defaultLevel={12} onAdd={p => set({ team: [...n.team, p] })} />}
            </div>
        </Modal>
    );
}

function FactionEditor({ faction, campaign, onClose }: { faction: Faction; campaign: Campaign; onClose: () => void }) {
    const [f, setF] = useState(faction);
    const exists = campaign.factions.some(x => x.id === faction.id);
    const set = (patch: Partial<Faction>) => setF({ ...f, ...patch });
    return (
        <Modal open onClose={onClose} title={exists ? 'Editar facção' : 'Nova facção'}
            footer={<>{exists && <button className="btn danger" onClick={async () => { if (confirm('Apagar esta facção?')) { await saveCampaign({ ...campaign, factions: campaign.factions.filter(x => x.id !== f.id) }); onClose(); } }}><Icon name="trash" />Apagar</button>}<button className="btn ghost" onClick={onClose}>Cancelar</button>
                <button className="btn primary" disabled={!f.name.trim()} onClick={async () => { await saveCampaign({ ...campaign, factions: exists ? campaign.factions.map(x => (x.id === f.id ? f : x)) : [...campaign.factions, f] }); onClose(); }}>Salvar</button></>}>
            <div className="grid cols-2">
                <label className="field"><span>Nome</span><input className="input" value={f.name} onChange={e => set({ name: e.target.value })} placeholder="Equipe Cinzas" /></label>
                <label className="field"><span>Tipo</span><select className="input" value={f.kind} onChange={e => set({ kind: e.target.value as Faction['kind'] })}>{Object.entries(FACTION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                <label className="field"><span>Ameaça ({f.threat}/5)</span><input type="range" min={0} max={5} value={f.threat} onChange={e => set({ threat: Number(e.target.value) })} /></label>
                <Switch checked={f.visible} onChange={v => set({ visible: v })} label="Visível para os jogadores" />
            </div>
            <label className="field"><span>Descrição</span><textarea className="input" value={f.description} onChange={e => set({ description: e.target.value })} /></label>
            <label className="field"><span>Objetivos</span><textarea className="input" value={f.goals} onChange={e => set({ goals: e.target.value })} placeholder="Despertar o lendário do vulcão…" /></label>
        </Modal>
    );
}

function Challenge({ npc, campaign, onClose }: { npc: Npc; campaign: Campaign; onClose: () => void }) {
    const { user } = useAuth();
    const toast = useToast();
    const navigate = useNavigate();
    const trainers = (useTrainers(true) ?? []).filter(t => campaignId(t.campaign) === campaign.id);
    const [chosen, setChosen] = useState<string[]>([]);
    return (
        <Modal open onClose={onClose} title={'Batalha contra ' + npc.name} subtitle="Escolha quem enfrenta o NPC."
            footer={<><button className="btn ghost" onClick={onClose}>Cancelar</button>
                <button className="btn primary" disabled={!chosen.length} onClick={async () => {
                    const group = trainers.filter(t => chosen.includes(t.id));
                    const battle = createBattle({
                        campaign: campaign.id, createdBy: user!.uid,
                        trainers: group.map(t => ({ uid: t.id, name: trainerName(t), classKey: t.trainerClass ?? null, agility: t.attributes?.agi ?? 0, team: t.team ?? [] })),
                        enemy: { kind: 'npc', name: npc.name, npcId: npc.id, reward: npc.reward, badge: npc.badge ?? null, team: npc.team.map(p => ({ ...p, uid: p.uid + '-' + Date.now().toString(36) })) }
                    });
                    try { navigate('/batalha/' + (await createBattleDoc(battle))); } catch { toast('Não foi possível criar a batalha.', 'bad'); }
                }}><Icon name="battle" />Começar</button></>}>
            {trainers.length === 0 ? <p className="muted">Nenhum treinador nesta campanha.</p> : (
                <div className="chips">{trainers.map(t => {
                    const on = chosen.includes(t.id);
                    return <button key={t.id} className={'chip' + (on ? ' on' : '')} aria-pressed={on} onClick={() => setChosen(on ? chosen.filter(x => x !== t.id) : [...chosen, t.id])}>{trainerName(t)}</button>;
                })}</div>
            )}
        </Modal>
    );
}
