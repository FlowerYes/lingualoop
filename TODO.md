# LinguaLoop implementation

- [x] Establish shared types, app shell and visual tokens.
- [x] Core lane: adaptive calculation, ranking, learner updates, guarded local storage; focused unit tests first.
- [x] Media lane: 12 Spanish records, captions, vocabulary and reliable local demo MP4s.
- [x] AI lane: bounded explain/tutor routes, deterministic offline fallback, request validation and tests.
- [x] Lead: playback and snap feed, captions, word/tutor sheets, onboarding, Learn/review, profile/reset.
- [x] Integrate; lint, 93 unit tests, production build; exercise full browser journey on mobile and desktop.
- [x] Fresh independent correctness review and blinded word-sheet reference comparison; fix blocking gaps and verify.
- [x] Document media provenance, API configuration, local run and Vercel deployment.
- [ ] Publish and verify on Vercel once the user supplies the destination account/project; no project is linked in this workspace.

Ownership: lead owns app UI/components/context/config; core owns lib/{adaptive,ranking,learner,storage}.ts and tests/core; media owns data/, public/media/, public/videos/, scripts/media*, docs/MEDIA.md; AI owns lib/ai.ts, app/api/, tests/ai*. Shared lib/types.ts is the interface contract; coordinate changes with lead. No overlapping writes. No commits or publication requested.
