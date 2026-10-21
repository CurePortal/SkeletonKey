import React, { useMemo, useState } from "react";
import JSZip from "jszip";
import MainContentArea from "../components/layout/MainContentArea";
import Button from "../components/common/Button";
import { useProjectData } from "../contexts/ProjectDataContext";
import { useAppState } from "../contexts/AppStateContext";
import { useNotification } from "../contexts/NotificationContext";
import { CaseDocumentType, TaskStatus, TaskType } from "../types";
import { getCaseFile } from "../services/documentStore";
import {
  FiPlus,
  FiTrash2,
  FiClock,
  FiFileText,
  FiCheckCircle,
  FiSearch,
  FiDownload,
} from "react-icons/fi";

const STATUS_ORDER: TaskStatus[] = ["todo", "doing", "blocked", "done"];
const DEFAULT_SECTIONS = [
  "Money & benefits",
  "Housing",
  "Food",
  "Health",
  "Legal",
  "Documents & ID",
  "Work & income",
  "Transportation",
  "Family",
  "Other",
];

const statusLabel = (status: TaskStatus) =>
  ({ todo: "To do", doing: "In progress", blocked: "Blocked", done: "Done" })[
    status
  ];

const statusStyle = (status: TaskStatus) =>
  ({
    todo: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
    doing: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    blocked: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    done: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  })[status];

const inputClass =
  "w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500";

const TasksPage: React.FC = () => {
  const { project, addTask, updateTask, deleteTask } = useProjectData();
  const { setViewMode } = useAppState();
  const { showSuccess, showError } = useNotification();

  const [title, setTitle] = useState("");
  const [section, setSection] = useState("Other");
  const [due, setDue] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [packingId, setPackingId] = useState("");

  const tasks = useMemo(() => project?.tasks || [], [project?.tasks]);
  const documents = useMemo(
    () => project?.caseDocuments || [],
    [project?.caseDocuments],
  );
  const sections = useMemo(
    () => [...new Set([...DEFAULT_SECTIONS, ...tasks.map((t) => t.section)])],
    [tasks],
  );
  const visible = useMemo(
    () =>
      tasks.filter((task) => {
        if (statusFilter !== "all" && task.status !== statusFilter) return false;
        if (!search.trim()) return true;
        const needle = search.toLowerCase();
        return (
          task.title.toLowerCase().includes(needle) ||
          task.section.toLowerCase().includes(needle) ||
          (Array.isArray(task.notes) ? task.notes : []).some((note) =>
            String(note?.text || "").toLowerCase().includes(needle),
          )
        );
      }),
    [tasks, statusFilter, search],
  );

  const grouped = useMemo(() => {
    const map: Record<TaskStatus, TaskType[]> = {
      todo: [],
      doing: [],
      blocked: [],
      done: [],
    };
    for (const task of visible) map[task.status].push(task);
    for (const key of STATUS_ORDER) {
      map[key].sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
    }
    return map;
  }, [visible]);

  if (!project) {
    return (
      <MainContentArea title="Tasks">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Open a project to start a task list.
        </p>
      </MainContentArea>
    );
  }

  const projectId = project.id;

  const fileFor = async (doc: CaseDocumentType): Promise<Blob | null> => {
    const stored = await getCaseFile(projectId, doc.id);
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

  const safeFileName = (name: string, fallback: string): string => {
    const base = name.replace(/\\/g, "/").split("/").pop() || "";
    const cleaned = base
      .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, " ")
      .replace(/\s+/g, " ")
      .replace(/^[.\s]+/, "")
      .trim();
    return (cleaned || fallback).slice(0, 120);
  };

  const uniqueFileName = (name: string, used: Set<string>): string => {
    if (!used.has(name.toLowerCase())) {
      used.add(name.toLowerCase());
      return name;
    }
    const dot = name.lastIndexOf(".");
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : "";
    let index = 2;
    let candidate = `${stem} (${index})${ext}`;
    while (used.has(candidate.toLowerCase())) {
      index += 1;
      candidate = `${stem} (${index})${ext}`;
    }
    used.add(candidate.toLowerCase());
    return candidate;
  };

  const downloadPack = async (task: TaskType) => {
    const attached = documents.filter((doc) =>
      task.documentIds.includes(doc.id),
    );
    if (!attached.length) return;
    setPackingId(task.id);
    try {
      const zip = new JSZip();
      const used = new Set<string>();
      const entries: Array<{ file: string; doc: CaseDocumentType }> = [];
      for (const doc of attached) {
        const blob = await fileFor(doc);
        if (!blob) continue;
        const file = uniqueFileName(safeFileName(doc.name, doc.id), used);
        zip.file(file, blob);
        entries.push({ file, doc });
      }
      const missing = attached.length - entries.length;
      const generated = new Date().toLocaleString();
      const lines = [
        "SkeletonKey document pack",
        "",
        `Task: ${task.title}`,
        `Area: ${task.section}`,
        `Status: ${statusLabel(task.status)}`,
        `Due: ${task.due || "not set"}`,
        `Generated: ${generated}`,
      ];
      if (Array.isArray(task.notes) && task.notes.length) {
        lines.push("", "Notes:");
        for (const note of task.notes) {
          lines.push(`- ${note.ts ? `${note.ts} ` : ""}${note.text}`);
        }
      }
      lines.push("", `Files (${entries.length}):`);
      entries.forEach((entry, index) => {
        const number = String(index + 1).padStart(2, "0");
        const original =
          entry.doc.name === entry.file ? "" : ` (${entry.doc.name})`;
        lines.push(`${number}. ${entry.file}${original}`);
      });
      if (missing) {
        lines.push("", `${missing} attached file(s) were missing and left out.`);
      }
      lines.push(
        "",
        "This pack was assembled locally. Nothing has been filed or sent.",
      );
      zip.file("00-INDEX.txt", lines.join("\n"));

      if (!entries.length) {
        showError("None of the attached files could be found in this browser.");
        return;
      }

      const blob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
      });
      const slug =
        task.title
          .normalize("NFKD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 48) || "task";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `packet-${new Date().toISOString().slice(0, 10)}-${slug}.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      showSuccess(
        missing
          ? `Pack downloaded with ${entries.length} file(s); ${missing} were missing.`
          : `Document pack downloaded (${entries.length} file(s)).`,
      );
    } catch (error) {
      showError(
        `Could not build the document pack: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setPackingId("");
    }
  };

  const add = () => {
    if (!title.trim()) return;
    addTask({
      title: title.trim().slice(0, 200),
      section,
      status: "todo",
      due,
      notes: [],
      documentIds: [],
    });
    setTitle("");
    setDue("");
    showSuccess("Task added.");
  };

  const cycle = (task: TaskType) => {
    const next =
      STATUS_ORDER[(STATUS_ORDER.indexOf(task.status) + 1) % STATUS_ORDER.length];
    updateTask({ ...task, status: next });
  };

  const addNote = (task: TaskType) => {
    const text = (noteDrafts[task.id] || "").trim();
    if (!text) return;
    updateTask({
      ...task,
      notes: [
        ...(Array.isArray(task.notes) ? task.notes : []),
        { ts: new Date().toLocaleString(), text: text.slice(0, 4000) },
      ],
    });
    setNoteDrafts((prev) => ({ ...prev, [task.id]: "" }));
  };

  const toggleDocument = (task: TaskType, docId: string) => {
    const has = task.documentIds.includes(docId);
    updateTask({
      ...task,
      documentIds: has
        ? task.documentIds.filter((id) => id !== docId)
        : [...task.documentIds, docId],
    });
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <MainContentArea
      title="Tasks"
      actions={
        <Button
          variant="outline"
          leftIcon={<FiFileText className="h-4 w-4" />}
          onClick={() => setViewMode("documents")}
        >
          Documents
        </Button>
      }
    >
      <div className="w-full">
        <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 mb-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                What needs to happen?
              </label>
              <input
                className={inputClass}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Call the housing office"
                onKeyDown={(event) => {
                  if (event.key === "Enter") add();
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Area
              </label>
              <input
                className={inputClass}
                value={section}
                onChange={(event) => setSection(event.target.value)}
                list="task-sections"
              />
              <datalist id="task-sections">
                {sections.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Due
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  className={inputClass}
                  value={due}
                  onChange={(event) => setDue(event.target.value)}
                />
                <Button variant="primary" leftIcon={<FiPlus className="h-4 w-4" />} onClick={add}>
                  Add
                </Button>
              </div>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <FiSearch className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              className={`${inputClass} pl-9`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tasks, areas, notes..."
            />
          </div>
          <select
            className={`${inputClass} max-w-[180px]`}
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as "all" | TaskStatus)
            }
          >
            <option value="all">All statuses</option>
            {STATUS_ORDER.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </select>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {tasks.filter((t) => t.status !== "done").length} open · {tasks.length} total
          </span>
        </div>

        {tasks.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center">
            <FiCheckCircle className="h-8 w-8 mx-auto text-gray-400 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No tasks yet. Add the first thing that needs to happen.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {STATUS_ORDER.map((status) => (
              <section
                key={status}
                className="bg-gray-100/70 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    {statusLabel(status)}
                  </h2>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {grouped[status].length}
                  </span>
                </div>
                <div className="space-y-2">
                  {grouped[status].map((task) => {
                    const overdue =
                      task.due && task.due < today && task.status !== "done";
                    return (
                      <article
                        key={task.id}
                        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                      >
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            onClick={() => cycle(task)}
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusStyle(task.status)}`}
                            title="Change status"
                          >
                            {statusLabel(task.status)}
                          </button>
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                            {task.section}
                          </span>
                          <button
                            type="button"
                            className="ml-auto text-gray-400 hover:text-red-500"
                            onClick={() => deleteTask(task.id)}
                            aria-label="Delete task"
                          >
                            <FiTrash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white mt-2">
                          {task.title}
                        </h3>
                        {task.due && (
                          <div className={`mt-1 flex items-center gap-1 text-[11px] ${overdue ? "text-red-600 dark:text-red-400" : "text-gray-500 dark:text-gray-400"}`}>
                            <FiClock className="h-3 w-3" /> {task.due}
                            {overdue ? " · overdue" : ""}
                          </div>
                        )}

                        {Array.isArray(task.notes) && task.notes.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {task.notes.slice(-3).map((note, index) => (
                              <li
                                key={`${note.ts}-${index}`}
                                className="text-[11px] text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 rounded px-2 py-1"
                              >
                                {note.text}
                              </li>
                            ))}
                          </ul>
                        )}

                        <div className="mt-2 flex gap-1">
                          <input
                            className="flex-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-[11px] text-gray-900 dark:text-white"
                            placeholder="Add a note"
                            value={noteDrafts[task.id] || ""}
                            onChange={(event) =>
                              setNoteDrafts((prev) => ({
                                ...prev,
                                [task.id]: event.target.value,
                              }))
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter") addNote(task);
                            }}
                          />
                          <button
                            type="button"
                            className="text-[11px] text-blue-600 dark:text-blue-400"
                            onClick={() => addNote(task)}
                          >
                            Save
                          </button>
                        </div>

                        {documents.length > 0 && (
                          <details className="mt-2">
                            <summary className="text-[11px] text-gray-500 dark:text-gray-400 cursor-pointer">
                              Documents ({task.documentIds.length})
                            </summary>
                            <div className="mt-1 max-h-28 overflow-auto space-y-1">
                              {documents.map((doc) => (
                                <label
                                  key={doc.id}
                                  className="flex items-center gap-2 text-[11px] text-gray-600 dark:text-gray-300"
                                >
                                  <input
                                    type="checkbox"
                                    checked={task.documentIds.includes(doc.id)}
                                    onChange={() => toggleDocument(task, doc.id)}
                                  />
                                  <span className="truncate">{doc.name}</span>
                                </label>
                              ))}
                            </div>
                          </details>
                        )}

                        {task.documentIds.length > 0 && (
                          <button
                            type="button"
                            onClick={() => void downloadPack(task)}
                            disabled={packingId === task.id}
                            className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50"
                            title="Download a ZIP with a cover index and all documents attached to this task"
                          >
                            <FiDownload className="h-3 w-3" />
                            {packingId === task.id
                              ? "Preparing pack…"
                              : "Document pack"}
                          </button>
                        )}
                      </article>
                    );
                  })}
                  {grouped[status].length === 0 && (
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 px-1 py-2">
                      Nothing here.
                    </p>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </MainContentArea>
  );
};

export default TasksPage;
