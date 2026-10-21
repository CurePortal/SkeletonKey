import React, { useMemo, useState } from "react";
import JSZip from "jszip";
import MainContentArea from "../components/layout/MainContentArea";
import Button from "../components/common/Button";
import { useProjectData } from "../contexts/ProjectDataContext";
import { useNotification } from "../contexts/NotificationContext";
import { CaseDocumentType, TaskStatus, TaskType } from "../types";
import { getCaseFile } from "../services/documentStore";
import {
  FiPlus,
  FiTrash2,
  FiClock,
  FiCheckCircle,
  FiDownload,
} from "react-icons/fi";

const STATUS_ORDER: TaskStatus[] = ["todo", "doing", "blocked", "done"];
const ACTIVE_STATUS_ORDER: TaskStatus[] = STATUS_ORDER.filter(
  (status) => status !== "done",
);


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
  const { showSuccess, showError } = useNotification();

  const [title, setTitle] = useState("");
  const [dueEnd, setDueEnd] = useState("");
  const [multiDue, setMultiDue] = useState(false);
  const [taskEntityIds, setTaskEntityIds] = useState<string[]>([]);
  const [due, setDue] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [packingId, setPackingId] = useState("");

  const tasks = useMemo(() => project?.tasks || [], [project?.tasks]);
  const documents = useMemo(
    () => project?.caseDocuments || [],
    [project?.caseDocuments],
  );
  const knowledgeBase = useMemo(
    () =>
      [
        { key: "characters", label: "Characters", rows: project?.characters || [] },
        { key: "locations", label: "Locations", rows: project?.locations || [] },
        {
          key: "technologies",
          label: "Technologies",
          rows: project?.technologies || [],
        },
        { key: "cultures", label: "Cultures", rows: project?.cultures || [] },
      ].filter((group) => group.rows.length > 0),
    [
      project?.characters,
      project?.locations,
      project?.technologies,
      project?.cultures,
    ],
  );
  const knowledgeBaseById = useMemo(() => {
    const rows = new Map<string, { name: string; kind: string }>();
    for (const group of knowledgeBase) {
      for (const row of group.rows) {
        rows.set(row.id, { name: row.name, kind: group.label });
      }
    }
    return rows;
  }, [knowledgeBase]);
  const visible = useMemo(
    () =>
      tasks.filter(
        (task) => statusFilter === "all" || task.status === statusFilter,
      ),
    [tasks, statusFilter],
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
      section: "General",
      status: "todo",
      due,
      dueEnd: multiDue ? dueEnd || undefined : undefined,
      notes: [],
      documentIds: [],
      linkedEntityIds: taskEntityIds,
    });
    setTitle("");
    setDue("");
    setDueEnd("");
    setMultiDue(false);
    setTaskEntityIds([]);
    showSuccess("Task added.");
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

  const toggleEntity = (task: TaskType, entityId: string) => {
    const ids = Array.isArray(task.linkedEntityIds)
      ? task.linkedEntityIds
      : [];
    updateTask({
      ...task,
      linkedEntityIds: ids.includes(entityId)
        ? ids.filter((id) => id !== entityId)
        : [...ids, entityId],
    });
  };

  const toggleDraftEntity = (entityId: string) => {
    setTaskEntityIds((current) =>
      current.includes(entityId)
        ? current.filter((id) => id !== entityId)
        : [...current, entityId],
    );
  };

  const today = new Date().toISOString().slice(0, 10);

  const renderTaskCard = (task: TaskType) => {
    const deadline = task.dueEnd || task.due;
    const overdue = Boolean(
      deadline && deadline < today && task.status !== "done",
    );
    const linkedEntities = (task.linkedEntityIds || [])
      .map((id) => knowledgeBaseById.get(id))
      .filter((row): row is { name: string; kind: string } => Boolean(row));
    return (
      <article
        key={task.id}
        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3"
      >
        <div className="flex items-start gap-2">
          <select
            value={task.status}
            onChange={(event) =>
              updateTask({
                ...task,
                status: event.target.value as TaskStatus,
              })
            }
            className={`cursor-pointer rounded-full border-0 text-[10px] font-semibold px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 ${statusStyle(task.status)}`}
            title="Change status"
          >
            {STATUS_ORDER.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </select>
          {task.section && task.section !== "General" && (
            <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
              {task.section}
            </span>
          )}
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
          <div
            className={`mt-1 flex items-center gap-1 text-[11px] ${overdue ? "text-red-600 dark:text-red-400" : "text-gray-500 dark:text-gray-400"}`}
          >
            <FiClock className="h-3 w-3" /> {task.due}
            {task.dueEnd && task.dueEnd !== task.due
              ? ` → ${task.dueEnd}`
              : ""}
            {overdue ? " · overdue" : ""}
          </div>
        )}

        {linkedEntities.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {linkedEntities.map((row) => (
              <span
                key={`${row.kind}-${row.name}`}
                className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                title={row.kind}
              >
                {row.name}
              </span>
            ))}
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

        {knowledgeBase.length > 0 && (
          <details className="mt-2">
            <summary className="text-[11px] text-gray-500 dark:text-gray-400 cursor-pointer">
              Knowledge base ({(task.linkedEntityIds || []).length})
            </summary>
            <div className="mt-1 max-h-40 overflow-auto space-y-2">
              {knowledgeBase.map((group) => (
                <div key={group.key}>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    {group.label}
                  </p>
                  <div className="space-y-1">
                    {group.rows.map((row) => (
                      <label
                        key={row.id}
                        className="flex items-center gap-2 text-[11px] text-gray-600 dark:text-gray-300"
                      >
                        <input
                          type="checkbox"
                          checked={(task.linkedEntityIds || []).includes(
                            row.id,
                          )}
                          onChange={() => toggleEntity(task, row.id)}
                        />
                        <span className="truncate">{row.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
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
            {packingId === task.id ? "Preparing pack…" : "Document pack"}
          </button>
        )}
      </article>
    );
  };

  const renderColumn = (
    status: TaskStatus,
    layout: "stack" | "grid" = "stack",
  ) => (
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
      <div
        className={
          layout === "grid"
            ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2"
            : "space-y-2"
        }
      >
        {grouped[status].map(renderTaskCard)}
        {grouped[status].length === 0 && (
          <p className="text-[11px] text-gray-400 dark:text-gray-500 px-1 py-2">
            Nothing here.
          </p>
        )}
      </div>
    </section>
  );

  return (
    <MainContentArea
      title="Tasks"
      inlineActions={
        <>
          <select
            className={`${inputClass} w-40 max-w-full`}
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
          <span className="text-xs whitespace-nowrap text-gray-500 dark:text-gray-400">
            {tasks.filter((t) => t.status !== "done").length} open ·{" "}
            {tasks.length} total
          </span>
        </>
      }
    >
      <div className="w-full">
        <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 mb-3">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <div className="sm:col-span-4">
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
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Knowledge base tags
              </label>
              <details className="relative">
                <summary
                  className={`${inputClass} cursor-pointer list-none truncate`}
                >
                  {taskEntityIds.length === 0
                    ? "Tag records…"
                    : `${taskEntityIds.length} record${
                        taskEntityIds.length === 1 ? "" : "s"
                      } tagged`}
                </summary>
                <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-md border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-600 dark:bg-gray-800">
                  {knowledgeBase.length === 0 ? (
                    <p className="px-1 py-2 text-[11px] text-gray-500 dark:text-gray-400">
                      No knowledge base records yet.
                    </p>
                  ) : (
                    knowledgeBase.map((group) => (
                      <div key={group.key} className="mb-2 last:mb-0">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                          {group.label}
                        </p>
                        <div className="space-y-1">
                          {group.rows.map((row) => (
                            <label
                              key={row.id}
                              className="flex items-center gap-2 text-[11px] text-gray-600 dark:text-gray-300"
                            >
                              <input
                                type="checkbox"
                                checked={taskEntityIds.includes(row.id)}
                                onChange={() => toggleDraftEntity(row.id)}
                              />
                              <span className="truncate">{row.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </details>
            </div>
            <div className="sm:col-span-5">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Due date
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  className={`${inputClass} min-w-0 flex-1`}
                  value={due}
                  onChange={(event) => setDue(event.target.value)}
                  aria-label="Due date"
                  title="Due date"
                />
                <label className="flex items-center gap-1 whitespace-nowrap text-[11px] text-gray-500 dark:text-gray-400">
                  <input
                    type="checkbox"
                    checked={multiDue}
                    onChange={(event) => {
                      setMultiDue(event.target.checked);
                      if (!event.target.checked) setDueEnd("");
                    }}
                  />
                  Multiple dates
                </label>
                {multiDue && (
                  <>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">
                      to
                    </span>
                    <input
                      type="date"
                      className={`${inputClass} min-w-0 flex-1`}
                      value={dueEnd}
                      min={due || undefined}
                      onChange={(event) => setDueEnd(event.target.value)}
                      aria-label="End date"
                      title="End date"
                    />
                  </>
                )}
                <Button
                  variant="primary"
                  leftIcon={<FiPlus className="h-4 w-4" />}
                  onClick={add}
                >
                  Add
                </Button>
              </div>
            </div>
          </div>
        </section>

        {tasks.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center">
            <FiCheckCircle className="h-8 w-8 mx-auto text-gray-400 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No tasks yet. Add the first thing that needs to happen.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {ACTIVE_STATUS_ORDER.map((status) => renderColumn(status))}
            </div>
            {renderColumn("done", "grid")}
          </div>
        )}
      </div>
    </MainContentArea>
  );
};

export default TasksPage;
