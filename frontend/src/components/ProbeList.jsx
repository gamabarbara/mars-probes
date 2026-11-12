import { useEffect, useState } from "react";

import { directionLabels } from "../directionLabels.js";
import { MoveForm } from "./MoveForm.jsx";

const pageSize = 20;
const selectClass = "mt-1 w-full rounded-md border border-slate-400 bg-white px-3 py-2";
const buttonClass = "rounded-md border border-slate-400 px-3 py-2 text-sm font-semibold disabled:opacity-50";

export function ProbeList({ launchCount }) {
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState("id");
  const [order, setOrder] = useState("asc");
  const [refreshCount, setRefreshCount] = useState(0);
  const [result, setResult] = useState({ status: "loading" });
  const [selectedId, setSelectedId] = useState(null);
  const [moving, setMoving] = useState(false);

  function refreshProbes() {
    setRefreshCount((count) => count + 1);
  }

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const query = new URLSearchParams({
      limit: String(pageSize + 1),
      offset: String(page * pageSize),
      sort_by: sortBy,
      order,
    });

    async function loadProbes() {
      setResult({ status: "loading" });
      try {
        const response = await fetch(`/probes?${query}`, { signal });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          if (!signal.aborted) {
            setResult({
              status: "error",
              message: body?.message || "Could not load the probes.",
            });
          }
          return;
        }
        const { probes } = await response.json();
        if (!signal.aborted) {
          setResult({ status: "success", probes });
        }
      } catch {
        if (!signal.aborted) {
          setResult({ status: "error", message: "Could not load the probes." });
        }
      }
    }

    loadProbes();
    return () => controller.abort();
  }, [page, sortBy, order, launchCount, refreshCount]);

  const { status, probes, message } = result;
  const hasNextPage = status === "success" && probes.length > pageSize;

  return (
    <section className="rounded-xl border border-slate-200 p-5" aria-labelledby="probe-list-title">
      <h2 id="probe-list-title" className="text-xl font-semibold">Launched probes</h2>
      <div className="my-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Sort by
          <select className={selectClass} value={sortBy} onChange={(event) => {
            setSortBy(event.target.value);
            setPage(0);
          }}>
            <option value="id">ID</option>
            <option value="x">X</option>
            <option value="y">Y</option>
            <option value="direction">Direction</option>
          </select>
        </label>
        <label className="text-sm font-medium">
          Sort order
          <select className={selectClass} value={order} onChange={(event) => {
            setOrder(event.target.value);
            setPage(0);
          }}>
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </label>
      </div>
      {status === "loading" && <p role="status">Loading probes…</p>}
      {status === "error" && (
        <div className="space-y-2">
          <p lang="en" role="alert" className="text-red-800">{message}</p>
          <button type="button" className={buttonClass} onClick={refreshProbes}>
            Try again
          </button>
        </div>
      )}
      {status === "success" && probes.length === 0 && (
        <p role="status">{page === 0 ? "No probes launched." : "No probes on this page."}</p>
      )}
      {status === "success" && probes.length > 0 && (
        <table className="w-full text-left text-sm" aria-labelledby="probe-list-title">
          <thead className="border-b border-slate-300">
            <tr>
              <th scope="col" className="py-2 pr-3">ID</th>
              <th scope="col" className="py-2 pr-3">Position</th>
              <th scope="col" className="py-2 pr-3">Direction</th>
              <th scope="col" className="py-2"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {probes.slice(0, pageSize).map(({ id, x, y, direction }) => (
              <tr key={id} className="border-b border-slate-200">
                <td className="py-2 pr-3 wrap-anywhere">{id}</td>
                <td className="py-2 pr-3 whitespace-nowrap">({x}, {y})</td>
                <td className="py-2 pr-3">{directionLabels[direction]}</td>
                <td className="py-2">
                  <button
                    type="button"
                    className={buttonClass}
                    aria-label={`Move probe ${id}`}
                    disabled={moving}
                    onClick={() => setSelectedId(id)}
                  >
                    Move
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <nav aria-label="Probe pagination" className="mt-4 flex items-center justify-between gap-2">
        <button type="button" className={buttonClass} disabled={page === 0 || status === "loading"} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <span className="text-sm" aria-live="polite">Page {page + 1}</span>
        <button type="button" className={buttonClass} disabled={!hasNextPage} onClick={() => setPage(page + 1)}>
          Next
        </button>
      </nav>
      {selectedId !== null && (
        <MoveForm
          key={selectedId}
          probeId={selectedId}
          moving={moving}
          onMovingChange={setMoving}
          onMoved={refreshProbes}
        />
      )}
    </section>
  );
}
