export interface SavedWord {
  id: string;
  surface: string;
  lemma: string;
  translation: string;
  contextSentence: string;
  encounters: number;
  language: string;
  videoId: string;
  savedAt: string;
}

export interface LearnerState {
  language: string;
  ability: number;
  interests: string[];
  savedWords: SavedWord[];
  watchedVideoIds: string[];
  totalWatchSeconds: number;
  comprehensionHistory: number[];
}

export interface VideoItem {
  id: string;
  src: string;
  poster: string;
  language: string;
  creator: string;
  handle: string;
  title: string;
  location: string;
  difficulty: number;
  topics: string[];
  duration: number;
  transcript: CaptionSegment[];
  sourceUrl?: string;
  sourcePlatform?: 'tiktok';
  sourceCaption?: string;
  creatorAvatar?: string;
}

export interface CaptionSegment {
  start: number;
  end: number;
  text: string;
  translation: string;
  words: CaptionWord[];
}

export interface CaptionWord {
  surface: string;
  lemma?: string;
  translation?: string;
  start?: number;
  end?: number;
  explanation?: string;
}

export interface WatchEvent {
  videoId: string;
  completionRatio: number;
  wordTaps: number;
  translationOpened: boolean;
  replayed: boolean;
  savedWords: number;
}

export interface WordExplanation {
  lemma: string;
  translation: string;
  contextMeaning: string;
  explanation: string;
  example: string;
}

export interface ExplainInput {
  language: string;
  word: string;
  sentence: string;
  translation: string;
}

export interface TutorInput {
  question: string;
  transcript: string;
  translation: string;
  learnerLevel: number;
}

export interface TutorAnswer {
  answer: string;
  source: 'ai' | 'demo';
}
