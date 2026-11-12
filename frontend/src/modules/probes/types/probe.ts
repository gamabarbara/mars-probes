export type Direction = "NORTH" | "EAST" | "SOUTH" | "WEST";

export type Probe = {
  id: string;
  x: number;
  y: number;
  direction: Direction;
};

export type ProbeDetail = Probe & {
  max_x: number;
  max_y: number;
};

export type ProbeListResponse = { probes: Probe[] };

export type ProbeSelectionProps = {
  selectedId: string | null;
  moving: boolean;
  onSelect: (id: string) => void;
};
