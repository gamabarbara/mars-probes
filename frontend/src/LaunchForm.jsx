import { useState } from "react";

const directions = {
  NORTH: "Norte",
  EAST: "Leste",
  SOUTH: "Sul",
  WEST: "Oeste",
};

const fieldClass = "mt-1 w-full rounded-md border border-slate-400 bg-white px-3 py-2";

export function LaunchForm() {
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
        setError(body?.message || "Não foi possível lançar a sonda. Tente novamente.");
        return;
      }
      setProbe(await response.json());
    } catch {
      setError("Não foi possível conectar à API. Tente novamente.");
    } finally {
      setLaunching(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 p-5" aria-labelledby="launch-title">
      <h2 id="launch-title" className="text-xl font-semibold">Lançar sonda</h2>
      <p id="grid-help" className="mt-1 text-sm text-slate-600">
        Defina os limites da malha com números inteiros de 0 a 100.
      </p>
      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Limite X
            <input className={fieldClass} name="x" type="number" min="0" max="100" step="1" required aria-describedby="grid-help" />
          </label>
          <label className="block text-sm font-medium">
            Limite Y
            <input className={fieldClass} name="y" type="number" min="0" max="100" step="1" required aria-describedby="grid-help" />
          </label>
        </div>
        <label className="block text-sm font-medium">
          Direção inicial
          <select className={fieldClass} name="direction" defaultValue="NORTH">
            {Object.entries(directions).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={launching} className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-60">
          {launching ? "Lançando…" : "Lançar"}
        </button>
      </form>
      {error && <p role="alert" className="mt-4 text-red-800">{error}</p>}
      {probe && (
        <div role="status" className="mt-4 rounded-md bg-emerald-50 p-4 text-emerald-950">
          <p className="font-semibold">Sonda lançada.</p>
          <p className="break-all">ID: {probe.id}</p>
          <p>Posição: ({probe.x}, {probe.y}) · Direção: {directions[probe.direction]}</p>
        </div>
      )}
    </section>
  );
}
