# Orrery project tiers and lineage

Status: tiers resolved by a featured list; lineage parked. Updated 2026-10-17.

## Decision: a featured list instead of tiers

Every project rendered at the same weight, so flagship work and small utilities read as equals. Instead of a per-project `tier` field, `src/content/projects.yaml` has one ordered top-level `featured:` list.

- On the map, featured projects shine (a larger, breathing halo and a small cross-flare) and the rest glow faintly. No project labels are added at rest, because labels clutter the map.
- Under the map, the projects page lists the featured projects in the order written.
- Families (clusters) stay about what a project is. A "Featured" cluster was rejected because each project has one cluster and moving a project there would strip it of its family color and filter.

## Parked: superseded projects and lineage

Superseded projects stay off the map. Showing them by default would add about six nodes, roughly 18 tech links and a new kind of trail line, mostly in the densest middle of the map.

If lineage comes back, prefer this order of escalation:

1. A line in the successor's description ("Successor to Odyssey CLI").
2. An "Archive" chip in the cluster legend, off by default, plus "Evolved from" / "Superseded by" links in the project panel.
3. Lineage trails drawn only while a project is focused, never all at once.

Lineages on record:

- PolymerBase / PolymerFront (2023) → OdysseyFramework / odyssey-cli (2024) → odyssey (2025) → odyssey-cicd (2026)
- academics-wiki-framework → Corum
- python-telegram-bot-quiz → Go-Terraform-Telegram-Quiz-Bot
- NocturnalProject → algebananazzzzz.com
- Kubernetes Homelab (HomeLab + homelab-manifests, both archived) → homelab-ansible, homelab-komodo and homelab-windmill. One predecessor fans out to three successors, so any `supersededBy` field would need to accept a list.
