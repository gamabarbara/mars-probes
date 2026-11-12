import { useState } from "react";
import { directionLabels } from "./directionLabels";
import { LaunchForm } from "./components/LaunchForm";
import { MoveForm } from "./components/MoveForm";
import { ProbeList } from "./components/ProbeList";
import { ProbeOverview, ProbeControl } from "./components/ProbeOverview";
import { useProbeQuery } from "./useProbeQuery";
import type { Probe, ProbeDetail } from "./probeTypes";

export function App() {
  const [launch, setLaunch] = useState<{ count: number; probe: Probe | null }>({ count: 0, probe: null });
  const [moveRevision, setMoveRevision] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const collectionRevision = launch.count + moveRevision;
  const detailUrl = selectedId === null ? null : `/probes/${encodeURIComponent(selectedId)}`;
  const detail = useProbeQuery<ProbeDetail>(detailUrl, moveRevision, "Could not load the selected probe.");

  function selectProbe(id: string | null) {
    if (!moving) setSelectedId(id);
  }

  return (
    <>
      <header className="mission-header">
        <div className="mission-shell mission-brand">
          <span className="mission-logo" aria-hidden="true" />
          <div><strong>Mars Probes</strong><span>Mission Control</span></div>
        </div>
      </header>
      <main className="mission-shell mission-main">
        <div className="mission-title">
          <div>
            <h1>Surface operations</h1>
            <p>Track and command your probes on the Martian plateau.</p>
          </div>
          <LaunchForm disabled={moving} onLaunched={(probe) => {
            setLaunch(({ count }) => ({ count: count + 1, probe }));
            setSelectedId(probe.id);
          }} />
        </div>
        <div role="status" className="launch-notice">
          {launch.probe && (
            <>
              <strong>Probe launched.</strong>{" "}
              <span>Position: ({launch.probe.x}, {launch.probe.y}) · Direction: {directionLabels[launch.probe.direction]}</span>
            </>
          )}
        </div>
        <div className="mission-layout">
          <ProbeOverview
            collectionRevision={collectionRevision}
            detail={detail}
            selectedId={selectedId}
            moving={moving}
            onSelect={selectProbe}
          />
          <ProbeControl detail={detail} selectedId={selectedId} moving={moving}
            onClearSelection={() => selectProbe(null)}>
            {selectedId !== null && (
              <MoveForm
                key={selectedId}
                probeId={selectedId}
                moving={moving}
                onMovingChange={setMoving}
                onRefresh={() => setMoveRevision((revision) => revision + 1)}
              />
            )}
          </ProbeControl>
          <ProbeList
            revision={collectionRevision}
            selectedId={selectedId}
            moving={moving}
            onSelect={selectProbe}
          />
        </div>
      </main>
    </>
  );
}
