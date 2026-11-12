import type { Direction } from "./types/probe";

export const directionLabels: Record<Direction, string> = {
  NORTH: "North",
  EAST: "East",
  SOUTH: "South",
  WEST: "West",
};

export const directionArrows: Record<Direction, string> = { NORTH: "↑", EAST: "→", SOUTH: "↓", WEST: "←" };
