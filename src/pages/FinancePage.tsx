import React, { useEffect, useMemo, useState } from "react";
import MainContentArea from "../components/layout/MainContentArea";
import Button from "../components/common/Button";
import { useProjectData } from "../contexts/ProjectDataContext";
import { useNotification } from "../contexts/NotificationContext";
import {
  FinanceSourceKind,
  FinanceSourceType,
} from "../types/project";
import {
  readCryptoWatcherConfig,
  watcherChain,
  writeCryptoWatcherAddress,
  type WatcherConfig,
} from "../services/cryptoWatcherService";
import {
  FiExternalLink,
  FiPlus,
  FiRefreshCw,
  FiTrash2,
  FiEdit2,
} from "react-icons/fi";

const inputClass =
  "w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500";

const DEFAULT_LEDGER = "~/beancount/main.beancount";
const DEFAULT_FAVA = "http://127.0.0.1:5000";
const DEFAULT_MCP = "~/.local/bin/beancount-server";

const KINDS: FinanceSourceKind[] = [
  "beancount",
  "stripe",
  "crypto",
  "bank",
  "manual",
  "other",
];

const emptyDraft = () => ({
  name: "",
  kind: "other" as FinanceSourceKind,
  status: "active" as FinanceSourceType["status"],
  ledgerAccount: "",
  envVar: "",
  reference: "",
  chain: "",
  notes: "",
  tags: "",
});

const FinancePage: React.FC = () => {
  const {
    project,
    addFinanceSource,
    updateFinanceSource,
    deleteFinanceSource,
    updateFinanceSettings,
  } = useProjectData();
  const { showSuccess, showError, showInfo } = useNotification();

  const settings = project?.financeSettings;
  const [ledgerFile, setLedgerFile] = useState(
    settings?.ledgerFile || DEFAULT_LEDGER,
  );
  const [favaUrl, setFavaUrl] = useState(settings?.favaUrl || DEFAULT_FAVA);
  const [favaStatus, setFavaStatus] = useState<
    "checking" | "reachable" | "unreachable"
  >("checking");
  const [tab, setTab] = useState<"beancount" | "sources">("beancount");
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [watcherConfig, setWatcherConfig] = useState<WatcherConfig>({});

  const sources = useMemo(
    () => project?.financeSources || [],
    [project?.financeSources],
  );

  useEffect(() => {
    setLedgerFile(settings?.ledgerFile || DEFAULT_LEDGER);
    setFavaUrl(settings?.favaUrl || DEFAULT_FAVA);
  }, [settings?.ledgerFile, settings?.favaUrl]);

  const checkFava = async () => {
    setFavaStatus("checking");
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      await fetch(favaUrl, {
        mode: "no-cors",
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timer);
      setFavaStatus("reachable");
    } catch {
      setFavaStatus("unreachable");
    }
  };

  useEffect(() => {
    void readCryptoWatcherConfig().then(setWatcherConfig);
  }, []);

  useEffect(() => {
    void checkFava();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favaUrl]);

  const saveSettings = () => {
    updateFinanceSettings({ ledgerFile, favaUrl });
    showSuccess("Finance settings saved.");
    void checkFava();
  };

  const resetDraft = () => {
    setDraft(emptyDraft());
    setEditingId(null);
  };

  const saveSource = () => {
    const name = draft.name.trim();
    if (!name) return;
    const payload = {
      name,
      kind: draft.kind,
      status: draft.status,
      ledgerAccount: draft.ledgerAccount.trim(),
      envVar: draft.envVar.trim(),
      reference: draft.reference.trim(),
      chain: draft.chain.trim(),
      notes: draft.notes.trim(),
      tags: draft.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      lastSync: "",
    };
    if (editingId) {
      const existing = sources.find((source) => source.id === editingId);
      if (existing) {
        updateFinanceSource({ ...existing, ...payload });
        showSuccess("Finance source updated.");
        void maybeAddToWatcher({ ...existing, ...payload });
      }
    } else {
      addFinanceSource({ ...payload, lastSync: "" });
      showSuccess("Finance source added.");
      void maybeAddToWatcher({
        ...payload,
        id: "",
        createdAt: "",
        updatedAt: "",
      } as FinanceSourceType);
    }
    resetDraft();
  };

  const maybeAddToWatcher = async (source: FinanceSourceType) => {
    if (source.kind !== "crypto") return;
    const chain = watcherChain(source.chain || source.name);
    if (!chain) {
      if (String(source.chain || source.name).toUpperCase().includes("XMR")) {
        showInfo(
          "Monero uses the view-only wallet, not the address watcher. Run xmr-watch-setup to configure it.",
        );
      } else {
        showInfo("Set a chain (BTC, LTC, ETH) to link this source to the watcher.");
      }
      return;
    }
    const address = source.reference.trim();
    if (!address) {
      showInfo(
        "Add the wallet address in Reference, then save again to link it to the watcher.",
      );
      return;
    }
    if (!window.confirm(
      `Add this ${chain.toUpperCase()} address to the crypto watcher?\n\n${address}`,
    )) {
      return;
    }
    try {
      setWatcherConfig(await writeCryptoWatcherAddress(chain, address));
      showSuccess(`${chain.toUpperCase()} address added to the crypto watcher.`);
    } catch (error) {
      showError(
        `Could not update the crypto watcher: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  };

  const startEdit = (source: FinanceSourceType) => {
    setEditingId(source.id);
    setDraft({
      name: source.name,
      kind: source.kind,
      status: source.status,
      ledgerAccount: source.ledgerAccount || "",
      envVar: source.envVar || "",
      reference: source.reference || "",
      chain: source.chain || "",
      notes: source.notes || "",
      tags: (source.tags || []).join(", "),
    });
  };

  const addPreset = (preset: Partial<FinanceSourceType> & { name: string }) => {
    addFinanceSource({
      name: preset.name,
      kind: preset.kind || "other",
      status: "active",
      ledgerAccount: preset.ledgerAccount || "",
      envVar: preset.envVar || "",
      reference: preset.reference || "",
      chain: preset.chain || "",
      notes: preset.notes || "",
      tags: preset.tags || [],
      lastSync: "",
    });
    showSuccess(`${preset.name} source added.`);
  };

  return (
    <MainContentArea
      title="Personal Finances"
      inlineActions={
        <div className="flex items-center gap-1 rounded-lg bg-gray-200 p-1 dark:bg-gray-700">
          <button
            type="button"
            onClick={() => setTab("beancount")}
            className={`rounded-md px-3 py-1 text-sm font-medium ${
              tab === "beancount"
                ? "bg-white text-blue-600 shadow dark:bg-gray-800 dark:text-blue-300"
                : "text-gray-600 dark:text-gray-300"
            }`}
          >
            Beancount
          </button>
          <button
            type="button"
            onClick={() => setTab("sources")}
            className={`rounded-md px-3 py-1 text-sm font-medium ${
              tab === "sources"
                ? "bg-white text-blue-600 shadow dark:bg-gray-800 dark:text-blue-300"
                : "text-gray-600 dark:text-gray-300"
            }`}
          >
            Sources ({sources.length})
          </button>
        </div>
      }
    >
      {tab === "beancount" ? (
        <div className="space-y-4">
          <section className="grid grid-cols-1 gap-2 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                Beancount ledger file
              </label>
              <input
                className={inputClass}
                value={ledgerFile}
                onChange={(event) => setLedgerFile(event.target.value)}
                placeholder={DEFAULT_LEDGER}
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                Fava URL
              </label>
              <input
                className={inputClass}
                value={favaUrl}
                onChange={(event) => setFavaUrl(event.target.value)}
                placeholder={DEFAULT_FAVA}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 md:col-span-4">
              <Button variant="primary" onClick={saveSettings}>
                Save settings
              </Button>
              <Button
                variant="outline"
                leftIcon={<FiRefreshCw className="h-4 w-4" />}
                onClick={() => void checkFava()}
              >
                Check Fava
              </Button>
              <Button
                variant="outline"
                leftIcon={<FiExternalLink className="h-4 w-4" />}
                onClick={() => window.open(favaUrl, "_blank")}
              >
                Open in browser
              </Button>
              <span
                className={`text-xs ${
                  favaStatus === "reachable"
                    ? "text-green-600 dark:text-green-400"
                    : favaStatus === "checking"
                      ? "text-gray-500 dark:text-gray-400"
                      : "text-amber-600 dark:text-amber-400"
                }`}
              >
                {favaStatus === "reachable"
                  ? "Fava is running"
                  : favaStatus === "checking"
                    ? "Checking Fava…"
                    : "Fava is not reachable"}
              </span>
            </div>
          </section>

          {favaStatus === "reachable" ? (
            <section className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
              <iframe
                key={favaUrl}
                title="Beancount · Fava"
                src={favaUrl}
                className="h-[70vh] w-full"
              />
            </section>
          ) : (
            <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Start the Beancount server
              </h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                SkeletonKey uses Fava to show and edit the Beancount ledger. If
                it is not running, start it locally and reload this tab.
              </p>
              <pre className="mt-3 overflow-x-auto rounded bg-gray-900 p-3 text-xs text-gray-100">
{`# start Fava in the background
~/.local/bin/beancount-server

# ledger file
${ledgerFile}`}
              </pre>
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                The MCP server that reads the ledger is{" "}
                <code>~/.local/bin/beancount-server</code> for Fava, and{" "}
                <code>mcp-beancount</code> for agents. Set{" "}
                <code>BEANCOUNT_FILE</code> to the ledger path.
              </p>
            </section>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <section className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                  Source name
                </label>
                <input
                  className={inputClass}
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="e.g. Stripe payouts, Monero wallet"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                  Kind
                </label>
                <select
                  className={inputClass}
                  value={draft.kind}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      kind: event.target.value as FinanceSourceKind,
                    }))
                  }
                >
                  {KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                  Status
                </label>
                <select
                  className={inputClass}
                  value={draft.status}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      status: event.target.value as FinanceSourceType["status"],
                    }))
                  }
                >
                  <option value="active">active</option>
                  <option value="paused">paused</option>
                  <option value="error">error</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                  Ledger account
                </label>
                <input
                  className={inputClass}
                  value={draft.ledgerAccount}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      ledgerAccount: event.target.value,
                    }))
                  }
                  placeholder="Assets:Bank:Checking"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                  Env var (never the secret)
                </label>
                <input
                  className={inputClass}
                  value={draft.envVar}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      envVar: event.target.value,
                    }))
                  }
                  placeholder="STRIPE_API_KEY"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                  Reference
                </label>
                <input
                  className={inputClass}
                  value={draft.reference}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      reference: event.target.value,
                    }))
                  }
                  placeholder="wallet address, account id, API endpoint…"
                />
              </div>
              {draft.kind === "crypto" && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                    Chain
                  </label>
                  <select
                    className={inputClass}
                    value={draft.chain}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        chain: event.target.value,
                      }))
                    }
                  >
                    <option value="">Select chain</option>
                    <option value="BTC">BTC</option>
                    <option value="LTC">LTC</option>
                    <option value="ETH">ETH</option>
                    <option value="XMR">XMR</option>
                  </select>
                </div>
              )}
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                  Tags
                </label>
                <input
                  className={inputClass}
                  value={draft.tags}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      tags: event.target.value,
                    }))
                  }
                  placeholder="comma, separated"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                  Notes
                </label>
                <input
                  className={inputClass}
                  value={draft.notes}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="mt-2 flex flex-wrap justify-end gap-2">
              {editingId && (
                <Button variant="outline" onClick={resetDraft}>
                  Cancel
                </Button>
              )}
              <Button
                variant="primary"
                leftIcon={<FiPlus className="h-4 w-4" />}
                onClick={saveSource}
                disabled={!draft.name.trim()}
              >
                {editingId ? "Save source" : "Add source"}
              </Button>
            </div>
          </section>

          <section className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                addPreset({
                  name: "Stripe",
                  kind: "stripe",
                  envVar: "STRIPE_API_KEY",
                  ledgerAccount: "Assets:Stripe",
                  notes: "Read-only API key in the environment.",
                })
              }
            >
              + Stripe
            </Button>
            {["Monero", "Bitcoin", "Ethereum", "Litecoin"].map((chain) => (
              <Button
                key={chain}
                size="sm"
                variant="outline"
                onClick={() =>
                  addPreset({
                    name: `${chain} wallet`,
                    kind: "crypto",
                    chain:
                      chain === "Monero"
                        ? "XMR"
                        : chain === "Bitcoin"
                          ? "BTC"
                          : chain === "Ethereum"
                            ? "ETH"
                            : "LTC",
                    reference: "",
                    ledgerAccount: `Assets:Crypto:${chain}`,
                    notes: "Managed by the local crypto watcher.",
                  })
                }
              >
                + {chain}
              </Button>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                addPreset({
                  name: "Beancount ledger",
                  kind: "beancount",
                  ledgerAccount: "",
                  notes: `Ledger: ${ledgerFile}`,
                })
              }
            >
              + Beancount
            </Button>
          </section>

          <section className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  {[
                    "Source",
                    "Kind",
                    "Status",
                    "Ledger account",
                    "Env / reference",
                    "Watcher",
                    "",
                  ].map((label) => (
                    <th
                      key={label}
                      className="whitespace-nowrap px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {sources.map((source) => (
                  <tr key={source.id}>
                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">
                      {source.name}
                      {source.notes && (
                        <p className="text-[11px] font-normal text-gray-500 dark:text-gray-400">
                          {source.notes}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2 capitalize text-gray-600 dark:text-gray-300">
                      {source.kind}
                    </td>
                    <td className="px-3 py-2 capitalize text-gray-600 dark:text-gray-300">
                      {source.status}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-300">
                      {source.ledgerAccount}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                      {source.envVar}
                      {source.envVar && source.reference ? " · " : ""}
                      {source.reference}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {source.kind === "crypto" ? (
                        (() => {
                          const chain = watcherChain(
                            source.chain || source.name,
                          );
                          const watched =
                            chain &&
                            String(watcherConfig[chain] || "").toLowerCase() ===
                              source.reference.trim().toLowerCase();
                          return watched ? (
                            <span className="text-green-600 dark:text-green-400">
                              watched
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400">
                              not in watcher
                            </span>
                          );
                        })()
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <button
                        type="button"
                        className="mr-2 text-gray-400 hover:text-blue-600"
                        onClick={() => startEdit(source)}
                        title="Edit"
                      >
                        <FiEdit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="text-gray-400 hover:text-red-500"
                        onClick={() => {
                          deleteFinanceSource(source.id);
                          showSuccess("Finance source removed.");
                        }}
                        title="Delete"
                      >
                        <FiTrash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {sources.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                    >
                      No finance sources yet. Add Beancount, Stripe, a crypto
                      wallet, or another ledger.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </MainContentArea>
  );
};

export default FinancePage;
