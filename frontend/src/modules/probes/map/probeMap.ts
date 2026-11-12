import type { Probe, ProbeDetail } from "../types/probe";

export function axisTicks(max: number) {
  if (max === 0) return [0];
  const intervals = Math.min(max, 5);
  return Array.from({ length: intervals + 1 }, (_, i) => Math.round(i * max / intervals));
}

export function buildProbeMap(probes: Probe[], selected: ProbeDetail | null) {
  const cells = new Map<string, Probe[]>();
  let maxX = selected?.max_x ?? 0;
  let maxY = selected?.max_y ?? 0;

  function addProbe(probe: Probe) {
    const { x, y } = probe;
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    const key = `${x},${y}`;
    const group = cells.get(key);
    if (group) group.push(probe);
    else cells.set(key, [probe]);
  }

  for (const probe of probes) {
    if (probe.id !== selected?.id) addProbe(probe);
  }
  if (selected) addProbe(selected);

  return { cells, maxX, maxY };
}
