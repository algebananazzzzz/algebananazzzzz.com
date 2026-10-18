import starmapRaw from '@/content/starmap-manifest.json';
import { collectQuotes, type StarmapInput } from './starmap';

/** The wiki's tip-callout quotes, shared by the meteors and the hero and footer mottos. */
export const quotes = collectQuotes(starmapRaw as StarmapInput);
