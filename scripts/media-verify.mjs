#!/usr/bin/env node
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const generated = readFileSync(join(root, 'data/videos.ts'), 'utf8');
const videos = JSON.parse(generated.match(/export const videos: VideoItem\[\] = ([\s\S]*);\s*$/)[1]);
const vocabulary = new Set(videos.flatMap((video) => video.transcript.flatMap((caption) => caption.words.map((word) => word.lemma))));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
assert(videos.length === 3, 'Three real TikTok clips required');
assert(videos.every((video) => video.sourcePlatform === 'tiktok' && /^https:\/\/www\.tiktok\.com\/@[\w.]+\/video\/\d+$/.test(video.sourceUrl)), 'TikTok creator provenance required');
assert(new Set(videos.map((item) => item.id)).size === videos.length, 'Duplicate clip IDs');
const clips = [];
for (const video of videos) {
  const file = join(root, 'public', video.src);
  const metadata = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', file]));
  const picture = metadata.streams.find((stream) => stream.codec_type === 'video');
  const sound = metadata.streams.find((stream) => stream.codec_type === 'audio');
  const duration = Number(metadata.format.duration);
  assert(picture?.codec_name === 'h264', `${video.id}: H.264 required`);
  assert(sound?.codec_name === 'aac', `${video.id}: AAC audio required`);
  assert(picture.width === 576 && picture.height === 1024, `${video.id}: wrong portrait dimensions`);
  assert(picture.pix_fmt === 'yuv420p', `${video.id}: browser-compatible pixel format required`);
  assert(Math.abs(duration - video.duration) < 0.06, `${video.id}: duration mismatch`);
  assert(duration >= 5 && duration <= 120, `${video.id}: expected a short video`);
  assert(statSync(join(root, 'public', video.poster)).size < 250_000, `${video.id}: poster too large`);
  assert(video.transcript[0].start >= 0, `${video.id}: captions cannot precede the clip`);
  let previousEnd = 0;
  for (const caption of video.transcript) {
    assert(caption.start >= previousEnd - 0.002, `${video.id}: overlapping captions`);
    assert(caption.end > caption.start && caption.end <= duration + 0.01, `${video.id}: caption outside clip`);
    assert(caption.words.map((word) => word.surface).join(' ') === caption.text, `${video.id}: words do not reconstruct sentence`);
    for (const word of caption.words) {
      assert(word.lemma && word.translation, `${video.id}: missing definition ${word.surface}`);
      if (word.start !== undefined) assert(word.start >= caption.start && word.end > word.start && word.end <= caption.end, `${video.id}: word timing outside caption`);
    }
    previousEnd = caption.end;
  }
  const decode = spawnSync('ffmpeg', ['-hide_banner', '-v', 'error', '-i', file, '-map', '0:v', '-map', '0:a', '-f', 'null', '-'], { encoding: 'utf8' });
  assert(decode.status === 0 && !decode.stderr.trim(), `${video.id}: decode error ${decode.stderr}`);
  const volume = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-vn', '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' });
  const meanVolumeDb = Number(volume.stderr.match(/mean_volume: ([-\d.]+) dB/)?.[1]);
  assert(Number.isFinite(meanVolumeDb) && meanVolumeDb > -45, `${video.id}: audio missing or too quiet`);
  const item = { id: video.id, path: video.src, duration, width: picture.width, height: picture.height, videoCodec: picture.codec_name, audioCodec: sound.codec_name, audioSampleRate: Number(sound.sample_rate), audioChannels: sound.channels, meanVolumeDb, bytes: Number(metadata.format.size), captions: video.transcript.length, firstCaptionStart: video.transcript[0].start, decoded: true };
  clips.push(item);
  console.log(`${item.id}: ${duration.toFixed(2)} s / ${item.width}×${item.height} / ${item.videoCodec}+${item.audioCodec} / ${meanVolumeDb} dB / decode OK`);
}
const report = { verifiedAt: new Date().toISOString(), clips: clips.length, captionSegments: clips.reduce((n, clip) => n + clip.captions, 0), vocabularyTokens: vocabulary.size, totalVideoBytes: clips.reduce((n, clip) => n + clip.bytes, 0), details: clips };
writeFileSync(join(root, 'data/media-verification.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Verified ${report.clips} clips, ${report.captionSegments} caption segments, ${report.vocabularyTokens} vocabulary tokens; ${(report.totalVideoBytes / 1_000_000).toFixed(2)} MB total video.`);
