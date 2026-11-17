import { useState } from 'react';
import { Link } from 'react-router';
import { CAMPAIGNS, useTrainers } from '../../lib/db';
import { trainerName } from '../../lib/normalize';
import { classByKey } from '../../rules/trainer';
import { setAvatarFallback } from '../../ui/avatar';
import { Sprite } from '../../ui/pokemon';
import { Empty, Loading, Money } from '../../ui/ui';

export default function Trainers() {
    const trainers = useTrainers(true);
    const [term, setTerm] = useState('');
    const [campaign, setCampaign] = useState('');
    if (!trainers) return <Loading />;
    const q = term.trim().toLowerCase();
    const list = trainers.filter(t => (!campaign || (t.campaign ?? '') === campaign) && (!q || trainerName(t).toLowerCase().includes(q) || (t.realName ?? '').toLowerCase().includes(q)));

    return (
        <div className="page">
            <div className="page-head">
                <div><p className="eyebrow">Mestre</p><h1>Treinadores</h1><p>{trainers.length} cadastrados. Abra um treinador para editar ficha, time, PC, mochila, dinheiro e insígnias.</p></div>
                <div className="row">
                    <input className="input" type="search" placeholder="Buscar…" value={term} onChange={e => setTerm(e.target.value)} aria-label="Buscar treinador" style={{ width: 200 }} />
                    <select className="input" style={{ width: 'auto' }} value={campaign} onChange={e => setCampaign(e.target.value)} aria-label="Campanha">
                        <option value="">Todas as campanhas</option>{CAMPAIGNS.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                </div>
            </div>
            {list.length === 0 ? <Empty icon="trainers" title="Nenhum treinador encontrado" /> : (
                <div className="grid cols-3 rise">
                    {list.map(t => (
                        <Link key={t.id} to={'/treinadores/' + t.id} className="card stack" style={{ textDecoration: 'none' }}>
                            <div className="row">
                                <img className="avatar" style={{ width: 52, height: 52 }} alt="" src={t.imageUrl || undefined} ref={img => setAvatarFallback(img, t.trainerName)} />
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{trainerName(t)}</strong>
                                    <span className="small muted">{classByKey(t.trainerClass)?.label ?? 'Ficha incompleta'} · {t.campaign ?? 'sem campanha'}</span>
                                </div>
                            </div>
                            <div className="row" style={{ gap: 4, minHeight: 64 }}>{(t.team ?? []).map(p => <Sprite key={p.uid} p={p} />)}</div>
                            <div className="row between small muted"><span>{t.team?.length ?? 0}/6 no time · {t.pc?.length ?? 0} no PC</span><Money value={t.money ?? 0} /></div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
