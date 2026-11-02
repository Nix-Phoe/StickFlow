import { describe, expect, it } from 'vitest';

import { collectLicenses } from './licenses';

describe('collectLicenses', () => {
  const licenses = collectLicenses(process.cwd(), ['fflate', 'workbox-window']);

  it('lists the bundled libraries and their dependencies, sorted, with their license text', () => {
    const names = licenses.map((entry) => entry.name);
    expect(names).toEqual([...names].sort());
    expect(names).toContain('workbox-core');
    const fflate = licenses.find((entry) => entry.name === 'fflate');
    expect(fflate).toMatchObject({ license: 'MIT', author: 'Arjun Barrett' });
    expect(fflate?.text).toContain('Permission is hereby granted');
  });

  it('leaves out type-only packages, which ship no code', () => {
    expect(licenses.some((entry) => entry.name.startsWith('@types/'))).toBe(false);
  });
});
