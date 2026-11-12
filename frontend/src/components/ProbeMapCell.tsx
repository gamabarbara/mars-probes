import { directionArrows, directionLabels } from '../contants/directionLabels';
import type {
  Probe,
  ProbeDetail,
  ProbeSelectionProps,
} from '../modules/probes/types/probe';

type Props = ProbeSelectionProps & {
  group: Probe[];
  selected: ProbeDetail | null;
  maxY: number;
};

export function ProbeMapCell({
  group,
  selected,
  selectedId,
  maxY,
  moving,
  onSelect,
}: Props) {
  const ordered = group.toSorted((a, b) => a.id.localeCompare(b.id));
  const { x, y, direction } = ordered[0];
  const activeIndex = ordered.findIndex(({ id }) => id === selectedId);
  const next = ordered[(activeIndex + 1) % ordered.length];
  const count = group.length;
  const description = `Cell (${x}, ${y}): ${count} ${count === 1 ? 'probe' : 'probes'}`;
  const detail =
    activeIndex >= 0 && selected
      ? `${description}, selected probe facing ${directionLabels[selected.direction]}`
      : description;

  return (
    <div
      role="listitem"
      className="map-cell"
      style={{ gridColumn: x + 1, gridRow: maxY - y + 1 }}
    >
      <button
        type="button"
        className="map-marker"
        disabled={moving}
        aria-label={`${detail}. Select probe ${next.id}`}
        aria-pressed={activeIndex >= 0}
        onClick={() => onSelect(next.id)}
      >
        <span className="sr-only">{detail}</span>
        <span aria-hidden="true" className="marker-glyph">
          {count > 1 ? count : directionArrows[direction]}
        </span>
      </button>
    </div>
  );
}
