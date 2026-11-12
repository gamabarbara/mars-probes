import { directionLabels } from '../contants/directionLabels';
import { useProbeList } from '../modules/probes/hooks/useProbeList';
import type { ProbeSelectionProps } from '../modules/probes/types/probe';

const selectClass = 'mission-field';
const buttonClass = 'mission-button';

type ProbeListProps = ProbeSelectionProps & { revision: number };

export function ProbeList({
  revision,
  selectedId,
  moving,
  onSelect,
}: ProbeListProps) {
  const {
    page,
    setPage,
    sortBy,
    order,
    changeSortBy,
    changeOrder,
    queryResult,
    status,
    retry,
    probes,
    hasNextPage,
  } = useProbeList(revision);

  return (
    <section
      className="mission-panel fleet-panel"
      aria-labelledby="probe-list-title"
    >
      <div className="panel-heading">
        <h2 id="probe-list-title">Probe fleet</h2>
      </div>
      <div className="fleet-filters">
        <label className="text-sm font-medium">
          Sort by
          <select
            className={selectClass}
            value={sortBy}
            onChange={event => changeSortBy(event.target.value)}
          >
            <option value="id">ID</option>
            <option value="x">X</option>
            <option value="y">Y</option>
            <option value="direction">Direction</option>
          </select>
        </label>
        <label className="text-sm font-medium">
          Sort order
          <select
            className={selectClass}
            value={order}
            onChange={event => changeOrder(event.target.value)}
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </label>
      </div>
      {status === 'loading' && (
        <p className="panel-body muted" role="status">
          Loading probes…
        </p>
      )}
      {queryResult.status === 'error' && (
        <div className="panel-body space-y-2">
          <p lang="en" role="alert" className="mission-error">
            {queryResult.message}
          </p>
          <button type="button" className={buttonClass} onClick={retry}>
            Try again
          </button>
        </div>
      )}
      {status === 'success' && probes.length === 0 && (
        <p className="panel-body muted" role="status">
          {page === 0 ? 'No probes launched.' : 'No probes on this page.'}
        </p>
      )}
      {status === 'success' && probes.length > 0 && (
        <table className="fleet-table" aria-labelledby="probe-list-title">
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">Position</th>
              <th scope="col">Direction</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {probes.map(({ id, x, y, direction }) => (
              <tr
                key={id}
                className={selectedId === id ? 'fleet-selected' : undefined}
              >
                <td className="probe-id">{id}</td>
                <td className="fleet-position">
                  ({x}, {y})
                </td>
                <td>{directionLabels[direction]}</td>
                <td>
                  <button
                    type="button"
                    className={buttonClass}
                    aria-label={`Select probe ${id}`}
                    aria-pressed={selectedId === id}
                    disabled={moving}
                    onClick={() => onSelect(id)}
                  >
                    Select
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <nav aria-label="Probe pagination" className="fleet-pagination">
        <button
          type="button"
          className={buttonClass}
          disabled={page === 0 || status === 'loading'}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </button>
        <span className="text-sm" aria-live="polite">
          Page {page + 1}
        </span>
        <button
          type="button"
          className={buttonClass}
          disabled={!hasNextPage}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </nav>
    </section>
  );
}
