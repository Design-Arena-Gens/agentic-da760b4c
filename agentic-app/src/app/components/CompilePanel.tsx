'use client';

import { useState } from 'react';
import { useProjectStore, useScenes } from '@/state/projectStore';

interface CompilationResponse {
  jobId: string;
  videoUrl: string;
}

export const CompilePanel = () => {
  const scenes = useScenes();
  const subtitlesRequested = useProjectStore((state) => state.subtitlesRequested);
  const setSubtitlesRequested = useProjectStore((state) => state.setSubtitlesRequested);
  const [status, setStatus] = useState<'idle' | 'working' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const readyScenes = scenes.filter((scene) => scene.selectedMedia && scene.selectedAudio);
  const allReady = readyScenes.length === scenes.length && scenes.length > 0;

  const handleCompile = async () => {
    if (!allReady) {
      setStatus('error');
      setMessage('All scenes require media and audio selections before rendering.');
      return;
    }
    setStatus('working');
    setMessage(null);
    setDownloadUrl(null);

    try {
      const response = await fetch('/api/video/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenes: scenes.map((scene) => ({
            id: scene.id,
            narration: scene.narration,
            duration: scene.duration,
            media: scene.selectedMedia,
            audio: scene.selectedAudio,
          })),
          subtitles: subtitlesRequested,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Compilation failed.');
      }

      const data = (await response.json()) as CompilationResponse;
      setDownloadUrl(data.videoUrl);
      setStatus('success');
      setMessage('Compilation complete. Download your video below.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Unknown error occurred.');
    }
  };

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-700 p-6 text-white shadow-md">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Render Video</h3>
          <p className="text-sm text-slate-200">
            Combine media, narration, and optional subtitles into a final MP4 using MoviePy &
            WhisperX.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={subtitlesRequested}
              onChange={(event) => setSubtitlesRequested(event.target.checked)}
              className="h-4 w-4 rounded border border-white/60 bg-transparent text-slate-900 focus:ring-white"
            />
            Generate & burn-in subtitles
          </label>
          <button
            type="button"
            onClick={handleCompile}
            disabled={!allReady || status === 'working'}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:bg-white/50"
          >
            {status === 'working' ? 'Rendering…' : 'Render Final Video'}
          </button>
        </div>
      </div>
      <div className="mt-4 rounded-lg bg-white/10 p-4 text-sm">
        <p>
          Scenes ready: {readyScenes.length}/{scenes.length}
        </p>
        {message ? (
          <p
            className={`mt-2 font-semibold ${
              status === 'error' ? 'text-rose-200' : status === 'success' ? 'text-emerald-200' : ''
            }`}
          >
            {message}
          </p>
        ) : null}
        {downloadUrl ? (
          <a
            href={downloadUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-900 shadow hover:bg-slate-100"
          >
            Download MP4
          </a>
        ) : null}
      </div>
    </section>
  );
};
