'use client';

import clsx from 'clsx';
import { ReactNode } from 'react';

interface TabConfig {
  id: string;
  label: string;
  badge?: number | string | null;
}

interface TabsProps {
  tabs: TabConfig[];
  activeId: string;
  onChange: (id: string) => void;
  children: ReactNode;
}

export const Tabs = ({ tabs, activeId, onChange, children }: TabsProps) => (
  <div className="flex flex-col gap-6">
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={clsx(
            'rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-slate-100',
            activeId === tab.id
              ? 'border-slate-900 bg-slate-900 text-white shadow'
              : 'border-slate-300 bg-white text-slate-700',
          )}
          onClick={() => onChange(tab.id)}
        >
          <span>{tab.label}</span>
          {tab.badge ? (
            <span className="ml-2 inline-flex min-w-6 justify-center rounded-full bg-white px-1 text-xs font-semibold text-slate-900">
              {tab.badge}
            </span>
          ) : null}
        </button>
      ))}
    </div>
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">{children}</div>
  </div>
);
