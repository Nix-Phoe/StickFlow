import { describe, expect, it } from 'vitest';

import { createInstaller, installMode, isIosDevice } from './install';

describe('installMode', () => {
  it('is "installed" in the installed app, whatever else is known', () => {
    expect(installMode({ standalone: true, ios: true, promptAvailable: true })).toBe('installed');
  });

  it('offers the browser prompt when there is one, the iOS explanation otherwise', () => {
    expect(installMode({ standalone: false, ios: false, promptAvailable: true })).toBe('prompt');
    expect(installMode({ standalone: false, ios: true, promptAvailable: false })).toBe('ios');
    expect(installMode({ standalone: false, ios: false, promptAvailable: false })).toBe('unavailable');
  });
});

describe('isIosDevice', () => {
  it('recognises iPhone, iPad and the iPad that says it is a Mac', () => {
    expect(isIosDevice({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', maxTouchPoints: 5 })).toBe(true);
    expect(isIosDevice({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', maxTouchPoints: 5 })).toBe(true);
    expect(isIosDevice({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', maxTouchPoints: 0 })).toBe(false);
    expect(isIosDevice({ userAgent: 'Mozilla/5.0 (Linux; Android 15) Chrome/140', maxTouchPoints: 5 })).toBe(false);
  });
});

/** Faux `window` : événements d'installation et mode d'affichage. */
function fakeWindow({ standalone = false } = {}) {
  const target = new EventTarget();
  return Object.assign(target, {
    matchMedia: (query: string) => ({ matches: standalone && query.includes('standalone') }),
    navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/140', maxTouchPoints: 0 },
  });
}

/** Faux `beforeinstallprompt`, avec le choix de l'utilisateur. */
function promptEvent(outcome: 'accepted' | 'dismissed') {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }>; prompted: boolean };
  event.prompted = false;
  event.prompt = async () => {
    event.prompted = true;
  };
  event.userChoice = Promise.resolve({ outcome });
  return event;
}

describe('createInstaller', () => {
  it('keeps the browser install prompt for later, and shows it on demand', async () => {
    const win = fakeWindow();
    const installer = createInstaller(win);
    const modes: string[] = [];
    installer.subscribe((mode) => modes.push(mode));
    expect(installer.mode()).toBe('unavailable');

    const event = promptEvent('accepted');
    win.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(installer.mode()).toBe('prompt');

    expect(await installer.prompt()).toBe(true);
    expect(event.prompted).toBe(true);
    // Le prompt ne sert qu'une fois ; l'installation finie, l'app est installée.
    win.dispatchEvent(new Event('appinstalled'));
    expect(installer.mode()).toBe('installed');
    expect(modes).toEqual(['prompt', 'unavailable', 'installed']);
  });

  it('does nothing when there is no prompt to show', async () => {
    expect(await createInstaller(fakeWindow()).prompt()).toBe(false);
  });

  it('knows the app is already installed when it runs standalone', () => {
    expect(createInstaller(fakeWindow({ standalone: true })).mode()).toBe('installed');
  });
});
