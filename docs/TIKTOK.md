# Real TikTok mobile update

September 12, 2026. This supersedes the earlier synthetic-media mobile demo.

## Three real videos

| Clip | Creator/source | Local duration | Source excerpt |
| --- | --- | --- | --- |
| Mi primera tortilla | [@ninivaleongil](https://www.tiktok.com/@ninivaleongil/video/7420869893882416417) | 16.60 s | 9.0–25.6 s |
| Es hora de comer | [@spanishforeveryday](https://www.tiktok.com/@spanishforeveryday/video/6926939216555429125) | 13.37 s | Full clip |
| Un recuerdo de San Salvador | [@pauliinog](https://www.tiktok.com/@pauliinog/video/7061719545567923461) | 14.50 s | 72.2–86.7 s |

All three contain the original human video and speech. The two excerpts are re-encoded for reliable browser playback; the quiet cooking audio was normalized. Files are local H.264/AAC, 576×1024, about 8.69 MB total. Creator attribution links remain available. Downloads used public media URLs emitted by TikTok's own public pages, without account cookies or authentication. Nothing has been published externally.

The previous twelve synthetic clips are no longer in the active catalog. Existing saved vocabulary is preserved; an old word whose original clip is absent reports that limitation when context replay is requested.

## Transcription

Cooking and travel use actual TikTok Spanish ASR cues, cross-checked with a local Whisper `small` run. The eating clip has no TikTok caption track and uses local Whisper transcription. English was reviewed from the Spanish, rather than accepting TikTok's raw machine translations. Each displayed token has a contextual lemma and gloss.

Word highlights use only matching ASR word intervals. Tokens where the independent ASR disagreed retain the reviewed caption text without fabricated word timing. The raw evidence is in [data/transcripts](../data/transcripts/); the displayed, reviewed captions are in [data/videos.ts](../data/videos.ts). This reproduces the synchronized transcript experience; Doomersion's private transcription implementation is unknown. This demo has a prepared catalog, not an upload or live-ingestion backend.

## UI and interactions

- Full-screen video, current-reference scan/heart/comments/share/ellipsis rail, floating navigation, direct over-video captions.
- Tap video to pause; double tap rewinds five seconds. Native vertical snap swipes change clips; only the active clip plays.
- Tap a word for a compact live definition. The video continues. Listen and Save word remain available.
- Swipe left opens the current-video tutor; swipe right opens flashcards. The inverse gesture closes either panel, with Close/Escape/Back alternatives.
- Comments opens the clickable transcript first. Sentence timestamps replay the actual clip. Original social comments are reached through the TikTok source link.
- Flashcards reveal meanings, retry words, mark remembered words for the current session, and replay the source sentence with Watch in context. Saved words persist; rating sessions restart when reopened.
- Scan runs real Spanish OCR on the captured frame in a local worker. It shows bounding boxes, selectable text, word lookup, progress, retry and a genuine empty state. No frame is uploaded. The roughly 6.4 MB runtime/model load is deferred until scanning; [asset provenance](../public/ocr/README.md) includes versions and licenses.
- Ellipsis exposes captions, English, difficulty, rewind, tutor and flashcards. Playback preferences and learner progress remain persistent.

Static appearance follows the [current App Store screenshots](https://apps.apple.com/us/app/doomersion/id6753957215), whose release history explicitly changed the buttons in June. The [official promo](https://doomersion.com/doomlingopromo2.mp4) demonstrates word popovers while video continues. The developer's iOS release notes confirm left-swipe tutor, clickable transcript in comments and double-tap rewind. Right-swipe flashcards is directly described by a February 6 Google Play review; its exact current iOS transition is not independently verified. [Google Play listing](https://play.google.com/store/apps/details?hl=en-US&id=com.mostafaafr.doomlingo)

## Verification

- 139 tests across 13 files; TypeScript, ESLint and the Webpack production build pass.
- All three video/audio streams fully decode. Durations, caption bounds, source attribution, local assets and every word definition are checked.
- Browser checks cover real-video playback, live word lookup, saving, right-swipe flashcards, Watch in context, left-swipe tutor, interactive transcript and sentence replay.
- Production Back closes a nested definition while keeping Comments open. Forward into its dismissed entry also preserves Comments. Seven history tests cover indexed Forward/Back and asynchronous traversal.
- OCR separately recognized a Spanish test frame exactly with seven word boxes and no external requests; its four lifecycle tests cover cancellation and timeout. Two worker regressions verify noise filtering and preserved Spanish text. The production scanner now returns “No clear text found” on a frame without readable text.
- Responsive browser checks passed at 375×667, 390×844, 844×390 and 1280×900 with no horizontal overflow. Inverse panel swipes, five-second double-tap rewind, and all three clips playing one at a time were verified. The final production browser reported no console errors.
- A fresh visual reviewer found no blocking clipping, overlap or unreadable actions in eight screenshots. Native word-popover sizing remains a visual difference. [Review captures](tiktok-qa/).
- The tutor currently uses the explicitly labeled built-in practice fallback. Live general AI answers require the existing server API-key configuration.

This is a local mobile-web implementation. It does not claim native pixel parity, access to Doomersion's private algorithms, a TikTok social backend, or physical-device validation. The active clip set is intentionally three videos.

## Running preview

The production preview runs at [127.0.0.1:3002](http://127.0.0.1:3002/feed?clip=tiktok-primera-tortilla) as a detached local process; output is in `/private/tmp/doom-preview.log`. It remains available while that process and this computer are running.
