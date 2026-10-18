import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';
import { buildOrrery, type OrreryData } from './orrery';

type ProjectData = CollectionEntry<'projects'>['data'];

let cached: Promise<{ orrery: OrreryData; projects: ProjectData[] }> | undefined;

// Both / and /projects render the orrery; the layout runs once per build.
export function getOrrery() {
  cached ??= (async () => {
    const [projectEntries, clusterEntries, domainEntries] = await Promise.all([
      getCollection('projects'),
      getCollection('projectClusters'),
      getCollection('technologies'),
    ]);
    const projects = projectEntries.map((e: CollectionEntry<'projects'>) => e.data);
    const orrery = buildOrrery(
      projects.map((p: ProjectData) => ({ ...p, featured: p.featured !== undefined })),
      clusterEntries.map((e: CollectionEntry<'projectClusters'>) => ({ id: e.id, ...e.data })),
      domainEntries.map((e: CollectionEntry<'technologies'>) => ({ id: e.id, ...e.data })),
    );
    return { orrery, projects };
  })();
  return cached;
}
