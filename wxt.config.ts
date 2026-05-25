import { defineConfig } from 'wxt';
import { existsSync } from 'node:fs';

function findChrome(): string {
  const candidates = [
    '/Applications/Tabbit.app/Contents/MacOS/Tabbit',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Arc.app/Contents/MacOS/Arc',
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return '';
}

export default defineConfig({
  webExt: {
    ...(findChrome() && {
      binaries: { chrome: findChrome() },
    }),
  },
  manifest: {
    name: 'Auto Filler',
    permissions: ['storage', 'activeTab', 'scripting'],
    host_permissions: ['<all_urls>'],
  },
  hooks: {
    'build:manifestGenerated': (_wxt, manifest) => {
      if (manifest.options_ui) {
        manifest.options_ui.open_in_tab = true;
      }
    },
  },
});
