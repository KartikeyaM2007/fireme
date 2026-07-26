export type Segment = {
  id: number;
  speaker: string;
  start_seconds: number;
  content: string;
};
export type Action = { id: number; text: string; owner: string; completed: boolean };
export type Chapter = { title: string; start_seconds: number; summary: string };
export type Note = {
  id: number;
  kind: "comment" | "highlight" | "soundbite";
  body: string;
  segment_id?: number | null;
  start_seconds: number;
  end_seconds?: number | null;
};
export type Meeting = {
  id: number;
  title: string;
  occurred_at: string;
  duration_seconds: number;
  participants: string[];
  summary: string;
  topics: string[];
  chapters: Chapter[];
  processing_status: string;
  media_url?: string | null;
  media_type?: string | null;
  segments?: Segment[];
  actions?: Action[];
  notes?: Note[];
};
