// src/services/searchService.ts
import { ProjectType, ID } from "../types/project";
import { SearchResult } from "../types/search";

export function searchProject(
  project: ProjectType,
  query: string,
  filters?: {
    types?: (
      | "event"
      | "character"
      | "location"
      | "technology"
      | "culture"
      | "sourceDocument"
      | "narrative"
      | "timeline"
    )[];
    timelineIds?: ID[];
    tags?: string[];
  },
): SearchResult[] {
  if (!query.trim()) return [];
  const normalizedQuery = query.toLowerCase().trim();
  const results: SearchResult[] = [];

  const passesFilters = (
    type: SearchResult["type"],
    timelineId?: ID | null,
    tags?: string[],
  ): boolean => {
    if (filters?.types?.length && !filters.types.includes(type)) return false;
    if (
      filters?.timelineIds?.length &&
      type === "event" &&
      timelineId &&
      !filters.timelineIds.includes(timelineId)
    )
      return false;

    if (filters?.tags?.length && tags?.length) {
      const hasMatchingTag = tags.some((tag) => filters.tags?.includes(tag));
      if (!hasMatchingTag) return false;
    } else if (filters?.tags?.length) {
      return false;
    }
    return true;
  };

  const addResult = (result: Omit<SearchResult, "id">) => {
    const uniqueId = `${result.type}-${result.entityId}-${result.matchType}-${Math.random().toString(16).slice(2)}`;
    results.push({ ...result, id: uniqueId });
  };

  if (!filters?.types?.length || filters.types.includes("timeline")) {
    project.timelines?.forEach((timeline) => {
      if (!passesFilters("timeline", null, timeline.tags)) return;
      if (timeline.name.toLowerCase().includes(normalizedQuery)) {
        addResult({
          type: "timeline",
          title: timeline.name,
          description: timeline.description,
          matchType: "title",
          matchText: timeline.name,
          entityId: timeline.id,
          tags: timeline.tags,
        });
      }
      if (timeline.description?.toLowerCase().includes(normalizedQuery)) {
        addResult({
          type: "timeline",
          title: timeline.name,
          description: timeline.description,
          matchType: "description",
          matchText: timeline.description,
          entityId: timeline.id,
          tags: timeline.tags,
        });
      }
      if (
        timeline.tags?.some((tag) =>
          tag.toLowerCase().includes(normalizedQuery),
        )
      ) {
        addResult({
          type: "timeline",
          title: timeline.name,
          description: timeline.description,
          matchType: "tags",
          matchText: timeline.tags
            .filter((t) => t.toLowerCase().includes(normalizedQuery))
            .join(", "),
          entityId: timeline.id,
          tags: timeline.tags,
        });
      }
    });
  }

  if (!filters?.types?.length || filters.types.includes("event")) {
    project.timelines?.forEach((timeline) => {
      timeline.events?.forEach((event) => {
        if (!passesFilters("event", timeline.id, event.tags)) return;
        if (event.title.toLowerCase().includes(normalizedQuery)) {
          addResult({
            type: "event",
            title: event.title,
            description: event.description,
            matchType: "title",
            matchText: event.title,
            entityId: event.id,
            parentId: timeline.id,
            date: event.date,
            iconId: event.iconId,
            tags: event.tags,
          });
        }
        if (event.description?.toLowerCase().includes(normalizedQuery)) {
          addResult({
            type: "event",
            title: event.title,
            description: event.description,
            matchType: "description",
            matchText: event.description,
            entityId: event.id,
            parentId: timeline.id,
            date: event.date,
            iconId: event.iconId,
            tags: event.tags,
          });
        }
        if (event.notes?.toLowerCase().includes(normalizedQuery)) {
          addResult({
            type: "event",
            title: event.title,
            description: event.description,
            matchType: "notes",
            matchText: event.notes,
            entityId: event.id,
            parentId: timeline.id,
            date: event.date,
            iconId: event.iconId,
            tags: event.tags,
          });
        }
        if (
          event.tags?.some((tag) => tag.toLowerCase().includes(normalizedQuery))
        ) {
          addResult({
            type: "event",
            title: event.title,
            description: event.description,
            matchType: "tags",
            matchText: event.tags
              .filter((t) => t.toLowerCase().includes(normalizedQuery))
              .join(", "),
            entityId: event.id,
            parentId: timeline.id,
            date: event.date,
            iconId: event.iconId,
            tags: event.tags,
          });
        }
      });
    });
  }

  if (!filters?.types?.length || filters.types.includes("character")) {
    project.characters?.forEach((character) => {
      if (!passesFilters("character", null, character.tags)) return;
      if (character.name.toLowerCase().includes(normalizedQuery)) {
        addResult({
          type: "character",
          title: character.name,
          description: character.description,
          matchType: "title",
          matchText: character.name,
          entityId: character.id,
          tags: character.tags,
        });
      }
      if (character.description?.toLowerCase().includes(normalizedQuery)) {
        addResult({
          type: "character",
          title: character.name,
          description: character.description,
          matchType: "description",
          matchText: character.description,
          entityId: character.id,
          tags: character.tags,
        });
      }
      if (character.background?.toLowerCase().includes(normalizedQuery)) {
        addResult({
          type: "character",
          title: character.name,
          description: character.description,
          matchType: "content",
          matchText: character.background,
          entityId: character.id,
          tags: character.tags,
        });
      }
      if (character.motivation?.toLowerCase().includes(normalizedQuery)) {
        addResult({
          type: "character",
          title: character.name,
          description: character.description,
          matchType: "content",
          matchText: character.motivation,
          entityId: character.id,
          tags: character.tags,
        });
      }
      if (character.notes?.toLowerCase().includes(normalizedQuery)) {
        addResult({
          type: "character",
          title: character.name,
          description: character.description,
          matchType: "notes",
          matchText: character.notes,
          entityId: character.id,
          tags: character.tags,
        });
      }
      if (
        character.tags?.some((tag) =>
          tag.toLowerCase().includes(normalizedQuery),
        )
      ) {
        addResult({
          type: "character",
          title: character.name,
          description: character.description,
          matchType: "tags",
          matchText: character.tags
            .filter((t) => t.toLowerCase().includes(normalizedQuery))
            .join(", "),
          entityId: character.id,
          tags: character.tags,
        });
      }
    });
  }

  if (!filters?.types?.length || filters.types.includes("location")) {
    project.locations?.forEach((location) => {
      if (!passesFilters("location", null, location.tags)) return;
      if (location.name.toLowerCase().includes(normalizedQuery)) {
        addResult({
          type: "location",
          title: location.name,
          description: location.description,
          matchType: "title",
          matchText: location.name,
          entityId: location.id,
          tags: location.tags,
        });
      }
      if (location.description?.toLowerCase().includes(normalizedQuery)) {
        addResult({
          type: "location",
          title: location.name,
          description: location.description,
          matchType: "description",
          matchText: location.description,
          entityId: location.id,
          tags: location.tags,
        });
      }
      if (location.notes?.toLowerCase().includes(normalizedQuery)) {
        addResult({
          type: "location",
          title: location.name,
          description: location.description,
          matchType: "notes",
          matchText: location.notes,
          entityId: location.id,
          tags: location.tags,
        });
      }
      if (
        location.tags?.some((tag) =>
          tag.toLowerCase().includes(normalizedQuery),
        )
      ) {
        addResult({
          type: "location",
          title: location.name,
          description: location.description,
          matchType: "tags",
          matchText: location.tags
            .filter((t) => t.toLowerCase().includes(normalizedQuery))
            .join(", "),
          entityId: location.id,
          tags: location.tags,
        });
      }
    });
  }

  if (!filters?.types?.length || filters.types.includes("technology")) {
    project.technologies?.forEach((technology) => {
      if (!passesFilters("technology", null, technology.tags)) return;
      if (technology.name.toLowerCase().includes(normalizedQuery)) {
        addResult({
          type: "technology",
          title: technology.name,
          description: technology.description,
          matchType: "title",
          matchText: technology.name,
          entityId: technology.id,
          tags: technology.tags,
        });
      }
      if (technology.description?.toLowerCase().includes(normalizedQuery)) {
        addResult({
          type: "technology",
          title: technology.name,
          description: technology.description,
          matchType: "description",
          matchText: technology.description,
          entityId: technology.id,
          tags: technology.tags,
        });
      }
      if (technology.notes?.toLowerCase().includes(normalizedQuery)) {
        addResult({
          type: "technology",
          title: technology.name,
          description: technology.description,
          matchType: "notes",
          matchText: technology.notes,
          entityId: technology.id,
          tags: technology.tags,
        });
      }
      if (
        technology.tags?.some((tag) =>
          tag.toLowerCase().includes(normalizedQuery),
        )
      ) {
        addResult({
          type: "technology",
          title: technology.name,
          description: technology.description,
          matchType: "tags",
          matchText: technology.tags
            .filter((t) => t.toLowerCase().includes(normalizedQuery))
            .join(", "),
          entityId: technology.id,
          tags: technology.tags,
        });
      }
    });
  }

  if (!filters?.types?.length || filters.types.includes("culture")) {
    project.cultures?.forEach((culture) => {
      if (!passesFilters("culture", null, culture.tags)) return;
      const content = [culture.values, culture.practices, culture.beliefs]
        .flat()
        .filter(Boolean)
        .join(" ");
      if (culture.name.toLowerCase().includes(normalizedQuery)) {
        addResult({
          type: "culture",
          title: culture.name,
          description: culture.description,
          matchType: "title",
          matchText: culture.name,
          entityId: culture.id,
          tags: culture.tags,
        });
      }
      if (culture.description?.toLowerCase().includes(normalizedQuery)) {
        addResult({
          type: "culture",
          title: culture.name,
          description: culture.description,
          matchType: "description",
          matchText: culture.description,
          entityId: culture.id,
          tags: culture.tags,
        });
      }
      if (culture.notes?.toLowerCase().includes(normalizedQuery)) {
        addResult({
          type: "culture",
          title: culture.name,
          description: culture.description,
          matchType: "notes",
          matchText: culture.notes,
          entityId: culture.id,
          tags: culture.tags,
        });
      }
      if (content?.toLowerCase().includes(normalizedQuery)) {
        addResult({
          type: "culture",
          title: culture.name,
          description: culture.description,
          matchType: "content",
          matchText: content,
          entityId: culture.id,
          tags: culture.tags,
        });
      }
      if (
        culture.tags?.some((tag) => tag.toLowerCase().includes(normalizedQuery))
      ) {
        addResult({
          type: "culture",
          title: culture.name,
          description: culture.description,
          matchType: "tags",
          matchText: culture.tags
            .filter((t) => t.toLowerCase().includes(normalizedQuery))
            .join(", "),
          entityId: culture.id,
          tags: culture.tags,
        });
      }
    });
  }

  // FIXED: Handle both sources and sourceDocuments for backward compatibility
  if (!filters?.types?.length || filters.types.includes("sourceDocument")) {
    const sourceDocuments = project.sources || project.sources || [];
    sourceDocuments.forEach((doc) => {
      if (!passesFilters("sourceDocument", null, doc.tags)) return;
      if (doc.title.toLowerCase().includes(normalizedQuery)) {
        addResult({
          type: "sourceDocument",
          title: doc.title,
          description: doc.description || null,
          matchType: "title",
          matchText: doc.title,
          entityId: doc.id,
          tags: doc.tags,
        });
      }
      if (doc.description?.toLowerCase().includes(normalizedQuery)) {
        addResult({
          type: "sourceDocument",
          title: doc.title,
          description: doc.description || null,
          matchType: "description",
          matchText: doc.description,
          entityId: doc.id,
          tags: doc.tags,
        });
      }
      if (doc.notes?.toLowerCase().includes(normalizedQuery)) {
        addResult({
          type: "sourceDocument",
          title: doc.title,
          description: doc.description || null,
          matchType: "notes",
          matchText: doc.notes,
          entityId: doc.id,
          tags: doc.tags,
        });
      }
      if (
        doc.authors?.some((author) =>
          author.toLowerCase().includes(normalizedQuery),
        )
      ) {
        addResult({
          type: "sourceDocument",
          title: doc.title,
          description: doc.description || null,
          matchType: "content",
          matchText: `Authors: ${doc.authors.filter((a) => a.toLowerCase().includes(normalizedQuery)).join(", ")}`,
          entityId: doc.id,
          tags: doc.tags,
        });
      }
      if (
        doc.tags?.some((tag) => tag.toLowerCase().includes(normalizedQuery))
      ) {
        addResult({
          type: "sourceDocument",
          title: doc.title,
          description: doc.description || null,
          matchType: "tags",
          matchText: doc.tags
            .filter((t) => t.toLowerCase().includes(normalizedQuery))
            .join(", "),
          entityId: doc.id,
          tags: doc.tags,
        });
      }
    });
  }

  // FIXED: Handle both reports and narratives for backward compatibility
  if (!filters?.types?.length || filters.types.includes("narrative")) {
    const narratives = project.reports || project.reports || [];
    narratives.forEach((narrative) => {
      if (!passesFilters("narrative", null, narrative.tags)) return;
      if (narrative.title.toLowerCase().includes(normalizedQuery)) {
        addResult({
          type: "narrative",
          title: narrative.title,
          description: narrative.description,
          matchType: "title",
          matchText: narrative.title,
          entityId: narrative.id,
          tags: narrative.tags,
        });
      }
      if (narrative.description?.toLowerCase().includes(normalizedQuery)) {
        addResult({
          type: "narrative",
          title: narrative.title,
          description: narrative.description,
          matchType: "description",
          matchText: narrative.description,
          entityId: narrative.id,
          tags: narrative.tags,
        });
      }

      narrative.scenes?.forEach((scene, index) => {
        if (scene.content?.toLowerCase().includes(normalizedQuery)) {
          addResult({
            type: "narrative",
            title: `${narrative.title} - Scene ${index + 1}: ${scene.title}`,
            description: scene.description,
            matchType: "content",
            matchText: scene.content,
            entityId: narrative.id,
            tags: narrative.tags,
          });
        }
      });
      if (
        narrative.tags?.some((tag) =>
          tag.toLowerCase().includes(normalizedQuery),
        )
      ) {
        addResult({
          type: "narrative",
          title: narrative.title,
          description: narrative.description,
          matchType: "tags",
          matchText: narrative.tags
            .filter((t) => t.toLowerCase().includes(normalizedQuery))
            .join(", "),
          entityId: narrative.id,
          tags: narrative.tags,
        });
      }
    });
  }

  const uniqueResults = Array.from(
    new Map(
      results.map((item) => [
        `${item.entityId}-${item.type}-${item.matchType}`,
        item,
      ]),
    ).values(),
  );
  return uniqueResults;
}

export function getAllProjectTags(project: ProjectType): string[] {
  const tagSet = new Set<string>();
  const addTags = (tags: string[] | undefined) => {
    tags?.forEach((tag) => tagSet.add(tag));
  };
  project.timelines?.forEach((timeline) => {
    addTags(timeline.tags);
    timeline.events?.forEach((event) => addTags(event.tags));
  });
  project.characters?.forEach((character) => addTags(character.tags));
  project.locations?.forEach((location) => addTags(location.tags));
  project.technologies?.forEach((technology) => addTags(technology.tags));
  project.cultures?.forEach((culture) => addTags(culture.tags));

  // FIXED: Handle both sources and sourceDocuments
  const sources = project.sources || project.sources || [];
  sources.forEach((doc) => addTags(doc.tags));

  // FIXED: Handle both reports and narratives
  const narratives = project.reports || project.reports || [];
  narratives.forEach((narrative) => addTags(narrative.tags));

  return Array.from(tagSet).sort();
}

export function getTagUsageStatistics(
  project: ProjectType,
): Record<string, number> {
  const tagCounts: Record<string, number> = {};
  const countTags = (tags: string[] | undefined) => {
    tags?.forEach((tag) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  };
  project.timelines?.forEach((timeline) => {
    countTags(timeline.tags);
    timeline.events?.forEach((event) => countTags(event.tags));
  });
  project.characters?.forEach((character) => countTags(character.tags));
  project.locations?.forEach((location) => countTags(location.tags));
  project.technologies?.forEach((technology) => countTags(technology.tags));
  project.cultures?.forEach((culture) => countTags(culture.tags));

  // FIXED: Handle both sources and sourceDocuments
  const sources = project.sources || project.sources || [];
  sources.forEach((doc) => countTags(doc.tags));

  // FIXED: Handle both reports and narratives
  const narratives = project.reports || project.reports || [];
  narratives.forEach((narrative) => countTags(narrative.tags));

  return tagCounts;
}
