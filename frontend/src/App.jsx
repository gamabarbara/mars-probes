import { useState } from "react";
import { LaunchForm } from "./components/LaunchForm.jsx";
import { MoveForm } from "./components/MoveForm.jsx";
import { ProbeList } from "./components/ProbeList.jsx";
import { ProbeOverview } from "./components/ProbeOverview.jsx";
import { useProbeQuery } from "./useProbeQuery.js";

export function App() {
  const [launchCount, setLaunchCount] = useState(0);
  const [moveRevision, setMoveRevision] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [moving, setMoving] = useState(false);
  const collectionRevision = launchCount + moveRevision;
  const detailUrl = selectedId === null ? null : `/probes/${encodeURIComponent(selectedId)}`;
  const detail = useProbeQuery(detailUrl, moveRevision, "Could not load the selected probe.");

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-3xl font-bold">Mars Probes</h1>
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="min-w-0 space-y-6">
          <LaunchForm onLaunched={() => setLaunchCount((count) => count + 1)} />
          <ProbeList
            revision={collectionRevision}
            selectedId={selectedId}
            moving={moving}
            onSelect={setSelectedId}
          />
        </div>
        <div className="min-w-0 space-y-6">
          <ProbeOverview
            collectionRevision={collectionRevision}
            detail={detail}
            selectedId={selectedId}
            moving={moving}
            onClearSelection={() => setSelectedId(null)}
          />
          {selectedId !== null && (
            <MoveForm
              key={selectedId}
              probeId={selectedId}
              moving={moving}
              onMovingChange={setMoving}
              detailLoading={detail.status === "loading"}
              onRefresh={() => setMoveRevision((revision) => revision + 1)}
            />
          )}
        </div>
      </div>
    </main>
  );
}
