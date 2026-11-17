import { useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../lib/auth';
import { CATEGORY_LABEL, CATEGORY_ORDER, itemBySlug, itemSprite, type ItemCategory } from '../rules/items';
import { slotsUsed } from '../rules/bag';
import { RULES } from '../rules/config';
import { Icon } from '../ui/icons';
import { Bar, Empty, Money, Tabs } from '../ui/ui';

export default function Bag() {
    const { profile } = useAuth();
    const [tab, setTab] = useState<ItemCategory | 'all'>('all');
    if (!profile) return null;
    const bag = profile.bag ?? [];
    const used = slotsUsed(bag);
    const items = bag
        .map(e => ({ entry: e, item: itemBySlug(e.technicalName)! }))
        .filter(x => x.item && (tab === 'all' || x.item.category === tab))
        .sort((a, b) => CATEGORY_ORDER.indexOf(a.item.category) - CATEGORY_ORDER.indexOf(b.item.category) || a.item.name.localeCompare(b.item.name));

    return (
        <div className="page">
            <div className="page-head">
                <div><p className="eyebrow">Inventário</p><h1>Mochila</h1><p>Itens de cura, frutas, pedras e TMs são usados pela tela do Time. Pokébolas, na batalha.</p></div>
                <div className="card flat stack" style={{ minWidth: 240, gap: 6 }}>
                    <div className="row between small"><span>Espaço</span><strong className="num">{used}/{RULES.bag.slots}</strong></div>
                    <Bar ratio={used / RULES.bag.slots} label="Espaço da mochila" />
                    <div className="row between small"><span>Dinheiro</span><strong><Money value={profile.money ?? 0} /></strong></div>
                </div>
            </div>
            <Tabs label="Categorias" value={tab} onChange={setTab} items={[{ value: 'all', label: 'Tudo' }, ...CATEGORY_ORDER.map(c => ({ value: c, label: CATEGORY_LABEL[c] }))]} />
            {items.length === 0 ? (
                <Empty icon="bag" title={tab === 'all' ? 'Mochila vazia' : 'Nada nesta categoria'}>Compre itens na <Link to="/loja">loja</Link> quando o grupo estiver numa cidade.</Empty>
            ) : (
                <div className="grid cols-3 rise">
                    {items.map(({ entry, item }) => (
                        <div key={entry.technicalName} className="card row" style={{ alignItems: 'flex-start' }}>
                            <div className="sprite-box" style={{ width: 52, height: 52 }}><img className="sprite" src={itemSprite(entry.technicalName)} alt="" /></div>
                            <div className="stack" style={{ gap: 3, flex: 1 }}>
                                <div className="row between"><strong>{item.name}</strong><span className="chip num">x{entry.quantity}</span></div>
                                <span className="tiny faint">{CATEGORY_LABEL[item.category]}</span>
                                <p className="small muted">{item.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <p className="small faint"><Icon name="bag" className="" /> Itens-chave não ocupam espaço. Cada espaço guarda até {RULES.bag.stack} unidades do mesmo item.</p>
        </div>
    );
}
