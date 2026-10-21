import { ProjectType, ReportType } from "../types";

type ProjectForNarrativeMigration = Omit<ProjectType, "narratives"> & {
  narratives?: ReportType[];
};

export function ensureProjectHasNarratives(
  project: ProjectForNarrativeMigration,
): ProjectType {
  if (project.reports && Array.isArray(project.reports)) {
    return project as ProjectType;
  }

  return {
    ...project,
    reports: [],
  } as ProjectType;
}

export function addSampleNarrativeIfEmpty(
  project: ProjectForNarrativeMigration,
): ProjectType {
  const migratedProject = ensureProjectHasNarratives(project);

  if (migratedProject.reports.length > 0) {
    return migratedProject;
  }

  const timelineId =
    migratedProject.timelines.length > 0
      ? migratedProject.timelines[0].id
      : null;

  const characterIds = migratedProject.characters
    .slice(0, 2)
    .map((char) => char.id);

  const now = new Date().toISOString();

  const sampleNarrative: ReportType = {
    id: `sample-narrative-${Date.now()}`,
    title: "Sample Narrative",
    description:
      "This is a sample narrative to help you get started. Feel free to edit or delete it.",
    reportType: "linear", // Added missing property - default narrative type
    scenes: [
      {
        id: `sample-scene-${Date.now()}-1`,
        title: "Introduction",
        description: "The beginning of your story",
        content:
          "Start writing your narrative here. You can add characters, locations, and events from your project to enrich your storytelling.",
        order: 1,
        characters: characterIds,
        locations: [],
        eventIds: [],
        notes:
          "This is a sample scene. You can add notes about your research or ideas for development here.",
      },
    ],
    nodes: [], // Added missing property - empty nodes array for flow view
    edges: [], // Added missing property - empty edges array for flow view
    timelineId,
    characterIds,
    tags: ["Sample", "Getting Started"],
    createdAt: now,
    updatedAt: now,
  };

  return {
    ...migratedProject,
    reports: [sampleNarrative],
    updatedAt: new Date().toISOString(),
  };
}

export function updateProjectNarratives(
  project: ProjectForNarrativeMigration,
  reports: ReportType[],
): ProjectType {
  const migratedProject = ensureProjectHasNarratives(project);

  return {
    ...migratedProject,
    reports,
    updatedAt: new Date().toISOString(),
  };
}
