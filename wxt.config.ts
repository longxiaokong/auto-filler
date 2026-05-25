import { defineConfig } from 'wxt';

export default defineConfig({
  webExt: {
    binaries: {
      chrome: '/Applications/Tabbit.app/Contents/MacOS/Tabbit',
    },
  },
  manifest: {
    name: 'Auto Filler',
    permissions: ['storage', 'activeTab', 'scripting'],
    host_permissions: ['<all_urls>'],
  },
});