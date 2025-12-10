
export interface GeneratedImage {
  id: string;
  dataUrl: string;
}

export interface Slide {
  id: string;
  pageIndex: number;
  originalImage: string; // Base64 data URL
  currentImage: string;
  selected: boolean;
  lastPrompt?: string;
  generatedCandidates: GeneratedImage[];
}

export type QuizType = 'multiple-choice' | 'short-answer';
export type Difficulty = 'High' | 'Medium' | 'Low';

export interface QuizQuestion {
  id: string;
  type: QuizType;
  question: string;
  options?: string[]; // For multiple choice
  correctAnswer: string;
  explanation: string;
  timeLimit: number; // Seconds
}

export interface QuizConfig {
  multipleChoiceCount: number;
  shortAnswerCount: number;
  difficulty: Difficulty;
}

export interface Participant {
  id: string;
  name: string;
  score: number;
  answers: Record<string, { answer: string; isCorrect: boolean; timeTaken: number }>; // questionId -> answer
}

export interface QuizState {
  status: 'lobby' | 'playing' | 'question-result' | 'final-result';
  currentQuestionIndex: number;
  startTime: number; // Timestamp when question started
  timerActive: boolean;
}

export interface QuizReport {
  summaryInfographic: string; // Base64 URL
  textReport: string; // Plain text
}

export interface WinnerPoster {
  companyName: string;
  winnerName: string;
  winnerPhoto: string; // Base64
  posterImage?: string; // Generated Poster URL
}

export interface SizeOption {
  id: string;
  label: string;
  subLabel: string;
  ratio: string;
}

export interface ColorOption {
  id: string;
  name: string;
  class: string;
  hex: string;
}

export interface InfographicStyle {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  previewImage?: string;
}

export interface GenerationConfig {
  language: string;
  sizeOption: string;
  selectedColor?: string;
  selectedStyleId?: string;
  customStyleImage?: string;
}
