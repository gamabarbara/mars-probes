import { useState } from "react";
import { LaunchForm } from "./components/LaunchForm.jsx";
import { ProbeList } from "./components/ProbeList.jsx";

export function App() {
  const [launchCount, setLaunchCount] = useState(0);

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <h1 className="mb-6 text-3xl font-bold">Mars Probes</h1>
      <div className="space-y-6">
        <LaunchForm onLaunched={() => setLaunchCount((count) => count + 1)} />
        <ProbeList launchCount={launchCount} />
      </div>
    </main>
  );
}
