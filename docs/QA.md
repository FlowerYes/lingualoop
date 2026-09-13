# LinguaLoop verification

Latest update: [three real TikTok clips and revised Doomersion interactions](TIKTOK.md). The material below records the earlier build.
The subsequent mobile update is documented in [mobile implementation and verification](MOBILE.md), including 127 passing tests, new interaction checks and a separate blind feed comparison. The original verification below describes the earlier baseline.

Verified September 12, 2026. Local browser checks used the actual running Next.js app and its visible controls. Tests used isolated fixtures and mocked provider calls, without reading the private `.env`.

## Automated checks

- ESLint: pass.
- TypeScript: pass.
- Production build: pass on the supported Node 24 runtime; all four application pages and both AI routes generated successfully.
- Production server: started successfully; browser reload reached the feed, played one active video, and reported no video decode errors.
- Vitest: 93 tests across adaptive scoring, ranking, learner/storage behavior, review, vocabulary, and AI routes/fallbacks.
- Dependency audit: zero reported vulnerabilities after updating the test tooling.
- Impeccable's UI anti-pattern detector: no findings in `app/` and `components/`.
- All 12 MP4s: metadata, audio presence, complete audio/video decode, caption timing and vocabulary coverage pass. See `data/media-verification.json`.

## Browser journey

| Flow | Observed result |
| --- | --- |
| First load and onboarding | Redirects to onboarding; Spanish, five levels, and interests work; disabled coming-soon languages do not interfere. |
| Playback and navigation | Active video plays; previous video pauses when moving to the next; only the active clip plays. Neighboring clips preload while distant clips have no media source. |
| Captions | Spanish words change with the video's current time. English translation toggles independently. |
| Audio | Unmute makes the active video unmuted; mute restores muted playback. |
| Word sheet | Opens from a caption or Save action, pauses playback, shows meaning/context/example, and saves to Learn. Retapping a saved word increments encounters. |
| Comprehension and ranking | Completed clips update stats; subsequent unseen content is preferred. After sufficient completed clips, the actual upward adaptation toast appeared. Pure tests cover downward adjustment and ranking factors. |
| Tutor | Suggested grammar prompt and a typed phrase question returned concise transcript-based answers through the deterministic fallback path. |
| Vocabulary | Saved words appear with lemma, translation, context, and encounters. Search filters; no-results state offers recovery. |
| Review | All three questions complete, including the one-saved-word case. Answer feedback and final results render; focus moves to each new question and completion heading. |
| Persistence | Full page reload retained saved vocabulary; profile showed the persisted watch time, clip count, and comprehension. |
| Reset | Confirmation clears progress and saved words, returns to onboarding, and the next session's Learn page is empty. |
| Responsive/theme | Inspected mobile 390×844 and 375×667, tablet 900×800, and desktop 1280×720. No horizontal overflow in the compact feed. Light and dark supporting surfaces both inspected. |

Native dialogs provide modal focus management. Main icon controls were enlarged to 44px, reduced-motion preferences are respected, and the desktop player was shortened slightly for low-height screens. Screenshots are in `docs/qa/`.

## Independent review and comparison

A separate fresh-context correctness reviewer inspected the implementation and tests. Its actionable encounter-count finding was fixed and rechecked. No blocking correctness findings remained.

The named visual reference was [Doomersion's public App Store screenshots](https://apps.apple.com/us/app/doomersion/id6753957215), supported by its [public demo](https://doomersion.com). Its branding and assets are not used in LinguaLoop. A separate critic received two actual word-definition screenshots as A/B, with identifying marketing labels excluded and no source attribution. It chose **B (LinguaLoop)** for definition readability and explicit save/pronunciation controls. The reviewer identified no visible blocker in B. `comparison-A.png` is the reference; `comparison-B.png` is LinguaLoop.

This is a scoped visual preference for the word-definition screen. Static screenshots do not prove whole-app superiority, native playback quality, or teaching effectiveness. Other flows were verified against the requested behavior, not against inaccessible native-app internals.

## Practical limits

- The media is original generated imagery animated into narrated scene studies, with synthetic Spanish speech. Replace it with licensed real footage for an authentic creator-content launch.
- The curated twelve-clip demo scores each unique clip once. Replaying still adds watch time. Reset starts the learning demonstration again.
- Live provider success has not been claimed: browser testing exercised the fallback, while automated tests cover successful structured responses and failure cases.
- No Lighthouse score or measured field Core Web Vitals are claimed. Assets and fonts are local and video loading is bounded.
- Vercel account deployment remains pending a destination/account. The app uses standard Next.js route handlers and has deployment instructions in the README; a local production build is not evidence of a deployed URL.
