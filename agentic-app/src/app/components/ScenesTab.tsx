'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { SceneDefinition, useLoadingScenes, useProjectStore, useScenes } from '@/state/projectStore';
import { searchMediaForScene } from '@/lib/media';

const exampleScenes = [
  {
    narration: 'The sun rises over the futuristic skyline as drones buzz between towers.',
    media_source: 'pexels',
    query: 'futuristic city sunrise drone',
    media_type: 'video',
  },
  {
    narration: 'In the robotics lab, engineers fine-tune AI companions.',
    media_source: 'ai',
    query: 'AI robotics lab cinematic lighting',
    media_type: 'photo',
  },
  {
    narration: 'Families gather in lush rooftop gardens above the bustling megacity.',
    media_source: 'pexels',
    query: 'urban rooftop garden community evening',
    media_type: 'video',
  },
];

export const ScenesTab = () => {
  const scenes = useScenes();
  const loadScenes = useProjectStore((state) => state.loadScenesFromJson);
  const setSceneMedia = useProjectStore((state) => state.setSceneMedia);
  const setSceneStatus = useProjectStore((state) => state.setSceneStatus);
  const updateScene = useProjectStore((state) => state.updateScene);
  const setLoading = useProjectStore((state) => state.setLoadingScene);
  const chooseSceneMedia = useProjectStore((state) => state.chooseSceneMedia);
  const pexelsApiKey = useProjectStore((state) => state.pexelsApiKey);
  const loadingSceneIds = useLoadingScenes();
  const [jsonInput, setJsonInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jsonInput && scenes.length === 0) {
      setJsonInput(JSON.stringify(exampleScenes, null, 2));
    }
  }, [jsonInput, scenes.length]);

  const handleLoad = useCallback(() => {
    try {
      const parsed = JSON.parse(jsonInput);
      loadScenes(parsed);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse JSON.');
    }
  }, [jsonInput, loadScenes]);

  const fetchSceneMedia = useCallback(
    async (scene: SceneDefinition) => {
      setLoading(scene.id, true);
      setSceneStatus(scene.id, 'searching');
      try {
        const results = await searchMediaForScene(scene, pexelsApiKey ?? null);
        setSceneMedia(scene.id, results);
        setSceneStatus(scene.id, 'ready');
      } catch (err) {
        setSceneStatus(scene.id, 'error', err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(scene.id, false);
      }
    },
    [pexelsApiKey, setLoading, setSceneMedia, setSceneStatus],
  );

  const fetchAll = useCallback(async () => {
    for (const scene of scenes) {
      // Sequential fetch to avoid throttling burst limits
      await fetchSceneMedia(scene);
    }
  }, [fetchSceneMedia, scenes]);

  const hasScenes = scenes.length > 0;

  const renderedScenes = useMemo(
    () =>
      scenes.map((scene) => {
        const isLoading = loadingSceneIds.has(scene.id);
        return (
          <div key={scene.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 font-semibold text-white">
                    {scenes.indexOf(scene) + 1}
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {scene.mediaSource === 'ai' ? 'AI Media' : 'Pexels'} ·{' '}
                      {scene.mediaType === 'video' ? 'Video' : 'Photo'}
                    </h3>
                    <p className="text-sm text-slate-500">Scene ID: {scene.id}</p>
                  </div>
                </div>

                <label className="block text-sm font-medium text-slate-700">
                  Narration
                  <textarea
                    value={scene.narration}
                    onChange={(event) =>
                      updateScene(scene.id, { narration: event.target.value })
                    }
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                    rows={3}
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Media Source
                    <select
                      value={scene.mediaSource}
                      onChange={(event) =>
                        updateScene(scene.id, {
                          mediaSource: event.target.value as SceneDefinition['mediaSource'],
                        })
                      }
                      className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                    >
                      <option value="pexels">Pexels</option>
                      <option value="ai">Pollinations AI</option>
                    </select>
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    Media Type
                    <select
                      value={scene.mediaType}
                      onChange={(event) =>
                        updateScene(scene.id, {
                          mediaType: event.target.value as SceneDefinition['mediaType'],
                        })
                      }
                      className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                    >
                      <option value="photo">Photo</option>
                      <option value="video">Video</option>
                    </select>
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    Search Query / AI Prompt
                    <input
                      value={scene.query}
                      onChange={(event) =>
                        updateScene(scene.id, { query: event.target.value })
                      }
                      className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    Target Duration (seconds)
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={scene.duration}
                      onChange={(event) =>
                        updateScene(scene.id, { duration: Number(event.target.value) })
                      }
                      className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                    />
                  </label>
                </div>
              </div>

              <div className="flex w-full flex-col justify-between gap-3 md:w-48">
                <button
                  type="button"
                  onClick={() => fetchSceneMedia(scene)}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:bg-slate-400"
                  disabled={isLoading || (scene.mediaSource === 'pexels' && !pexelsApiKey)}
                >
                  {isLoading ? 'Searching…' : 'Search Media'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateScene(scene.id, {
                      id: scene.id,
                      narration: scene.narration,
                      mediaSource: scene.mediaSource,
                      query: scene.query,
                      mediaType: scene.mediaType,
                      duration: scene.duration,
                      mediaResults: [],
                      selectedMedia: undefined,
                      status: 'idle',
                    })
                  }
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1"
                >
                  Reset Scene
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Results
                </span>
                <span
                  className={`text-xs font-semibold ${
                    scene.status === 'ready'
                      ? 'text-emerald-600'
                      : scene.status === 'error'
                        ? 'text-rose-600'
                        : 'text-slate-400'
                  }`}
                >
                  {scene.status === 'ready'
                    ? `${scene.mediaResults.length} options`
                    : scene.status === 'error'
                      ? scene.error ?? 'Failed'
                      : isLoading
                        ? 'Searching…'
                        : 'Idle'}
                </span>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {scene.mediaResults.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => chooseSceneMedia(scene.id, result.id)}
                    className={`group relative overflow-hidden rounded-lg border text-left transition ${
                      scene.selectedMedia?.id === result.id
                        ? 'border-slate-900 shadow-lg'
                        : 'border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    {result.type === 'photo' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={result.previewUrl || result.url}
                        alt={scene.query}
                        className="h-40 w-full object-cover"
                      />
                    ) : (
                      <video
                        src={result.previewUrl || result.url}
                        className="h-40 w-full object-cover"
                        autoPlay
                        muted
                        loop
                      />
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/80 to-transparent p-3 text-xs text-white">
                      <p className="font-semibold capitalize">
                        {result.provider} · {result.type}
                      </p>
                      {result.duration ? <p>{result.duration.toFixed(1)}s</p> : null}
                    </div>
                  </button>
                ))}
                {scene.mediaResults.length === 0 ? (
                  <div className="col-span-full rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                    No media fetched yet. Run a search to populate suggestions.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        );
      }),
    [chooseSceneMedia, fetchSceneMedia, loadingSceneIds, pexelsApiKey, scenes, updateScene],
  );

  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Scene Definitions</h2>
          <button
            type="button"
            onClick={() => {
              setJsonInput(JSON.stringify(exampleScenes, null, 2));
              loadScenes(exampleScenes);
              setError(null);
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 hover:bg-white focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1"
          >
            Load Sample
          </button>
        </div>
        <p className="text-sm text-slate-600">
          Paste JSON describing each scene. You can edit narration, prompts, or media preferences
          per scene after importing.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-4">
          <textarea
            value={jsonInput}
            onChange={(event) => setJsonInput(event.target.value)}
            rows={16}
            className="w-full rounded-xl border border-slate-300 bg-slate-950/5 p-4 font-mono text-xs text-slate-800 shadow-inner focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
            spellCheck={false}
          />
          {error ? <p className="text-sm font-semibold text-rose-600">{error}</p> : null}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleLoad}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1"
            >
              Import Scenes
            </button>
            <button
              type="button"
              onClick={fetchAll}
              disabled={!hasScenes || scenes.some((scene) => scene.mediaSource === 'pexels' && !pexelsApiKey)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              Search Media For All
            </button>
          </div>
        </div>

        <div className="space-y-5">
          {hasScenes ? renderedScenes : (
            <div className="flex h-full min-h-[24rem] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
              Import scenes to begin configuring your video project.
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
