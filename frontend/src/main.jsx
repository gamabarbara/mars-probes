import { createRoot } from "react-dom/client";
import "./styles.css";

function App() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-3xl font-bold">Mars Probes</h1>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
