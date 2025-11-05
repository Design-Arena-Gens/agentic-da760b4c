'use client';

import { FormEvent, useState } from 'react';
import { useProjectStore } from '@/state/projectStore';

export const ApiKeyTab = () => {
  const storedKey = useProjectStore((state) => state.pexelsApiKey);
  const setKey = useProjectStore((state) => state.setPexelsApiKey);
  const [localValue, setLocalValue] = useState(() => storedKey ?? '');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setKey(localValue);
    setStatus('success');
    setTimeout(() => setStatus('idle'), 2500);
  };

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Pexels Authentication</h2>
        <p className="mt-1 text-sm text-slate-600">
          Provide your Pexels API key. It is stored securely in your browser using local storage and
          never sent anywhere except when you request media.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-sm font-medium text-slate-700">
          Pexels API Key
          <input
            value={localValue}
            onChange={(event) => setLocalValue(event.target.value)}
            placeholder="563492ad6f91700001000001..."
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 shadow-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
            spellCheck={false}
            required
          />
        </label>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1"
          >
            Save API Key
          </button>
          {status === 'success' ? (
            <span className="text-sm font-medium text-emerald-600">Saved to your device</span>
          ) : null}
        </div>
      </form>
    </section>
  );
};
