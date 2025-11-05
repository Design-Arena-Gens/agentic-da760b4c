import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
import { promises as fs } from 'fs';
import path from 'path';
import { dir as tmpDir } from 'tmp';
import type { FfmpegCommand } from 'fluent-ffmpeg';
import { ffmpeg, getMediaDuration } from '@/lib/ffmpeg';
import { bufferFromDataUrlOrRemote, writeBufferToTempFile } from '@/lib/files';

interface ScenePayload {
  id: string;
  narration: string;
  duration: number;
  media: {
    id: string;
    provider: string;
    type: 'photo' | 'video';
    url: string;
  };
  audio: {
    id: string;
    provider: string;
    url: string;
    format: string;
    duration?: number;
  };
}

interface RequestBody {
  scenes: ScenePayload[];
  subtitles: boolean;
}

const runFfmpeg = (command: FfmpegCommand) =>
  new Promise<void>((resolve, reject) => {
    command
      .on('end', () => resolve())
      .on('error', (error: Error) => reject(error))
      .run();
  });

const ensureMp4FromImage = async (
  imagePath: string,
  outputPath: string,
  duration: number,
): Promise<void> => {
  const command = ffmpeg()
    .input(imagePath)
    .inputOptions(['-loop 1'])
    .outputOptions([
      '-t',
      duration.toString(),
      '-vf',
      'scale=1280:720,format=yuv420p',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
    ])
    .noAudio()
    .save(outputPath);
  await runFfmpeg(command);
};

const ensureVideoDuration = async (
  videoPath: string,
  outputPath: string,
  duration: number,
): Promise<void> => {
  const sourceDuration = await getMediaDuration(videoPath);
  if (sourceDuration === 0) {
    throw new Error('Unable to read duration of video asset.');
  }
  if (sourceDuration >= duration) {
    const command = ffmpeg(videoPath)
      .outputOptions([
        '-t',
        duration.toString(),
        '-vf',
        'scale=1280:720,format=yuv420p',
        '-an',
      ])
      .videoCodec('libx264')
      .save(outputPath);
    await runFfmpeg(command);
    return;
  }

  const loopCount = Math.ceil(duration / sourceDuration) - 1;
  const command = ffmpeg()
    .input(videoPath)
    .inputOptions(loopCount > 0 ? ['-stream_loop', loopCount.toString()] : [])
    .outputOptions([
      '-t',
      duration.toString(),
      '-vf',
      'scale=1280:720,format=yuv420p',
      '-an',
      '-movflags',
      '+faststart',
    ])
    .videoCodec('libx264')
    .save(outputPath);

  await runFfmpeg(command);
};

const muxScene = async (videoPath: string, audioPath: string, outputPath: string): Promise<void> => {
  const command = ffmpeg()
    .input(videoPath)
    .input(audioPath)
    .outputOptions(['-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart'])
    .save(outputPath);
  await runFfmpeg(command);
};

const formatTimestamp = (seconds: number): string => {
  const totalMs = Math.max(seconds, 0) * 1000;
  const date = new Date(totalMs);
  const hours = String(Math.floor(totalMs / (1000 * 60 * 60))).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const secs = String(date.getUTCSeconds()).padStart(2, '0');
  const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
  return `${hours}:${minutes}:${secs},${ms}`;
};

const buildWordLevelSrt = async (
  scenes: ScenePayload[],
  sceneDurations: number[],
  srtPath: string,
): Promise<void> => {
  const lines: string[] = [];
  let cueIndex = 1;
  let cursor = 0;

  scenes.forEach((scene, sceneIndex) => {
    const duration = sceneDurations[sceneIndex] ?? scene.duration;
    const words = scene.narration.split(/\s+/).filter(Boolean);
    const segmentDuration = words.length > 0 ? duration / words.length : duration;

    words.forEach((word) => {
      const start = cursor;
      const end = start + segmentDuration;
      lines.push(String(cueIndex));
      lines.push(`${formatTimestamp(start)} --> ${formatTimestamp(end)}`);
      lines.push(word);
      lines.push('');
      cueIndex += 1;
      cursor = end;
    });
    cursor = sceneDurations.slice(0, sceneIndex + 1).reduce((acc, value) => acc + value, 0);
  });

  await fs.writeFile(srtPath, lines.join('\n'), 'utf-8');
};

const concatVideos = async (videoPaths: string[], outputPath: string): Promise<void> => {
  const concatFile = `${outputPath}.txt`;
  const content = videoPaths.map((file) => `file '${file}'`).join('\n');
  await fs.writeFile(concatFile, content, 'utf-8');
  const command = ffmpeg()
    .input(concatFile)
    .inputOptions(['-f', 'concat', '-safe', '0'])
    .outputOptions(['-c', 'copy'])
    .save(outputPath);
  await runFfmpeg(command);
  await fs.unlink(concatFile);
};

const applySubtitles = async (inputPath: string, srtPath: string, outputPath: string): Promise<void> => {
  const command = ffmpeg()
    .input(inputPath)
    .outputOptions(['-vf', `subtitles=${srtPath}:force_style='FontName=Inter,FontSize=28,PrimaryColour=&HFFFFFF&'`, '-c:a', 'copy'])
    .save(outputPath);
  await runFfmpeg(command);
};

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<RequestBody>;

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { scenes, subtitles } = body;

  if (!Array.isArray(scenes) || scenes.length === 0) {
    return NextResponse.json({ error: 'At least one scene is required.' }, { status: 400 });
  }

  let cleanupWorkspace: (() => void) | undefined;

  try {
    const workspace = await new Promise<string>((resolve, reject) => {
      tmpDir({ unsafeCleanup: true }, (error, directoryPath, cleanupCallback) => {
        if (error) {
          reject(error);
          return;
        }
        cleanupWorkspace = cleanupCallback;
        resolve(directoryPath);
      });
    });

    const sceneOutputs: string[] = [];
    const sceneDurations: number[] = [];

    for (const scene of scenes) {
      if (!scene.media || !scene.audio) {
        throw new Error(`Scene ${scene.id} is missing media or audio data.`);
      }

      const mediaBuffer = await bufferFromDataUrlOrRemote(scene.media.url);
      const mediaPostfix = scene.media.type === 'photo' ? '.jpg' : '.mp4';
      const { path: mediaPath, cleanup: cleanupMedia } = await writeBufferToTempFile(mediaBuffer, {
        postfix: mediaPostfix,
      });

      const audioBuffer = await bufferFromDataUrlOrRemote(scene.audio.url);
      const { path: audioPath, cleanup: cleanupAudio } = await writeBufferToTempFile(audioBuffer, {
        postfix: '.mp3',
      });

      const normalizedVideoPath = path.join(workspace, `${scene.id}-video.mp4`);
      const muxedScenePath = path.join(workspace, `${scene.id}-muxed.mp4`);

      try {
        if (scene.media.type === 'photo') {
          await ensureMp4FromImage(mediaPath, normalizedVideoPath, scene.duration);
        } else {
          await ensureVideoDuration(mediaPath, normalizedVideoPath, scene.duration);
        }
        await muxScene(normalizedVideoPath, audioPath, muxedScenePath);
        const muxedDuration = await getMediaDuration(muxedScenePath);
        sceneOutputs.push(muxedScenePath);
        sceneDurations.push(muxedDuration || scene.duration);
      } finally {
        cleanupMedia();
        cleanupAudio();
      }
    }

    const finalOutputPath = path.join(workspace, 'final.mp4');
    await concatVideos(sceneOutputs, finalOutputPath);

    let outputPath = finalOutputPath;
    if (subtitles) {
      const srtPath = path.join(workspace, 'captions.srt');
      await buildWordLevelSrt(scenes, sceneDurations, srtPath);
      const burnedPath = path.join(workspace, 'final_subbed.mp4');
      await applySubtitles(finalOutputPath, srtPath, burnedPath);
      outputPath = burnedPath;
    }

    const finalBuffer = await fs.readFile(outputPath);
    const base64 = finalBuffer.toString('base64');
    const dataUrl = `data:video/mp4;base64,${base64}`;

    return NextResponse.json({
      jobId: `video-${Date.now()}`,
      videoUrl: dataUrl,
    });
  } catch (error) {
    console.error('[video-compile]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected error.' },
      { status: 500 },
    );
  } finally {
    cleanupWorkspace?.();
  }
}
