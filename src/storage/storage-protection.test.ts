import { describe, expect, it } from 'vitest';

import { createProjectLibrary } from './library';
import { createMemoryStore } from './memory-store';
import { createStorageProtection, protectOnSave } from './storage-protection';
import { testProject } from '../test/fixtures';

/** Faux `navigator.storage` : note les demandes, accorde ou non la protection. */
function fakeManager({ persisted = false, grant = true } = {}) {
  const calls: string[] = [];
  let state = persisted;
  return {
    calls,
    manager: {
      persisted: async () => {
        calls.push('persisted');
        return state;
      },
      persist: async () => {
        calls.push('persist');
        state = grant;
        return state;
      },
    },
  };
}

describe('createStorageProtection', () => {
  it('reports whether the browser keeps the data protected, or null when it cannot tell', async () => {
    expect(await createStorageProtection(fakeManager({ persisted: true }).manager).status()).toBe(true);
    expect(await createStorageProtection(fakeManager().manager).status()).toBe(false);
    expect(await createStorageProtection(undefined).status()).toBeNull();
  });

  it('asks the browser once, and not at all when the storage is already protected', async () => {
    const asked = fakeManager();
    const protection = createStorageProtection(asked.manager);
    expect(await protection.request()).toBe(true);
    expect(await protection.request()).toBe(true);
    expect(asked.calls.filter((call) => call === 'persist')).toHaveLength(1);

    const already = fakeManager({ persisted: true });
    await createStorageProtection(already.manager).request();
    expect(already.calls).not.toContain('persist');
  });

  it('can be asked again on demand (button in the settings) after a refusal', async () => {
    const refused = fakeManager({ grant: false });
    const protection = createStorageProtection(refused.manager);
    expect(await protection.request()).toBe(false);
    expect(await protection.request()).toBe(false);
    expect(await protection.request({ force: true })).toBe(false);
    expect(refused.calls.filter((call) => call === 'persist')).toHaveLength(2);
  });
});

describe('protectOnSave', () => {
  it('asks for protection after the first project is saved', async () => {
    const { manager, calls } = fakeManager();
    const library = protectOnSave(createProjectLibrary(createMemoryStore()), createStorageProtection(manager));
    expect(calls).toEqual([]);
    await library.save(testProject());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(calls).toContain('persist');
  });
});
