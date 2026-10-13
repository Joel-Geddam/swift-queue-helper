import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  PriorityQueue,
  TRIAGE_PRIORITY,
  type Patient,
  type TriageLevel,
} from "@/lib/priorityQueue";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MediQueue — Hospital Priority Queue System" },
      {
        name: "description",
        content: "Triage-based hospital patient queue powered by a binary-heap priority queue.",
      },
      { property: "og:title", content: "MediQueue — Hospital Priority Queue System" },
      {
        property: "og:description",
        content: "Check in patients, assign triage levels, and call the next patient by priority.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const STORAGE_KEY = "mediqueue-state-v1";

const levelStyles: Record<TriageLevel, string> = {
  emergency: "bg-emergency text-emergency-foreground",
  urgent: "bg-urgent text-urgent-foreground",
  standard: "bg-standard text-standard-foreground",
};

const levelLabel: Record<TriageLevel, string> = {
  emergency: "P1 · Emergency",
  urgent: "P2 · Urgent",
  standard: "P3 · Standard",
};

function waitTime(from: number, now: number) {
  const m = Math.floor((now - from) / 60000);
  return m < 1 ? "<1 min" : `${m} min`;
}

function Index() {
  const queueRef = useRef(new PriorityQueue());
  const [version, setVersion] = useState(0);
  const [current, setCurrent] = useState<Patient | null>(null);
  const [served, setServed] = useState<Patient[]>([]);
  const [ticket, setTicket] = useState(1);
  const [now, setNow] = useState(Date.now());
  const [loaded, setLoaded] = useState(false);

  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [condition, setCondition] = useState("");
  const [level, setLevel] = useState<TriageLevel>("standard");

  // Load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        (s.waiting as Patient[]).forEach((p) => queueRef.current.enqueue(p));
        setCurrent(s.current ?? null);
        setServed(s.served ?? []);
        setTicket(s.ticket ?? 1);
        setVersion((v) => v + 1);
      }
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ waiting: queueRef.current.toArray(), current, served, ticket }),
    );
  }, [version, current, served, ticket, loaded]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const waiting = useMemo(() => queueRef.current.sorted(), [version]);

  const counts = useMemo(() => {
    const c = { emergency: 0, urgent: 0, standard: 0 };
    waiting.forEach((p) => c[p.level]++);
    return c;
  }, [waiting]);

  function addPatient(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    queueRef.current.enqueue({
      id: crypto.randomUUID(),
      ticket,
      name: name.trim(),
      age: Number(age) || 0,
      condition: condition.trim() || "—",
      level,
      priority: TRIAGE_PRIORITY[level],
      arrivedAt: Date.now(),
      status: "waiting",
    });
    setTicket((t) => t + 1);
    setName("");
    setAge("");
    setCondition("");
    setLevel("standard");
    setVersion((v) => v + 1);
  }

  function callNext() {
    const next = queueRef.current.dequeue();
    if (current) setServed((s) => [{ ...current, status: "served" as const }, ...s].slice(0, 20));
    setCurrent(next ? { ...next, status: "called" } : null);
    setVersion((v) => v + 1);
  }

  function removePatient(id: string) {
    queueRef.current.remove(id);
    setVersion((v) => v + 1);
  }

  function resetAll() {
    if (!confirm("Clear all queue data?")) return;
    queueRef.current = new PriorityQueue();
    setCurrent(null);
    setServed([]);
    setTicket(1);
    setVersion((v) => v + 1);
  }

  const inputCls =
    "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-lg font-bold text-primary-foreground">
              +
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">MediQueue</h1>
              <p className="text-xs text-muted-foreground">Priority-based patient queue</p>
            </div>
          </div>
          <button
            onClick={resetAll}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
          >
            Reset
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-6 lg:grid-cols-[340px_1fr]">
        {/* Left column */}
        <div className="space-y-6">
          <form onSubmit={addPatient} className="space-y-3 rounded-lg border border-border bg-card p-5">
            <h2 className="font-semibold">Register patient</h2>
            <input className={inputCls} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
            <input className={inputCls} placeholder="Age" type="number" min={0} value={age} onChange={(e) => setAge(e.target.value)} />
            <input className={inputCls} placeholder="Symptoms / condition" value={condition} onChange={(e) => setCondition(e.target.value)} />
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Triage level</p>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(TRIAGE_PRIORITY) as TriageLevel[]).map((l) => (
                  <button
                    type="button"
                    key={l}
                    onClick={() => setLevel(l)}
                    className={`rounded-md px-2 py-2 text-xs font-medium capitalize transition ${
                      level === l ? levelStyles[l] : "bg-muted text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <button className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Add to queue
            </button>
          </form>

          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(counts) as TriageLevel[]).map((l) => (
              <div key={l} className="rounded-lg border border-border bg-card p-3 text-center">
                <div className={`mx-auto mb-1 h-1.5 w-8 rounded-full ${levelStyles[l]}`} />
                <div className="text-2xl font-semibold">{counts[l]}</div>
                <div className="text-xs capitalize text-muted-foreground">{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <section className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Now serving</p>
                {current ? (
                  <div className="mt-1 flex items-center gap-3">
                    <span className="text-3xl font-bold text-primary">#{current.ticket}</span>
                    <div>
                      <p className="font-semibold">{current.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {current.age ? `${current.age} yrs · ` : ""}
                        {current.condition}
                      </p>
                    </div>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${levelStyles[current.level]}`}>
                      {levelLabel[current.level]}
                    </span>
                  </div>
                ) : (
                  <p className="mt-1 text-muted-foreground">No patient being served</p>
                )}
              </div>
              <button
                onClick={callNext}
                disabled={!waiting.length && !current}
                className="shrink-0 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
              >
                {waiting.length ? "Call next →" : "Finish"}
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="font-semibold">Waiting queue</h2>
              <span className="text-xs text-muted-foreground">{waiting.length} patients · sorted by priority, then arrival</span>
            </div>
            {waiting.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">Queue is empty.</p>
            ) : (
              <ol className="divide-y divide-border">
                {waiting.map((p, i) => (
                  <li key={p.id} className="flex items-center gap-4 px-5 py-3">
                    <span className="w-6 text-sm text-muted-foreground">{i + 1}</span>
                    <span className="w-12 font-mono text-sm font-semibold">#{p.ticket}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {p.age ? `${p.age} yrs · ` : ""}
                        {p.condition}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">{waitTime(p.arrivedAt, now)}</span>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${levelStyles[p.level]}`}>
                      {levelLabel[p.level]}
                    </span>
                    <button
                      onClick={() => removePatient(p.id)}
                      className="text-xs text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${p.name}`}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {served.length > 0 && (
            <section className="rounded-lg border border-border bg-card">
              <h2 className="border-b border-border px-5 py-3 font-semibold">Recently served</h2>
              <ul className="divide-y divide-border">
                {served.map((p) => (
                  <li key={p.id} className="flex items-center gap-4 px-5 py-2 text-sm text-muted-foreground">
                    <span className="w-12 font-mono">#{p.ticket}</span>
                    <span className="flex-1">{p.name}</span>
                    <span className="capitalize">{p.level}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
