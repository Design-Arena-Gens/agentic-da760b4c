'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from '@/utils/nanoid';

export type MediaSource = 'pexels' | 'ai';
export type MediaType = 'photo' | 'video';

export interface SceneDefinition {
  id: string;
  narration: string;
  mediaSource: MediaSource;
  query: string;
  mediaType: MediaType;
  duration: number;
  status: 'idle' | 'searching' | 'ready' | 'error';
  error?: string;
  mediaResults: SceneMediaResult[];
  selectedMedia?: SceneMediaResult;
  audioOptions: AudioResult[];
  selectedAudio?: AudioResult;
}

export interface SceneMediaResult {
  id: string;
  provider: MediaSource;
  type: MediaType;
  url: string;
  previewUrl: string;
  width?: number;
  height?: number;
  duration?: number;
  meta?: Record<string, unknown>;
}

export interface AudioResult {
  id: string;
  provider: AudioProvider;
  url: string;
  format: string;
  duration?: number;
  meta?: Record<string, unknown>;
}

export type AudioProvider = 'edge_tts' | 'kokoro' | 'pollinations';

interface ProjectState {
  pexelsApiKey: string | null;
  scenes: SceneDefinition[];
  activeTab: number;
  subtitlesRequested: boolean;
  loadingSceneIds: Set<string>;
  loadingAudioSceneIds: Set<string>;

  setActiveTab: (index: number) => void;
  setPexelsApiKey: (key: string) => void;
  setSubtitlesRequested: (value: boolean) => void;

  loadScenesFromJson: (payload: unknown) => void;
  updateScene: (sceneId: string, update: Partial<SceneDefinition>) => void;
  setSceneStatus: (sceneId: string, status: SceneDefinition['status'], error?: string) => void;
  setSceneMedia: (sceneId: string, results: SceneMediaResult[]) => void;
  chooseSceneMedia: (sceneId: string, mediaId: string) => void;
  setLoadingScene: (sceneId: string, loading: boolean) => void;

  upsertSceneAudio: (sceneId: string, audio: AudioResult) => void;
  chooseSceneAudio: (sceneId: string, audioId: string) => void;
  setLoadingAudio: (sceneId: string, loading: boolean) => void;

  reset: () => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      pexelsApiKey: null,
      scenes: [],
      activeTab: 0,
      subtitlesRequested: false,
      loadingSceneIds: new Set(),
      loadingAudioSceneIds: new Set(),

      setActiveTab: (index) => set({ activeTab: index }),
      setPexelsApiKey: (key) => set({ pexelsApiKey: key.trim() || null }),
      setSubtitlesRequested: (value) => set({ subtitlesRequested: value }),

      loadScenesFromJson: (payload) => {
        if (!Array.isArray(payload)) {
          throw new Error('Scenes payload must be an array.');
        }

        const parsed: SceneDefinition[] = payload.map((item) => {
          if (
            typeof item !== 'object' ||
            item === null ||
            typeof item.narration !== 'string' ||
            typeof item.media_source !== 'string' ||
            typeof item.query !== 'string' ||
            typeof item.media_type !== 'string'
          ) {
            throw new Error('Invalid scene shape encountered.');
          }

          const mediaSource = item.media_source === 'ai' ? 'ai' : 'pexels';
          const mediaType = item.media_type === 'video' ? 'video' : 'photo';

          return {
            id: nanoid(),
            narration: item.narration,
            mediaSource,
            query: item.query,
            mediaType,
            duration: typeof item.duration === 'number' && item.duration > 0 ? item.duration : 8,
            status: 'idle',
            mediaResults: [],
            audioOptions: [],
          };
        });

        set({ scenes: parsed });
      },

      updateScene: (sceneId, update) =>
        set({
          scenes: get().scenes.map((scene) =>
            scene.id === sceneId
              ? {
                  ...scene,
                  ...update,
                  mediaResults: update.mediaResults ?? scene.mediaResults,
                  audioOptions: update.audioOptions ?? scene.audioOptions,
                }
              : scene,
          ),
        }),

      setSceneStatus: (sceneId, status, error) =>
        set({
          scenes: get().scenes.map((scene) =>
            scene.id === sceneId ? { ...scene, status, error } : scene,
          ),
        }),

      setSceneMedia: (sceneId, results) =>
        set({
          scenes: get().scenes.map((scene) =>
            scene.id === sceneId
              ? {
                  ...scene,
                  mediaResults: results,
                  selectedMedia:
                    scene.selectedMedia && results.some((item) => item.id === scene.selectedMedia?.id)
                      ? scene.selectedMedia
                      : results[0],
                }
              : scene,
          ),
        }),

      chooseSceneMedia: (sceneId, mediaId) =>
        set({
          scenes: get().scenes.map((scene) =>
            scene.id === sceneId
              ? {
                  ...scene,
                  selectedMedia: scene.mediaResults.find((item) => item.id === mediaId),
                }
              : scene,
          ),
        }),

      setLoadingScene: (sceneId, loading) =>
        set(() => {
          const next = new Set(get().loadingSceneIds);
          if (loading) {
            next.add(sceneId);
          } else {
            next.delete(sceneId);
          }
          return { loadingSceneIds: next };
        }),

      upsertSceneAudio: (sceneId, audio) =>
        set({
          scenes: get().scenes.map((scene) =>
            scene.id === sceneId
              ? {
                  ...scene,
                  audioOptions: [
                    ...scene.audioOptions.filter((item) => item.id !== audio.id),
                    audio,
                  ],
                  selectedAudio: audio,
                }
              : scene,
          ),
        }),

      chooseSceneAudio: (sceneId, audioId) =>
        set({
          scenes: get().scenes.map((scene) =>
            scene.id === sceneId
              ? {
                  ...scene,
                  selectedAudio: scene.audioOptions.find((item) => item.id === audioId),
                }
              : scene,
          ),
        }),

      setLoadingAudio: (sceneId, loading) =>
        set(() => {
          const next = new Set(get().loadingAudioSceneIds);
          if (loading) {
            next.add(sceneId);
          } else {
            next.delete(sceneId);
          }
          return { loadingAudioSceneIds: next };
        }),

      reset: () =>
        set({
          pexelsApiKey: null,
          scenes: [],
          subtitlesRequested: false,
          activeTab: 0,
        }),
    }),
    {
      name: 'agentic-video-project',
      partialize: (state) => ({
        pexelsApiKey: state.pexelsApiKey,
        scenes: state.scenes,
        subtitlesRequested: state.subtitlesRequested,
      }),
      version: 1,
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState as Partial<ProjectState>),
        loadingSceneIds: new Set(),
        loadingAudioSceneIds: new Set(),
      }),
    },
  ),
);

export const useScenes = () => useProjectStore((state) => state.scenes);
export const useLoadingScenes = () => useProjectStore((state) => state.loadingSceneIds);
export const useLoadingAudioScenes = () => useProjectStore((state) => state.loadingAudioSceneIds);
