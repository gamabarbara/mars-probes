import { useState } from "react";

import type { ProbeListResponse } from "../types/probe";
import { useProbeQuery } from "./useProbeQuery";

const pageSize = 20;

export function useProbeList(revision: number) {
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState("id");
  const [order, setOrder] = useState("asc");
  const query = new URLSearchParams({
    limit: String(pageSize + 1),
    offset: String(page * pageSize),
    sort_by: sortBy,
    order,
  });
  const queryResult = useProbeQuery<ProbeListResponse>(
    `/probes?${query}`, revision, "Could not load the probes.",
  );
  const probes = queryResult.status === "success" ? queryResult.data.probes : [];

  function changeSortBy(value: string) {
    setSortBy(value);
    setPage(0);
  }

  function changeOrder(value: string) {
    setOrder(value);
    setPage(0);
  }

  return {
    page,
    setPage,
    sortBy,
    order,
    changeSortBy,
    changeOrder,
    queryResult,
    probes: probes.slice(0, pageSize),
    hasNextPage: probes.length > pageSize,
  };
}
