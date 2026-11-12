import { useLayoutEffect, useRef } from "react";

import { directionLabels } from "../directionLabels.js";

const cellSize = 36;
const arrows = { NORTH: "↑", EAST: "→", SOUTH: "↓", WEST: "←" };

export function ProbeMap({ probes, selected }) {
  const viewport = useRef(null);
  const cells = new Map();
  let maxX = selected?.max_x ?? 0;
  let maxY = selected?.max_y ?? 0;

  function addProbe({ x, y }, isSelected = false) {
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    const key = `${x},${y}`;
    cells.set(key, { x, y, count: (cells.get(key)?.count ?? 0) + 1, isSelected });
  }

  for (const probe of probes) {
    if (probe.id !== selected?.id) addProbe(probe);
  }
  if (selected) addProbe(selected, true);

  const focusX = selected?.x ?? 0;
  const focusY = selected?.y ?? 0;
  const hasCells = cells.size > 0;
  useLayoutEffect(() => {
    const panel = viewport.current;
    if (!panel) return;
    panel.scrollLeft = (focusX + 0.5) * cellSize - panel.clientWidth / 2;
    panel.scrollTop = (maxY - focusY + 0.5) * cellSize - panel.clientHeight / 2;
  }, [focusX, focusY, maxX, maxY, hasCells]);

  if (!hasCells) return <p role="status">No probes to display.</p>;

  const tile = `${cellSize}px`;
  return (
    <figure className="space-y-2">
      <figcaption className="text-sm text-slate-600">Map bounds: (0, 0) to ({maxX}, {maxY})</figcaption>
      <div ref={viewport} role="region" aria-label="Map grid" tabIndex={0} className="max-h-80 overflow-auto rounded border border-slate-300">
        <div
          role="list"
          aria-label="Occupied cells"
          className="probe-grid grid w-max bg-slate-50"
          style={{
            "--probe-cell-size": tile,
            gridTemplateColumns: `repeat(${maxX + 1}, ${tile})`,
            gridTemplateRows: `repeat(${maxY + 1}, ${tile})`,
          }}
        >
          {selected && (
            <div
              aria-hidden="true"
              className="pointer-events-none border-2 border-sky-600 bg-sky-100/45"
              style={{ gridColumn: `1 / span ${selected.max_x + 1}`, gridRow: `${maxY - selected.max_y + 1} / -1` }}
            />
          )}
          {[...cells.values()].map(({ x, y, count, isSelected }) => (
            <div
              key={`${x},${y}`}
              role="listitem"
              className="z-10 grid place-items-center"
              style={{ gridColumn: x + 1, gridRow: maxY - y + 1 }}
            >
              <span className="sr-only">
                Cell ({x}, {y}): {count} {count === 1 ? "probe" : "probes"}
                {isSelected && `, selected probe facing ${directionLabels[selected.direction]}`}
              </span>
              <span
                aria-hidden="true"
                className={`flex max-w-full items-center gap-0.5 rounded px-0.5 text-xs font-bold ${isSelected ? "bg-sky-700 text-white" : "text-slate-800"}`}
              >
                {isSelected && <span className="text-base">{arrows[selected.direction]}</span>}
                {count > 1 ? count : !isSelected && "●"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </figure>
  );
}
