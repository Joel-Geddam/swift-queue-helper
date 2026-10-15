/**
 * Binary min-heap priority queue for hospital triage.
 * Lower priority number = seen first. Ties broken by arrival order (FIFO).
 */

export type TriageLevel = "emergency" | "urgent" | "standard";

export const TRIAGE_PRIORITY: Record<TriageLevel, number> = {
  emergency: 1,
  urgent: 2,
  standard: 3,
};

/**
 * Symptom screening. Certain words in the reported condition are clinical
 * red flags, so they lift a patient up the queue regardless of the triage
 * level the desk picked. Only the highest tier matched counts — listing five
 * mild symptoms can never outrank one critical sign.
 */
export type SymptomTier = "critical" | "urgent" | "mild";

const SYMPTOM_KEYWORDS: Record<SymptomTier, string[]> = {
  critical: [
    "cardiac arrest",
    "not breathing",
    "no pulse",
    "unconscious",
    "unresponsive",
    "stopped breathing",
    "choking",
    "severe bleeding",
    "heavy bleeding",
    "hemorrhage",
    "haemorrhage",
    "seizure",
    "convulsion",
    "anaphylaxis",
    "blue lips",
    "cyanosis",
    "overdose",
    "poisoning",
    "suicidal",
    "self-harm",
    "head injury",
    "stroke",
    "gasping",
    "crushing pain",
  ],
  urgent: [
    "chest pain",
    "difficulty breathing",
    "shortness of breath",
    "breathless",
    "high fever",
    "vomiting blood",
    "blood in stool",
    "fracture",
    "broken bone",
    "severe pain",
    "dehydration",
    "confusion",
    "slurred speech",
    "face drooping",
    "abdominal pain",
    "pregnant",
    "snake bite",
    "dog bite",
    "burn",
    "deep cut",
    "fainted",
    "fainting",
    "palpitations",
  ],
  mild: [
    "cough",
    "cold",
    "sore throat",
    "fever",
    "headache",
    "rash",
    "nausea",
    "diarrhea",
    "diarrhoea",
    "mild pain",
    "sprain",
    "checkup",
    "check-up",
    "follow-up",
    "prescription",
    "refill",
    "dizziness",
    "back pain",
    "toothache",
  ],
};

/** Points subtracted from the triage score — higher means more pressing. */
const TIER_BOOST: Record<SymptomTier, number> = { critical: 180, urgent: 80, mild: 20 };

export interface SymptomFlag {
  tier: SymptomTier;
  matched: string[];
  boost: number;
}

/** Highest-severity tier whose keywords appear in the text, or null. */
export function analyseSymptoms(text: string): SymptomFlag | null {
  const t = ` ${text.toLowerCase()} `;
  for (const tier of ["critical", "urgent", "mild"] as SymptomTier[]) {
    const matched = SYMPTOM_KEYWORDS[tier].filter((k) => t.includes(k));
    if (matched.length) return { tier, matched, boost: TIER_BOOST[tier] };
  }
  return null;
}

/**
 * priority = (triage level × 100) − symptom boost − wait boost.  Lower is seen sooner.
 * e.g. emergency+unresponsive = 100−180 = −80  ·  urgent = 200  ·  standard = 300
 */
export function computePriority(level: TriageLevel, condition: string): number {
  return TRIAGE_PRIORITY[level] * 100 - (analyseSymptoms(condition)?.boost ?? 0);
}

/**
 * Waiting time also counts: a patient earns 2 points per minute waited,
 * capped at 80 so a long wait can never overtake a higher triage level
 * (levels sit 100 points apart).
 */
export const WAIT_BONUS_PER_MIN = 2;
export const WAIT_BONUS_CAP = 80;

export function waitBoost(arrivedAt: number, now: number): number {
  const mins = Math.max(0, Math.floor((now - arrivedAt) / 60000));
  return Math.min(WAIT_BONUS_CAP, mins * WAIT_BONUS_PER_MIN);
}

/** Priority including the wait bonus for a given moment in time. */
export function effectivePriority(p: Patient, now: number): number {
  return p.priority - waitBoost(p.arrivedAt, now);
}


export interface Patient {
  id: string;
  ticket: number;
  name: string;
  age: number;
  condition: string;
  level: TriageLevel;
  priority: number;
  arrivedAt: number; // timestamp, used as FIFO tiebreaker
  status: "waiting" | "called" | "served";
}

function higher(a: Patient | undefined, b: Patient | undefined): boolean {
  if (!a) return false;
  if (!b) return true;
  if (a.priority !== b.priority) return a.priority < b.priority;
  return a.arrivedAt < b.arrivedAt;
}

export class PriorityQueue {
  private heap: Patient[] = [];

  get size(): number {
    return this.heap.length;
  }

  peek(): Patient | undefined {
    return this.heap[0];
  }

  toArray(): Patient[] {
    return [...this.heap];
  }

  /** Sorted snapshot (does not mutate the heap). */
  sorted(): Patient[] {
    const copy = new PriorityQueue();
    copy.heap = [...this.heap];
    const out: Patient[] = [];
    while (copy.size > 0) out.push(copy.dequeue()!);
    return out;
  }

  enqueue(patient: Patient): void {
    this.heap.push(patient);
    let i = this.heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!higher(this.heap[i], this.heap[parent])) break;
      [this.heap[i], this.heap[parent]] = [this.heap[parent]!, this.heap[i]!];
      i = parent;
    }
  }

  dequeue(): Patient | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop() as Patient;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        let smallest = i;
        if (l < this.heap.length && higher(this.heap[l], this.heap[smallest])) smallest = l;
        if (r < this.heap.length && higher(this.heap[r], this.heap[smallest])) smallest = r;
        if (smallest === i) break;
        [this.heap[i], this.heap[smallest]] = [this.heap[smallest]!, this.heap[i]!];
        i = smallest;
      }
    }
    return top;
  }

  remove(id: string): boolean {
    const idx = this.heap.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    const last = this.heap.pop() as Patient;
    if (idx < this.heap.length) {
      this.heap[idx] = last;
      // Restore heap property in both directions.
      let i = idx;
      while (i > 0) {
        const parent = (i - 1) >> 1;
        if (!higher(this.heap[i], this.heap[parent])) break;
        [this.heap[i], this.heap[parent]] = [this.heap[parent]!, this.heap[i]!];
        i = parent;
      }
      for (;;) {
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        let smallest = i;
        if (l < this.heap.length && higher(this.heap[l], this.heap[smallest])) smallest = l;
        if (r < this.heap.length && higher(this.heap[r], this.heap[smallest])) smallest = r;
        if (smallest === i) break;
        [this.heap[i], this.heap[smallest]] = [this.heap[smallest]!, this.heap[i]!];
        i = smallest;
      }
    }
    return true;
  }

  /**
   * Fold the current wait bonus into every patient's priority and rebuild
   * the heap. Call before dequeueing or rendering so long-waiting patients
   * move up. Base score is recomputed from level+condition first, so this
   * is idempotent.
   */
  rescore(now: number): void {
    for (const p of this.heap) {
      p.priority = computePriority(p.level, p.condition) - waitBoost(p.arrivedAt, now);
    }
    // Heapify bottom-up.
    for (let i = (this.heap.length >> 1) - 1; i >= 0; i--) {
      let j = i;
      for (;;) {
        const l = 2 * j + 1;
        const r = 2 * j + 2;
        let smallest = j;
        if (l < this.heap.length && higher(this.heap[l], this.heap[smallest])) smallest = l;
        if (r < this.heap.length && higher(this.heap[r], this.heap[smallest])) smallest = r;
        if (smallest === j) break;
        [this.heap[j], this.heap[smallest]] = [this.heap[smallest]!, this.heap[j]!];
        j = smallest;
      }
    }
  }
}
