import type { Direction } from "./probeTypes";

export const directionLabels: Record<Direction, string> = {
  NORTH: "North",
  EAST: "East",
  SOUTH: "South",
  WEST: "West",
};

export const directionArrows: Record<Direction, string> = { NORTH: "↑", EAST: "→", SOUTH: "↓", WEST: "←" };
