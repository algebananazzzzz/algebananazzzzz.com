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
  cluster: z.string(),
  name: z.string(),
  title: z.string(),
  tech: z.array(z.string()).min(1),
  description: z.string(),
  date: z.string().optional(),
  href: z.string().url().optional(),
});
const clusterSchema = z.object({ label: z.string().min(1), color: z.string().min(1) });
const projectFileSchema = z.object({
  clusters: z.record(z.string(), clusterSchema),
  featured: z.array(z.string()),
  projects: z.array(projectSchema),
});

// The featured list lives at the top of the file so its order is easy to edit;
// each project carries its position in that list as `featured`.
const projects = defineCollection({
  loader: file('src/content/projects.yaml', {
    parser: (text) => {
      const f = projectFileSchema.parse(load(text));
      const ids = new Set(f.projects.map((p) => p.id));
      const unknown = f.featured.filter((id) => !ids.has(id));
      if (unknown.length) throw new Error(`Unknown featured project(s): ${unknown.join(', ')}.`);
      return f.projects.map((p) => {
        const rank = f.featured.indexOf(p.id);
        return rank < 0 ? p : { ...p, featured: rank };
      });
    },
  }),
  schema: projectSchema.extend({ featured: z.number().int().nonnegative().optional() }),
});

const projectClusters = defineCollection({
  loader: file('src/content/projects.yaml', {
    parser: (text) => projectFileSchema.parse(load(text)).clusters,
  }),
  schema: clusterSchema,
});

const technologySchema = z.object({
  label: z.string().min(1),
  tint: z.string().min(1),
  techs: z.record(z.string(), z.string().min(1)),
});

const technologies = defineCollection({
  loader: file('src/content/technologies.yaml', {
    parser: (text) =>
      z.object({ domains: z.record(z.string(), technologySchema) }).parse(load(text)).domains,
  }),
  schema: technologySchema,
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

export const collections = { projects, projectClusters, technologies, experience };
