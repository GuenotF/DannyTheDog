export type ExerciseKind = 'heavy' | 'isolation' | 'timed' | 'bodyweight';

export interface Exercise {
  id: string;
  name: string;
  kind: ExerciseKind;
  /** Pas d'ajustement de la charge (kg) ou du temps (s) pour le gainage. */
  step: number;
  startWeight: number | null;
  /** Créé par l'utilisateur (étiquette « perso »). */
  custom?: boolean;
  /** Supprimé du catalogue : masqué, mais gardé pour l'historique. */
  archived?: boolean;
}

export interface TemplateItem {
  exerciseId: string;
  sets: number;
  repsMin: number;
  repsMax: number;
}

export interface TemplateBlock {
  /** Présent pour un superset (ex. « S1 »). */
  label?: string;
  /** Repos en secondes après l'exercice (ou après le dernier exercice d'un superset). */
  rest: number;
  items: TemplateItem[];
}

export interface Template {
  id: string;
  name: string;
  /** Jour prévu : 1 = lundi … 7 = dimanche. */
  day: number;
  optional: boolean;
  blocks: TemplateBlock[];
}

export interface SetLog {
  w: number | null;
  reps: number;
  done: boolean;
}

export interface ExerciseLog {
  exerciseId: string;
  repsMin: number;
  repsMax: number;
  sets: SetLog[];
}

export interface BlockLog {
  label?: string;
  rest: number;
  exercises: ExerciseLog[];
}

export type DecisionKind = 'up' | 'same' | 'down';

export interface Decision {
  exerciseId: string;
  from: number | null;
  to: number | null;
  kind: DecisionKind;
  note: string;
  failStreak: number;
}

export interface ActiveSession {
  id: string;
  templateId: string;
  startedAt: number;
  blocks: BlockLog[];
  restEnd: number;
  restTotal: number;
  restFrom: string;
  /** Série dont la charge est en cours d'édition : « bloc-exercice-série ». */
  editing: string | null;
  applyNext: boolean;
  /** Renseigné quand la séance est terminée et en attente d'enregistrement. */
  finishedAt?: number;
  decisions?: Decision[];
  feeling?: number;
  /** Décision dont la charge est en cours de modification sur l'écran de fin. */
  editingDecision?: string | null;
}

export interface SessionRecord {
  id: string;
  templateId: string;
  templateName: string;
  startedAt: number;
  endedAt: number;
  feeling: number | null;
  blocks: BlockLog[];
  decisions: Decision[];
}

export interface ExerciseProgress {
  weight: number | null;
  failStreak: number;
  /** Variation appliquée à la dernière séance (pour l'affichage « +2,5 »). */
  lastChange: number;
}

export interface BodyEntry {
  id: string;
  /** Horodatage de la mesure. */
  at: number;
  weight: number | null;
  waist: number | null;
}

export interface AppData {
  version: 1;
  exercises: Exercise[];
  templates: Template[];
  progress: Record<string, ExerciseProgress>;
  history: SessionRecord[];
  body: BodyEntry[];
  active: ActiveSession | null;
  lastExport: string | null;
  settings: { footDay: number | null };
}
