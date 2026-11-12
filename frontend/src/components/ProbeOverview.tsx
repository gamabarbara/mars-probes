import type { ReactNode } from "react";

import { directionArrows, directionLabels } from "../modules/probes/directionLabels";
import { useProbeQuery } from "../modules/probes/hooks/useProbeQuery";
import type { ProbeQuery } from "../modules/probes/hooks/useProbeQuery";
import type { Probe, ProbeDetail, ProbeListResponse, ProbeSelectionProps } from "../modules/probes/types/probe";
import { ProbeMap } from "./ProbeMap";

const MAP_PAGE_SIZE = 100;

async function loadMapProbes(
  url: string, read: (url: string) => Promise<ProbeListResponse>,
): Promise<ProbeListResponse> {
  const probes: Probe[] = [];
  for (let offset = 0; ; offset += MAP_PAGE_SIZE) {
    const page = await read(`${url}?limit=${MAP_PAGE_SIZE}&offset=${offset}`);
    probes.push(...page.probes);
    if (page.probes.length < MAP_PAGE_SIZE) return { probes };
  }
}

type QueryErrorProps = { message: string; onRetry: () => void; label: string };

function QueryError({ message, onRetry, label }: QueryErrorProps) {
  return (
    <div className="space-y-2">
      <p role="alert" className="mission-error">{message}</p>
      <button type="button" className="mission-button" onClick={onRetry}>{label}</button>
    </div>
  );
}

type ProbeOverviewProps = ProbeSelectionProps & {
  collectionRevision: number;
  detail: ProbeQuery<ProbeDetail>;
};

export function ProbeOverview({ collectionRevision, detail, selectedId, moving, onSelect }: ProbeOverviewProps) {
  const collection = useProbeQuery("/probes", collectionRevision, "Could not load the probe map.", loadMapProbes);
  const selected = selectedId !== null && detail.status === "success" ? detail.data : null;

  return (
    <section className="mission-panel map-panel" aria-labelledby="probe-map-title">
      <div className="panel-heading">
        <h2 id="probe-map-title">Plateau map</h2>
        {collection.status === "success" && (
          <span>{collection.data.probes.length} {collection.data.probes.length === 1 ? "probe" : "probes"}</span>
        )}
      </div>
      {collection.status === "success" ? (
        <ProbeMap probes={collection.data.probes} selected={selected}
          selectedId={selectedId} moving={moving} onSelect={onSelect} />
      ) : (
        <div className="panel-body">
          {collection.status === "loading" && <p role="status">Loading probe map…</p>}
          {collection.status === "error" && (
            <QueryError message={collection.message} onRetry={collection.retry} label="Retry map" />
          )}
        </div>
      )}
    </section>
  );
}

type ProbeControlProps = Pick<ProbeSelectionProps, "selectedId" | "moving"> & {
  detail: ProbeQuery<ProbeDetail>;
  onClearSelection: () => void;
  children: ReactNode;
};

export function ProbeControl({ detail, selectedId, moving, onClearSelection, children }: ProbeControlProps) {
  const selected = detail.status === "success" ? detail.data : null;

  return (
    <section className="mission-panel" aria-labelledby="probe-control-title">
      <div className="panel-heading">
        <h2 id="probe-control-title">Probe control</h2>
        {selectedId !== null && (
          <button type="button" className="mission-link" disabled={moving} onClick={onClearSelection}>
            Clear selection
          </button>
        )}
      </div>
      {selectedId === null && <p className="panel-body muted">Select a probe on the map or in the fleet.</p>}
      {selectedId !== null && (
        <div className="panel-body probe-detail">
          <div className="probe-identity">
            <span className="probe-symbol" aria-hidden="true">{selected ? directionArrows[selected.direction] : "·"}</span>
            <div><h3>Selected probe</h3><p className="probe-id">ID: {selectedId}</p></div>
          </div>
          {detail.status === "loading" && <p role="status">Loading selected probe…</p>}
          {detail.status === "error" && (
            <QueryError message={detail.message} onRetry={detail.retry} label="Retry detail" />
          )}
          {selected && (
            <dl className="probe-telemetry">
              <div><dt>Position</dt><dd>({selected.x}, {selected.y})</dd></div>
              <div><dt>Heading</dt><dd>{directionLabels[selected.direction]}</dd></div>
              <div><dt>Grid limits</dt><dd>(0, 0) to ({selected.max_x}, {selected.max_y})</dd></div>
            </dl>
          )}
          {children}
        </div>
      )}
    </section>
  );
}
