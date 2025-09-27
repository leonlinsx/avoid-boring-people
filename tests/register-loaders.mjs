import { register } from 'node:module';

await register('./astro-content-loader.mjs', import.meta.url);
