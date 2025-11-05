'use client';

import { useMemo } from 'react';
import { Tabs } from './components/Tabs';
import { ApiKeyTab } from './components/ApiKeyTab';
import { ScenesTab } from './components/ScenesTab';
import { PreviewTab } from './components/PreviewTab';
import { AudioTab } from './components/AudioTab';
import { useProjectStore, useScenes } from '@/state/projectStore';

export default function Home() {
  const scenes = useScenes();
  const setActiveTab = useProjectStore((state) => state.setActiveTab);
  const activeIndex = useProjectStore((state) => state.activeTab);

  const tabConfig = useMemo(
    () => [
      { id: 'api', label: 'Pexels API' },
      { id: 'scenes', label: 'Scenes', badge: scenes.length || null },
      {
        id: 'preview',
        label: 'Preview',
        badge: scenes.filter((scene) => scene.selectedMedia).length || null,
      },
      {
        id: 'audio',
        label: 'Audio & Render',
        badge: scenes.filter((scene) => scene.selectedAudio).length || null,
      },
    ],
    [scenes],
  );

  const activeId = tabConfig[Math.min(activeIndex, tabConfig.length - 1)]?.id ?? tabConfig[0].id;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200 py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6">
        <header className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
            Agentic Video Studio
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Orchestrate ultra-fast video production with curated scenes, AI visuals, and smart
            narration.
          </h1>
          <p className="max-w-3xl text-base text-slate-600">
            Import structured scenes, source visuals from Pexels or Pollinations, iterate on
            previews, then stitch everything with AI-powered voiceovers, subtitles, and a rendered
            master video.
          </p>
        </header>

        <Tabs
          tabs={tabConfig}
          activeId={activeId}
          onChange={(id) => setActiveTab(tabConfig.findIndex((item) => item.id === id))}
        >
          {activeId === 'api' && <ApiKeyTab />}
          {activeId === 'scenes' && <ScenesTab />}
          {activeId === 'preview' && <PreviewTab />}
          {activeId === 'audio' && <AudioTab />}
        </Tabs>
      </div>
    </main>
  );
}
