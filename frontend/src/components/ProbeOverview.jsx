import { directionLabels } from "../directionLabels.js";
import { useProbeQuery } from "../useProbeQuery.js";
import { ProbeMap } from "./ProbeMap.jsx";

function QueryError({ message, onRetry, label }) {
  return (
    <div className="space-y-2">
      <p role="alert" className="text-red-800">{message}</p>
      <button type="button" className="underline" onClick={onRetry}>{label}</button>
    </div>
  );
}

export function ProbeOverview({ collectionRevision, detail, selectedId, moving, onClearSelection }) {
  const collection = useProbeQuery("/probes", collectionRevision, "Could not load the probe map.");
  const selected = selectedId !== null && detail.status === "success" ? detail.data : null;

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 p-5" aria-labelledby="probe-map-title">
      <h2 id="probe-map-title" className="text-xl font-semibold">Probe map</h2>
      {collection.status === "loading" && <p role="status">Loading probe map…</p>}
      {collection.status === "error" && (
        <QueryError message={collection.message} onRetry={collection.retry} label="Retry map" />
      )}
      {collection.status === "success" && <ProbeMap probes={collection.data.probes} selected={selected} />}
      {selectedId !== null && (
        <section className="space-y-2 border-t border-slate-200 pt-3" aria-labelledby="probe-detail-title">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="probe-detail-title" className="font-semibold">Selected probe</h3>
            <button type="button" className="text-sm underline disabled:opacity-50" disabled={moving} onClick={onClearSelection}>
              Clear selection
            </button>
          </div>
          {detail.status === "loading" && <p role="status">Loading selected probe…</p>}
          {detail.status === "error" && (
            <QueryError message={detail.message} onRetry={detail.retry} label="Retry detail" />
          )}
          {selected && (
            <dl className="space-y-1 text-sm">
              <div><dt className="inline font-medium">Position: </dt><dd className="inline">({selected.x}, {selected.y})</dd></div>
              <div><dt className="inline font-medium">Direction: </dt><dd className="inline">{directionLabels[selected.direction]}</dd></div>
              <div><dt className="inline font-medium">Grid limits: </dt><dd className="inline">(0, 0) to ({selected.max_x}, {selected.max_y})</dd></div>
            </dl>
          )}
        </section>
      )}
    </section>
  );
}
