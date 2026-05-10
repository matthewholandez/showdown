"use client";

import { useEffect, useMemo, useState } from "react";

type Model = { id: string; label: string };
type EvalMode = "contains" | "exact" | "regex";

type EvalResponse = {
  response: string;
  passed: boolean;
  tokens: { prompt: number; completion: number; total: number };
  eval_mode: EvalMode;
};

const MODES: EvalMode[] = ["contains", "exact", "regex"];

export default function Home() {
  const [models, setModels] = useState<Model[]>([]);
  const [modelId, setModelId] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("You are a terse oracle. Answer in one short sentence.");
  const [userInput, setUserInput] = useState("What is the capital of France?");
  const [expected, setExpected] = useState("Paris");
  const [mode, setMode] = useState<EvalMode>("contains");
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [result, setResult] = useState<EvalResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((data: { models: Model[] }) => {
        const sorted = [...data.models].sort((a, b) =>
          a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
        );
        setModels(sorted);
        if (sorted[0]) setModelId(sorted[0].id);
      })
      .catch(() => setError("couldn't reach the backend"));
  }, []);

  const selected = useMemo(() => models.find((m) => m.id === modelId), [models, modelId]);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!modelId) return;
    setLoading(true);
    setHasRun(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt, userInput, expected, modelId, evalMode: mode }),
      });
      if (!res.ok) throw new Error(`http ${res.status}`);
      setResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className={`mx-auto px-6 py-16 transition-[max-width] duration-500 ease-out ${
        hasRun ? "max-w-5xl" : "max-w-xl"
      }`}
    >
      <header className="flex items-baseline justify-between mb-12">
        <h1 className="font-serif italic text-3xl leading-none">showdown</h1>
        <span className="text-muted text-xs">model evaluation</span>
      </header>

      <div className={`grid gap-12 ${hasRun ? "md:grid-cols-2" : "grid-cols-1"}`}>
        <form onSubmit={run} className="space-y-7" suppressHydrationWarning>
          <div>
            <div className="label mb-1">model</div>
            <select
              className="field"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              disabled={!models.length}
              suppressHydrationWarning
            >
              {!models.length && <option>loading…</option>}
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            {selected && <div className="text-muted text-[11px] mt-1 truncate">{selected.id}</div>}
          </div>

          <div>
            <div className="label mb-2">system prompt</div>
            <textarea
              className="block"
              rows={6}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
            />
          </div>

          <div>
            <div className="label mb-2">user input</div>
            <textarea
              className="block"
              rows={5}
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
            />
          </div>

          <div>
            <div className="label mb-1">expected</div>
            <input
              className="field"
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-5">
            <span className="label">mode</span>
            {MODES.map((m) => (
              <button
                key={m}
                type="button"
                data-on={mode === m}
                onClick={() => setMode(m)}
                className="mode text-sm"
              >
                {m}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            <button type="submit" className="submit" disabled={loading || !modelId} suppressHydrationWarning>
              {loading ? "running…" : "run"}
            </button>
            {error && <span className="text-accent text-xs">{error}</span>}
          </div>
        </form>

        {hasRun && (
          <aside className="fade md:sticky md:top-16 md:self-start">
            <div className="label mb-3">result</div>
            {loading && (
              <div className="text-muted italic font-serif text-lg">running…</div>
            )}
            {!loading && error && (
              <div className="text-accent text-sm">{error}</div>
            )}
            {!loading && result && (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <span
                    className="dot"
                    style={{ background: result.passed ? "var(--ink)" : "var(--accent)" }}
                  />
                  <span className="font-serif italic text-xl">
                    {result.passed ? "passed" : "failed"}
                  </span>
                  <span className="text-muted text-xs ml-auto">
                    {result.eval_mode} · {result.tokens.total} tokens
                    <span className="text-muted/70"> ({result.tokens.prompt}+{result.tokens.completion})</span>
                  </span>
                </div>
                <pre className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">
{result.response}
                </pre>
              </>
            )}
          </aside>
        )}
      </div>
    </main>
  );
}
