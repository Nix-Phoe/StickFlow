import { describe, expect, it } from 'vitest';

import { createEventBus } from '../core/events';
import { connectIntents } from '../core/intents';
import { activeFrame } from '../core/selectors';
import { createInitialState, Store } from '../core/store';
import { createDefaultSkeleton, sortSkeleton } from '../model/skeleton';
import { connectPlayer, MAX_STEP_MS, type FrameScheduler } from './player';

/** Planificateur manuel : les rappels ne s'exécutent que lorsque le test fait avancer le temps. */
function createFakeScheduler() {
  let now = 0;
  let nextId = 1;
  const pending = new Map<number, () => void>();
  const scheduler: FrameScheduler = {
    request(callback) {
      const id = nextId++;
      pending.set(id, callback);
      return id;
    },
    cancel(id) {
      pending.delete(id);
    },
  };
  return {
    scheduler,
    now: () => now,
    pendingCount: () => pending.size,
    /** Avance le temps de `ms` puis exécute les rappels en attente (une image d'affichage). */
    advance(ms: number) {
      now += ms;
      const callbacks = [...pending.values()];
      pending.clear();
      callbacks.forEach((callback) => callback());
    },
  };
}

function setup() {
  const bus = createEventBus();
  const store = new Store(createInitialState('Test', sortSkeleton(createDefaultSkeleton())));
  const clock = createFakeScheduler();
  connectIntents(bus, store);
  connectPlayer({ bus, store, scheduler: clock.scheduler, now: clock.now });
  // Séquence de départ : 2 images clés + 3 frames générées = 5 frames ; à 10 IPS, une toutes les 100 ms.
  bus.emit('animation:fps:change', { fps: 10 });
  return { bus, store, clock, active: () => activeFrame(store.state)?.index };
}

describe('connectPlayer', () => {
  it('moves to the next frame once a frame duration has elapsed', () => {
    const { bus, clock, active } = setup();
    bus.emit('playback:play');
    clock.advance(50);
    expect(active()).toBe(0);
    clock.advance(50);
    expect(active()).toBe(1);
  });

  it('loops back to the first frame after the last one', () => {
    const { bus, clock, active } = setup();
    bus.emit('frame:select', { index: 4 });
    bus.emit('playback:play');
    clock.advance(100);
    expect(active()).toBe(0);
  });

  it('plays faster with the preview speed', () => {
    const { bus, clock, active } = setup();
    bus.emit('playback:speed:change', { speed: 2 });
    bus.emit('playback:play');
    clock.advance(50);
    expect(active()).toBe(1);
  });

  it('follows an fps change during playback', () => {
    const { bus, clock, active } = setup();
    bus.emit('playback:play');
    bus.emit('animation:fps:change', { fps: 20 });
    clock.advance(50);
    expect(active()).toBe(1);
  });

  it('stops advancing when paused, and stays on the current frame', () => {
    const { bus, clock, active } = setup();
    bus.emit('playback:play');
    clock.advance(100);
    bus.emit('playback:pause');
    clock.advance(500);
    expect(active()).toBe(1);
    expect(clock.pendingCount()).toBe(0);
  });

  it('returns to the frame where playback started on stop', () => {
    const { bus, store, clock, active } = setup();
    bus.emit('frame:select', { index: 2 });
    bus.emit('playback:play');
    clock.advance(100);
    clock.advance(100);
    expect(active()).toBe(4);
    bus.emit('playback:stop');
    expect(active()).toBe(2);
    expect(store.state.session.isPlaying).toBe(false);
  });

  it('does not jump far ahead after a long pause of the display (hidden tab)', () => {
    const { bus, clock, active } = setup();
    bus.emit('playback:play');
    clock.advance(10_000);
    expect(active()).toBe(Math.floor(MAX_STEP_MS / 100) % 5);
  });

  it('does not put playback in the undo history', () => {
    const { bus, store, clock } = setup();
    const before = store.state.project;
    bus.emit('playback:play');
    clock.advance(300);
    expect(store.state.project).toBe(before);
  });
});
