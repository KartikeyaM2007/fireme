import type { Segment } from "./types";

export const fmt = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export const date = (v: string) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(v));

export const segmentEnd = (segments: Segment[] | undefined, segment: Segment) =>
  segments?.find((item) => item.start_seconds > segment.start_seconds)
    ?.start_seconds ?? Infinity;
