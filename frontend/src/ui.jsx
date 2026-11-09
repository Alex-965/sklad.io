import React, { useEffect, useId, useRef } from 'react';
import { X, Loader2, PackageOpen, ChevronLeft, ChevronRight } from 'lucide-react';

export function Button({ children, icon: Icon, variant = '', className = '', busy = false, disabled = false, ...props }) {
  return <button className={`button ${variant} ${className}`} disabled={busy || disabled} {...props}>
    {busy ? <Loader2 size={16} className="spin" /> : Icon && <Icon size={16} />} {children}
  </button>;
}

export function PageTitle({ eyebrow = 'СКЛАДСЬКИЙ ОБЛІК', title, description, children }) {
  return <div className="page-title"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div><div className="page-actions">{children}</div></div>;
}

export function Empty({ title = 'Поки що тут порожньо', children }) {
  return <div className="empty"><PackageOpen size={32} strokeWidth={1.3} /><h3>{title}</h3><p>{children || 'Нові записи з’являться тут після додавання.'}</p></div>;
}

export function Field({ label, children, hint, ...props }) {
  const id = useId(), labelId = `${id}-label`, hintId = `${id}-hint`;
  const accessible = { id, 'aria-labelledby': labelId, ...(hint ? { 'aria-describedby': hintId } : {}) };
  return <label className="field" htmlFor={id}><span id={labelId}>{label}</span>{children ? React.cloneElement(children, accessible) : <input {...props} {...accessible} />}{hint && <small id={hintId}>{hint}</small>}</label>;
}

export function Dialog({ title, description, onClose, children, busy = false }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const old = document.activeElement;
    const root = ref.current;
    (root.querySelector('input,select,textarea') || root.querySelector('button'))?.focus();
    function keys(event) {
      if (event.key === 'Escape' && !busy) onClose();
      if (event.key === 'Tab') {
        const fields = [...root.querySelectorAll('button,input,select,textarea,a[href]')].filter(el => !el.disabled && el.offsetParent !== null);
        if (!fields.length) return;
        if (event.shiftKey && document.activeElement === fields[0]) { event.preventDefault(); fields.at(-1).focus(); }
        else if (!event.shiftKey && document.activeElement === fields.at(-1)) { event.preventDefault(); fields[0].focus(); }
      }
    }
    document.addEventListener('keydown', keys);
    return () => { document.removeEventListener('keydown', keys); old?.focus(); };
  }, [onClose, busy]);
  return <div className="backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref}>
      <div className="dialog-heading"><div><h2 id={titleId}>{title}</h2>{description && <p>{description}</p>}</div><button className="icon-button" aria-label="Закрити вікно" onClick={onClose} disabled={busy}><X size={20} /></button></div>
      {children}
    </section>
  </div>;
}

export function Pagination({ page, pages, count, onChange }) {
  if (!count) return null;
  return <div className="pagination"><span>Усього: {count}</span><div><Button icon={ChevronLeft} aria-label="Попередня сторінка" disabled={page === 1} onClick={() => onChange(page - 1)} /><span>{page} / {pages}</span><Button icon={ChevronRight} aria-label="Наступна сторінка" disabled={page === pages} onClick={() => onChange(page + 1)} /></div></div>;
}

export function Status({ stock, minimum }) {
  return <span className={`badge ${stock === 0 ? 'red' : stock <= minimum ? 'amber' : 'green'}`}><i />{stock === 0 ? 'Немає в наявності' : stock <= minimum ? 'Низький залишок' : 'У наявності'}</span>;
}
