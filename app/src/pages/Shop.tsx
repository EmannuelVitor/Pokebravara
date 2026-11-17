import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { campaignId, updateTrainer, useCampaign } from '../lib/db';
import { useToast } from '../lib/toast';
import { addItem, quantityOf } from '../rules/bag';
import { CATEGORY_LABEL, CATEGORY_ORDER, ITEMS, itemSprite, type ItemCategory } from '../rules/items';
import { Empty, Money, Tabs } from '../ui/ui';

export default function Shop() {
    const { profile } = useAuth();
    const toast = useToast();
    const campaign = useCampaign(campaignId(profile?.campaign));
    const [tab, setTab] = useState<ItemCategory>('balls');
    const [qty, setQty] = useState<Record<string, number>>({});
    const [busy, setBusy] = useState(false);
    if (!profile) return null;
    const here = campaign?.regions.find(r => r.id === campaign.location);
    const money = profile.money ?? 0;
    const forSale = ITEMS.filter(i => i.price !== null && i.category === tab);

    async function buy(slug: string, price: number, name: string) {
        const amount = Math.max(1, qty[slug] ?? 1);
        const total = price * amount;
        if (total > money) { toast('Dinheiro insuficiente.', 'bad'); return; }
        const added = addItem(profile!.bag ?? [], slug, amount);
        if (added.error) { toast(added.error, 'bad'); return; }
        setBusy(true);
        try {
            await updateTrainer(profile!.id, { bag: added.bag, money: money - total });
            toast(`Comprou ${amount}x ${name}.`, 'ok');
        } catch {
            toast('A compra não foi concluída.', 'bad');
        }
        setBusy(false);
    }

    if (!here?.mart) {
        return (
            <div className="page">
                <div className="page-head"><div><p className="eyebrow">Economia</p><h1>Loja Pokémon</h1></div></div>
                <Empty icon="shop" title="Não há loja aqui">A loja abre quando o grupo está numa cidade com Poké Mart. Seu saldo: ₽ {money.toLocaleString('pt-BR')}.</Empty>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="page-head">
                <div><p className="eyebrow">Poké Mart · {here.name}</p><h1>Loja</h1><p>Preços tabelados. A compra desconta do seu saldo e vai direto para a mochila.</p></div>
                <div className="card flat"><p className="eyebrow">Saldo</p><strong style={{ fontSize: '1.4rem' }}><Money value={money} /></strong></div>
            </div>
            <Tabs label="Categorias" value={tab} onChange={setTab} items={CATEGORY_ORDER.filter(c => ITEMS.some(i => i.category === c && i.price !== null)).map(c => ({ value: c, label: CATEGORY_LABEL[c] }))} />
            <div className="grid cols-3 rise">
                {forSale.map(item => {
                    const amount = qty[item.slug] ?? 1;
                    const total = item.price! * amount;
                    return (
                        <div key={item.slug} className="card stack">
                            <div className="row" style={{ alignItems: 'flex-start' }}>
                                <div className="sprite-box" style={{ width: 52, height: 52 }}><img className="sprite" src={itemSprite(item.slug)} alt="" /></div>
                                <div style={{ flex: 1 }}>
                                    <div className="row between"><strong>{item.name}</strong><Money value={item.price!} /></div>
                                    <p className="small muted">{item.description}</p>
                                    <p className="tiny faint">Na mochila: {quantityOf(profile.bag ?? [], item.slug)}</p>
                                </div>
                            </div>
                            <div className="row between">
                                <input className="input num" type="number" min={1} max={99} value={amount} aria-label={'Quantidade de ' + item.name} style={{ width: 80 }}
                                    onChange={e => setQty({ ...qty, [item.slug]: Math.max(1, Math.min(99, Number(e.target.value) || 1)) })} />
                                <button className="btn primary small" disabled={busy || total > money} onClick={() => buy(item.slug, item.price!, item.name)}>Comprar · <Money value={total} /></button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
