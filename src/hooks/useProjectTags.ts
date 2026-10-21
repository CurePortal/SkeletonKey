// src/hooks/useProjectTags.ts
import { useMemo } from "react";
import { ProjectType } from "../types";

interface TagStats {
  tag: string;
  count: number;
  entities: Array<{
    id: string;
    name: string;
    type: string;
  }>;
}

export const useProjectTags = (project: ProjectType | null) => {
  const tagStats = useMemo(() => {
    if (!project) {
      console.log("📊 useProjectTags: No project provided");
      return [];
    }

    const tagMap = new Map<string, TagStats>();

    // Helper function to add tags from an entity
    const addTagsFromEntity = (
      entity: any,
      entityType: string,
      nameField: string = "name",
    ) => {
      // Add defensive checks
      if (!entity) {
        console.log(
          `⚠️ useProjectTags: Skipping null entity of type ${entityType}`,
        );
        return;
      }

      if (!entity.tags || !Array.isArray(entity.tags)) {
        return;
      }

      console.log(
        `🏷️ useProjectTags: Processing ${entityType} "${entity[nameField] || entity.title || entity.name || "Unnamed"}" with tags:`,
        entity.tags,
      );

      entity.tags.forEach((tag: string) => {
        // More robust tag validation
        if (!tag || typeof tag !== "string") return;

        const normalizedTag = tag.trim();
        if (!normalizedTag) return;

        if (!tagMap.has(normalizedTag)) {
          tagMap.set(normalizedTag, {
            tag: normalizedTag,
            count: 0,
            entities: [],
          });
        }

        const tagStat = tagMap.get(normalizedTag)!;
        tagStat.count += 1;
        tagStat.entities.push({
          id: entity.id || "unknown",
          name: entity[nameField] || entity.title || entity.name || "Unnamed",
          type: entityType,
        });
      });
    };

    if (project.characters && Array.isArray(project.characters)) {
      project.characters.forEach((char) =>
        addTagsFromEntity(char, "character"),
      );
    }

    if (project.locations && Array.isArray(project.locations)) {
      project.locations.forEach((loc) => addTagsFromEntity(loc, "location"));
    }

    if (project.technologies && Array.isArray(project.technologies)) {
      project.technologies.forEach((tech) =>
        addTagsFromEntity(tech, "technology"),
      );
    }

    if (project.cultures && Array.isArray(project.cultures)) {
      project.cultures.forEach((culture) =>
        addTagsFromEntity(culture, "culture"),
      );
    }

    // Handle both sources and sourceDocuments with better checking
    const sourceDocuments = project.sources || project.sources || [];
    if (Array.isArray(sourceDocuments) && sourceDocuments.length > 0) {
      sourceDocuments.forEach((source) =>
        addTagsFromEntity(source, "source", "title"),
      );
    }

    if (project.reports && Array.isArray(project.reports)) {
      project.reports.forEach((narrative) =>
        addTagsFromEntity(narrative, "narrative", "title"),
      );
    }

    // Process timeline and event tags
    if (project.timelines && Array.isArray(project.timelines)) {
      project.timelines.forEach((timeline) => {
        addTagsFromEntity(timeline, "timeline");
        if (timeline.events && Array.isArray(timeline.events)) {
          timeline.events.forEach((event) =>
            addTagsFromEntity(event, "event", "title"),
          );
        }
      });
    }

    // Process dynamic entities if they exist
    if (project.entities && Array.isArray(project.entities)) {
      project.entities.forEach((entity) => {
        const entityType = entity.entityType || "dynamic";
        addTagsFromEntity(entity, entityType);
      });
    }

    const result = Array.from(tagMap.values()).sort(
      (a, b) => b.count - a.count,
    );

    return result;
  }, [project]);

  // Get all unique tags
  const allTags = useMemo(() => {
    return tagStats.map((stat) => stat.tag);
  }, [tagStats]);

  // Get popular tags (used more than once)
  const popularTags = useMemo(() => {
    return tagStats.filter((stat) => stat.count > 1).map((stat) => stat.tag);
  }, [tagStats]);

  // Get tag suggestions (all tags sorted by popularity)
  const tagSuggestions = useMemo(() => {
    return tagStats.sort((a, b) => b.count - a.count).map((stat) => stat.tag);
  }, [tagStats]);

  // Get entities by tag
  const getEntitiesByTag = (tag: string) => {
    const tagStat = tagStats.find((stat) => stat.tag === tag);
    return tagStat ? tagStat.entities : [];
  };

  // Get tags for a specific entity type
  const getTagsForEntityType = (entityType: string) => {
    const entityTags = new Set<string>();
    tagStats.forEach((stat) => {
      if (stat.entities.some((e) => e.type === entityType)) {
        entityTags.add(stat.tag);
      }
    });
    return Array.from(entityTags);
  };

  return {
    tagStats,
    allTags,
    popularTags,
    tagSuggestions,
    getEntitiesByTag,
    getTagsForEntityType,
  };
};
