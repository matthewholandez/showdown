"use client";

import { useEffect, useState } from "react";

type Model = { id: string; label: string };
type EvalMode = "contains" | "exact" | "regex";

type EvalResponse = {
  response: string;
  passed: boolean;
  tokens: { prompt: number; completion: number; total: number };
  eval_mode: EvalMode;
};

type CardState =
  | { state: "loading" }
  | { state: "done"; data: EvalResponse }
  | { state: "error"; error: string };

const MODES: EvalMode[] = ["contains", "exact", "regex"];

export default function Home() {
  const [models, setModels] = useState<Model[]>([]);
  const [pendingId, setPendingId] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [systemPrompt, setSystemPrompt] = useState("You are a terse oracle. Answer in one short sentence.");
  const [userInput, setUserInput] = useState("What is the capital of France?");
  const [expected, setExpected] = useState("Paris");
  const [mode, setMode] = useState<EvalMode>("contains");
  const [hasRun, setHasRun] = useState(false);
  const [results, setResults] = useState<Record<string, CardState>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((data: { models: Model[] }) => {
        const sorted = [...data.models].sort((a, b) =>
          a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
        );
        setModels(sorted);
        if (sorted[0]) setPendingId(sorted[0].id);
      })
      .catch(() => setError("couldn't reach the backend"));
  }, []);

  const anyLoading = Object.values(results).some((r) => r.state === "loading");

  function addModel() {
    if (!pendingId || selectedIds.includes(pendingId)) return;
    setSelectedIds((prev) => [...prev, pendingId]);
  }

  function removeModel(id: string) {
    setSelectedIds((prev) => prev.filter((m) => m !== id));
    setResults((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function fireFor(ids: string[]) {
    if (ids.length === 0) return;
    setHasRun(true);
    setError(null);
    setResults((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = { state: "loading" };
      return next;
    });

    ids.forEach((id) => {
      fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt, userInput, expected, modelId: id, evalMode: mode }),
      })
        .then(async (res) => {
          if (!res.ok) throw new Error(`http ${res.status}`);
          const data: EvalResponse = await res.json();
          setResults((prev) => ({ ...prev, [id]: { state: "done", data } }));
        })
        .catch((err) => {
          setResults((prev) => ({
            ...prev,
            [id]: { state: "error", error: err instanceof Error ? err.message : "unknown error" },
          }));
        });
    });
  }

  async function run(e: React.FormEvent) {
    e.preventDefault();
    fireFor(selectedIds);
  }

  const untestedIds = selectedIds.filter(
    (id) => !results[id] || results[id].state === "error"
  );

  function labelFor(id: string) {
    return models.find((m) => m.id === id)?.label ?? id;
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
            <div className="label mb-1">models</div>
            <div className="flex items-center gap-2">
              <select
                className="field flex-1"
                value={pendingId}
                onChange={(e) => setPendingId(e.target.value)}
                disabled={!models.length}
                suppressHydrationWarning
              >
                {!models.length && <option>loading…</option>}
                {models.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
              <button
                type="button"
                className="add-btn"
                onClick={addModel}
                disabled={!pendingId || selectedIds.includes(pendingId)}
              >
                add
              </button>
            </div>
            {selectedIds.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {selectedIds.map((id) => (
                  <span key={id} className="chip">
                    {labelFor(id)}
                    <button type="button" onClick={() => removeModel(id)} aria-label={`remove ${labelFor(id)}`}>×</button>
                  </span>
                ))}
              </div>
            )}
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
            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="submit"
                disabled={anyLoading || selectedIds.length === 0}
                suppressHydrationWarning
              >
                {anyLoading ? "running…" : hasRun ? "run all" : "run"}
              </button>
              {hasRun && untestedIds.length > 0 && (
                <button
                  type="button"
                  className="add-btn"
                  onClick={() => fireFor(untestedIds)}
                  disabled={anyLoading}
                >
                  run untested ({untestedIds.length})
                </button>
              )}
            </div>
            {error && <span className="text-accent text-xs">{error}</span>}
          </div>
        </form>

        {hasRun && (
          <aside className="md:sticky md:top-16 md:self-start space-y-6">
            <div className="label">results</div>
            {selectedIds.map((id) => {
              const r = results[id];
              return (
                <div key={id} className="fade border-b border-line pb-5 last:border-0">
                  <div className="text-muted text-[11px] mb-2 truncate">{labelFor(id)}</div>
                  {!r ? (
                    <div className="text-muted italic font-serif">not run</div>
                  ) : r.state === "loading" ? (
                    <div className="text-muted italic font-serif">running…</div>
                  ) : r.state === "error" ? (
                    <div className="text-accent text-sm">{r.error}</div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-3">
                        <span
                          className="dot"
                          style={{ background: r.data.passed ? "var(--ink)" : "var(--accent)" }}
                        />
                        <span className="font-serif italic text-lg">
                          {r.data.passed ? "passed" : "failed"}
                        </span>
                        <span className="text-muted text-xs ml-auto">
                          {r.data.eval_mode} · {r.data.tokens.total} tokens
                          <span className="text-muted/70"> ({r.data.tokens.prompt}+{r.data.tokens.completion})</span>
                        </span>
                      </div>
                      <pre className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">
{r.data.response}
                      </pre>
                    </>
                  )}
                </div>
              );
            })}
          </aside>
        )}
      </div>
    </main>
  );
}
