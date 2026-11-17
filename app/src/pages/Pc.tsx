import { useState } from 'react';
import { speciesById, sprite } from '../data';
import { useAuth } from '../lib/auth';
import { campaignId, updateTrainer, useCampaign } from '../lib/db';
import { useToast } from '../lib/toast';
import type { PokemonInstance } from '../model';
import { RULES } from '../rules/config';
import { displayName, fullHeal } from '../rules/pokemon';
import { Icon } from '../ui/icons';
import { PokemonDetail } from '../ui/pokemon';
import { Empty, Modal, StatusPill } from '../ui/ui';

/** PC do treinador: caixas de RULES.pc.boxSize, troca com o time e cura no Centro Pokémon. */
export default function Pc() {
    const { profile } = useAuth();
    const toast = useToast();
    const campaign = useCampaign(campaignId(profile?.campaign));
    const [box, setBox] = useState(0);
    const [selected, setSelected] = useState<{ from: 'team' | 'pc'; uid: string } | null>(null);
    if (!profile) return null;
    const team = profile.team ?? [];
    const pc = profile.pc ?? [];
    const here = campaign?.regions.find(r => r.id === campaign.location);
    const access = Boolean(profile.pcUnlocked || here?.pokemonCenter);
    const boxes = Math.max(RULES.pc.boxes, Math.ceil((pc.length + 1) / RULES.pc.boxSize));
    const inBox = pc.slice(box * RULES.pc.boxSize, (box + 1) * RULES.pc.boxSize);
    const chosen = selected ? (selected.from === 'team' ? team : pc).find(p => p.uid === selected.uid) ?? null : null;

    async function save(nextTeam: PokemonInstance[], nextPc: PokemonInstance[], message: string) {
        try {
            await updateTrainer(profile!.id, { team: nextTeam, pc: nextPc });
            toast(message, 'ok');
            setSelected(null);
        } catch {
            toast('Não foi possível salvar. Confira a conexão.', 'bad');
        }
    }

    function move() {
        if (!chosen || !selected) return;
        if (selected.from === 'team') {
            if (team.length <= 1) return toast('O time precisa ter pelo menos um Pokémon.', 'bad');
            save(team.filter(p => p.uid !== chosen.uid), [...pc, chosen], `${displayName(chosen)} foi para o PC.`);
        } else {
            if (team.length >= RULES.party.max) return toast(`O time já tem ${RULES.party.max} Pokémon. Guarde um antes.`, 'bad');
            save([...team, chosen], pc.filter(p => p.uid !== chosen.uid), `${displayName(chosen)} entrou no time.`);
        }
    }

    if (!access) {
        return (
            <div className="page">
                <div className="page-head"><div><p className="eyebrow">Sistema de armazenamento</p><h1>PC</h1></div></div>
                <Empty icon="pc" title="O PC só funciona em um Centro Pokémon">Quando o grupo estiver numa cidade com Centro Pokémon (ou o Professor liberar o acesso), você poderá trocar Pokémon e curar os reservas. Você tem {pc.length} Pokémon guardados.</Empty>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="page-head">
                <div><p className="eyebrow">Sistema de armazenamento</p><h1>PC <span className="muted num" style={{ fontSize: '1.2rem' }}>{pc.length} guardados</span></h1><p>Selecione um Pokémon do time ou da caixa para trocar de lugar.</p></div>
                {here?.pokemonCenter && <button className="btn" onClick={() => save(team.map(fullHeal), pc.map(fullHeal), 'Time e reservas curados!')}><Icon name="heal" />Curar time e reservas</button>}
            </div>

            <section className="card stack">
                <div className="row between"><h2>Time <span className="muted num small">{team.length}/{RULES.party.max}</span></h2></div>
                <div className="box-grid" style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}>
                    {Array.from({ length: RULES.party.max }, (_, i) => team[i]).map((p, i) => (
                        <button key={p?.uid ?? 'e' + i} className={'slot' + (p ? ' filled' : '') + (p && selected?.uid === p.uid ? ' selected' : '')} disabled={!p}
                            aria-label={p ? `${displayName(p)}, nível ${p.level}` : 'Vazio'} title={p ? `${displayName(p)} · Nv. ${p.level}` : undefined}
                            onClick={() => p && setSelected({ from: 'team', uid: p.uid })}>
                            {p && <img src={sprite(speciesById(p.pokemonId)!.dex, p.isShiny)} alt="" />}
                        </button>
                    ))}
                </div>
            </section>

            <section className="card stack">
                <div className="row between">
                    <h2>Caixa {box + 1}</h2>
                    <div className="row">
                        <button className="btn small icon" aria-label="Caixa anterior" disabled={box === 0} onClick={() => setBox(box - 1)}>‹</button>
                        <span className="small muted num">{box + 1} / {boxes}</span>
                        <button className="btn small icon" aria-label="Próxima caixa" disabled={box >= boxes - 1} onClick={() => setBox(box + 1)}>›</button>
                    </div>
                </div>
                <div className="box-grid">
                    {Array.from({ length: RULES.pc.boxSize }, (_, i) => inBox[i]).map((p, i) => (
                        <button key={p?.uid ?? 'b' + i} className={'slot' + (p ? ' filled' : '') + (p && selected?.uid === p.uid ? ' selected' : '')} disabled={!p}
                            aria-label={p ? `${displayName(p)}, nível ${p.level}` : `Espaço ${i + 1} vazio`} title={p ? `${displayName(p)} · Nv. ${p.level}` : undefined}
                            onClick={() => p && setSelected({ from: 'pc', uid: p.uid })}>
                            {p && <img src={sprite(speciesById(p.pokemonId)!.dex, p.isShiny)} alt="" />}
                        </button>
                    ))}
                </div>
            </section>

            <Modal open={Boolean(chosen)} onClose={() => setSelected(null)} wide title={chosen ? displayName(chosen) : ''}
                subtitle={chosen && selected ? <span className="row">{selected.from === 'team' ? `Time · posição ${team.indexOf(chosen) + 1}` : `PC · caixa ${Math.floor(pc.indexOf(chosen) / RULES.pc.boxSize) + 1}, espaço ${(pc.indexOf(chosen) % RULES.pc.boxSize) + 1}`}<StatusPill status={chosen.statusCondition} /></span> : null}
                footer={chosen && selected && (
                    <>
                        <button className="btn ghost" onClick={() => setSelected(null)}>Fechar</button>
                        <button className="btn primary" onClick={move} disabled={selected.from === 'pc' ? team.length >= RULES.party.max : team.length <= 1}>
                            <Icon name="swap" />{selected.from === 'team' ? 'Guardar no PC' : team.length >= RULES.party.max ? `Time cheio (${RULES.party.max}/${RULES.party.max})` : 'Levar para o time'}
                        </button>
                    </>
                )}>
                {chosen && <PokemonDetail p={chosen} />}
            </Modal>
        </div>
    );
}
