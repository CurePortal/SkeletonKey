import React, { useEffect, useState } from "react";
import MainContentArea from "../components/layout/MainContentArea";
import AboutSupport from "../components/settings/AboutSupport";
import Button from "../components/common/Button";
import { useUITheme } from "../contexts/UIThemeContext";
import { useAppState } from "../contexts/AppStateContext";
import { useProjectData } from "../contexts/ProjectDataContext";
import { useNotification } from "../contexts/NotificationContext";
import { checkOllamaStatus } from "../services/ollamaService";
import {
  LLM_PROVIDERS,
  getModel,
  getProvider,
  getProviderKey,
  listProviderModels,
  setProviderKey,
  setSelection,
  type LlmProvider,
} from "../services/llmProviders";
import {
  getMapTileSettings,
  setMapTileSettings,
  type MapTileStyle,
} from "../services/mapTiles";
import {
  bridgeUrl,
  localHealth,
  setBridgeUrl,
  type LocalHealth,
} from "../services/mapIntelligenceService";
import {
  hqPullProject,
  hqPushProject,
  hqStatus,
  hqUrl,
  setHqUrl,
  type HqStatus,
} from "../services/hqBridgeService";
import {
  FiCpu,
  FiMap,
  FiRadio,
  FiShield,
  FiSave,
  FiRefreshCw,
  FiDownload,
  FiUploadCloud,
  FiPackage,
  FiPlay,
  FiSquare,
  FiTerminal,
  FiServer,
  FiDollarSign,
} from "react-icons/fi";
import {
  cancelSetupJob,
  setupJob,
  setupStatus,
  startSetup,
  type SetupJob,
  type SetupStatus,
} from "../services/setupService";

const inputClass =
  "w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500";

const SettingsPage: React.FC = () => {
  const { theme, setTheme } = useUITheme();
  const { appState, setAutoSaveDelay } = useAppState();
  const {
    project,
    setProject,
    hasUnsavedChanges,
    updateFinanceSettings,
  } = useProjectData();
  const { showSuccess, showError, showInfo } = useNotification();

  const [provider, setProvider] = useState<LlmProvider>(() => getProvider());
  const [aiModel, setAiModel] = useState(() => getModel());
  const [aiKey, setAiKey] = useState(() => getProviderKey(getProvider()));
  const [contextSize, setContextSize] = useState(
    () => localStorage.getItem("ollama-context-size") || "32768",
  );
  const [models, setModels] = useState<string[]>([]);
  const [modelError, setModelError] = useState("");
  const [checkingModels, setCheckingModels] = useState(false);
  const [ollamaOnline, setOllamaOnline] = useState(false);

  const [mapStyle, setMapStyle] = useState<MapTileStyle>(
    () => getMapTileSettings().style,
  );
  const [cartoKey, setCartoKey] = useState(
    () => getMapTileSettings().cartoKey,
  );

  const [financeLedger, setFinanceLedger] = useState(
    project?.financeSettings?.ledgerFile || "~/Documents/SkeletonKey/finances/main.beancount",
  );
  const [financeFava, setFinanceFava] = useState(
    project?.financeSettings?.favaUrl || "http://127.0.0.1:5001",
  );
  const [financeStatus, setFinanceStatus] = useState<
    "unknown" | "checking" | "reachable" | "unreachable"
  >("unknown");

  const [geoUrl, setGeoUrl] = useState(bridgeUrl());
  const [hqBase, setHqBase] = useState(hqUrl());
  const [geoHealth, setGeoHealth] = useState<LocalHealth | null>(null);
  const [hqHealth, setHqHealth] = useState<HqStatus | null>(null);
  const [testingGeo, setTestingGeo] = useState(false);
  const [testingHq, setTestingHq] = useState(false);

  const [setup, setSetup] = useState<SetupStatus | null>(null);
  const [setupError, setSetupError] = useState("");
  const [setupRegion, setSetupRegion] = useState("north-america");
  const [setupJobState, setSetupJobState] = useState<SetupJob | null>(null);
  const [setupStarting, setSetupStarting] = useState(false);

  const refreshModels = async (
    nextProvider: LlmProvider = provider,
    nextKey: string = aiKey,
  ) => {
    setCheckingModels(true);
    setModelError("");
    try {
      const list = await listProviderModels(nextProvider, nextKey);
      setModels(list);
      if (!aiModel && list.length) setAiModel(list[0]);
      if (aiModel && list.length && !list.includes(aiModel)) setAiModel(list[0]);
      if (!list.length) setModelError("No models were returned. Check the key or provider.");
    } catch (error) {
      setModels([]);
      setModelError(error instanceof Error ? error.message : String(error));
    } finally {
      setCheckingModels(false);
    }
    if (nextProvider === "ollama") {
      setOllamaOnline(await checkOllamaStatus());
    } else {
      setOllamaOnline(false);
    }
  };

  const changeProvider = (next: LlmProvider) => {
    setProvider(next);
    const nextKey = getProviderKey(next);
    setAiKey(nextKey);
    setModels([]);
    setAiModel("");
    void refreshModels(next, nextKey);
  };

  useEffect(() => {
    void refreshModels();
  }, []);


  const saveAi = () => {
    if (!aiModel) {
      showError("Choose a model first.");
      return;
    }
    setProviderKey(provider, aiKey);
    setSelection(provider, aiModel);
    localStorage.setItem("ollama-context-size", contextSize);
    showSuccess("AI model settings saved.");
  };

  const saveMapTiles = () => {
    setMapTileSettings({ style: mapStyle, cartoKey });
    showSuccess("Map tile settings saved.");
  };

  const testGeo = async () => {
    setTestingGeo(true);
    try {
      setGeoHealth(await localHealth());
    } catch (error) {
      setGeoHealth(null);
      showError(error instanceof Error ? error.message : String(error));
    } finally {
      setTestingGeo(false);
    }
  };

  const checkFinanceServer = async () => {
    setFinanceStatus("checking");
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      await fetch(financeFava, {
        mode: "no-cors",
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timer);
      setFinanceStatus("reachable");
    } catch {
      setFinanceStatus("unreachable");
    }
  };

  const saveFinance = () => {
    updateFinanceSettings({ ledgerFile: financeLedger, favaUrl: financeFava });
    showSuccess("Finance settings saved.");
    void checkFinanceServer();
  };

  const saveServices = async () => {
    setBridgeUrl(geoUrl);
    setHqUrl(hqBase);
    await testGeo();
    await testHq();
    showSuccess("Local service settings saved.");
  };

  const testHq = async () => {
    setTestingHq(true);
    try {
      setHqHealth(await hqStatus());
    } catch (error) {
      setHqHealth(null);
      showError(error instanceof Error ? error.message : String(error));
    } finally {
      setTestingHq(false);
    }
  };

  const sendToHq = async () => {
    if (!project) {
      showInfo("Open a project first.");
      return;
    }
    try {
      const status = await hqPushProject(project);
      setHqHealth(status);
      showSuccess(`Project sent to HQ: ${status.project.name}`);
    } catch (error) {
      showError(error instanceof Error ? error.message : String(error));
    }
  };

  const loadFromHq = async () => {
    if (
      project &&
      hasUnsavedChanges &&
      !window.confirm("Replace the current project with the HQ project?")
    ) {
      return;
    }
    try {
      const incoming = await hqPullProject();
      setProject(incoming, null);
      showSuccess(`Loaded ${incoming.name} from HQ.`);
    } catch (error) {
      showError(error instanceof Error ? error.message : String(error));
    }
  };

  const refreshSetup = async () => {
    setSetupError("");
    try {
      const status = await setupStatus();
      setSetup(status);
      setSetupRegion((current) => current || status.defaults.region);
    } catch (error) {
      setSetup(null);
      setSetupError(error instanceof Error ? error.message : String(error));
    }
  };

  useEffect(() => {
    void refreshSetup();
  }, []);

  useEffect(() => {
    if (!setupJobState || setupJobState.status !== "running") return;
    const timer = setInterval(async () => {
      try {
        const job = await setupJob(setupJobState.id);
        setSetupJobState(job);
        if (job.status !== "running") {
          await refreshSetup();
        }
      } catch {
        // Keep polling; the service may be starting.
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [setupJobState?.id, setupJobState?.status]);

  const runSetup = async (
    target: "ollama" | "maps" | "services" | "hq",
  ) => {
    setSetupStarting(true);
    setSetupError("");
    try {
      const result = await startSetup(target, {
        region: setupRegion,
      });
      setSetupJobState(result.job);
      showSuccess(`Started: ${target}. This can run for a while.`);
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : String(error));
    } finally {
      setSetupStarting(false);
    }
  };

  const stopSetup = async () => {
    if (!setupJobState) return;
    try {
      await cancelSetupJob(setupJobState.id);
      setSetupJobState({ ...setupJobState, status: "cancelled" });
    } catch (error) {
      showError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <MainContentArea
      title="Settings"
    >
      <div className="max-w-5xl mx-auto space-y-5">
        <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            Appearance and saving
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Theme
              </label>
              <select
                className={inputClass}
                value={theme}
                onChange={(event) =>
                  setTheme(event.target.value as "light" | "dark" | "system")
                }
              >
                <option value="system">System</option>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Auto-save delay
              </label>
              <select
                className={inputClass}
                value={appState.autoSaveDelay}
                onChange={(event) => setAutoSaveDelay(Number(event.target.value))}
              >
                <option value={3000}>3 seconds</option>
                <option value={10000}>10 seconds</option>
                <option value={30000}>30 seconds</option>
              </select>
            </div>
            <div className="flex items-end">
              <span className="inline-flex items-center gap-2 text-xs text-green-700 dark:text-green-400">
                <FiShield className="h-4 w-4" /> Local only
              </span>
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <FiPackage className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Set up this machine
            </h2>
            <button
              type="button"
              onClick={() => void refreshSetup()}
              className="ml-auto inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400"
            >
              <FiRefreshCw className="h-3.5 w-3.5" /> Check
            </button>
          </div>
          {setupError && <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">{setupError}</p>}
          {setup && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                  <FiCpu className="h-4 w-4" /> Ollama
                  <span className={`ml-auto text-[10px] ${setup.ollama.running ? "text-green-600 dark:text-green-400" : "text-gray-400"}`}>
                    {setup.ollama.running ? "running" : setup.ollama.installed ? "installed" : "missing"}
                  </span>
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                  <FiMap className="h-4 w-4" /> Offline maps
                  <span className={`ml-auto text-[10px] ${setup.maps.built ? "text-green-600 dark:text-green-400" : "text-gray-400"}`}>
                    {setup.maps.built ? "ready" : "not built"}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                  Valhalla {setup.maps.valhallaRunning ? "up" : "down"} · gazetteer {setup.maps.gazetteerBuilt ? "ready" : "missing"}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                  <FiServer className="h-4 w-4" /> HQ services
                  <span className={`ml-auto text-[10px] ${setup.services.mcp ? "text-green-600 dark:text-green-400" : "text-gray-400"}`}>
                    {setup.services.mcp ? "ready" : "offline"}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                  bridge {setup.services.bridge ? "up" : "down"} · opencode {setup.services.opencode ? "up" : "off"}
                </p>
              </div>
            </div>
          )}

          <div className="max-w-xs">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Map region
            </label>
            <select
              className={inputClass}
              value={setupRegion}
              onChange={(event) => setSetupRegion(event.target.value)}
            >
              <option value="north-america">North America</option>
              <option value="central-america">Central America</option>
              <option value="south-america">South America</option>
              <option value="europe">Europe</option>
              <option value="africa">Africa</option>
              <option value="asia">Asia</option>
              <option value="australia-oceania">Australia / Oceania</option>
            </select>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void runSetup("ollama")} disabled={setupStarting}>Install Ollama</Button>
            <Button variant="outline" onClick={() => void runSetup("maps")} disabled={setupStarting}>Build offline maps</Button>
            <Button variant="outline" onClick={() => void runSetup("services")} disabled={setupStarting}>Start local services</Button>
          </div>

          {setupJobState && (
            <div className="mt-4 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 text-xs">
                <FiTerminal className="h-4 w-4" />
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  {setupJobState.target}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                  setupJobState.status === "done"
                    ? "border-green-600 text-green-700 dark:text-green-400"
                    : setupJobState.status === "error"
                      ? "border-red-500 text-red-600 dark:text-red-400"
                      : "border-blue-500 text-blue-600 dark:text-blue-400"
                }`}>
                  {setupJobState.status}
                </span>
                {setupJobState.status === "running" && (
                  <button type="button" onClick={() => void stopSetup()} className="ml-auto inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                    <FiSquare className="h-3 w-3" /> Stop
                  </button>
                )}
              </div>
              <pre className="text-[11px] leading-relaxed bg-gray-900 text-gray-200 p-3 max-h-56 overflow-auto whitespace-pre-wrap">
                {setupJobState.tail || "Waiting for output…"}
              </pre>
            </div>
          )}
          {setup && (
            <p className="mt-3 text-[11px] text-gray-400 break-all">
              Node {setup.runtime.node} · repo {setup.repoDir}
            </p>
          )}
        </section>

        <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <FiCpu className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              AI model
            </h2>
            <span
              className={`ml-2 text-[11px] px-2 py-0.5 rounded-full border ${
                provider === "ollama"
                  ? ollamaOnline
                    ? "border-green-600 text-green-700 dark:text-green-400"
                    : "border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400"
                  : aiKey
                    ? "border-green-600 text-green-700 dark:text-green-400"
                    : "border-amber-500 text-amber-700 dark:text-amber-400"
              }`}
            >
              {provider === "ollama"
                ? ollamaOnline
                  ? "online"
                  : "offline"
                : aiKey
                  ? "key added"
                  : "needs key"}
            </span>
            <button
              type="button"
              onClick={() => void refreshModels()}
              disabled={checkingModels}
              className="ml-auto inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400"
            >
              <FiRefreshCw className={`h-3.5 w-3.5 ${checkingModels ? "animate-spin" : ""}`} />
              Refresh models
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Provider
              </label>
              <select
                className={inputClass}
                value={provider}
                onChange={(event) => changeProvider(event.target.value as LlmProvider)}
              >
                {Object.values(LLM_PROVIDERS).map((info) => (
                  <option key={info.id} value={info.id}>
                    {info.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Model
              </label>
              <select
                className={inputClass}
                value={aiModel}
                onChange={(event) => setAiModel(event.target.value)}
                disabled={!models.length}
              >
                {!models.length && <option value="">Load models first</option>}
                {models.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              {modelError && (
                <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
                  {modelError}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Context window {provider !== "ollama" ? "(local only)" : ""}
              </label>
              <input
                className={inputClass}
                type="number"
                value={contextSize}
                onChange={(event) => setContextSize(event.target.value)}
                disabled={provider !== "ollama"}
              />
            </div>
          </div>
          {LLM_PROVIDERS[provider].keyRequired && (
            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                {LLM_PROVIDERS[provider].short} API key
              </label>
              <input
                className={inputClass}
                type="password"
                value={aiKey}
                onChange={(event) => setAiKey(event.target.value)}
                placeholder="Paste the key"
                autoComplete="off"
              />
              <p className="mt-1 text-[11px] text-gray-400">
                Kept in this session only, never written to the project or
                exports. Refresh models after adding it.
              </p>
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <Button variant="primary" leftIcon={<FiSave className="h-4 w-4" />} onClick={saveAi}>
              Save AI settings
            </Button>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <FiMap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Map tiles
            </h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Use key-free OpenStreetMap tiles or your own CARTO key. The key is
            stored on this machine, not in the project or exports.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Tile style
              </label>
              <select
                className={inputClass}
                value={mapStyle}
                onChange={(event) => setMapStyle(event.target.value as MapTileStyle)}
              >
                <option value="osm">OpenStreetMap (no key)</option>
                <option value="carto-voyager">CARTO Voyager</option>
                <option value="carto-dark">CARTO Dark</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                CARTO API key
              </label>
              <input
                className={inputClass}
                type="password"
                value={cartoKey}
                onChange={(event) => setCartoKey(event.target.value)}
                placeholder={mapStyle === "osm" ? "Not needed for OSM" : "Paste CARTO key"}
                autoComplete="off"
                disabled={mapStyle === "osm"}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="primary" leftIcon={<FiSave className="h-4 w-4" />} onClick={saveMapTiles}>
              Save map tiles
            </Button>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <FiMap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Local map services
            </h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            The map bridge fronts the offline gazetteer, Valhalla, and the phone
            beacon. Run <code>npm run geo</code>.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Geo bridge URL
              </label>
              <input className={inputClass} value={geoUrl} onChange={(event) => setGeoUrl(event.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                HQ bridge URL
              </label>
              <input className={inputClass} value={hqBase} onChange={(event) => setHqBase(event.target.value)} />
            </div>
          </div>
          {geoHealth && (
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              <span className={`px-2 py-0.5 rounded-full border ${geoHealth.valhalla ? "border-green-600 text-green-700 dark:text-green-400" : "border-gray-300 text-gray-500"}`}>Valhalla</span>
              <span className={`px-2 py-0.5 rounded-full border ${geoHealth.gazetteer ? "border-green-600 text-green-700 dark:text-green-400" : "border-gray-300 text-gray-500"}`}>Gazetteer</span>
              <span className={`px-2 py-0.5 rounded-full border ${geoHealth.beacon ? "border-green-600 text-green-700 dark:text-green-400" : "border-gray-300 text-gray-500"}`}>Beacon</span>
            </div>
          )}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button variant="outline" leftIcon={<FiRefreshCw className="h-4 w-4" />} onClick={() => void testGeo()} disabled={testingGeo}>
              Test map services
            </Button>
            <Button variant="primary" leftIcon={<FiSave className="h-4 w-4" />} onClick={() => void saveServices()}>
              Save services
            </Button>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <FiDollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Finances · Beancount
            </h2>
            <span
              className={`ml-2 text-[11px] px-2 py-0.5 rounded-full border ${
                financeStatus === "reachable"
                  ? "border-green-600 text-green-700 dark:text-green-400"
                  : financeStatus === "unreachable"
                    ? "border-amber-500 text-amber-700 dark:text-amber-400"
                    : "border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400"
              }`}
            >
              {financeStatus === "reachable"
                ? "Fava connected"
                : financeStatus === "unreachable"
                  ? "Fava offline"
                  : financeStatus === "checking"
                    ? "checking"
                    : "not checked"}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Point SkeletonKey at a Beancount ledger and its local Fava server.
            The Beancount MCP (<code>mcp-beancount</code>) can read the same
            file for agents. Start Fava with{" "}
            <code>npm run beancount</code>.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Ledger file
              </label>
              <input
                className={inputClass}
                value={financeLedger}
                onChange={(event) => setFinanceLedger(event.target.value)}
                placeholder="~/Documents/SkeletonKey/finances/main.beancount"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Fava URL
              </label>
              <input
                className={inputClass}
                value={financeFava}
                onChange={(event) => setFinanceFava(event.target.value)}
                placeholder="http://127.0.0.1:5001"
              />
            </div>
          </div>
          <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
            Set <code>BEANCOUNT_FILE</code> for the MCP server. Never store API
            keys in the project; use environment variable names on finance
            sources instead.
          </p>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              leftIcon={<FiRefreshCw className="h-4 w-4" />}
              onClick={() => void checkFinanceServer()}
              disabled={financeStatus === "checking"}
            >
              Test Fava
            </Button>
            <Button
              variant="primary"
              leftIcon={<FiSave className="h-4 w-4" />}
              onClick={saveFinance}
            >
              Save finances
            </Button>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <FiRadio className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              HQ bridge
            </h2>
            <span
              className={`ml-2 text-[11px] px-2 py-0.5 rounded-full border ${
                hqHealth
                  ? "border-green-600 text-green-700 dark:text-green-400"
                  : "border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400"
              }`}
            >
              {hqHealth ? "connected" : "not checked"}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            The SkeletonKey MCP lets HQ read and write this project from beacon
            telemetry and chat. Run <code>npm run mcp</code>. This is loopback
            only; no cloud.
          </p>
          {hqHealth && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              HQ project: <strong>{hqHealth.project.name}</strong> ·{" "}
              {hqHealth.counts.events} events · {hqHealth.counts.locations} places ·{" "}
              {hqHealth.counts.sourceDocuments} sources
            </p>
          )}
          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="outline" leftIcon={<FiRefreshCw className="h-4 w-4" />} onClick={() => void testHq()} disabled={testingHq}>
              Test HQ
            </Button>
            <Button variant="outline" leftIcon={<FiUploadCloud className="h-4 w-4" />} onClick={() => void sendToHq()}>
              Send project to HQ
            </Button>
            <Button variant="primary" leftIcon={<FiDownload className="h-4 w-4" />} onClick={() => void loadFromHq()}>
              Load project from HQ
            </Button>
          </div>
        </section>

        <AboutSupport />

        <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Privacy
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Projects are stored on this computer. There are no accounts, no
            analytics, no cloud projects, and no Pro subscription. Map, beacon,
            and HQ calls go to loopback services on this machine. If you publish
            the app, host your own copy.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
            SkeletonKey is software, not a lawyer, benefits office, or tax
            adviser. You verify facts and send documents yourself.
          </p>
        </section>
      </div>
    </MainContentArea>
  );
};

export default SettingsPage;
