import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { campaignId, updateTrainer, useCampaign } from '../lib/db';
import { useToast } from '../lib/toast';
import type { BagEntry, PokemonInstance } from '../model';
import { removeItem } from '../rules/bag';
import { RULES } from '../rules/config';
import { FIELD_SKILLS, canUseField } from '../rules/field';
import { CATEGORY_LABEL, itemBySlug, itemSprite } from '../rules/items';
import { displayName, fullHeal, useItemOn } from '../rules/pokemon';
import { Icon } from '../ui/icons';
import { MonCard, PokemonDetail } from '../ui/pokemon';
import { Empty, Modal } from '../ui/ui';

export default function Team() {
    const { profile } = useAuth();
    const toast = useToast();
    const campaign = useCampaign(campaignId(profile?.campaign));
    const [openUid, setOpenUid] = useState<string | null>(null);
    if (!profile) return null;
    const team = profile.team ?? [];
    const bag = profile.bag ?? [];
    const open = team.find(p => p.uid === openUid) ?? null;
    const here = campaign?.regions.find(r => r.id === campaign.location);
    const atCenter = Boolean(here?.pokemonCenter);

    async function save(nextTeam: PokemonInstance[], nextBag?: BagEntry[], ok?: string) {
        try {
            await updateTrainer(profile!.id, nextBag ? { team: nextTeam, bag: nextBag } : { team: nextTeam });
            if (ok) toast(ok, 'ok');
        } catch {
            toast('Não foi possível salvar. Confira a conexão.', 'bad');
        }
    }

    const replace = (p: PokemonInstance) => team.map(x => (x.uid === p.uid ? p : x));
    const usable = bag.filter(e => {
        const item = itemBySlug(e.technicalName);
        return item && ['healing', 'berries', 'evolution', 'tms'].includes(item.category);
    });

    return (
        <div className="page">
            <div className="page-head">
                <div><p className="eyebrow">Equipe</p><h1>Seu time <span className="muted num" style={{ fontSize: '1.2rem' }}>{team.length}/{RULES.party.max}</span></h1><p>Toque em um Pokémon para ver stats, golpes, evolução e usar itens. O primeiro da lista entra primeiro nas batalhas.</p></div>
                {atCenter && (
                    <button className="btn primary" onClick={() => save(team.map(fullHeal), undefined, 'Seu time foi curado no Centro Pokémon!')}><Icon name="heal" />Curar no Centro Pokémon</button>
                )}
            </div>

            {team.length === 0 ? <Empty title="Seu time está vazio">Capture Pokémon nas rotas ou peça ao Professor.</Empty> : (
                <div className="grid cols-3 rise">
                    {team.map((p, i) => (
                        <MonCard key={p.uid} p={p} onClick={() => setOpenUid(p.uid)} extra={i === 0 ? <span className="tiny" style={{ color: 'var(--accent)' }}>Líder do time</span> : null} />
                    ))}
                </div>
            )}

            <section className="card stack">
                <h2>Habilidades de campo</h2>
                <p className="small muted">Quem do time consegue superar obstáculos do mapa (como as antigas HMs).</p>
                <div className="grid cols-3">
                    {FIELD_SKILLS.map(skill => {
                        const helpers = team.filter(p => canUseField(p, skill));
                        return (
                            <div key={skill.key} className="card flat stack" style={{ gap: 4, opacity: helpers.length ? 1 : .55 }}>
                                <div className="row between"><strong>{skill.label}</strong><span className={'chip ' + (helpers.length ? 'on' : '')}>{helpers.length ? 'Disponível' : 'Ninguém'}</span></div>
                                <p className="tiny muted">{skill.description}</p>
                                {helpers.length > 0 && <p className="tiny">{helpers.map(displayName).join(', ')}</p>}
                            </div>
                        );
                    })}
                </div>
            </section>

            <Modal open={Boolean(open)} onClose={() => setOpenUid(null)} wide title={open ? displayName(open) : ''} subtitle={open ? `Nível ${open.level}` : ''}
                footer={open && (
                    <>
                        {team.indexOf(open) > 0 && <button className="btn" onClick={() => save([open, ...team.filter(x => x.uid !== open.uid)], undefined, `${displayName(open)} agora lidera o time.`)}>Tornar líder</button>}
                        <button className="btn ghost" onClick={() => setOpenUid(null)}>Fechar</button>
                    </>
                )}>
                {open && (
                    <div className="stack" style={{ gap: 20 }}>
                        <PokemonDetail p={open} actions={{ allowEvolve: true, onChange: next => save(replace(next), undefined, next.pokemonId !== open.pokemonId ? `${displayName(open)} evoluiu!` : 'Alterações salvas.') }} />
                        <section className="stack">
                            <p className="eyebrow">Usar item da mochila</p>
                            {usable.length === 0 ? <p className="small muted">Nenhum item de cura, fruta, pedra ou TM na mochila.</p> : (
                                <div className="chips">
                                    {usable.map(e => {
                                        const item = itemBySlug(e.technicalName)!;
                                        return (
                                            <button key={e.technicalName} className="chip" title={item.description} onClick={() => {
                                                const result = useItemOn(open, e.technicalName);
                                                if (!result.ok) { toast(result.message, 'bad'); return; }
                                                save(replace(result.pokemon), removeItem(bag, e.technicalName, 1).bag, result.message);
                                            }}>
                                                <img src={itemSprite(e.technicalName)} alt="" width={22} height={22} style={{ imageRendering: 'pixelated' }} />
                                                {item.name} <span className="num">x{e.quantity}</span> <span className="tiny" style={{ opacity: .6 }}>{CATEGORY_LABEL[item.category]}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    </div>
                )}
            </Modal>
        </div>
    );
}
