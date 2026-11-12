'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';

type Option = { value: string; label: React.ReactNode; text: string; disabled: boolean };

// Reads <option> children (also inside arrays and fragments), so a <select> can become <Select> unchanged.
function readOptions(children: React.ReactNode): Option[] {
  const out: Option[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const props = child.props as { value?: string | number; children?: React.ReactNode; disabled?: boolean };
    if (child.type === React.Fragment) { out.push(...readOptions(props.children)); return; }
    if (child.type !== 'option') return;
    const text = React.Children.toArray(props.children).filter((c) => typeof c === 'string' || typeof c === 'number').join('');
    out.push({ value: String(props.value ?? text), label: props.children, text, disabled: !!props.disabled });
  });
  return out;
}

type Props = {
  value: string | number;
  onChange: (event: { target: { value: string } }) => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  'aria-label'?: string;
};

// The Zamzam dropdown: rounded, gold highlight, keyboard friendly, with a search box for long lists.
// Same props as <select> (value, onChange(e.target.value), <option> children).
export default function Select({ value, onChange, children, className = '', disabled, name, id, 'aria-label': ariaLabel }: Props) {
  const options = useMemo(() => readOptions(children), [children]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const current = options.find((o) => o.value === String(value));
  const searchable = options.length > 8;
  const shown = query ? options.filter((o) => o.text.toLowerCase().includes(query.toLowerCase())) : options;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const openList = () => {
    if (disabled) return;
    setQuery('');
    setActive(Math.max(0, options.findIndex((o) => o.value === String(value))));
    setOpen(true);
  };
  const choose = (o: Option | undefined) => {
    if (!o || o.disabled) return;
    onChange({ target: { value: o.value } });
    setOpen(false);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openList(); }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(shown.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(shown[active]); }
    else if (e.key === 'Tab') setOpen(false);
  };

  return (
    <div ref={root} className={`relative ${className.includes('w-') || className.includes('flex-1') ? '' : 'w-full'} ${className.match(/\b(flex-1|w-\S+|min-w-\S+|max-w-\S+|sm:col-span-\d)\b/g)?.join(' ') ?? ''}`} onKeyDown={onKey}>
      {name && <input type="hidden" name={name} value={String(value)} />}
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openList())}
        className={`${className} !w-full flex items-center justify-between gap-2 text-start cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 transition-colors ${open ? 'ring-2 ring-[#b99664]/50 border-[#b99664]' : 'hover:border-[#cdbb9e]'}`}
      >
        <span className={`truncate ${current ? '' : 'text-[#9aa1a9]'}`}>{current?.label ?? '—'}</span>
        <svg aria-hidden="true" viewBox="0 0 20 20" className={`w-4 h-4 shrink-0 text-[#b99664] transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full min-w-[12rem] rounded-xl border border-[#e3d7c3] bg-white shadow-[0_12px_32px_-12px_rgba(20,43,74,0.35)] overflow-hidden">
          {searchable && (
            <div className="p-2 border-b border-[#f0e9dd]">
              <input
                autoFocus
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                placeholder="…"
                aria-label="Search"
                className="w-full rounded-lg border border-[#e3d7c3] bg-[#fcfaf7] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#b99664]/40"
              />
            </div>
          )}
          <ul id={listId} role="listbox" className="max-h-64 overflow-y-auto py-1">
            {shown.length === 0 && <li className="px-3 py-2 text-sm text-[#9aa1a9]">—</li>}
            {shown.map((o, i) => {
              const selected = o.value === String(value);
              return (
                <li
                  key={o.value + i}
                  role="option"
                  aria-selected={selected}
                  aria-disabled={o.disabled}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => { e.preventDefault(); choose(o); }}
                  className={`mx-1 flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer ${
                    o.disabled ? 'opacity-40 cursor-not-allowed' : i === active ? 'bg-[#f7f0e4] text-[#142b4a]' : 'text-[#2d3540]'
                  } ${selected ? 'font-bold' : ''}`}
                >
                  <span className="truncate">{o.label}</span>
                  {selected && <span aria-hidden="true" className="text-[#b99664]">✓</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
