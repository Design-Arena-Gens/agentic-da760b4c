'use client';

import { useCallback, useMemo } from 'react';
import {
  SceneDefinition,
  useLoadingScenes,
  useProjectStore,
  useScenes,
} from '@/state/projectStore';
import { searchMediaForScene } from '@/lib/media';

export const PreviewTab = () => {
  const scenes = useScenes();
  const pexelsApiKey = useProjectStore((state) => state.pexelsApiKey);
  const setSceneMedia = useProjectStore((state) => state.setSceneMedia);
  const setSceneStatus = useProjectStore((state) => state.setSceneStatus);
  const updateScene = useProjectStore((state) => state.updateScene);
  const chooseSceneMedia = useProjectStore((state) => state.chooseSceneMedia);
  const loadingScenes = useLoadingScenes();

  const retryScene = useCallback(
    async (scene: SceneDefinition) => {
      useProjectStore.getState().setLoadingScene(scene.id, true);
      setSceneStatus(scene.id, 'searching');
      try {
        const results = await searchMediaForScene(scene, pexelsApiKey ?? null);
        setSceneMedia(scene.id, results);
        setSceneStatus(scene.id, 'ready');
      } catch (error) {
        setSceneStatus(
          scene.id,
          'error',
          error instanceof Error ? error.message : 'Unable to refresh scene',
        );
      } finally {
        useProjectStore.getState().setLoadingScene(scene.id, false);
      }
    },
    [pexelsApiKey, setSceneMedia, setSceneStatus],
  );

  const timelineSummary = useMemo(() => {
    const totalSeconds = scenes.reduce((sum, scene) => sum + (scene.duration || 0), 0);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return { totalSeconds, label: `${minutes}m ${seconds.toFixed(0)}s` };
  }, [scenes]);

  if (scenes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center text-sm text-slate-600">
        Import scenes first to preview media selections.
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Scene Preview & Selection</h2>
          <p className="text-sm text-slate-600">
            Review the best candidate per scene, retry problematic items, or swap to alternates.
          </p>
        </div>
        <div className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow">
          Runtime · {timelineSummary.label}
        </div>
      </header>

      <div className="space-y-5">
        {scenes.map((scene, index) => {
          const isLoading = loadingScenes.has(scene.id);
          const selection = scene.selectedMedia;
          return (
            <div
              key={scene.id}
              className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row"
            >
              <div className="flex items-start gap-4">
                <span className="mt-1 inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm uppercase tracking-wide text-slate-500">Narration</p>
                  <p className="mt-1 text-base font-medium text-slate-900">{scene.narration}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs uppercase tracking-wide text-slate-500">
                    <span className="rounded-full border border-slate-300 px-3 py-1 font-semibold">
                      {scene.mediaSource === 'ai' ? 'Pollinations AI' : 'Pexels'}
                    </span>
                    <span className="rounded-full border border-slate-300 px-3 py-1 font-semibold">
                      {scene.mediaType}
                    </span>
                    <span className="rounded-full border border-slate-300 px-3 py-1 font-semibold">
                      Target {scene.duration}s
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-4 md:flex-row">
                <div className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-950/5 md:max-w-sm">
                  {selection ? (
                    selection.type === 'photo' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selection.previewUrl || selection.url}
                        alt={scene.query}
                        className="h-56 w-full object-cover"
                      />
                    ) : (
                      <video
                        src={selection.previewUrl || selection.url}
                        className="h-56 w-full object-cover"
                        controls
                      />
                    )
                  ) : (
                    <div className="flex h-56 w-full items-center justify-center text-sm text-slate-500">
                      No selection yet
                    </div>
                  )}
                  {selection ? (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/80 to-transparent p-4 text-xs text-white">
                      <p className="font-semibold">
                        {selection.provider} · {selection.type}
                      </p>
                      {selection.duration ? <p>{selection.duration.toFixed(1)}s clip</p> : null}
                    </div>
                  ) : null}
                </div>

                <div className="flex-1 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Query / Prompt
                      <input
                        value={scene.query}
                        onChange={(event) => updateScene(scene.id, { query: event.target.value })}
                        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                      />
                    </label>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Alternate Options
                    </p>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      {scene.mediaResults.map((option) => (
                        <button
                          type="button"
                          key={option.id}
                          onClick={() => chooseSceneMedia(scene.id, option.id)}
                          className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition ${
                            scene.selectedMedia?.id === option.id
                              ? 'border-slate-900 bg-slate-900/5'
                              : 'border-slate-300 hover:border-slate-500'
                          }`}
                        >
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold uppercase text-slate-600">
                            {option.type === 'photo' ? 'IMG' : 'VID'}
                          </span>
                          <div>
                            <p className="font-medium text-slate-900">{option.provider}</p>
                            {option.duration ? (
                              <p className="text-xs text-slate-500">{option.duration.toFixed(1)}s</p>
                            ) : null}
                          </div>
                        </button>
                      ))}
                      {scene.mediaResults.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-500">
                          Run a search to populate options.
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => retryScene(scene)}
                      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:bg-slate-400"
                      disabled={(scene.mediaSource === 'pexels' && !pexelsApiKey) || isLoading}
                    >
                      {isLoading ? 'Refreshing…' : 'Retry Selection'}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateScene(scene.id, { mediaResults: [], selectedMedia: undefined })}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1"
                    >
                      Clear Options
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
