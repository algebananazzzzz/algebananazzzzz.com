import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import yaml from '@rollup/plugin-yaml';

export default defineConfig({
  site: process.env.SITE_URL || 'https://algebananazzzzz.com',
  base: '/',
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [react(), mdx(), sitemap()],
  vite: {
    plugins: [yaml(), tailwindcss()],
    css: { modules: { localsConvention: 'camelCase' } },
  },
  build: { inlineStylesheets: 'auto' },
});
