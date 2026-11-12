import { useState } from "react";

import { directionLabels } from "../directionLabels.js";

const fieldClass = "mt-1 w-full rounded-md border border-slate-400 bg-white px-3 py-2";
const gridValidation = {
  onInvalid(event) {
    event.currentTarget.setCustomValidity("Enter a whole number from 0 to 100.");
  },
  onInput(event) {
    event.currentTarget.setCustomValidity("");
  },
};

export function LaunchForm({ onLaunched }) {
  const [launching, setLaunching] = useState(false);
  const [probe, setProbe] = useState(null);
  const [error, setError] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLaunching(true);
    setProbe(null);
    setError(null);

    try {
      const response = await fetch("/probes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          x: Number(form.get("x")),
          y: Number(form.get("y")),
          direction: form.get("direction"),
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.message || "Could not launch the probe. Try again.");
        return;
      }
      setProbe(await response.json());
      onLaunched?.();
    } catch {
      setError("Could not connect to the API. Try again.");
    } finally {
      setLaunching(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 p-5" aria-labelledby="launch-title">
      <h2 id="launch-title" className="text-xl font-semibold">Launch probe</h2>
      <p id="grid-help" className="mt-1 text-sm text-slate-600">
        Set the grid limits using whole numbers from 0 to 100.
      </p>
      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            X limit
            <input className={fieldClass} name="x" type="number" min="0" max="100" step="1" required aria-describedby="grid-help" {...gridValidation} />
          </label>
          <label className="block text-sm font-medium">
            Y limit
            <input className={fieldClass} name="y" type="number" min="0" max="100" step="1" required aria-describedby="grid-help" {...gridValidation} />
          </label>
        </div>
        <label className="block text-sm font-medium">
          Initial direction
          <select className={fieldClass} name="direction" defaultValue="NORTH">
            {Object.entries(directionLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={launching} className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-60">
          {launching ? "Launching…" : "Launch"}
        </button>
      </form>
      {error && <p lang="en" role="alert" className="mt-4 text-red-800">{error}</p>}
      {probe && (
        <div role="status" className="mt-4 rounded-md bg-emerald-50 p-4 text-emerald-950">
          <p className="font-semibold">Probe launched.</p>
          <p className="break-all">ID: {probe.id}</p>
          <p>Position: ({probe.x}, {probe.y}) · Direction: {directionLabels[probe.direction]}</p>
        </div>
      )}
    </section>
  );
}
