import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface RequestBody {
  sceneId: string;
  mediaSource: 'pexels' | 'ai';
  mediaType: 'photo' | 'video';
  query: string;
  apiKey: string | null;
}

const PEXELS_API_BASE = 'https://api.pexels.com';

interface PexelsPhotoSrc {
  original: string;
  large: string;
  medium: string;
  small: string;
}

interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  src: PexelsPhotoSrc;
  photographer: string;
  photographer_url: string;
  avg_color?: string;
}

interface PexelsVideoFile {
  id: number;
  quality: string;
  file_type: string;
  width: number;
  height: number;
  link: string;
}

interface PexelsVideo {
  id: number;
  duration: number;
  image: string;
  url: string;
  video_files: PexelsVideoFile[];
  video_pictures?: { id: number }[];
  user?: { name?: string };
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<RequestBody>;

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { mediaSource, mediaType, query, apiKey } = body;

  if (!mediaSource || !mediaType || !query) {
    return NextResponse.json(
      { error: 'sceneId, mediaSource, mediaType, and query are required.' },
      { status: 400 },
    );
  }

  try {
    if (mediaSource === 'pexels') {
      if (!apiKey) {
        return NextResponse.json({ error: 'Pexels API key missing.' }, { status: 400 });
      }
      const headers = { Authorization: apiKey };
      if (mediaType === 'photo') {
        const url = new URL('/v1/search', PEXELS_API_BASE);
        url.searchParams.set('query', query);
        url.searchParams.set('per_page', '10');
        const response = await fetch(url, { headers });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || 'Pexels photo search failed.');
        }
        const data = (await response.json()) as { photos?: PexelsPhoto[] };
        const results =
          data?.photos?.map((photo) => ({
            id: `pexels-photo-${photo.id}`,
            provider: 'pexels' as const,
            type: 'photo' as const,
            url: photo.src?.original ?? photo.url,
            previewUrl: photo.src?.medium ?? photo.src?.small ?? photo.src?.original ?? photo.url,
            width: photo.width,
            height: photo.height,
            meta: {
              photographer: photo.photographer,
              photographer_url: photo.photographer_url,
              avg_color: photo.avg_color,
            },
          })) ?? [];
        return NextResponse.json({ results });
      }

      const url = new URL('/videos/search', PEXELS_API_BASE);
      url.searchParams.set('query', query);
      url.searchParams.set('per_page', '10');
      const response = await fetch(url, { headers });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Pexels video search failed.');
      }
      const data = (await response.json()) as { videos?: PexelsVideo[] };
      const results =
        data?.videos?.map((video) => {
          const optimalFile =
            video.video_files?.find((file) => file.quality === 'hd') ?? video.video_files?.[0];
          return {
            id: `pexels-video-${video.id}`,
            provider: 'pexels' as const,
            type: 'video' as const,
            url: optimalFile?.link ?? video.url,
            previewUrl: video.image ?? optimalFile?.link ?? video.url,
            width: optimalFile?.width,
            height: optimalFile?.height,
            duration: video.duration,
            meta: {
              video_picture_id: video.video_pictures?.[0]?.id,
              user: video.user?.name,
            },
          };
        }) ?? [];
      return NextResponse.json({ results });
    }

    const seedValues = Array.from({ length: 6 }, () => Math.floor(Math.random() * 900000) + 10000);
    const results = seedValues.map((seed, index) => {
      const baseUrl = new URL(`https://image.pollinations.ai/prompt/${encodeURIComponent(query)}`);
      baseUrl.searchParams.set('seed', seed.toString());
      baseUrl.searchParams.set('width', '1280');
      baseUrl.searchParams.set('height', '720');
      if (mediaType === 'video') {
        baseUrl.searchParams.set('format', 'mp4');
      }
      const url = baseUrl.toString();
      return {
        id: `pollinations-${mediaType}-${seed}-${index}`,
        provider: 'ai' as const,
        type: mediaType,
        url,
        previewUrl: mediaType === 'photo' ? url : `${url}#t=0.1`,
        width: 1280,
        height: 720,
      };
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error('[media-search]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected error.' },
      { status: 500 },
    );
  }
}
