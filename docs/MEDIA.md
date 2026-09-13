# LinguaLoop demo media

Latest update: [three real TikTok clips and revised Doomersion interactions](TIKTOK.md). The material below records the earlier build.
The app ships with **12 original narrated Spanish scene studies**. They use four AI-generated still images, gentle camera movement, and synthetic Spanish narration. They are not recordings of real creators or actual events. The displayed creator names and handles are fictional editorial personas. Place labels describe the scenes' inspiration; the generated streets and landscapes are not exact location documentation.

The demo is complete and works locally without an API key, a media service, or a network request to an external video host. All public paths are served by the Next.js application. The 12 clips intentionally reuse the four scenes with distinct transcripts and camera paths; they are teaching vignettes, not twelve separate filmed stories. The Music vignette is a spoken reflection about music and travel, with no music track.

## Files and source

- `data/videos.ts`: typed `VideoItem[]`, generated from the authored scripts and measured audio timings.
- `data/vocabulary.ts` and `data/vocabulary-seed.json`: offline definitions for all 185 distinct Spanish caption tokens, with lemmas, translations, and contextual explanations for common expressions.
- `scripts/media-source.json`: editable Spanish scripts, English translations, level, topics, narrator settings, and scene assignments.
- `data/media-timings.json`: measured caption boundaries and finished clip durations.
- `scripts/media-originals/*.png`: four original generated source images, retained outside `public` to avoid shipping them as web assets.
- `scripts/media-prompts.json`: the exact generation prompts, asset keys, creation date, and SHA-256 hashes of the original images.
- `public/media/*.webp`: four 720 × 1280 compressed posters. `/media/cafe.webp` is the onboarding/hero image.
- `public/videos/*.mp4`: twelve portrait H.264/AAC files with fast-start metadata for browser playback.

Images were generated on 2026-09-12 with the built-in `image_gen.imagegen` tool. No third-party footage, creator likeness reference, scraped content, stock video, borrowed branding, music recording, or external visual source was used. macOS's installed **Mónica** (`es_ES`) speech voice narrates every sentence. This is synthesized Spanish speech, not a native speaker recording or voice clone. No OpenAI API key was used for media generation or narration.

## Clip manifest

| Record / file stem | Level | Scene | Topics |
| --- | --- | --- | --- |
| `cafe-madrid` | A1 | café | Food, Travel, Everyday |
| `mercado-colores` | A1 | market | Food, Everyday |
| `calle-granada` | A1 | Granada street | Travel, Culture |
| `desayuno-sin-prisa` | A2 | café | Food, Everyday |
| `perderse-granada` | A2 | Granada street | Travel, Culture |
| `paseo-verde` | A2 | mountains | Nature, Travel |
| `tomate-temporada` | B1 | market | Food, Culture |
| `patios-con-historia` | B1 | Granada street | Culture, Travel |
| `charla-terraza` | B1 | café | Everyday, Culture |
| `montana-silencio` | B2 | mountains | Nature, Everyday |
| `comprar-cercano` | B2 | market | Food, Culture |
| `musica-recuerdo` | B2 | Granada street | Music, Travel |

Difficulty labels are editorial estimates for these short scripts, not validated CEFR assessments.

## Rebuild

Prerequisites: macOS, Node.js, the project's installed dependencies (Next.js supplies `sharp`), `ffmpeg`, `ffprobe`, and the installed Mónica voice. A normal Vercel build does **not** regenerate media and has no macOS dependency; it deploys the committed MP4/WebP files.

```sh
node scripts/media-build.mjs
```

Rebuild only a changed clip:

```sh
node scripts/media-build.mjs cafe-madrid
```

Each sentence is synthesized separately, trimmed only at its beginning/end, and slowed slightly at lower difficulty levels without changing pitch. A 100 ms lead-in and 240 ms inter-sentence pauses are added. Caption start/end times come directly from the duration of each final PCM sentence. There is no ASR, transcription guesswork, or forced alignment. Caption segments change at sentence boundaries; the last caption stays visible through the brief end hold. All clips run at least 10.8 seconds so learners have reading time. Captions are supplied by the application, not burned into the video, and all words remain individually interactive.

The image assets are compressed/cropped into portrait posters with `sharp`; ffmpeg animates a slow pan or zoom and encodes 576 × 1024, 24 fps, YUV 4:2:0 H.264 Main video with 44.1 kHz mono AAC narration. Browser autoplay may require starting muted, which the app handles.

To replace a scene study with licensed real footage later, place its MP4 in `public/videos`, update the corresponding transcript with accurate timestamps and creator attribution, and map it in `data/videos.ts`. The media builder overwrites generated records, so remove replaced records from its source or update that workflow before running it again.

## Verification

`scripts/media-verify.mjs` checks every clip with ffprobe, fully decodes all audio/video streams, verifies portrait dimensions and audio presence, validates caption timing/word reconstruction/vocabulary coverage, and writes `data/media-verification.json`. It fails on a missing asset or invalid record.

```sh
node scripts/media-verify.mjs
```
