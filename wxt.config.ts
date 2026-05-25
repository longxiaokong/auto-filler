import { defineConfig } from 'wxt';

export default defineConfig({
  runner: {
    chromiumProfile: '.chrome-profile',
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
