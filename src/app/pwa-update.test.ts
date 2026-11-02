import { describe, expect, it } from 'vitest';

import { createUpdateController } from './pwa-update';

/** Faux `registerSW` de vite-plugin-pwa : garde les rappels, note les mises à jour demandées. */
function fakeRegister() {
  const log: string[] = [];
  let needRefresh: () => void = () => undefined;
  const register = (options: { onNeedRefresh?: () => void }) => {
    needRefresh = options.onNeedRefresh ?? (() => undefined);
    return async (reload?: boolean) => {
      log.push(`update ${String(reload)}`);
    };
  };
  return { register, log, newVersion: () => needRefresh() };
}

describe('createUpdateController', () => {
  it('announces a new version instead of reloading', () => {
    const { register, log, newVersion } = fakeRegister();
    const updates = createUpdateController({ register, save: async () => undefined });
    const seen: boolean[] = [];
    updates.subscribe((available) => seen.push(available));
    newVersion();
    expect(seen).toEqual([true]);
    expect(log).toEqual([]);
  });

  it('saves the open project before switching to the new version', async () => {
    const { register, log, newVersion } = fakeRegister();
    const updates = createUpdateController({
      register,
      save: async () => {
        log.push('save');
      },
    });
    newVersion();
    await updates.apply();
    expect(log).toEqual(['save', 'update true']);
  });

  it('still updates when the save fails (the saved projects are untouched)', async () => {
    const { register, log, newVersion } = fakeRegister();
    const updates = createUpdateController({
      register,
      save: async () => {
        throw new Error('quota');
      },
    });
    newVersion();
    await updates.apply();
    expect(log).toEqual(['update true']);
  });

  it('can be put off until later', () => {
    const { register, newVersion } = fakeRegister();
    const updates = createUpdateController({ register, save: async () => undefined });
    const seen: boolean[] = [];
    updates.subscribe((available) => seen.push(available));
    newVersion();
    updates.dismiss();
    expect(seen).toEqual([true, false]);
  });
});
