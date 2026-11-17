import { useEffect, useRef, type ReactNode } from 'react';
import type { Roll } from '../rules/dice';
import { STATUS_LABEL, type StatusCondition } from '../rules/status';
import { typeColor, typeLabel } from '../rules/types';
import { Icon, StatusGlyph } from './icons';

export function Modal({ open, onClose, title, subtitle, children, footer, wide }: {
    open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        const dialog = ref.current;
        if (!dialog) return;
        if (open && !dialog.open) dialog.showModal();
        if (!open && dialog.open) dialog.close();
    }, [open]);
    return (
        <dialog ref={ref} className="modal" style={wide ? { width: 'min(980px, calc(100% - 24px))' } : undefined} onClose={onClose} onClick={e => { if (e.target === ref.current) onClose(); }}>
            {open && (
                <>
                    <div className="modal-body">
                        <div className="modal-head">
                            <div className="stack" style={{ gap: 4 }}>
                                <h2>{title}</h2>
                                {subtitle && <div className="muted small">{subtitle}</div>}
                            </div>
                            <button className="btn ghost icon" onClick={onClose} aria-label="Fechar"><Icon name="close" /></button>
                        </div>
                        {children}
                    </div>
                    {footer && <div className="modal-foot">{footer}</div>}
                </>
            )}
        </dialog>
    );
}

export function Tabs<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode }[]; label: string }) {
    return (
        <div className="tabs" role="tablist" aria-label={label}>
            {items.map(item => (
                <button key={item.value} role="tab" aria-selected={item.value === value} onClick={() => onChange(item.value)}>{item.label}</button>
            ))}
        </div>
    );
}

export function HpBar({ current, max, showText = true }: { current: number; max: number; showText?: boolean }) {
    const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
    const level = ratio <= 0.2 ? 'crit' : ratio <= 0.5 ? 'low' : '';
    return (
        <div className="stack" style={{ gap: 3 }}>
            <div className={'bar hp ' + level} role="meter" aria-label="HP" aria-valuemin={0} aria-valuemax={max} aria-valuenow={current}><i style={{ width: ratio * 100 + '%' }} /></div>
            {showText && <span className="tiny muted num">HP {current}/{max}</span>}
        </div>
    );
}

export function Bar({ ratio, kind = 'stat', label }: { ratio: number; kind?: 'stat' | 'xp'; label?: string }) {
    return <div className={'bar ' + kind} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)}><i style={{ width: Math.max(0, Math.min(1, ratio)) * 100 + '%' }} /></div>;
}

export function TypeBadge({ type }: { type: string }) {
    return <span className="type" style={{ background: typeColor(type) }}>{typeLabel(type)}</span>;
}

export function StatusPill({ status }: { status: StatusCondition }) {
    if (status === 'none') return null;
    return <span className={'status-pill ' + status}><StatusGlyph status={status} />{STATUS_LABEL[status]}</span>;
}

export function Empty({ icon = 'ball', title, children }: { icon?: string; title: string; children?: ReactNode }) {
    return (
        <div className="empty">
            <Icon name={icon} />
            <strong>{title}</strong>
            {children && <div className="small">{children}</div>}
        </div>
    );
}

export function DiceResult({ roll, target }: { roll: Roll; target?: number }) {
    const natural = roll.dice[0];
    const sides = Number(roll.expression.match(/d(\d+)/)?.[1] ?? 20);
    const cls = roll.dice.length === 1 && natural === sides ? 'crit' : roll.dice.length === 1 && natural === 1 ? 'fail' : '';
    return (
        <div className="row">
            {roll.dice.map((d, i) => <span key={i} className={'die ' + cls}>{d}</span>)}
            {roll.modifier !== 0 && <span className="muted num">{roll.modifier > 0 ? '+' : '−'} {Math.abs(roll.modifier)}</span>}
            <span className="muted">=</span>
            <strong className="num" style={{ fontSize: '1.6rem', fontFamily: 'var(--display)' }}>{roll.total}</strong>
            {target !== undefined && <span className={'chip ' + (roll.total >= target ? 'on' : '')}>{roll.total >= target ? 'Sucesso' : 'Falha'} (CD {target})</span>}
        </div>
    );
}

export function Money({ value }: { value: number }) {
    return <span className="num">₽ {value.toLocaleString('pt-BR')}</span>;
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
    return (
        <label className="row" style={{ gap: 10, cursor: 'pointer' }}>
            <span className="switch"><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} /><span /></span>
            {label}
        </label>
    );
}

export function Loading({ text = 'Carregando…' }: { text?: string }) {
    return <div className="empty" aria-busy="true"><span className="die">?</span><span>{text}</span></div>;
}
