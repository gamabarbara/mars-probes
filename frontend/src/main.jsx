import { createRoot } from "react-dom/client";
import { LaunchForm } from "./LaunchForm.jsx";
import "./styles.css";

function App() {
  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <h1 className="mb-6 text-3xl font-bold">Mars Probes</h1>
      <LaunchForm />
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
