import { useState, ReactNode } from 'react';

interface PanelSectionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function PanelSection({ title, children, defaultOpen = true }: PanelSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
      >
        {title}
        <span className={`transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && <div className="px-3 pb-3 flex flex-col gap-2">{children}</div>}
    </div>
  );
}
