import { useMemo, useState } from 'react';

import { buildProbeLabels } from '../probeLabels';
import { probeService } from '../services/probeService';
import type { Probe, ProbeDetail, ProbeListResponse } from '../types/probe';

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
  const collection = useProbeQuery<ProbeListResponse>(
    '/probes',
    collectionRevision,
    'Could not load the probe map.',
    probeService.listAll
  );
  const probes =
    collection.status === 'success' ? collection.data.probes : null;
  const probeLabels = useMemo(
    () => buildProbeLabels(probes?.map(({ id }) => id) ?? []),
    [probes]
  );
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

  function handleLaunchComplete(probe: Probe | null) {
    setLaunch(({ count }) => ({ count: count + 1, probe }));
    if (probe) setSelectedId(probe.id);
  }

  function refreshAfterMove() {
    setMoveRevision(revision => revision + 1);
  }

  return {
    launch,
    collection,
    collectionRevision,
    probeLabels,
    detail,
    selectedId,
    moving,
    setMoving,
    selectProbe,
    handleLaunchComplete,
    refreshAfterMove,
  };
}
