// src/pages/UnifiedWritingPage.tsx

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { ReactFlowProvider } from "@xyflow/react";
import {
  FiFile,
  FiFolder,
  FiBook,
  FiPlus,
  FiSearch,
  FiEdit3,
  FiEye,
  FiSave,
  FiTrash2,
  FiGrid,
  FiList,
  FiX,
  FiChevronRight,
  FiChevronDown,
  FiClock,
  FiHash,
} from "react-icons/fi";
import { FaStream, FaProjectDiagram } from "react-icons/fa";

import { useProjectData } from "../contexts/ProjectDataContext";
import { useNotification } from "../contexts/NotificationContext";
import MainContentArea from "../components/layout/MainContentArea";
import Button from "../components/common/Button";
import Modal from "../components/common/Modal";
import InputField from "../components/common/InputField";
import NarrativeResourcePanel from "../components/NarrativeResourcePanel";
import ContentEditableWithTags, {
  ContentEditableRef,
} from "../components/common/ContentEditableWithTags";

import {
  Document,
  DocumentType,
  Narrative,
  DocumentFolder,
  ViewMode,
  EditorMode,
  ResourceLink,
} from "../types/writing";
import { ID, NarrativeType, SceneType } from "../types";

// Migration utility
const migrateExistingData = (
  project: any,
): { documents: Document[]; narratives: Narrative[] } => {
  const documents: Document[] = [];
  const narratives: Narrative[] = [];

  // Migrate existing narratives and scenes
  if (project.reports) {
    project.reports.forEach((oldNarrative: NarrativeType) => {
      // Create new narrative
      const narrative: Narrative = {
        id: oldNarrative.id,
        title: oldNarrative.title,
        description: oldNarrative.description,
        type: oldNarrative.narrativeType === "flow" ? "branching" : "linear",
        documentIds: [],
        viewPreference: oldNarrative.narrativeType === "flow" ? "flow" : "list",
        defaultEditorMode: "split",
        timelineId: oldNarrative.timelineId || undefined,
        metadata: {
          totalWords: 0,
          totalScenes: oldNarrative.scenes?.length || 0,
          lastModified: new Date(oldNarrative.updatedAt),
          created: new Date(oldNarrative.createdAt),
        },
        tags: oldNarrative.tags || [],
      };

      // Migrate scenes as documents
      if (oldNarrative.scenes) {
        oldNarrative.scenes.forEach((scene: SceneType) => {
          const doc: Document = {
            id: scene.id,
            type: "scene",
            title: scene.title || `Scene ${scene.order}`,
            content: scene.content || "",
            format: "html",
            parentId: null,
            narrativeId: oldNarrative.id,
            order: scene.order,
            linkedResources: extractResourcesFromContent(scene.content),
            linkedDocuments: [],
            tags: [],
            metadata: {
              wordCount: scene.content ? scene.content.split(" ").length : 0,
              lastEdited: new Date(),
              created: new Date(),
              viewMode: "split",
            },
          };
          documents.push(doc);
          narrative.documentIds.push(doc.id);
        });
      }

      // Update word count
      narrative.metadata.totalWords = narrative.documentIds
        .map((id) => documents.find((d) => d.id === id))
        .filter(Boolean)
        .reduce((sum, doc) => sum + (doc?.metadata.wordCount || 0), 0);

      narratives.push(narrative);
    });
  }

  // Migrate existing notes from localStorage
  const notesKey = `notes_${project.id}`;
  const existingNotes = localStorage.getItem(notesKey);
  if (existingNotes) {
    try {
      const notes = JSON.parse(existingNotes);
      notes.forEach((note: any) => {
        const doc: Document = {
          id: note.id,
          type: "note",
          title: note.title,
          content: convertMarkdownToHTML(note.content),
          format: "html",
          parentId: note.folder !== "root" ? note.folder : null,
          narrativeId: null,
          order: 0,
          linkedResources: note.linkedEntities || [],
          linkedDocuments: note.linkedNotes || [],
          tags: note.tags || [],
          metadata: {
            wordCount: note.content ? note.content.split(" ").length : 0,
            lastEdited: new Date(note.updatedAt),
            created: new Date(note.createdAt),
            viewMode: "edit",
          },
        };
        documents.push(doc);
      });
    } catch (e) {
      console.error("Failed to migrate notes:", e);
    }
  }

  return { documents, narratives };
};

const extractResourcesFromContent = (content: string): ResourceLink[] => {
  if (!content) return [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, "text/html");
  const tags = doc.querySelectorAll(".resource-tag");

  return Array.from(tags).map((tag) => ({
    type: tag.getAttribute("data-type") || "unknown",
    id: tag.getAttribute("data-id") || "",
    name: tag.getAttribute("data-name") || tag.textContent || "",
  }));
};

const convertMarkdownToHTML = (markdown: string): string => {
  let html = markdown;

  // Convert wiki links
  html = html.replace(
    /\[\[([^\]]+)\]\]/g,
    '<a class="wiki-link" data-doc="$1">$1</a>',
  );

  // Convert entity references
  html = html.replace(
    /@(\w+):([^@\s]+)/g,
    '<span class="resource-tag" data-type="$1" data-name="$2">@$1:$2</span>',
  );

  // Convert headers
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Convert formatting
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  return html;
};

const UnifiedWritingPageInternal: React.FC = () => {
  const { project } = useProjectData();
  const { showSuccess, showError, showInfo } = useNotification();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [narratives, setNarratives] = useState<Narrative[]>([]);
  const [folders, setFolders] = useState<DocumentFolder[]>([
    {
      id: "root",
      name: "All Documents",
      parentId: null,
      documentIds: [],
      folderIds: [],
      metadata: { documentCount: 0, created: new Date(), modified: new Date() },
    },
  ]);

  const [selectedDocument, setSelectedDocument] = useState<Document | null>(
    null,
  );
  const [selectedNarrative, setSelectedNarrative] = useState<Narrative | null>(
    null,
  );
  const [selectedFolder, setSelectedFolder] = useState<string>("root");

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [editorMode, setEditorMode] = useState<EditorMode>("split");
  const [searchQuery, setSearchQuery] = useState("");

  const [editContent, setEditContent] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createType, setCreateType] = useState<DocumentType>("note");

  const contentEditableRef = useRef<ContentEditableRef>(null);
  const [contentKey, setContentKey] = useState(0);

  // Load and migrate data on mount
  useEffect(() => {
    if (!project) return;

    const storageKey = `unified_documents_${project.id}`;
    const narrativesKey = `unified_narratives_${project.id}`;
    const migrationKey = `unified_migration_${project.id}`;

    // Check if already migrated
    const alreadyMigrated = localStorage.getItem(migrationKey);

    if (!alreadyMigrated) {
      showInfo(
        "Migrating your existing content to the unified writing system...",
      );
      const { documents: migratedDocs, narratives: migratedNarratives } =
        migrateExistingData(project);

      setDocuments(migratedDocs);
      setNarratives(migratedNarratives);

      // Save migrated data
      localStorage.setItem(storageKey, JSON.stringify(migratedDocs));
      localStorage.setItem(narrativesKey, JSON.stringify(migratedNarratives));
      localStorage.setItem(migrationKey, "true");

      showSuccess("Migration complete! All your content has been preserved.");
    } else {
      // Load existing unified data
      const savedDocs = localStorage.getItem(storageKey);
      const savedNarratives = localStorage.getItem(narrativesKey);

      if (savedDocs) setDocuments(JSON.parse(savedDocs));
      if (savedNarratives) setNarratives(JSON.parse(savedNarratives));
    }
  }, [project, showInfo, showSuccess]);

  // Save documents when changed
  const saveDocuments = useCallback(
    (docs: Document[]) => {
      if (!project) return;
      const storageKey = `unified_documents_${project.id}`;
      localStorage.setItem(storageKey, JSON.stringify(docs));
      setDocuments(docs);
    },
    [project],
  );

  // Save narratives when changed
  const saveNarratives = useCallback(
    (narrs: Narrative[]) => {
      if (!project) return;
      const narrativesKey = `unified_narratives_${project.id}`;
      localStorage.setItem(narrativesKey, JSON.stringify(narrs));
      setNarratives(narrs);
    },
    [project],
  );

  // Filter documents based on search
  const filteredDocuments = useMemo(() => {
    let filtered = documents;

    // Filter by folder
    if (selectedFolder !== "root") {
      filtered = filtered.filter((doc) => doc.parentId === selectedFolder);
    }

    // Filter by narrative
    if (selectedNarrative) {
      filtered = filtered.filter((doc) =>
        selectedNarrative.documentIds.includes(doc.id),
      );
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (doc) =>
          doc.title.toLowerCase().includes(query) ||
          doc.content.toLowerCase().includes(query) ||
          doc.tags.some((tag) => tag.toLowerCase().includes(query)),
      );
    }

    return filtered;
  }, [documents, selectedFolder, selectedNarrative, searchQuery]);

  // Group documents by type
  const documentsByType = useMemo(() => {
    const grouped: Record<DocumentType, Document[]> = {
      narrative: [],
      scene: [],
      chapter: [],
      note: [],
      worldbuilding: [],
      character_sheet: [],
      research: [],
      outline: [],
      snippet: [],
    };

    filteredDocuments.forEach((doc) => {
      if (grouped[doc.type]) {
        grouped[doc.type].push(doc);
      }
    });

    return grouped;
  }, [filteredDocuments]);

  // Handle document selection
  const handleSelectDocument = useCallback((doc: Document) => {
    setSelectedDocument(doc);
    setEditTitle(doc.title);
    setEditContent(doc.content);
    setContentKey((prev) => prev + 1);
    setIsDirty(false);
  }, []);

  // Handle document creation
  const handleCreateDocument = useCallback(
    (type: DocumentType, title: string) => {
      const newDoc: Document = {
        id: `doc_${Date.now()}`,
        type,
        title: title || `New ${type}`,
        content: "",
        format: "html",
        parentId: selectedFolder !== "root" ? selectedFolder : null,
        narrativeId: selectedNarrative?.id || null,
        order: documents.length,
        linkedResources: [],
        linkedDocuments: [],
        tags: [],
        metadata: {
          wordCount: 0,
          lastEdited: new Date(),
          created: new Date(),
          viewMode: "split",
        },
      };

      const updatedDocs = [...documents, newDoc];
      saveDocuments(updatedDocs);

      // Add to narrative if one is selected
      if (selectedNarrative) {
        const updatedNarrative = {
          ...selectedNarrative,
          documentIds: [...selectedNarrative.documentIds, newDoc.id],
          metadata: {
            ...selectedNarrative.metadata,
            lastModified: new Date(),
          },
        };
        const updatedNarratives = narratives.map((n) =>
          n.id === selectedNarrative.id ? updatedNarrative : n,
        );
        saveNarratives(updatedNarratives);
        setSelectedNarrative(updatedNarrative);
      }

      handleSelectDocument(newDoc);
      setIsCreateModalOpen(false);
      showSuccess(`Created new ${type}: ${title}`);
    },
    [
      documents,
      selectedFolder,
      selectedNarrative,
      narratives,
      saveDocuments,
      saveNarratives,
      handleSelectDocument,
      showSuccess,
    ],
  );

  // Handle document save
  const handleSaveDocument = useCallback(() => {
    if (!selectedDocument) return;

    const wordCount = editContent
      .split(/\s+/)
      .filter((word) => word.length > 0).length;

    const updatedDoc: Document = {
      ...selectedDocument,
      title: editTitle.trim() || "Untitled",
      content: editContent,
      metadata: {
        ...selectedDocument.metadata,
        wordCount,
        lastEdited: new Date(),
      },
      linkedResources: extractResourcesFromContent(editContent),
    };

    const updatedDocs = documents.map((d) =>
      d.id === selectedDocument.id ? updatedDoc : d,
    );
    saveDocuments(updatedDocs);
    setSelectedDocument(updatedDoc);
    setIsDirty(false);
    showSuccess("Document saved");
  }, [
    selectedDocument,
    editTitle,
    editContent,
    documents,
    saveDocuments,
    showSuccess,
  ]);

  // Handle document deletion
  const handleDeleteDocument = useCallback(
    (docId: string) => {
      if (!confirm("Are you sure you want to delete this document?")) return;

      const updatedDocs = documents.filter((d) => d.id !== docId);
      saveDocuments(updatedDocs);

      // Remove from narratives
      const updatedNarratives = narratives.map((n) => ({
        ...n,
        documentIds: n.documentIds.filter((id) => id !== docId),
      }));
      saveNarratives(updatedNarratives);

      if (selectedDocument?.id === docId) {
        setSelectedDocument(null);
        setEditTitle("");
        setEditContent("");
      }

      showSuccess("Document deleted");
    },
    [
      documents,
      narratives,
      selectedDocument,
      saveDocuments,
      saveNarratives,
      showSuccess,
    ],
  );

  // Handle resource insertion
  const handleInsertResource = useCallback(
    (type: string, name: string, id: ID) => {
      if (!contentEditableRef.current) return;

      const html = `<span contentEditable="false" class="resource-tag bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-0.5 rounded-full text-sm inline-block mx-0.5 cursor-default" data-id="${id}" data-type="${type}" data-name="${name}">${name}</span>&nbsp;`;
      contentEditableRef.current.insertHtml(html);
      setIsDirty(true);
    },
    [],
  );

  if (!project) {
    return (
      <MainContentArea title="Writing">
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500">No project loaded</p>
        </div>
      </MainContentArea>
    );
  }

  return (
    <MainContentArea title="Writing" noPadding={true}>
      <div className="flex h-full bg-gray-50 dark:bg-gray-900">
        {/* Sidebar */}
        <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <Button
              variant="primary"
              className="w-full"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <FiPlus className="mr-2" />
              New Document
            </Button>
          </div>

          <div className="p-4">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-200 dark:border-gray-600 rounded-md"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4">
            {/* Narratives */}
            {narratives.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Narratives
                </h3>
                {narratives.map((narrative) => (
                  <button
                    key={narrative.id}
                    onClick={() => setSelectedNarrative(narrative)}
                    className={`w-full text-left px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      selectedNarrative?.id === narrative.id
                        ? "bg-blue-100 dark:bg-blue-900"
                        : ""
                    }`}
                  >
                    <FiBook className="inline mr-2" />
                    {narrative.title}
                    <span className="ml-2 text-xs text-gray-500">
                      ({narrative.documentIds.length})
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Documents by Type */}
            {Object.entries(documentsByType).map(([type, docs]) => {
              if (docs.length === 0) return null;

              return (
                <div key={type} className="mb-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    {type.replace("_", " ")}s ({docs.length})
                  </h3>
                  {docs.map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => handleSelectDocument(doc)}
                      className={`w-full text-left px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
                        selectedDocument?.id === doc.id
                          ? "bg-blue-100 dark:bg-blue-900"
                          : ""
                      }`}
                    >
                      <FiFile className="inline mr-2 text-gray-400" />
                      <span className="truncate">{doc.title}</span>
                      {doc.tags.length > 0 && (
                        <FiHash className="inline ml-2 text-gray-400 text-xs" />
                      )}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {selectedDocument ? (
            <>
              {/* Document Header */}
              <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => {
                        setEditTitle(e.target.value);
                        setIsDirty(true);
                      }}
                      className="text-xl font-semibold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none"
                    />
                    {isDirty && (
                      <span className="text-xs text-orange-500">
                        Unsaved changes
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Editor Mode Toggle */}
                    <div className="flex bg-gray-100 dark:bg-gray-700 rounded p-1">
                      <button
                        onClick={() => setEditorMode("edit")}
                        className={`px-3 py-1 rounded ${editorMode === "edit" ? "bg-white dark:bg-gray-600 shadow" : ""}`}
                      >
                        <FiEdit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditorMode("preview")}
                        className={`px-3 py-1 rounded ${editorMode === "preview" ? "bg-white dark:bg-gray-600 shadow" : ""}`}
                      >
                        <FiEye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditorMode("split")}
                        className={`px-3 py-1 rounded ${editorMode === "split" ? "bg-white dark:bg-gray-600 shadow" : ""}`}
                      >
                        Split
                      </button>
                    </div>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSaveDocument}
                      disabled={!isDirty}
                    >
                      <FiSave className="mr-1" />
                      Save
                    </Button>

                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDeleteDocument(selectedDocument.id)}
                    >
                      <FiTrash2 />
                    </Button>
                  </div>
                </div>

                {/* Document metadata */}
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <span className="flex items-center">
                    <FiClock className="mr-1" />
                    {new Date(
                      selectedDocument.metadata.lastEdited,
                    ).toLocaleString()}
                  </span>
                  <span>{selectedDocument.metadata.wordCount || 0} words</span>
                  {selectedDocument.tags.length > 0 && (
                    <span className="flex items-center">
                      <FiHash className="mr-1" />
                      {selectedDocument.tags.join(", ")}
                    </span>
                  )}
                </div>
              </div>

              {/* Editor */}
              <div className="flex-1 flex overflow-hidden">
                {(editorMode === "edit" || editorMode === "split") && (
                  <div
                    className={`${editorMode === "split" ? "w-1/2" : "w-full"} p-6`}
                  >
                    <ContentEditableWithTags
                      key={contentKey}
                      ref={contentEditableRef}
                      value={editContent}
                      onChange={(html) => {
                        setEditContent(html);
                        setIsDirty(true);
                      }}
                      className="w-full h-full p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                {(editorMode === "preview" || editorMode === "split") && (
                  <div
                    className={`${editorMode === "split" ? "w-1/2 border-l" : "w-full"} p-6 overflow-auto bg-white dark:bg-gray-800`}
                  >
                    <div
                      className="prose dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: editContent }}
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <FiFile className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500 mb-4">
                  Select a document or create a new one
                </p>
                <Button
                  variant="primary"
                  onClick={() => setIsCreateModalOpen(true)}
                >
                  Create New Document
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Resource Panel */}
        <div className="w-80 border-l border-gray-200 dark:border-gray-700">
          <NarrativeResourcePanel onInsertResource={handleInsertResource} />
        </div>
      </div>

      {/* Create Document Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Document"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Document Type
            </label>
            <select
              value={createType}
              onChange={(e) => setCreateType(e.target.value as DocumentType)}
              className="w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-md"
            >
              <option value="note">Note</option>
              <option value="scene">Scene</option>
              <option value="chapter">Chapter</option>
              <option value="worldbuilding">Worldbuilding</option>
              <option value="character_sheet">Character Sheet</option>
              <option value="research">Research</option>
              <option value="outline">Outline</option>
              <option value="snippet">Snippet</option>
            </select>
          </div>

          <InputField
            label="Title"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder={`Enter ${createType} title...`}
            required
          />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => handleCreateDocument(createType, editTitle)}
            disabled={!editTitle.trim()}
          >
            Create
          </Button>
        </div>
      </Modal>
    </MainContentArea>
  );
};

const UnifiedWritingPage: React.FC = () => (
  <ReactFlowProvider>
    <UnifiedWritingPageInternal />
  </ReactFlowProvider>
);

export default UnifiedWritingPage;
