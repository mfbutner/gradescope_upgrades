import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Gradescope Upgrades',
    permissions: ['storage'],
  },
  webExt: { disabled: true }, // stops WXT from trying to auto-launch a browser from WSL
});