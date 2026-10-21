import React, { useMemo, useRef, useState } from "react";
import MainContentArea from "../components/layout/MainContentArea";
import Button from "../components/common/Button";
import { useProjectData } from "../contexts/ProjectDataContext";
import { useAppState } from "../contexts/AppStateContext";
import { useNotification } from "../contexts/NotificationContext";
import { CaseDocumentType } from "../types";
import { LLM_PROVIDERS, getProvider } from "../services/llmProviders";
import {
  analyzeDocumentWithOllama,
  extractDocumentText,
  isPdf,
  isTextLike,
} from "../services/documentAnalysisService";
import {
  deleteCaseFile,
  getCaseFile,
  putCaseFile,
} from "../services/documentStore";
import {
  FiUpload,
  FiFileText,
  FiSearch,
  FiTrash2,
  FiDownload,
  FiCpu,
  FiCheckCircle,
  FiClock,
  FiExternalLink,
  FiBookOpen,
} from "react-icons/fi";

const MAX_FILE = 50 * 1024 * 1024;
const inputClass =
  "w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500";

const sizeLabel = (bytes: number) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${Math.round(bytes / 1024)} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

const CaseDocumentsPage: React.FC = () => {
  const {
    project,
    addCaseDocument,
    updateCaseDocument,
    deleteCaseDocument,
    addSourceDocument,
  } = useProjectData();
  const { setViewMode } = useAppState();
  const { showSuccess, showError, showInfo } = useNotification();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [busy, setBusy] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);

  const documents = useMemo(() => project?.caseDocuments || [], [project?.caseDocuments]);
  const visible = useMemo(
    () =>
      documents.filter(
        (doc) =>
          !search.trim() ||
          doc.name.toLowerCase().includes(search.toLowerCase()) ||
          doc.note.toLowerCase().includes(search.toLowerCase()),
      ),
    [documents, search],
  );
  const selected = useMemo(
    () => documents.find((doc) => doc.id === selectedId) || null,
    [documents, selectedId],
  );

  if (!project) {
    return (
      <MainContentArea title="Documents">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Open a project to keep documents.
        </p>
      </MainContentArea>
    );
  }

  const setStatus = (id: string, message: string) =>
    setBusy((prev) => ({ ...prev, [id]: message }));
  const clearStatus = (id: string) =>
    setBusy((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

  const fileFor = async (doc: CaseDocumentType): Promise<Blob | null> => {
    const stored = await getCaseFile(project.id, doc.id);
    if (stored) return stored;
    if (doc.sourcePath) {
      try {
        const { readFile } = await import("@tauri-apps/plugin-fs");
        const bytes = await readFile(doc.sourcePath);
        return new Blob([bytes], {
          type: doc.mimeType || "application/octet-stream",
        });
      } catch {
        // The imported file is no longer on disk.
      }
    }
    return null;
  };

  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      if (file.size > MAX_FILE) {
        showError(`${file.name} is larger than 50 MB.`);
        continue;
      }
      const id = crypto.randomUUID();
      const ext = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").slice(0, 8) || "";
      const storedName = ext ? `${id}.${ext}` : id;
      try {
        await putCaseFile(project.id, id, file);
        const text =
          isPdf(file) || isTextLike(file) ? await extractDocumentText(file) : "";
        addCaseDocument({
          id,
          name: file.name.slice(0, 200),
          storedName,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          uploaded: new Date().toISOString(),
          status: "new",
          analyzedAt: "",
          analysis: "",
          extractedText: text,
          note: "",
        });
        if (!text && (isPdf(file) || isTextLike(file))) {
          showInfo(`${file.name}: no readable text found (scan or image?).`);
        }
        showSuccess(`${file.name} added.`);
      } catch (error) {
        showError(`Could not store ${file.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    setUploading(false);
  };

  const analyze = async (doc: CaseDocumentType) => {
    setStatus(doc.id, `Analyzing with ${LLM_PROVIDERS[getProvider()].short}…`);
    try {
      const text = doc.extractedText || doc.analysis;
      const reply = await analyzeDocumentWithOllama(doc.name, text);
      updateCaseDocument({
        ...doc,
        analysis: reply,
        analyzedAt: new Date().toISOString(),
        status: "reviewed",
      });
      showSuccess("Document analyzed.");
    } catch (error) {
      showError(error instanceof Error ? error.message : String(error));
    } finally {
      clearStatus(doc.id);
    }
  };

  const reExtract = async (doc: CaseDocumentType) => {
    setStatus(doc.id, "Reading text…");
    try {
      const blob = await fileFor(doc);
      if (!blob) throw new Error("The file is missing from this browser.");
      const file = new File([blob], doc.name, { type: doc.mimeType });
      const text = await extractDocumentText(file);
      updateCaseDocument({ ...doc, extractedText: text });
      showSuccess(text ? "Text extracted." : "No readable text found.");
    } catch (error) {
      showError(error instanceof Error ? error.message : String(error));
    } finally {
      clearStatus(doc.id);
    }
  };

  const download = async (doc: CaseDocumentType) => {
    try {
      const blob = await fileFor(doc);
      if (!blob) throw new Error("The file is missing from this browser.");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = doc.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (error) {
      showError(error instanceof Error ? error.message : String(error));
    }
  };

  const remove = async (doc: CaseDocumentType) => {
    if (!window.confirm(`Delete ${doc.name}?`)) return;
    await deleteCaseFile(project.id, doc.id);
    deleteCaseDocument(doc.id);
    if (selectedId === doc.id) setSelectedId("");
    showSuccess("Document deleted.");
  };

  const addAsSource = (doc: CaseDocumentType) => {
    if (doc.sourceDocumentId) {
      showInfo("This document is already in the Knowledge Base.");
      return;
    }
    const sourceId = addSourceDocument({
      title: doc.name,
      description: doc.analysis || "",
      authors: [],
      publicationDate: doc.uploaded.slice(0, 10),
      type: "Document",
      sourceType: "file",
      url: null,
      filePath: doc.storedName,
      fileName: doc.name,
      notes: doc.extractedText || doc.note,
      tags: ["uploaded"],
      citations: {},
      fileSize: doc.size,
      mimeType: doc.mimeType,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    updateCaseDocument({ ...doc, sourceDocumentId: sourceId });
    showSuccess("Added to Knowledge Base as a source.");
  };

  return (
    <MainContentArea
      title="Documents"
      actions={
        <>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={upload}
          />
          <Button
            variant="outline"
            leftIcon={<FiBookOpen className="h-4 w-4" />}
            onClick={() => setViewMode("tasks")}
          >
            Tasks
          </Button>
          <Button
            variant="primary"
            leftIcon={<FiUpload className="h-4 w-4" />}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? "Uploading…" : "Upload files"}
          </Button>
        </>
      }
    >
      <div className="w-full">
        <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 mb-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <FiSearch className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                className={`${inputClass} pl-9`}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search documents..."
              />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {documents.length} document(s) · stored on this computer
            </span>
          </div>
        </section>

        {documents.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center">
            <FiFileText className="h-8 w-8 mx-auto text-gray-400 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              No documents yet. Upload a letter, notice, ID, or pay stub.
            </p>
            <Button variant="primary" onClick={() => fileInputRef.current?.click()}>
              Upload the first file
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {visible.map((doc) => (
                  <li key={doc.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(doc.id)}
                      className={`w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-700/40 ${
                        selectedId === doc.id ? "bg-blue-50 dark:bg-blue-900/20" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <FiFileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {doc.name}
                        </span>
                        {doc.analysis && (
                          <FiCheckCircle className="h-3.5 w-3.5 text-green-500 ml-auto flex-shrink-0" />
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                        <span>{sizeLabel(doc.size)}</span>
                        <span>·</span>
                        <span>{doc.uploaded.slice(0, 10)}</span>
                        {doc.extractedText && <span className="text-green-600 dark:text-green-400">text</span>}
                      </div>
                    </button>
                  </li>
                ))}
                {visible.length === 0 && (
                  <li className="p-4 text-sm text-gray-500 dark:text-gray-400">
                    No matches.
                  </li>
                )}
              </ul>
            </section>

            <section className="lg:col-span-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              {!selected ? (
                <div className="h-full min-h-[240px] flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  Select a document to read or analyze it.
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white break-all">
                        {selected.name}
                      </h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {sizeLabel(selected.size)} · uploaded {selected.uploaded.replace("T", " ").slice(0, 16)}
                        {selected.analyzedAt ? ` · analyzed ${selected.analyzedAt.slice(0, 10)}` : ""}
                      </p>
                    </div>
                    <div className="ml-auto flex gap-2">
                      <Button variant="outline" size="sm" leftIcon={<FiDownload className="h-3.5 w-3.5" />} onClick={() => void download(selected)}>
                        Download
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/30"
                        leftIcon={<FiTrash2 className="h-3.5 w-3.5" />}
                        onClick={() => void remove(selected)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant="primary"
                      leftIcon={<FiCpu className="h-4 w-4" />}
                      onClick={() => void analyze(selected)}
                      disabled={Boolean(busy[selected.id])}
                    >
                      Analyze with AI
                    </Button>
                    <Button variant="outline" onClick={() => void reExtract(selected)} disabled={Boolean(busy[selected.id])}>
                      Re-read text
                    </Button>
                    <Button
                      variant="outline"
                      leftIcon={selected.analysis ? <FiCheckCircle className="h-4 w-4" /> : <FiClock className="h-4 w-4" />}
                      onClick={() =>
                        updateCaseDocument({
                          ...selected,
                          status: selected.status === "reviewed" ? "new" : "reviewed",
                        })
                      }
                    >
                      {selected.status === "reviewed" ? "Mark new" : "Mark reviewed"}
                    </Button>
                    <Button variant="outline" leftIcon={<FiBookOpen className="h-4 w-4" />} onClick={() => addAsSource(selected)}>
                      Add to Knowledge Base
                    </Button>
                  </div>

                  {busy[selected.id] && (
                    <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                      {busy[selected.id]}
                    </p>
                  )}

                  {selected.analysis && (
                    <div className="mt-4">
                      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
                        Analysis
                      </h3>
                      <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/40 rounded-lg p-3 max-h-[40vh] overflow-auto">
                        {selected.analysis}
                      </pre>
                    </div>
                  )}

                  {selected.extractedText && (
                    <details className="mt-4" open={!selected.analysis}>
                      <summary className="text-sm font-semibold text-gray-800 dark:text-gray-200 cursor-pointer">
                        Extracted text
                      </summary>
                      <pre className="whitespace-pre-wrap text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/40 rounded-lg p-3 max-h-[45vh] overflow-auto mt-2">
                        {selected.extractedText}
                      </pre>
                    </details>
                  )}

                  {!selected.extractedText && (
                    <p className="mt-4 text-xs text-amber-700 dark:text-amber-400">
                      No readable text was found. This may be a scan or a photo.
                      Type a summary in the note if the assistant needs it.
                    </p>
                  )}

                  <div className="mt-4">
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Note
                    </label>
                    <textarea
                      className={inputClass}
                      rows={2}
                      value={selected.note}
                      onChange={(event) =>
                        updateCaseDocument({ ...selected, note: event.target.value.slice(0, 2000) })
                      }
                      placeholder="What is this document for?"
                    />
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </MainContentArea>
  );
};

export default CaseDocumentsPage;
