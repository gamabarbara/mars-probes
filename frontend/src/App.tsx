import { LaunchForm } from './components/LaunchForm';
import { MoveForm } from './components/MoveForm';
import { ProbeList } from './components/ProbeList';
import { ProbeOverview, ProbeControl } from './components/ProbeOverview';
import { directionLabels } from './contants/directionLabels';
import { useMissionControl } from './modules/probes/hooks/useMissionControl';

export function App() {
  const {
    launch,
    collectionRevision,
    detail,
    selectedId,
    moving,
    setMoving,
    selectProbe,
    handleLaunchComplete,
    refreshAfterMove,
  } = useMissionControl();

  return (
    <>
      <header className="mission-header">
        <div className="mission-shell mission-brand">
          <span className="mission-logo" aria-hidden="true" />
          <div>
            <strong>Mars Probes</strong>
            <span>Mission Control</span>
          </div>
        </div>
      </header>
      <main className="mission-shell mission-main">
        <div className="mission-title">
          <div>
            <h1>Surface operations</h1>
            <p>Track and command your probes on the Martian plateau.</p>
          </div>
          <LaunchForm
            disabled={moving}
            onLaunchComplete={handleLaunchComplete}
          />
        </div>
        <div role="status" className="launch-notice mission-success">
          {launch.probe && (
            <>
              <strong>Probe launched.</strong>{' '}
              <span>
                Position: ({launch.probe.x}, {launch.probe.y}) · Direction:{' '}
                {directionLabels[launch.probe.direction]}
              </span>
            </>
          )}
        </div>
        <div role="alert" className="launch-notice mission-error">
          {launch.count > 0 &&
            !launch.probe &&
            'Could not confirm whether the probe launched. Check the fleet before launching again.'}
        </div>
        <div className="mission-layout">
          <ProbeOverview
            collectionRevision={collectionRevision}
            detail={detail}
            selectedId={selectedId}
            moving={moving}
            onSelect={selectProbe}
          />
          <ProbeControl
            detail={detail}
            selectedId={selectedId}
            moving={moving}
            onClearSelection={() => selectProbe(null)}
          >
            {selectedId !== null && (
              <MoveForm
                key={selectedId}
                probeId={selectedId}
                moving={moving}
                onMovingChange={setMoving}
                onRefresh={refreshAfterMove}
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
