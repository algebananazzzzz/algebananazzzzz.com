import { defineCollection, z } from 'astro:content';
import { file } from 'astro/loaders';
import { load } from 'js-yaml';

const StarType = z.enum([
  'neutron',
  'giant',
  'subgiant',
  'mainseq',
  'protostar',
  'whitedwarf',
  'dwarf',
  'kmain',
  'gmain',
  'bgiant',
  'blackhole',
]);

const projectSchema = z.object({
  id: z.string(),
  title: z.string(),
  tagline: z.string(),
  tech: z.array(z.string()),
  summary: z.string(),
  bullets: z.array(z.string()).optional(),
  date: z.string(),
  cluster: z.string(),
  href: z.string().url().optional(),
  magnitude: z.number().positive(),
});
const clusterSchema = z.object({ color: z.string().min(1) });
const projectFileSchema = z.object({
  clusters: z.record(
    z.string(),
    clusterSchema.extend({
      projects: z.array(projectSchema.omit({ cluster: true })).default([]),
    }),
  ),
});

const projects = defineCollection({
  loader: file('src/content/projects.yaml', {
    parser: (text) =>
      Object.entries(projectFileSchema.parse(load(text)).clusters).flatMap(([cluster, config]) =>
        config.projects.map((project) => ({ ...project, cluster })),
      ),
  }),
  schema: projectSchema,
});

const projectClusters = defineCollection({
  loader: file('src/content/projects.yaml', {
    parser: (text) =>
      Object.fromEntries(
        Object.entries(projectFileSchema.parse(load(text)).clusters).map(([id, config]) => [
          id,
          { color: config.color },
        ]),
      ),
  }),
  schema: clusterSchema,
});

const experience = defineCollection({
  loader: file('src/content/experience.yaml'),
  schema: z.object({
    id: z.string(),
    date: z.string(),
    role: z.string(),
    org: z.string(),
    summary: z.string(),
    bullets: z.array(z.string()).optional(),
    tags: z.array(z.string()),
    star: StarType,
  }),
});

export const collections = { projects, projectClusters, experience };
