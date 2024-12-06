import { defineConfig } from 'astro/config'; // import lit from '@astrojs/lit';

import unocss from "@unocss/astro";
import presetWind from "@unocss/preset-wind";
import { presetAttributify, presetTypography } from 'unocss';
import presetTagify from '@unocss/preset-tagify';

import db from "@astrojs/db"; // https://astro.build/config

import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: "https://astro-minimal-starter.netlify.app/",
  integrations: [unocss({
    presets: [presetWind(), presetAttributify({
      /* preset options */
    }), presetTagify({
      /* options */
    }), presetTypography()],
    safelist: [
      /* this you can use to exclude utilities from purge */
    ]
  }), db(), sitemap()]
});