import { Actor, Persisted } from 'terse-sdk/actor';

// These are genuine Terse actors. One assignment is the atomic persistence
// boundary; plain nested mutations must never be mistaken for durable writes.
export class ParticipantState extends Actor {
  @Persisted private document = '';

  async read(initial: string): Promise<string> {
    if (!this.document) this.document = initial;
    return this.document;
  }

  async compareAndSet(expected: number, next: string): Promise<string> {
    const current = this.document ? JSON.parse(this.document) : { revision: 0 };
    const parsed = JSON.parse(next);
    if (current.revision !== expected || parsed.revision !== expected + 1) throw new Error('CG409: Workspace changed. Refresh and retry.');
    this.document = next;
    return next;
  }
}

export class NegotiationState extends Actor {
  @Persisted private document = '';

  async read(initial: string): Promise<string> {
    if (!this.document) this.document = initial;
    return this.document;
  }

  async compareAndSet(expected: number, next: string): Promise<string> {
    const current = this.document ? JSON.parse(this.document) : { revision: 0 };
    const parsed = JSON.parse(next);
    if (current.revision !== expected || parsed.revision !== expected + 1) throw new Error('CG409: Workspace changed. Refresh and retry.');
    this.document = next;
    return next;
  }
}

// Pairing codes and call capabilities never enter the browser's workspace view.
export class PhoneDirectoryState extends Actor {
  @Persisted private document = '';
  async read(initial: string): Promise<string> {
    if (!this.document) this.document = initial;
    return this.document;
  }
  async compareAndSet(expected: number, next: string): Promise<string> {
    const current = this.document ? JSON.parse(this.document) : { revision: 0 };
    const parsed = JSON.parse(next);
    if (current.revision !== expected || parsed.revision !== expected + 1) throw new Error('CG409: Workspace changed. Refresh and retry.');
    this.document = next;
    return next;
  }
}
