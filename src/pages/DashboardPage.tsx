import React, { useCallback, useEffect, useState } from "react";
import { FaPencilAlt, FaSyncAlt } from "react-icons/fa";
import { useProjectData } from "../contexts/ProjectDataContext";
import { useAppState } from "../contexts/AppStateContext";
import MainContentArea from "../components/layout/MainContentArea";
import Button from "../components/common/Button";
import {
  BeaconPosition,
  LocalHealth,
  beaconHealth,
  localHealth,
} from "../services/mapIntelligenceService";

const DashboardPage: React.FC = () => {
  const { project } = useProjectData();
  const {
    setViewMode,
    setCurrentTimelineId,
    setCurrentKnowledgeBaseCategory,
    setSelectedKnowledgeBaseEntityId,
    openModal,
    appState: { currentTimelineId },
  } = useAppState();

  const [health, setHealth] = useState<LocalHealth | null>(null);
  const [beacon, setBeacon] = useState<BeaconPosition | null>(null);
  const [healthError, setHealthError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setHealthError("");
    try {
      const [nextHealth, nextBeacon] = await Promise.all([
        localHealth(),
        beaconHealth().catch(() => null),
      ]);
      setHealth(nextHealth);
      setBeacon(nextBeacon?.latest ?? null);
    } catch (error) {
      setHealth(null);
      setHealthError(error instanceof Error ? error.message : String(error));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 20_000);
    return () => clearInterval(timer);
  }, [refresh]);

  const formatDate = (value?: string) => {
    if (!value) return "";
    try {
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [year, month, day] = value.split("-").map(Number);
        return new Date(year, month - 1, day).toLocaleDateString();
      }
      return new Date(value).toLocaleDateString();
    } catch {
      return value;
    }
  };

  const formatAge = (ts: number) => {
    const seconds = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (seconds < 90) return `${seconds}s`;
    if (seconds < 5400) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  const openView = (mode: Parameters<typeof setViewMode>[0]) => {
    setViewMode(mode);
    setCurrentKnowledgeBaseCategory(null);
    setSelectedKnowledgeBaseEntityId(null);
  };

  const openCategory = (
    category: "characters" | "locations" | "technologies" | "cultures" | "sources",
  ) => {
    setViewMode("knowledge-base");
    setCurrentKnowledgeBaseCategory(category);
    setSelectedKnowledgeBaseEntityId(null);
  };

  const openTimeline = (timelineId?: string) => {
    setViewMode("timeline");
    if (timelineId) setCurrentTimelineId(timelineId);
    else if (project?.timelines.length && !currentTimelineId) {
      setCurrentTimelineId(project.timelines[0].id);
    }
  };

  if (!project) {
    return (
      <MainContentArea title="Overview">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No project open.
        </p>
      </MainContentArea>
    );
  }

  const events = (project.timelines || []).flatMap((timeline) =>
    (timeline.events || []).map((event) => ({
      ...event,
      timelineId: timeline.id,
      timelineName: timeline.name,
    })),
  );
  const recentEvents = [...events]
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .slice(0, 6);
  const allOpenTasks = (project.tasks || []).filter(
    (task) => task.status !== "done",
  );
  const openTasks = [...allOpenTasks]
    .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"))
    .slice(0, 6);
  const recentDocuments = [...(project.caseDocuments || [])]
    .sort((a, b) => (b.uploaded || "").localeCompare(a.uploaded || ""))
    .slice(0, 5);

  const stats = [
    {
      label: "Places",
      value: project.locations?.length || 0,
      onClick: () => openCategory("locations"),
    },
    {
      label: "Sources",
      value: project.sources?.length || 0,
      onClick: () => openCategory("sources"),
    },
    {
      label: "Events",
      value: events.length,
      onClick: () => openTimeline(),
    },
    {
      label: "People",
      value: project.characters?.length || 0,
      onClick: () => openCategory("characters"),
    },
    {
      label: "Documents",
      value: project.caseDocuments?.length || 0,
      onClick: () => openView("documents"),
    },
    {
      label: "Open tasks",
      value: allOpenTasks.length,
      onClick: () => openView("tasks"),
    },
    {
      label: "Reports",
      value: project.reports?.length || 0,
      onClick: () => openView("narrative"),
    },
    {
      label: "Timelines",
      value: project.timelines?.length || 0,
      onClick: () => openTimeline(),
    },
  ];

  const serviceChips = [
    { label: "Bridge", on: health?.ok },
    { label: "Beacon", on: health?.beacon },
    { label: "Valhalla", on: health?.valhalla },
    { label: "Gazetteer", on: health?.gazetteer },
    { label: "Ollama", on: health?.ollama },
    { label: "Beancount", on: health?.beancount },
    { label: "Fava", on: health?.fava },
  ];

  return (
    <MainContentArea
      title="Overview"
      subtitle={project.name}
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => openModal("edit_project")}
          leftIcon={<FaPencilAlt className="h-3.5 w-3.5" />}
        >
          Edit project
        </Button>
      }
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2 mb-3">
        {stats.map((stat) => (
          <button
            key={stat.label}
            type="button"
            onClick={stat.onClick}
            className="text-left rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 hover:border-blue-500 dark:hover:border-blue-400"
          >
            <span className="block text-[11px] text-gray-500 dark:text-gray-400">
              {stat.label}
            </span>
            <span className="block text-xl font-semibold text-gray-900 dark:text-white leading-tight">
              {stat.value}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <section className="xl:col-span-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Live position
            </h2>
            <div className="flex items-center gap-2">
              {beacon && (
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  {formatAge(beacon.ts)}
                </span>
              )}
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={refreshing}
                className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 disabled:opacity-50"
              >
                <FaSyncAlt className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => openView("map")}
                className="text-[11px] text-blue-600 dark:text-blue-400"
              >
                Open
              </button>
            </div>
          </div>
          {healthError ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">{healthError}</p>
          ) : beacon ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded border border-gray-200 dark:border-gray-700 px-2 py-1.5">
                <div className="text-[10px] text-gray-500 dark:text-gray-400">Lat</div>
                <div className="text-sm font-medium">{beacon.lat.toFixed(5)}</div>
              </div>
              <div className="rounded border border-gray-200 dark:border-gray-700 px-2 py-1.5">
                <div className="text-[10px] text-gray-500 dark:text-gray-400">Lon</div>
                <div className="text-sm font-medium">{beacon.lon.toFixed(5)}</div>
              </div>
              <div className="rounded border border-gray-200 dark:border-gray-700 px-2 py-1.5">
                <div className="text-[10px] text-gray-500 dark:text-gray-400">Speed</div>
                <div className="text-sm font-medium">
                  {beacon.speed != null ? `${beacon.speed.toFixed(2)} m/s` : "—"}
                </div>
              </div>
              <div className="rounded border border-gray-200 dark:border-gray-700 px-2 py-1.5">
                <div className="text-[10px] text-gray-500 dark:text-gray-400">Battery</div>
                <div className="text-sm font-medium">
                  {beacon.battery != null ? `${Math.round(beacon.battery)}%` : "—"}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              No position received.
            </p>
          )}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {serviceChips.map((chip) => (
              <span
                key={chip.label}
                className={`text-[10px] rounded-full border px-2 py-0.5 ${
                  chip.on
                    ? "border-green-600 text-green-700 dark:text-green-400"
                    : "border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400"
                }`}
              >
                {chip.label}
              </span>
            ))}
          </div>
        </section>

        <section className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
          <div className="flex items-center justify-between mb-1.5">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Open tasks
            </h2>
            <button
              type="button"
              onClick={() => openView("tasks")}
              className="text-[11px] text-blue-600 dark:text-blue-400"
            >
              All
            </button>
          </div>
          {openTasks.length ? (
            <ul className="space-y-1">
              {openTasks.map((task) => (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => openView("tasks")}
                    className="w-full flex items-center gap-2 text-left text-xs rounded px-1.5 py-1 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        task.status === "blocked"
                          ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {task.status}
                    </span>
                    <span className="flex-1 truncate">{task.title}</span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">
                      {formatDate(task.due)}
                      {task.dueEnd && task.dueEnd !== task.due
                        ? ` – ${formatDate(task.dueEnd)}`
                        : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">Nothing open.</p>
          )}
        </section>

        <section className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
          <div className="flex items-center justify-between mb-1.5">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Recent activity
            </h2>
            <button
              type="button"
              onClick={() => openTimeline()}
              className="text-[11px] text-blue-600 dark:text-blue-400"
            >
              Timeline
            </button>
          </div>
          {recentEvents.length ? (
            <ul className="space-y-1">
              {recentEvents.map((event) => (
                <li key={event.id}>
                  <button
                    type="button"
                    onClick={() => openTimeline(event.timelineId)}
                    className="w-full flex items-center gap-2 text-left text-xs rounded px-1.5 py-1 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <span className="flex-1 truncate">{event.title}</span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">
                      {formatDate(event.date)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">No activity.</p>
          )}
        </section>

        <section className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
          <div className="flex items-center justify-between mb-1.5">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Recent documents
            </h2>
            <button
              type="button"
              onClick={() => openView("documents")}
              className="text-[11px] text-blue-600 dark:text-blue-400"
            >
              All
            </button>
          </div>
          {recentDocuments.length ? (
            <ul className="space-y-1">
              {recentDocuments.map((doc) => (
                <li key={doc.id}>
                  <button
                    type="button"
                    onClick={() => openView("documents")}
                    className="w-full flex items-center gap-2 text-left text-xs rounded px-1.5 py-1 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <span className="flex-1 truncate">{doc.name}</span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">
                      {formatDate(doc.uploaded)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">No documents.</p>
          )}
        </section>

        <section className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1.5">
            Local services
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {serviceChips.map((chip) => (
              <span
                key={chip.label}
                className={`text-[10px] rounded-full border px-2 py-0.5 ${
                  chip.on
                    ? "border-green-600 text-green-700 dark:text-green-400"
                    : "border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400"
                }`}
              >
                {chip.label}
              </span>
            ))}
          </div>
          {health?.version && (
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1.5">
              Valhalla {health.version}
            </p>
          )}
        </section>
      </div>
    </MainContentArea>
  );
};

export default DashboardPage;
