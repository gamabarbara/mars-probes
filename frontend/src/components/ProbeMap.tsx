import { useLayoutEffect, useRef } from "react";
import type { CSSProperties } from "react";

import { directionArrows, directionLabels } from "../directionLabels";

import type { Probe, ProbeDetail, ProbeSelectionProps } from "../probeTypes";

type ProbeMapProps = ProbeSelectionProps & { probes: Probe[]; selected: ProbeDetail | null };
type MapStyle = CSSProperties & { "--map-columns": number; "--map-rows": number };

export function ProbeMap({ probes, selected, selectedId, moving, onSelect }: ProbeMapProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
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

  const focused = selected ?? probes.find(({ id }) => id === selectedId);
  const focusX = focused?.x ?? 0;
  const focusY = focused?.y ?? 0;
  const hasCells = cells.size > 0;

  useLayoutEffect(() => {
    const panel = viewport.current;
    const plane = grid.current;
    if (!panel || !plane) return;

    const center = () => {
      panel.scrollLeft = plane.offsetLeft + (focusX + 0.5) * plane.clientWidth / (maxX + 1) - panel.clientWidth / 2;
      panel.scrollTop = plane.offsetTop + (maxY - focusY + 0.5) * plane.clientHeight / (maxY + 1) - panel.clientHeight / 2;
    };

    center();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(center);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [selectedId, focusX, focusY, maxX, maxY, hasCells]);

  if (!hasCells) {
    return <div className="terrain terrain-empty"><p role="status">No probes to display.</p></div>;
  }

  const mapStyle: MapStyle = { "--map-columns": maxX + 1, "--map-rows": maxY + 1 };

  return (
    <figure>
      <div className="terrain">
        <div ref={viewport} role="region" aria-label="Map grid" tabIndex={0} className="map-viewport">
          <div className="map-plane" style={mapStyle}>
            <div ref={grid} role="list" aria-label="Occupied cells" className="probe-grid">
              {Array.from({ length: maxX + 1 }, (_, x) => (
                <span aria-hidden="true" key={x} className="map-axis axis-x"
                  style={{ gridColumn: x + 1, gridRow: maxY + 1 }}>{x}</span>
              ))}
              {Array.from({ length: maxY + 1 }, (_, y) => (
                <span aria-hidden="true" key={y} className="map-axis axis-y"
                  style={{ gridColumn: 1, gridRow: maxY - y + 1 }}>{y}</span>
              ))}
              {selected && (
                <div
                  aria-hidden="true"
                  className="map-boundary"
                  style={{ gridColumn: `1 / span ${selected.max_x + 1}`, gridRow: `${maxY - selected.max_y + 1} / -1` }}
                />
              )}
              {[...cells.entries()].map(([key, group]) => {
                const ordered = group.toSorted((a, b) => a.id.localeCompare(b.id));
                const { x, y, direction } = ordered[0];
                const activeIndex = ordered.findIndex(({ id }) => id === selectedId);
                const next = ordered[(activeIndex + 1) % ordered.length];
                const count = group.length;
                const description = `Cell (${x}, ${y}): ${count} ${count === 1 ? "probe" : "probes"}`;
                const detail = activeIndex >= 0 && selected
                  ? `${description}, selected probe facing ${directionLabels[selected.direction]}`
                  : description;

                return (
                  <div key={key} role="listitem" className="map-cell"
                    style={{ gridColumn: x + 1, gridRow: maxY - y + 1 }}>
                    <button type="button" className="map-marker" disabled={moving}
                      aria-label={`${detail}. Select probe ${next.id}`}
                      aria-pressed={activeIndex >= 0}
                      onClick={() => onSelect(next.id)}>
                      <span className="sr-only">{detail}</span>
                      <span aria-hidden="true" className="marker-glyph">
                        {count > 1 ? count : directionArrows[direction]}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <span className="map-north" aria-label="North is up">↑ N</span>
      </div>
      <figcaption className="map-caption">
        <span><i aria-hidden="true" /> Selected probe</span>
        <span>Map bounds: (0, 0) to ({maxX}, {maxY})</span>
      </figcaption>
    </figure>
  );
}
