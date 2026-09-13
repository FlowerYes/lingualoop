# Mobile implementation and parity evidence

Latest update: [three real TikTok clips and revised Doomersion interactions](TIKTOK.md). The material below records the earlier build.
Verified September 12, 2026. LinguaLoop remains a responsive web app with its original identity and twelve bundled Spanish videos.

## Reference

The comparison uses Doomersion's [official demo](https://doomersion.com/doomlingopromo2.mp4) and [App Store screenshots and release history](https://apps.apple.com/us/app/doomersion/id6753957215), inspected directly. The demo visibly demonstrates full-height video, captions and word definitions, and shows a Too hard control. The release history documents swipe-left tutor access, double-tap rewind, clickable transcripts and adjustable language levels. Its learning-center screenshot lists tutor, flashcards, quizzes and progress.

These sources do not provide access to the native app's internal recommendation system. Gesture outcomes outside the public demo are release claims, not native interactions verified by this project.

## Implemented mobile flows

| Flow | Behavior |
| --- | --- |
| Playback | Tap to pause/resume; double tap rewinds five seconds. An explicit rewind button and keyboard-accessible seek range remain available. Five seconds is LinguaLoop's chosen interval; the reference does not specify one. |
| Swipes | Vertical movement retains native snap scrolling. Swipe left opens the tutor; swipe right opens the transcript. Both have visible button alternatives. |
| Transcript | Every sentence has a replay timestamp and tappable vocabulary. English translation can be toggled. Save opens this word picker instead of choosing an arbitrary word. |
| Word meanings | Open definitions from captions or transcript, hear pronunciation, and save to Learn. Nested Back returns from the definition to its transcript. |
| Difficulty | Too hard lowers the requested level, bounded to the supported range. Profile offers an explicit level and interest editor with Save/Cancel, preserving earned progress. |
| Learning center | Flashcards add reveal, pronunciation, Study again, Got it, completion and restart alongside the existing three-question Quick review. |
| Preferences | Mute, English captions, speed, appearance and likes persist in a separate guarded versioned record. Existing learner records stay compatible. |
| Returning to Feed | The active clip, queue, playhead and actual watched intervals survive route-tab changes during the current app session. Full reload retains learning/preferences but begins a new feed session. |
| Sheets | Native modal focus behavior, Escape, Back-to-close, backdrop close and downward handle drag. The visual viewport constrains height and keyboard clearance. |
| Sharing | Transcript Share uses native sharing when available, otherwise copies a clip link or exposes a selectable URL. Valid clip links select the requested local video, including after onboarding. |
| Landscape | Phones use a split video/caption view and keep navigation available. Desktop retains its centered player and learning rails. |

Watch credit uses real playback time and unique viewed intervals. Seeking cannot manufacture completion, and repeating footage cannot increase unique coverage. Transcript assistance is included in comprehension evidence. Reset clears preferences and the current feed session along with the existing demo data.

## Validation

- 127 Vitest tests across eleven files; ESLint and TypeScript pass.
- Production build passes with the installed Next.js Webpack build option: `node node_modules/next/dist/bin/next build --webpack`, using the bundled supported Node runtime. Turbopack's CSS worker failed to bind a local port in this execution environment, including an escalated retry; this is not recorded as a passing default Turbopack build.
- Impeccable UI detector: no findings.
- Browser interactions verified: onboarding, both horizontal gestures, double-tap rewind, paused range seeking, sentence replay, nested Back, vocabulary saving, tutor fallback response, flashcard retry/completion, preference save/reload, speed applied to media, shared clip selection and feed playhead restoration across tabs.
- The production server smoke check completed onboarding from a shared clip link, selected `cafe-madrid`, played exactly one fully ready video without a media error, and opened its interactive transcript.
- A route-restoration check left `perderse-granada` at 2.2 seconds and returned to the same clip at 2.237 seconds after playback resumed. Only one active video played.
- Responsive views inspected at 375×667, 390×844, 844×390 and 1280×800 with no document horizontal overflow. Supporting surfaces were inspected in light and dark modes. Inline caption words use the web's inline-text target treatment; standalone controls are at least 44 CSS pixels.
- A fresh independent source reviewer checked sheets, persistence, flashcards and onboarding. A separate playback reviewer found transcript-assistance, cross-route watch evidence and double-tap timing gaps; all were fixed. Its follow-up found a zero-position persistence guard, also removed.

The separate blind critic received only the two matching-size feed screenshots with A/B identifiers. It selected **A (LinguaLoop)** for visible translation, word-help guidance, tutor/transcript/replay controls and navigation. It reported no visible blocker. This is a scoped visual verdict; it excludes video subject matter and cannot establish functional or teaching superiority.

Evidence: [phone](mobile-qa/feed-phone.png), [small phone](mobile-qa/feed-small.png), [landscape](mobile-qa/feed-landscape.png), [desktop](mobile-qa/feed-desktop.png), [transcript](mobile-qa/transcript.png), [flashcards](mobile-qa/flashcards.png), [learning settings](mobile-qa/learning-settings.png), [dark profile](mobile-qa/profile-dark.png), [comparison A](mobile-qa/comparison-a.png), [comparison B](mobile-qa/comparison-b.png).

## Remaining limits

This is mobile web, not an iOS or Android binary. It retains the curated Spanish dataset and synthetic narrated scene studies. Multilingual media, screen-text OCR, accounts, social comments and a production content/recommendation service are not implemented. Flashcard practice is a session queue, not a spaced-repetition scheduler. Likes are local preferences and are not public social counts. Shared localhost URLs are useful only on the host running the app until deployment.

Browser viewport tests do not replace checks on physical iOS/Android hardware, the on-screen keyboard, native share targets or mobile audio policies. Reduced-motion rules remain in place; no measured Lighthouse, field performance or native-app parity result is claimed. No deployment or publication was performed.
