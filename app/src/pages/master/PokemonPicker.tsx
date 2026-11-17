// Formulário compacto para criar um Pokémon (espécie, nível, natureza, shiny, apelido).
import { useState } from 'react';
import { SPECIES, speciesById } from '../../data';
import type { PokemonInstance } from '../../model';
import { createPokemon } from '../../rules/pokemon';
import { NATURES } from '../../rules/stats';
import { Icon } from '../../ui/icons';

export default function PokemonPicker({ onAdd, label = 'Adicionar', defaultLevel = 5 }: { onAdd: (p: PokemonInstance) => void; label?: string; defaultLevel?: number }) {
    const [species, setSpecies] = useState('');
    const [level, setLevel] = useState(defaultLevel);
    const [nature, setNature] = useState('');
    const [nickname, setNickname] = useState('');
    const [shiny, setShiny] = useState(false);
    return (
        <form className="row" style={{ alignItems: 'end' }} onSubmit={e => {
            e.preventDefault();
            if (!species) return;
            onAdd(createPokemon(Number(species), level, { nature: nature || undefined, nickname: nickname.trim() || undefined, isShiny: shiny }));
            setNickname('');
        }}>
            <label className="field" style={{ minWidth: 200, flex: 2 }}><span>Espécie</span>
                <select className="input" value={species} onChange={e => setSpecies(e.target.value)} required>
                    <option value="">Escolha…</option>
                    {SPECIES.map(s => <option key={s.id} value={s.id}>#{String(s.id).padStart(3, '0')} {s.name}</option>)}
                </select>
            </label>
            <label className="field" style={{ width: 90 }}><span>Nível</span><input className="input num" type="number" min={1} max={100} value={level} onChange={e => setLevel(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} /></label>
            <label className="field" style={{ minWidth: 150, flex: 1 }}><span>Natureza</span>
                <select className="input" value={nature} onChange={e => setNature(e.target.value)}><option value="">Aleatória</option>{NATURES.map(n => <option key={n.name} value={n.name}>{n.label}</option>)}</select>
            </label>
            <label className="field" style={{ minWidth: 140, flex: 1 }}><span>Apelido</span><input className="input" value={nickname} maxLength={20} placeholder={species ? speciesById(Number(species))?.name : ''} onChange={e => setNickname(e.target.value)} /></label>
            <label className="row small" style={{ minHeight: 42 }}><input type="checkbox" checked={shiny} onChange={e => setShiny(e.target.checked)} />Shiny</label>
            <button className="btn primary" disabled={!species}><Icon name="plus" />{label}</button>
        </form>
    );
}
