// @ts-nocheck
/**
 * Zotero Integration Service
 * Manages bibliography and reference synchronization with Zotero
 * Integrated with existing SourceDocumentType from project
 */

import { EventEmitter } from "events";
import { SourceDocumentType } from "../types/project";
import { v4 as uuidv4 } from "uuid";
import { join, appDataDir } from "@tauri-apps/api/path";
import { createDir, writeBinaryFile } from "@tauri-apps/plugin-fs";

export interface ZoteroConfig {
  apiKey?: string;
  userId?: string;
  groupId?: string;
  libraryType: "user" | "group";
  baseUrl?: string;
  syncAttachments?: boolean;
  autoSync?: boolean;
  syncInterval?: number;
  collections?: string[];
}

export interface ZoteroItem {
  key: string;
  version: number;
  data: {
    key: string;
    version: number;
    itemType: string;
    title?: string;
    creators?: Array<{
      creatorType: string;
      firstName?: string;
      lastName?: string;
      name?: string;
    }>;
    abstractNote?: string;
    publicationTitle?: string;
    volume?: string;
    issue?: string;
    pages?: string;
    date?: string;
    DOI?: string;
    ISSN?: string;
    url?: string;
    tags?: Array<{ tag: string; type?: number }>;
    collections?: string[];
    dateAdded?: string;
    dateModified?: string;
  };
  links?: {
    self?: { href: string };
    attachment?: { href: string };
  };
  meta?: {
    creatorSummary?: string;
    parsedDate?: string;
    numChildren?: number;
  };
}

export interface SyncResult {
  added: number;
  updated: number;
  deleted: number;
  attachments: number;
  errors: string[];
}

export class ZoteroIntegration extends EventEmitter {
  private static instance: ZoteroIntegration;
  private config: ZoteroConfig | null = null;
  private apiBase: string = "https://api.zotero.org";
  private syncTimer: NodeJS.Timeout | null = null;
  private itemCache: Map<string, ZoteroItem> = new Map();
  private lastSyncVersion: number = 0;
  private syncInProgress: boolean = false;

  private constructor() {
    super();
  }

  public static getInstance(): ZoteroIntegration {
    if (!ZoteroIntegration.instance) {
      ZoteroIntegration.instance = new ZoteroIntegration();
    }
    return ZoteroIntegration.instance;
  }

  /**
   * Initialize Zotero integration
   */
  async initialize(config: ZoteroConfig): Promise<void> {
    this.config = config;

    if (config.baseUrl) {
      this.apiBase = config.baseUrl;
    }

    try {
      // Verify API access
      await this.verifyAccess();

      // Setup auto-sync if enabled
      if (config.autoSync && config.syncInterval) {
        this.startAutoSync(config.syncInterval);
      }

      this.emit("initialized", config);
    } catch (error) {
      throw new Error(`Zotero initialization failed: ${error.message}`);
    }
  }

  /**
   * Sync references with Zotero library
   */
  async syncReferences(
    existingDocuments: SourceDocumentType[] = [],
  ): Promise<{ documents: SourceDocumentType[]; result: SyncResult }> {
    if (this.syncInProgress) {
      throw new Error("Sync already in progress");
    }

    this.syncInProgress = true;
    this.emit("sync:start");

    const result: SyncResult = {
      added: 0,
      updated: 0,
      deleted: 0,
      attachments: 0,
      errors: [],
    };

    try {
      // Get items from Zotero
      const items = await this.fetchItems();

      // Create lookup map for existing documents using citations as key
      const existingMap = new Map<string, SourceDocumentType>();
      for (const doc of existingDocuments) {
        // Check if document has Zotero key in citations
        const zoteroKey = doc.citations?.zoteroKey;
        if (zoteroKey) {
          existingMap.set(zoteroKey, doc);
        }
      }

      const updatedDocuments: SourceDocumentType[] = [];
      const processedKeys = new Set<string>();

      // Process each Zotero item
      for (const item of items) {
        processedKeys.add(item.key);

        const existing = existingMap.get(item.key);
        const document = this.convertToSourceDocument(item);

        if (!existing) {
          // New item
          updatedDocuments.push(document);
          result.added++;
        } else if (this.hasChanges(existing, item)) {
          // Updated item - preserve existing ID and merge changes
          const updated: SourceDocumentType = {
            ...existing,
            ...document,
            id: existing.id, // Keep existing ID
            tags: [...new Set([...existing.tags, ...document.tags])], // Merge tags
            citations: {
              ...existing.citations,
              ...document.citations,
            },
          };
          updatedDocuments.push(updated);
          result.updated++;
        } else {
          // Unchanged item
          updatedDocuments.push(existing);
        }

        // Sync attachments if enabled
        if (this.config?.syncAttachments) {
          try {
            const attachmentCount = await this.syncAttachments(item, document);
            result.attachments += attachmentCount;
          } catch (error) {
            result.errors.push(
              `Failed to sync attachments for ${item.key}: ${error.message}`,
            );
          }
        }
      }

      // Keep non-Zotero documents and mark deleted Zotero items
      for (const existing of existingDocuments) {
        const zoteroKey = existing.citations?.zoteroKey;
        if (!zoteroKey) {
          // Keep non-Zotero documents
          updatedDocuments.push(existing);
        } else if (!processedKeys.has(zoteroKey)) {
          // Zotero document was deleted
          result.deleted++;
        }
      }

      // Update last sync version
      this.lastSyncVersion = await this.getLibraryVersion();

      this.emit("sync:complete", result);
      return { documents: updatedDocuments, result };
    } catch (error) {
      result.errors.push(error.message);
      this.emit("sync:error", error);
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Import specific items from Zotero
   */
  async importItems(itemKeys: string[]): Promise<SourceDocumentType[]> {
    const documents: SourceDocumentType[] = [];

    for (const key of itemKeys) {
      try {
        const item = await this.fetchItem(key);
        const document = this.convertToSourceDocument(item);
        documents.push(document);

        if (this.config?.syncAttachments) {
          await this.syncAttachments(item, document);
        }
      } catch (error) {
        console.error(`Failed to import item ${key}:`, error);
        this.emit("import:error", { key, error });
      }
    }

    this.emit("import:complete", documents);
    return documents;
  }

  /**
   * Convert Zotero item to SourceDocumentType
   */
  private convertToSourceDocument(item: ZoteroItem): SourceDocumentType {
    const data = item.data;

    // Format authors array
    const authors = (data.creators || [])
      .filter((c) => c.creatorType === "author")
      .map((c) => {
        if (c.lastName && c.firstName) {
          return `${c.lastName}, ${c.firstName}`;
        }
        return c.name || "";
      })
      .filter(Boolean);

    // Format publication date
    const publicationDate = data.date || null;

    return {
      id: uuidv4(),
      title: data.title || "Untitled",
      description: data.abstractNote,
      authors,
      publicationDate,
      type: this.mapItemType(data.itemType),
      sourceType: "url",
      url: data.url || null,
      filePath: null,
      fileName: null,
      notes: "",
      tags: data.tags?.map((t) => t.tag) || [],
      citations: {
        zoteroKey: item.key,
        zoteroVersion: item.version.toString(),
        apa: this.createCitation(item, "apa"),
        mla: this.createCitation(item, "mla"),
        chicago: this.createCitation(item, "chicago"),
        doi: data.DOI,
        issn: data.ISSN,
        volume: data.volume,
        issue: data.issue,
        pages: data.pages,
        publisher: data.publicationTitle,
      },
    };
  }

  /**
   * Map Zotero item type to project document type
   */
  private mapItemType(zoteroType: string): string {
    const typeMap: Record<string, string> = {
      journalArticle: "journal",
      book: "book",
      bookSection: "chapter",
      conferencePaper: "conference",
      thesis: "thesis",
      report: "report",
      webpage: "website",
      manuscript: "manuscript",
      patent: "patent",
      statute: "legal",
      case: "legal",
      newspaperArticle: "newspaper",
      magazineArticle: "magazine",
      blogPost: "blog",
      videoRecording: "video",
      audioRecording: "audio",
      presentation: "presentation",
      map: "map",
      email: "email",
      instantMessage: "message",
      forumPost: "forum",
      interview: "interview",
      letter: "letter",
      note: "note",
    };

    return typeMap[zoteroType] || "other";
  }

  /**
   * Create citation string
   */
  private createCitation(
    item: ZoteroItem,
    style: "apa" | "mla" | "chicago" = "apa",
  ): string {
    const data = item.data;
    const creators = data.creators || [];
    const year = data.date ? new Date(data.date).getFullYear() : "n.d.";

    let citation = "";

    if (style === "apa") {
      // APA Style
      if (creators.length > 0) {
        const author = creators[0];
        if (author.lastName) {
          citation = `${author.lastName}, ${author.firstName?.[0] || ""}. `;
        } else if (author.name) {
          citation = `${author.name}. `;
        }
      }

      citation += `(${year}). `;

      if (data.title) {
        citation += `${data.title}. `;
      }

      if (data.publicationTitle) {
        citation += `*${data.publicationTitle}*`;
        if (data.volume) {
          citation += `, ${data.volume}`;
          if (data.issue) {
            citation += `(${data.issue})`;
          }
        }
        if (data.pages) {
          citation += `, ${data.pages}`;
        }
        citation += ". ";
      }

      if (data.DOI) {
        citation += `https://doi.org/${data.DOI}`;
      } else if (data.url) {
        citation += data.url;
      }
    } else if (style === "mla") {
      // MLA Style
      if (creators.length > 0) {
        const author = creators[0];
        if (author.lastName && author.firstName) {
          citation = `${author.lastName}, ${author.firstName}. `;
        } else if (author.name) {
          citation = `${author.name}. `;
        }
      }

      if (data.title) {
        citation += `"${data.title}." `;
      }

      if (data.publicationTitle) {
        citation += `*${data.publicationTitle}*`;
        if (data.volume) {
          citation += `, vol. ${data.volume}`;
        }
        if (data.issue) {
          citation += `, no. ${data.issue}`;
        }
        citation += `, ${year}`;
        if (data.pages) {
          citation += `, pp. ${data.pages}`;
        }
        citation += ".";
      }
    } else if (style === "chicago") {
      // Chicago Style
      if (creators.length > 0) {
        const author = creators[0];
        if (author.lastName && author.firstName) {
          citation = `${author.lastName}, ${author.firstName}. `;
        } else if (author.name) {
          citation = `${author.name}. `;
        }
      }

      if (data.title) {
        citation += `"${data.title}." `;
      }

      if (data.publicationTitle) {
        citation += `*${data.publicationTitle}* `;
      }

      if (data.volume) {
        citation += `${data.volume}`;
        if (data.issue) {
          citation += `, no. ${data.issue}`;
        }
      }

      citation += ` (${year})`;

      if (data.pages) {
        citation += `: ${data.pages}`;
      }

      citation += ".";
    }

    return citation.trim();
  }

  /**
   * Check if document has changes from Zotero
   */
  private hasChanges(existing: SourceDocumentType, item: ZoteroItem): boolean {
    const existingVersion = parseInt(existing.citations?.zoteroVersion || "0");
    return existingVersion < item.version;
  }

  /**
   * API Helper Methods
   */
  private async verifyAccess(): Promise<void> {
    const url = this.buildUrl("/keys/current");
    const response = await this.makeRequest(url.toString());

    if (!response.ok) {
      throw new Error("Invalid API key or access denied");
    }
  }

  private buildUrl(endpoint: string): URL {
    const libraryPath =
      this.config?.libraryType === "group"
        ? `/groups/${this.config.groupId}`
        : `/users/${this.config.userId}`;

    return new URL(`${this.apiBase}${libraryPath}${endpoint}`);
  }

  private async makeRequest(
    url: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const headers: Record<string, string> = {
      "Zotero-API-Version": "3",
      ...(options.headers as Record<string, string>),
    };

    if (this.config?.apiKey) {
      headers["Zotero-API-Key"] = this.config.apiKey;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok && response.status !== 404) {
      const error = await response.text();
      throw new Error(`Zotero API error: ${response.status} - ${error}`);
    }

    return response;
  }

  private async fetchItems(since?: number): Promise<ZoteroItem[]> {
    const url = this.buildUrl("/items");
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "100");

    if (since) {
      url.searchParams.set("since", since.toString());
    }

    if (this.config?.collections && this.config.collections.length > 0) {
      for (const collectionKey of this.config.collections) {
        url.searchParams.append("collectionKey", collectionKey);
      }
    }

    const items: ZoteroItem[] = [];
    let start = 0;
    let hasMore = true;

    while (hasMore) {
      url.searchParams.set("start", start.toString());
      const response = await this.makeRequest(url.toString());
      const batch = await response.json();

      items.push(...batch);

      const totalResults = response.headers.get("Total-Results");
      if (totalResults) {
        const total = parseInt(totalResults, 10);
        hasMore = start + batch.length < total;
        start += batch.length;
      } else {
        hasMore = false;
      }
    }

    // Update cache
    for (const item of items) {
      this.itemCache.set(item.key, item);
    }

    return items;
  }

  private async fetchItem(key: string): Promise<ZoteroItem> {
    if (this.itemCache.has(key)) {
      return this.itemCache.get(key)!;
    }

    const url = this.buildUrl(`/items/${key}`);
    const response = await this.makeRequest(url.toString());
    const item = await response.json();

    this.itemCache.set(key, item);
    return item;
  }

  private async getLibraryVersion(): Promise<number> {
    const url = this.buildUrl("/items");
    url.searchParams.set("format", "versions");
    url.searchParams.set("limit", "1");

    const response = await this.makeRequest(url.toString());
    const versionHeader = response.headers.get("Last-Modified-Version");

    return versionHeader ? parseInt(versionHeader, 10) : 0;
  }

  private async syncAttachments(
    item: ZoteroItem,
    document: SourceDocumentType,
  ): Promise<number> {
    // Implementation for attachment sync
    // This would download PDFs and other attachments
    return 0;
  }

  private startAutoSync(interval: number): void {
    this.stopAutoSync();

    this.syncTimer = setInterval(async () => {
      try {
        const version = await this.getLibraryVersion();

        if (version > this.lastSyncVersion) {
          // Auto-sync would be triggered by the project service
          this.emit("autosync:needed");
        }
      } catch (error) {
        console.error("Auto-sync check failed:", error);
      }
    }, interval);
  }

  private stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Search Zotero library
   */
  async searchLibrary(query: string): Promise<ZoteroItem[]> {
    const url = this.buildUrl("/items");
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "50");

    const response = await this.makeRequest(url.toString());
    return await response.json();
  }

  /**
   * Get collections
   */
  async getCollections(): Promise<any[]> {
    const url = this.buildUrl("/collections");
    const response = await this.makeRequest(url.toString());
    return await response.json();
  }

  /**
   * Export documents to Zotero
   */
  async exportToZotero(documents: SourceDocumentType[]): Promise<string[]> {
    const exportedKeys: string[] = [];

    for (const document of documents) {
      if (document.citations?.zoteroKey) {
        // Skip already synced documents
        continue;
      }

      try {
        const zoteroItem = this.convertToZoteroItem(document);
        const url = this.buildUrl("/items");

        const response = await this.makeRequest(url.toString(), {
          method: "POST",
          body: JSON.stringify([zoteroItem]),
          headers: {
            "Content-Type": "application/json",
          },
        });

        const result = await response.json();
        if (result.successful) {
          const key = Object.keys(result.successful)[0];
          exportedKeys.push(key);
        }
      } catch (error) {
        console.error(`Failed to export document ${document.id}:`, error);
      }
    }

    return exportedKeys;
  }

  private convertToZoteroItem(document: SourceDocumentType): any {
    return {
      itemType: this.reverseMapItemType(document.type),
      title: document.title,
      abstractNote: document.description,
      creators: this.parseAuthors(document.authors),
      date: document.publicationDate,
      url: document.url,
      DOI: document.citations?.doi,
      tags: document.tags.map((tag) => ({ tag })),
    };
  }

  private reverseMapItemType(type: string): string {
    const reverseMap: Record<string, string> = {
      journal: "journalArticle",
      book: "book",
      chapter: "bookSection",
      conference: "conferencePaper",
      thesis: "thesis",
      report: "report",
      website: "webpage",
      manuscript: "manuscript",
      patent: "patent",
      legal: "statute",
    };

    return reverseMap[type] || "document";
  }

  private parseAuthors(authors: string[]): any[] {
    return authors.map((author) => {
      const parts = author.split(",");
      if (parts.length === 2) {
        return {
          creatorType: "author",
          lastName: parts[0].trim(),
          firstName: parts[1].trim(),
        };
      } else {
        return {
          creatorType: "author",
          name: author.trim(),
        };
      }
    });
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.stopAutoSync();
    this.removeAllListeners();
    this.itemCache.clear();
    this.config = null;
  }
}
