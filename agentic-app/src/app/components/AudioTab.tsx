'use client';

import { useMemo, useState } from 'react';
import { AudioProvider, SceneDefinition, useLoadingAudioScenes, useProjectStore, useScenes } from '@/state/projectStore';
import { CompilePanel } from './CompilePanel';

interface AudioResponse {
  id: string;
  provider: AudioProvider;
  url: string;
  format: string;
  duration?: number;
  meta?: Record<string, unknown>;
}

const providerVoices: Record<AudioProvider, string[]> = {
  edge_tts: ['en-US-GuyNeural', 'en-US-JennyNeural', 'en-GB-RyanNeural'],
  kokoro: ['af_sky', 'af_northstar', 'af_alto'],
  pollinations: ['leonard', 'callisto', 'venus'],
};

export const AudioTab = () => {
  const scenes = useScenes();
  const setLoadingAudio = useProjectStore((state) => state.setLoadingAudio);
  const upsertAudio = useProjectStore((state) => state.upsertSceneAudio);
  const chooseAudio = useProjectStore((state) => state.chooseSceneAudio);
  const updateScene = useProjectStore((state) => state.updateScene);
  const loadingAudioSceneIds = useLoadingAudioScenes();

  const [voiceSelections, setVoiceSelections] = useState<Record<string, string>>({});
  const [providerSelections, setProviderSelections] = useState<Record<string, AudioProvider>>({});
  const [errorByScene, setErrorByScene] = useState<Record<string, string | null>>({});

  const handleGenerate = async (scene: SceneDefinition) => {
    const provider = providerSelections[scene.id] ?? 'edge_tts';
    const voice = voiceSelections[scene.id] ?? providerVoices[provider][0];
    setLoadingAudio(scene.id, true);
    setErrorByScene((prev) => ({ ...prev, [scene.id]: null }));

    try {
      const response = await fetch('/api/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneId: scene.id,
          provider,
          voice,
          text: scene.narration,
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Audio generation failed');
      }

      const data = (await response.json()) as AudioResponse;
      upsertAudio(scene.id, data);
      chooseAudio(scene.id, data.id);
    } catch (error) {
      setErrorByScene((prev) => ({
        ...prev,
        [scene.id]: error instanceof Error ? error.message : 'Unknown error',
      }));
    } finally {
      setLoadingAudio(scene.id, false);
    }
  };

  const handleProviderChange = (sceneId: string, provider: AudioProvider) => {
    setProviderSelections((prev) => ({ ...prev, [sceneId]: provider }));
    setVoiceSelections((prev) => ({ ...prev, [sceneId]: providerVoices[provider][0] }));
  };

  const runtimeSummary = useMemo(
    () =>
      scenes.reduce(
        (acc, scene) => {
          if (scene.selectedAudio?.duration) {
            return {
              total: acc.total + scene.selectedAudio.duration,
              ready: acc.ready + 1,
            };
          }
          return acc;
        },
        { total: 0, ready: 0 },
      ),
    [scenes],
  );

  if (scenes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center text-sm text-slate-600">
        Import scenes to generate narration assets.
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Narration & Audio</h2>
          <p className="text-sm text-slate-600">
            Generate narration with Kokoro, Edge TTS, or Pollinations voices. You can regenerate any
            scene or swap providers independently.
          </p>
        </div>
        <div className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow">
          Ready {runtimeSummary.ready}/{scenes.length}
        </div>
      </header>

      <div className="space-y-5">
        {scenes.map((scene, index) => {
          const provider = providerSelections[scene.id] ?? 'edge_tts';
          const voice = voiceSelections[scene.id] ?? providerVoices[provider][0];
          const isLoading = loadingAudioSceneIds.has(scene.id);
          const activeAudio = scene.selectedAudio;
          return (
            <div
              key={scene.id}
              className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row"
            >
              <div className="flex items-start gap-4">
                <span className="mt-1 inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  {index + 1}
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Narration
                  </p>
                  <textarea
                    value={scene.narration}
                    onChange={(event) => updateScene(scene.id, { narration: event.target.value })}
                    rows={4}
                    className="mt-2 w-full max-w-xl rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                  />
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Voice Provider
                    <select
                      value={provider}
                      onChange={(event) =>
                        handleProviderChange(scene.id, event.target.value as AudioProvider)
                      }
                      className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                    >
                      <option value="edge_tts">Edge TTS</option>
                      <option value="kokoro">Kokoro</option>
                      <option value="pollinations">Pollinations AI</option>
                    </select>
                  </label>

                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Voice
                    <select
                      value={voice}
                      onChange={(event) =>
                        setVoiceSelections((prev) => ({ ...prev, [scene.id]: event.target.value }))
                      }
                      className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                    >
                      {providerVoices[provider].map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => handleGenerate(scene)}
                    disabled={isLoading}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:bg-slate-500"
                  >
                    {isLoading ? 'Generating…' : 'Generate Audio'}
                  </button>
                  <button
                    type="button"
                    onClick={() => chooseAudio(scene.id, activeAudio?.id ?? '')}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1 disabled:cursor-not-allowed"
                    disabled={!activeAudio}
                  >
                    Keep Current
                  </button>
                  <button
                    type="button"
                    onClick={() => updateScene(scene.id, { audioOptions: [], selectedAudio: undefined })}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1"
                  >
                    Clear Audio
                  </button>
                </div>
                {errorByScene[scene.id] ? (
                  <p className="text-sm font-semibold text-rose-600">{errorByScene[scene.id]}</p>
                ) : null}

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Generated Options
                  </p>
                  <div className="mt-2 grid gap-3 md:grid-cols-2">
                    {scene.audioOptions.map((audio) => (
                      <div
                        key={audio.id}
                        className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                          scene.selectedAudio?.id === audio.id
                            ? 'border-slate-900 bg-slate-900/5'
                            : 'border-slate-300'
                        }`}
                      >
                        <div className="flex flex-col justify-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <span>{audio.provider}</span>
                          {audio.duration ? (
                            <span className="text-slate-400">{audio.duration.toFixed(1)}s</span>
                          ) : null}
                        </div>
                        <audio controls className="flex-1">
                          <source src={audio.url} type={`audio/${audio.format}`} />
                        </audio>
                        <button
                          type="button"
                          onClick={() => chooseAudio(scene.id, audio.id)}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-100"
                        >
                          Use
                        </button>
                      </div>
                    ))}
                    {scene.audioOptions.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-500">
                        Generate narration to populate options.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <CompilePanel />
    </section>
  );
};
