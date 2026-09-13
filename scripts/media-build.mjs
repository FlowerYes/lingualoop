#!/usr/bin/env node
/** Rebuild authored demo media on macOS: node scripts/media-build.mjs [video-id ...]
 * Requires ffmpeg, ffprobe, and the macOS Mónica Spanish voice. No API or network.
 * Images are original AI-generated stills; ffmpeg adds gentle camera movement.
 */
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = JSON.parse(readFileSync(join(root, 'scripts/media-source.json'), 'utf8'));
const vocabulary = JSON.parse(readFileSync(join(root, 'data/vocabulary-seed.json'), 'utf8'));
const selected = process.argv.slice(2);
const work = mkdtempSync(join(tmpdir(), 'lingualoop-media-'));
const run = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
const ffmpeg = (...args) => run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
const probe = (path) => JSON.parse(run('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', path]));
const duration = (path) => Number(probe(path).format.duration);
const normalized = (word) => word.toLocaleLowerCase('es').replace(/[^\p{L}\p{N}]/gu, '');
const round = (n) => Math.round(n * 1000) / 1000;
const timingPath = join(root, 'data/media-timings.json');
const timings = existsSync(timingPath) ? JSON.parse(readFileSync(timingPath, 'utf8')) : {};

mkdirSync(join(root, 'public/videos'), { recursive: true });
mkdirSync(join(root, 'public/media'), { recursive: true });

try {
  for (const scene of new Set(source.map((item) => item.scene))) {
    const image = join(root, `scripts/media-originals/${scene}.png`);
    const poster = join(root, `public/media/${scene}.webp`);
    if (!existsSync(poster)) {
      let quality = 83;
      let buffer;
      do {
        buffer = await sharp(image).resize(720, 1280, { fit: 'cover' }).webp({ quality }).toBuffer();
        quality -= 3;
      } while (buffer.length > 240_000 && quality >= 62);
      writeFileSync(poster, buffer);
    }
  }

  for (const item of source) {
    if (selected.length && !selected.includes(item.id)) continue;
    const parts = [];
    const transcript = [];
    const silence = (name, seconds) => {
      const path = join(work, `${item.id}-${name}.wav`);
      ffmpeg('-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', String(seconds), '-c:a', 'pcm_s16le', path);
      parts.push(path);
    };
    let cursor = 0.1;
    silence('lead', cursor);
    for (let index = 0; index < item.captions.length; index += 1) {
      const [text, translation] = item.captions[index];
      const raw = join(work, `${item.id}-${index}.aiff`);
      const wav = join(work, `${item.id}-${index}.wav`);
      run('say', ['-v', item.voice, '-r', String(item.rate), '-o', raw, text]);
      const speechTempo = { 1: 0.7, 2: 0.78, 3: 0.85, 4: 0.9 }[item.difficulty];
      ffmpeg('-i', raw, '-af', `silenceremove=start_periods=1:start_duration=0.01:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_duration=0.01:start_threshold=-50dB,areverse,atempo=${speechTempo}`, '-ar', '44100', '-ac', '1', '-c:a', 'pcm_s16le', wav);
      const spokenDuration = duration(wav);
      if (spokenDuration < 0.25) throw new Error(`Empty narration: ${item.id} / ${index}`);
      transcript.push({
        start: round(cursor),
        end: round(cursor + spokenDuration + 0.24),
        text,
        translation,
        words: text.split(/\s+/).map((surface) => {
          const entry = vocabulary[normalized(surface)];
          if (!entry) throw new Error(`Missing vocabulary: ${surface}`);
          return { surface, lemma: entry[0], translation: entry[1] };
        }),
      });
      parts.push(wav);
      silence(`gap-${index}`, 0.24);
      cursor += spokenDuration + 0.24;
    }
    const totalDuration = Math.max(10.8, cursor + 0.7);
    silence('tail', totalDuration - cursor);
    transcript.at(-1).end = round(totalDuration);
    const list = join(work, `${item.id}-concat.txt`);
    writeFileSync(list, parts.map((path) => `file '${path.replaceAll("'", "'\\''")}'`).join('\n'));
    const narration = join(work, `${item.id}-narration.wav`);
    ffmpeg('-f', 'concat', '-safe', '0', '-i', list, '-c:a', 'pcm_s16le', narration);
    const mp4 = join(root, `public/videos/${item.id}.mp4`);
    const frames = Math.ceil(totalDuration * 24);
    const seed = source.indexOf(item) % 3;
    const zoom = seed === 1 ? '1.075-on*0.00012' : '1.025+on*0.00012';
    const x = seed === 2 ? 'iw/2-(iw/zoom/2)+on*0.018' : 'iw/2-(iw/zoom/2)';
    ffmpeg('-loop', '1', '-i', join(root, `public/media/${item.scene}.webp`), '-i', narration,
      '-vf', `scale=1152:2048,zoompan=z='${zoom}':x='${x}':y='ih/2-(ih/zoom/2)':d=${frames}:s=576x1024:fps=24`,
      '-t', String(round(totalDuration)), '-map', '0:v:0', '-map', '1:a:0',
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-pix_fmt', 'yuv420p', '-profile:v', 'main',
      '-c:a', 'aac', '-b:a', '96k', '-ar', '44100', '-movflags', '+faststart', mp4);
    const result = probe(mp4);
    timings[item.id] = { duration: round(Number(result.format.duration)), transcript };
    writeFileSync(timingPath, `${JSON.stringify(timings, null, 2)}\n`);
    console.log(`${item.id}: ${timings[item.id].duration}s, ${Math.round(Number(result.format.size) / 1024)} KiB, ${transcript.length} captions`);
  }

  const videos = source.map((item) => {
    if (!timings[item.id]) throw new Error(`Missing timing data for ${item.id}; run a full build first.`);
    return {
      id: item.id,
      src: `/videos/${item.id}.mp4`,
      poster: `/media/${item.scene}.webp`,
      language: 'es',
      creator: item.creator,
      handle: item.handle,
      title: item.title,
      location: item.location,
      difficulty: item.difficulty,
      topics: item.topics,
      ...timings[item.id],
    };
  });
  writeFileSync(join(root, 'data/videos.ts'), `// Generated by scripts/media-build.mjs. Authored scene studies; see docs/MEDIA.md.\nimport type { VideoItem } from '@/lib/types';\n\nexport const videos: VideoItem[] = ${JSON.stringify(videos, null, 2)};\n`);
  console.log(`Wrote ${videos.length} typed records to data/videos.ts.`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
