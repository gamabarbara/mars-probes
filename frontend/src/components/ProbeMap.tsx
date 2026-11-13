import type { CSSProperties } from 'react';

import { axisTicks, buildProbeMap } from '../modules/probes/map/probeMap';
import type {
  Probe,
  ProbeDetail,
  ProbeSelectionProps,
} from '../modules/probes/types/probe';

import { ProbeMapCell } from './ProbeMapCell';

type ProbeMapProps = ProbeSelectionProps & {
  probes: Probe[];
  probeLabels: ReadonlyMap<string, string>;
  selected: ProbeDetail | null;
};
type MapStyle = CSSProperties & {
  '--map-columns': number;
  '--map-rows': number;
};

export function ProbeMap({
  probes,
  probeLabels,
  selected,
  selectedId,
  moving,
  onSelect,
}: ProbeMapProps) {
  const { cells, maxX, maxY } = buildProbeMap(probes, selected);
  const selectedLabel =
    selectedId === null ? null : (probeLabels.get(selectedId) ?? selectedId);

  if (cells.size === 0) {
    return (
      <div className="terrain terrain-empty">
        <p role="status">No probes to display.</p>
      </div>
    );
  }

  const mapStyle: MapStyle = {
    '--map-columns': maxX + 1,
    '--map-rows': maxY + 1,
  };

  return (
    <figure className="map-figure">
      <div className="terrain map-terrain">
        <div
          role="region"
          aria-label="Map grid"
          className="map-viewport"
          style={mapStyle}
        >
          <div role="list" aria-label="Occupied cells" className="probe-grid">
            {axisTicks(maxX).map(x => (
              <span
                aria-hidden="true"
                key={x}
                className="map-axis axis-x"
                style={{ gridColumn: x + 1, gridRow: maxY + 1 }}
              >
                {x}
              </span>
            ))}
            {axisTicks(maxY).map(y => (
              <span
                aria-hidden="true"
                key={y}
                className="map-axis axis-y"
                style={{ gridColumn: 1, gridRow: maxY - y + 1 }}
              >
                {y}
              </span>
            ))}
            {selected && (
              <div
                aria-hidden="true"
                className="map-boundary"
                style={{
                  gridColumn: `1 / span ${selected.max_x + 1}`,
                  gridRow: `${maxY - selected.max_y + 1} / -1`,
                }}
              />
            )}
            {[...cells.entries()].map(([key, group]) => (
              <ProbeMapCell
                key={key}
                group={group}
                probeLabels={probeLabels}
                selected={selected}
                selectedId={selectedId}
                maxY={maxY}
                moving={moving}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
        <span className="map-north" aria-label="North is up">
          ↑ N
        </span>
      </div>
      <figcaption className="map-caption">
        <span>
          <i aria-hidden="true" />{' '}
          {selectedLabel === null
            ? 'Selected probe'
            : `Selected probe ${selectedLabel}`}
        </span>
        <span>
          Map bounds: (0, 0) to ({maxX}, {maxY})
        </span>
      </figcaption>
    </figure>
  );
}
