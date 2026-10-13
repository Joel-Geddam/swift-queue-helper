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
      [this.heap[i], this.heap[parent]] = [this.heap[parent], this.heap[i]];
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
        [this.heap[i], this.heap[smallest]] = [this.heap[smallest], this.heap[i]];
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
        [this.heap[i], this.heap[parent]] = [this.heap[parent], this.heap[i]];
        i = parent;
      }
      for (;;) {
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        let smallest = i;
        if (l < this.heap.length && higher(this.heap[l], this.heap[smallest])) smallest = l;
        if (r < this.heap.length && higher(this.heap[r], this.heap[smallest])) smallest = r;
        if (smallest === i) break;
        [this.heap[i], this.heap[smallest]] = [this.heap[smallest], this.heap[i]];
        i = smallest;
      }
    }
    return true;
  }
}
