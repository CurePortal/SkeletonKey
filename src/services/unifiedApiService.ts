// src/services/unifiedApiService.ts
import {
  ProjectType,
  TimelineType,
  EventType,
  CharacterType,
  LocationType,
  TechnologyType,
  CultureType,
  NarrativeType,
  ID,
} from "../types";

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    timestamp: string;
    operation: string;
    projectId?: ID;
  };
}

export interface APIContext {
  projectId: ID | null;
  userId?: string;
  sessionId?: string;
}

class UnifiedAPI {
  private context: APIContext = {
    projectId: null,
  };

  private projectDataContext: any;
  private notificationContext: any;
  private appStateContext: any;

  initialize(projectDataContext: any, notificationContext: any): void {
    this.projectDataContext = projectDataContext;
    this.notificationContext = notificationContext;
  }

  setContext(context: Partial<APIContext>): void {
    this.context = { ...this.context, ...context };
  }

  setAppStateContext(context: any): void {
    this.appStateContext = context;
  }

  project = {
    create: async (
      name: string,
      description?: string,
    ): Promise<APIResponse<ProjectType>> => {
      try {
        const project = await this.projectDataContext.createProject({
          name,
          description,
        });
        this.context.projectId = project.id;
        return this.success(project, "project.create");
      } catch (error) {
        return this.error(error, "project.create");
      }
    },

    load: async (
      projectIdOrPath: string,
    ): Promise<APIResponse<ProjectType>> => {
      try {
        const project =
          await this.projectDataContext.loadProject(projectIdOrPath);
        this.context.projectId = project.id;
        return this.success(project, "project.load");
      } catch (error) {
        return this.error(error, "project.load");
      }
    },

    save: async (): Promise<APIResponse<boolean>> => {
      try {
        const result = await this.projectDataContext.saveChanges();
        return this.success(result, "project.save");
      } catch (error) {
        return this.error(error, "project.save");
      }
    },

    get: (): APIResponse<ProjectType | null> => {
      const project = this.projectDataContext.project;
      return this.success(project, "project.get");
    },

    update: (details: {
      name?: string;
      description?: string;
    }): APIResponse<void> => {
      try {
        this.projectDataContext.updateProjectDetails(details);
        return this.success(undefined, "project.update");
      } catch (error) {
        return this.error(error, "project.update");
      }
    },

    export: async (
      format: "ahp" | "json" = "json",
    ): Promise<APIResponse<any>> => {
      try {
        const project = this.projectDataContext.project;
        if (!project) throw new Error("No project loaded");

        const exportData =
          format === "ahp"
            ? await this.projectDataContext.exportProjectAsAHP()
            : project;

        return this.success(exportData, "project.export");
      } catch (error) {
        return this.error(error, "project.export");
      }
    },
  };

  timeline = {
    add: (data: Partial<TimelineType>): APIResponse<ID> => {
      try {
        const id = this.generateId();
        const timeline: TimelineType = {
          id,
          name: data.name || "New Timeline",
          description: data.description || "",
          color: data.color || "#4287f5",
          startDate: data.startDate || "",
          endDate: data.endDate || "",
          isMainTimeline: data.isMainTimeline || false,
          parentTimelineId: data.parentTimelineId || null,
          branchFromEventId: data.branchFromEventId || null,
          tags: data.tags || [],
          events: data.events || [],
          pointsOfDivergence: data.pointsOfDivergence || [],
        };

        this.projectDataContext.addTimeline(timeline);
        return this.success(id, "timeline.add");
      } catch (error) {
        return this.error(error, "timeline.add");
      }
    },

    update: (timeline: TimelineType): APIResponse<void> => {
      try {
        this.projectDataContext.updateTimeline(timeline);
        return this.success(undefined, "timeline.update");
      } catch (error) {
        return this.error(error, "timeline.update");
      }
    },

    delete: (timelineId: ID): APIResponse<void> => {
      try {
        this.projectDataContext.deleteTimeline(timelineId);
        return this.success(undefined, "timeline.delete");
      } catch (error) {
        return this.error(error, "timeline.delete");
      }
    },

    get: (timelineId: ID): APIResponse<TimelineType | undefined> => {
      try {
        const timeline = this.projectDataContext.getTimelineById(timelineId);
        return this.success(timeline, "timeline.get");
      } catch (error) {
        return this.error(error, "timeline.get");
      }
    },

    list: (): APIResponse<TimelineType[]> => {
      try {
        const project = this.projectDataContext.project;
        return this.success(project?.timelines || [], "timeline.list");
      } catch (error) {
        return this.error(error, "timeline.list");
      }
    },
  };

  event = {
    add: (timelineId: ID, data: Partial<EventType>): APIResponse<ID> => {
      try {
        const id = this.generateId();
        const event: EventType = {
          id,
          timelineId,
          title: data.title || "New Event",
          description: data.description || "",
          date: data.date || new Date().toISOString(),
          endDate: data.endDate || null,
          importance: data.importance || 5,
          iconId: data.iconId || "default",
          tags: data.tags || [],
          linkedCharacterIds: data.linkedCharacterIds || [],
          linkedLocationIds: data.linkedLocationIds || [],
          linkedTechnologyIds: data.linkedTechnologyIds || [],
          linkedCultureIds: data.linkedCultureIds || [],
          linkedSourceDocumentIds: data.linkedSourceDocumentIds || [],
          causes: data.causes || [],
          effects: data.effects || [],
          notes: data.notes || "",
          isPointOfDivergence: data.isPointOfDivergence || false,
        };

        this.projectDataContext.addEvent(timelineId, event);
        return this.success(id, "event.add");
      } catch (error) {
        return this.error(error, "event.add");
      }
    },

    update: (timelineId: ID, event: EventType): APIResponse<void> => {
      try {
        this.projectDataContext.updateEvent(timelineId, event);
        return this.success(undefined, "event.update");
      } catch (error) {
        return this.error(error, "event.update");
      }
    },

    delete: (timelineId: ID, eventId: ID): APIResponse<void> => {
      try {
        this.projectDataContext.deleteEvent(timelineId, eventId);
        return this.success(undefined, "event.delete");
      } catch (error) {
        return this.error(error, "event.delete");
      }
    },

    get: (eventId: ID, timelineId?: ID): APIResponse<EventType | undefined> => {
      try {
        const event = this.projectDataContext.getEventById(eventId, timelineId);
        return this.success(event, "event.get");
      } catch (error) {
        return this.error(error, "event.get");
      }
    },
  };

  kb = {
    character: {
      add: (data: Partial<CharacterType>): APIResponse<ID> => {
        try {
          const id = this.generateId();

          // Helper to normalize related character IDs
          const normalizeRelatedIds = (
            relatedIds: any,
          ): Record<string, string[]> => {
            if (!relatedIds || typeof relatedIds !== "object") return {};
            const normalized: Record<string, string[]> = {};
            for (const [key, value] of Object.entries(relatedIds)) {
              if (Array.isArray(value)) {
                normalized[key] = value.filter((id) => typeof id === "string");
              } else if (typeof value === "string") {
                normalized[key] = [value];
              } else {
                normalized[key] = [];
              }
            }
            return normalized;
          };

          // Process locations to ensure they're strings
          const processLocations = (locations: any): string[] => {
            if (!locations) return [];
            if (!Array.isArray(locations)) return [];
            return locations.filter((loc: any) => typeof loc === "string");
          };

          const character: CharacterType = {
            id,
            name: data.name || "New Character",
            description: data.description || "",
            birthDate: data.birthDate || null,
            deathDate: data.deathDate || null,
            traits: Array.isArray(data.traits) ? data.traits : [],
            motivation: data.motivation || "",
            background: data.background || "",
            isHistorical:
              data.isHistorical !== undefined ? data.isHistorical : true,
            imageUrl: data.imageUrl || null,
            // Handle both timelineIds and linkedTimelineIds
            timelineIds:
              data.timelineIds || (data as any).linkedTimelineIds || [],
            linkedEventIds: Array.isArray(data.linkedEventIds)
              ? data.linkedEventIds
              : [],
            relatedCharacterIds: normalizeRelatedIds(data.relatedCharacterIds),
            locations: processLocations(data.locations),
            tags: Array.isArray(data.tags) ? data.tags : [],
            notes: data.notes || "",
          };

          this.projectDataContext.addCharacter(character);
          return this.success(id, "kb.character.add");
        } catch (error) {
          return this.error(error, "kb.character.add");
        }
      },

      update: (character: CharacterType): APIResponse<void> => {
        try {
          this.projectDataContext.updateCharacter(character);
          return this.success(undefined, "kb.character.update");
        } catch (error) {
          return this.error(error, "kb.character.update");
        }
      },

      delete: (characterId: ID): APIResponse<void> => {
        try {
          this.projectDataContext.deleteCharacter(characterId);
          return this.success(undefined, "kb.character.delete");
        } catch (error) {
          return this.error(error, "kb.character.delete");
        }
      },

      get: (characterId: ID): APIResponse<CharacterType | undefined> => {
        try {
          const character =
            this.projectDataContext.getCharacterById(characterId);
          return this.success(character, "kb.character.get");
        } catch (error) {
          return this.error(error, "kb.character.get");
        }
      },

      list: (): APIResponse<CharacterType[]> => {
        try {
          const project = this.projectDataContext.project;
          return this.success(project?.characters || [], "kb.character.list");
        } catch (error) {
          return this.error(error, "kb.character.list");
        }
      },
    },

    location: {
      add: (data: Partial<LocationType>): APIResponse<ID> => {
        try {
          const id = this.generateId();
          const location: LocationType = {
            id,
            name: data.name || "New Location",
            description: data.description || "",
            coordinates: data.coordinates || null,
            foundedDate: data.foundedDate || null,
            destroyedDate: data.destroyedDate || null,
            population: data.population || null,
            type: data.type || "City",
            importance: data.importance || 5,
            parentLocationId: data.parentLocationId || null,
            timelineIds: data.timelineIds || [],
            linkedEventIds: data.linkedEventIds || [],
            tags: data.tags || [],
            notes: data.notes || "",
            mapUrl: data.mapUrl || null,
          };

          this.projectDataContext.addLocation(location);
          return this.success(id, "kb.location.add");
        } catch (error) {
          return this.error(error, "kb.location.add");
        }
      },

      update: (location: LocationType): APIResponse<void> => {
        try {
          this.projectDataContext.updateLocation(location);
          return this.success(undefined, "kb.location.update");
        } catch (error) {
          return this.error(error, "kb.location.update");
        }
      },

      delete: (locationId: ID): APIResponse<void> => {
        try {
          this.projectDataContext.deleteLocation(locationId);
          return this.success(undefined, "kb.location.delete");
        } catch (error) {
          return this.error(error, "kb.location.delete");
        }
      },

      get: (locationId: ID): APIResponse<LocationType | undefined> => {
        try {
          const location = this.projectDataContext.getLocationById(locationId);
          return this.success(location, "kb.location.get");
        } catch (error) {
          return this.error(error, "kb.location.get");
        }
      },

      list: (): APIResponse<LocationType[]> => {
        try {
          const project = this.projectDataContext.project;
          return this.success(project?.locations || [], "kb.location.list");
        } catch (error) {
          return this.error(error, "kb.location.list");
        }
      },
    },

    technology: {
      add: (data: Partial<TechnologyType>): APIResponse<ID> => {
        try {
          const id = this.generateId();
          const technology: TechnologyType = {
            id,
            name: data.name || "New Technology",
            description: data.description || "",
            discoveryDate: data.discoveryDate || null,
            developmentLevel: data.developmentLevel || 5,
            impact: data.impact || 5,
            fields: data.fields || [],
            prerequisiteTechIds: data.prerequisiteTechIds || [],
            derivedTechIds: data.derivedTechIds || [],
            inventors: data.inventors || [],
            timelineIds: data.timelineIds || [],
            linkedEventIds: data.linkedEventIds || [],
            tags: data.tags || [],
            notes: data.notes || "",
          };

          this.projectDataContext.addTechnology(technology);
          return this.success(id, "kb.technology.add");
        } catch (error) {
          return this.error(error, "kb.technology.add");
        }
      },

      update: (technology: TechnologyType): APIResponse<void> => {
        try {
          this.projectDataContext.updateTechnology(technology);
          return this.success(undefined, "kb.technology.update");
        } catch (error) {
          return this.error(error, "kb.technology.update");
        }
      },

      delete: (technologyId: ID): APIResponse<void> => {
        try {
          this.projectDataContext.deleteTechnology(technologyId);
          return this.success(undefined, "kb.technology.delete");
        } catch (error) {
          return this.error(error, "kb.technology.delete");
        }
      },

      get: (technologyId: ID): APIResponse<TechnologyType | undefined> => {
        try {
          const technology =
            this.projectDataContext.getTechnologyById(technologyId);
          return this.success(technology, "kb.technology.get");
        } catch (error) {
          return this.error(error, "kb.technology.get");
        }
      },

      list: (): APIResponse<TechnologyType[]> => {
        try {
          const project = this.projectDataContext.project;
          return this.success(
            project?.technologies || [],
            "kb.technology.list",
          );
        } catch (error) {
          return this.error(error, "kb.technology.list");
        }
      },
    },

    culture: {
      add: (data: Partial<CultureType>): APIResponse<ID> => {
        try {
          const id = this.generateId();
          const culture: CultureType = {
            id,
            name: data.name || "New Culture",
            description: data.description || "",
            foundedDate: data.foundedDate || null,
            endDate: data.endDate || null,
            values: data.values || [],
            practices: data.practices || [],
            languages: data.languages || [],
            beliefs: data.beliefs || [],
            linkedLocationIds: data.linkedLocationIds || [],
            linkedCharacterIds: data.linkedCharacterIds || [],
            timelineIds: data.timelineIds || [],
            linkedEventIds: data.linkedEventIds || [],
            tags: data.tags || [],
            notes: data.notes || "",
            imageUrl: data.imageUrl || null,
          };

          this.projectDataContext.addCulture(culture);
          return this.success(id, "kb.culture.add");
        } catch (error) {
          return this.error(error, "kb.culture.add");
        }
      },

      update: (culture: CultureType): APIResponse<void> => {
        try {
          this.projectDataContext.updateCulture(culture);
          return this.success(undefined, "kb.culture.update");
        } catch (error) {
          return this.error(error, "kb.culture.update");
        }
      },

      delete: (cultureId: ID): APIResponse<void> => {
        try {
          this.projectDataContext.deleteCulture(cultureId);
          return this.success(undefined, "kb.culture.delete");
        } catch (error) {
          return this.error(error, "kb.culture.delete");
        }
      },

      get: (cultureId: ID): APIResponse<CultureType | undefined> => {
        try {
          const culture = this.projectDataContext.getCultureById(cultureId);
          return this.success(culture, "kb.culture.get");
        } catch (error) {
          return this.error(error, "kb.culture.get");
        }
      },

      list: (): APIResponse<CultureType[]> => {
        try {
          const project = this.projectDataContext.project;
          return this.success(project?.cultures || [], "kb.culture.list");
        } catch (error) {
          return this.error(error, "kb.culture.list");
        }
      },
    },
  };

  narrative = {
    add: (data: Partial<NarrativeType>): APIResponse<ID> => {
      try {
        const id = this.generateId();
        const now = new Date().toISOString();
        const narrative: NarrativeType = {
          id,
          title: data.title || "New Narrative",
          description: data.description || "",
          narrativeType: data.narrativeType || "linear",
          tags: data.tags || [],
          timelineId: data.timelineId || null,
          characterIds: data.characterIds || [],
          scenes: data.scenes || [],
          nodes: data.nodes || [],
          edges: data.edges || [],
          createdAt: now,
          updatedAt: now,
        };

        this.projectDataContext.addNarrative(narrative);
        return this.success(id, "narrative.add");
      } catch (error) {
        return this.error(error, "narrative.add");
      }
    },

    update: (narrative: NarrativeType): APIResponse<void> => {
      try {
        this.projectDataContext.updateNarrative(narrative);
        return this.success(undefined, "narrative.update");
      } catch (error) {
        return this.error(error, "narrative.update");
      }
    },

    delete: (narrativeId: ID): APIResponse<void> => {
      try {
        this.projectDataContext.deleteNarrative(narrativeId);
        return this.success(undefined, "narrative.delete");
      } catch (error) {
        return this.error(error, "narrative.delete");
      }
    },

    get: (narrativeId: ID): APIResponse<NarrativeType | undefined> => {
      try {
        const narrative = this.projectDataContext.getNarrativeById(narrativeId);
        return this.success(narrative, "narrative.get");
      } catch (error) {
        return this.error(error, "narrative.get");
      }
    },

    list: (): APIResponse<NarrativeType[]> => {
      try {
        const project = this.projectDataContext.project;
        return this.success(project?.narratives || [], "narrative.list");
      } catch (error) {
        return this.error(error, "narrative.list");
      }
    },
  };

  nav = {
    addButton: (
      target: string,
      label: string,
      icon?: string,
    ): APIResponse<string> => {
      try {
        const buttonCode = `
<Button
  onClick={() => setViewMode('${target}')}
  className="nav-button"
  icon={${icon ? `"${icon}"` : "undefined"}}
>
  ${label}
</Button>`;
        return this.success(buttonCode, "nav.addButton");
      } catch (error) {
        return this.error(error, "nav.addButton");
      }
    },

    goTo: (viewMode: string): APIResponse<void> => {
      try {
        if (this.appStateContext) {
          this.appStateContext.setViewMode(viewMode);
        }
        return this.success(undefined, "nav.goTo");
      } catch (error) {
        return this.error(error, "nav.goTo");
      }
    },
  };

  private generateId(): ID {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private success<T>(data: T, operation: string): APIResponse<T> {
    return {
      success: true,
      data,
      metadata: {
        timestamp: new Date().toISOString(),
        operation,
        projectId: this.context.projectId ?? undefined,
      },
    };
  }

  private error(error: any, operation: string): APIResponse {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (this.notificationContext) {
      this.notificationContext.showError(errorMessage);
    }

    return {
      success: false,
      error: errorMessage,
      metadata: {
        timestamp: new Date().toISOString(),
        operation,
        projectId: this.context.projectId ?? undefined,
      },
    };
  }

  async batch(
    operations: Array<() => APIResponse<any>>,
  ): Promise<APIResponse<any[]>> {
    const results = [];
    for (const op of operations) {
      const result = await op();
      results.push(result);
      if (!result.success) {
        return this.error(
          `Batch operation failed at step ${results.length}`,
          "batch",
        );
      }
    }
    return this.success(results, "batch");
  }
}

export const api = new UnifiedAPI();

export const terminal = {
  newProject: (name: string) => api.project.create(name),
  save: () => api.project.save(),

  addTimeline: (name: string) => api.timeline.add({ name }),
  listTimelines: () => api.timeline.list(),

  addEvent: (timelineId: ID, title: string, date: string) =>
    api.event.add(timelineId, { title, date }),

  addCharacter: (name: string) => api.kb.character.add({ name }),
  addLocation: (name: string) => api.kb.location.add({ name }),

  addNavButton: (target: string, label: string) =>
    api.nav.addButton(target, label),

  help: () => {
    console.log(`
Available Terminal Commands:
============================
PROJECT:
  terminal.newProject(name)
  terminal.save()

TIMELINE:
  terminal.addTimeline(name)
  terminal.listTimelines()

EVENTS:
  terminal.addEvent(timelineId, title, date)

KNOWLEDGE BASE:
  terminal.addCharacter(name)
  terminal.addLocation(name)

NAVIGATION:
  terminal.addNavButton(target, label)

For full API access, use: api.[category].[method]()
    `);
  },
};

if (typeof window !== "undefined") {
  (window as any).api = api;
  (window as any).terminal = terminal;
}
