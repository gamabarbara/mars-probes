import { useState } from 'react';

import type { Probe, ProbeDetail } from '../types/probe';

import { useProbeQuery } from './useProbeQuery';

export function useMissionControl() {
  const [launch, setLaunch] = useState<{ count: number; probe: Probe | null }>({
    count: 0,
    probe: null,
  });
  const [moveRevision, setMoveRevision] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const collectionRevision = launch.count + moveRevision;
  const detailUrl =
    selectedId === null ? null : `/probes/${encodeURIComponent(selectedId)}`;
  const detail = useProbeQuery<ProbeDetail>(
    detailUrl,
    moveRevision,
    'Could not load the selected probe.'
  );

  function selectProbe(id: string | null) {
    if (!moving) setSelectedId(id);
  }

  function handleLaunched(probe: Probe) {
    setLaunch(({ count }) => ({ count: count + 1, probe }));
    setSelectedId(probe.id);
  }

  function refreshAfterMove() {
    setMoveRevision(revision => revision + 1);
  }

  return {
    launch,
    collectionRevision,
    detail,
    selectedId,
    moving,
    setMoving,
    selectProbe,
    handleLaunched,
    refreshAfterMove,
  };
}
