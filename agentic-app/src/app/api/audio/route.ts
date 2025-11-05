import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
import { promises as fs } from 'fs';
import { file as tmpFile } from 'tmp';
import { getMediaDuration } from '@/lib/ffmpeg';

interface RequestBody {
  sceneId: string;
  provider: 'edge_tts' | 'kokoro' | 'pollinations';
  voice: string;
  text: string;
}

const voiceMap: Record<RequestBody['provider'], Record<string, string>> = {
  edge_tts: {
    'en-US-GuyNeural': 'Matthew',
    'en-US-JennyNeural': 'Joanna',
    'en-GB-RyanNeural': 'Brian',
  },
  kokoro: {
    af_sky: 'Amy',
    af_northstar: 'Salli',
    af_alto: 'Kimberly',
  },
  pollinations: {
    leonard: 'Joey',
    callisto: 'Justin',
    venus: 'Kendra',
  },
};

const pickVoice = (provider: RequestBody['provider'], voice: string) =>
  voiceMap[provider][voice] ?? Object.values(voiceMap[provider])[0];

const fetchTtsBuffer = async (voice: string, text: string): Promise<Buffer> => {
  const url = new URL('https://api.streamelements.com/kappa/v2/speech');
  url.searchParams.set('voice', voice);
  url.searchParams.set('text', text);
  const response = await fetch(url);
  if (!response.ok) {
    const textResponse = await response.text();
    throw new Error(textResponse || 'TTS provider returned an error.');
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

const writeTempFile = async (buffer: Buffer): Promise<{ path: string; cleanup: () => void }> =>
  new Promise((resolve, reject) => {
    tmpFile({ postfix: '.mp3' }, async (error, path, fd, cleanupCallback) => {
      if (error) {
        reject(error);
        return;
      }
      try {
        await fs.writeFile(path, buffer);
        resolve({ path, cleanup: cleanupCallback });
      } catch (err) {
        cleanupCallback();
        reject(err);
      }
    });
  });

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<RequestBody>;

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { provider, voice, text, sceneId } = body;

  if (!provider || !voice || !text || !sceneId) {
    return NextResponse.json(
      { error: 'sceneId, provider, voice, and text are required.' },
      { status: 400 },
    );
  }

  try {
    const mappedVoice = pickVoice(provider, voice);
    const audioBuffer = await fetchTtsBuffer(mappedVoice, text);
    const { path, cleanup } = await writeTempFile(audioBuffer);
    let duration = 0;
    try {
      duration = await getMediaDuration(path);
    } finally {
      cleanup();
    }
    const id = `${provider}-${Date.now()}`;
    const dataUrl = `data:audio/mpeg;base64,${audioBuffer.toString('base64')}`;

    return NextResponse.json({
      id,
      provider,
      url: dataUrl,
      format: 'mp3',
      duration,
      meta: { mappedVoice },
    });
  } catch (error) {
    console.error('[audio-generation]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected error.' },
      { status: 500 },
    );
  }
}
