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
  beancountReport,
  beancountStatus,
  type BeancountStatus,
} from "../services/hqBridgeService";
import {
  isAddressWatcherChain,
  planWatcherReconcile,
  readWatcherState,
  watcherChain,
  writeCryptoWatcherAddress,
  type WatcherState,
} from "../services/cryptoWatcherService";
import {
  FiExternalLink,
  FiPlus,
  FiRefreshCw,
  FiTrash2,
  FiEdit2,
  FiLock,
} from "react-icons/fi";

const inputClass =
  "w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500";

const KIND_OPTIONS: Array<{
  value: Exclude<FinanceSourceKind, "beancount">;
  label: string;
  needsKey?: boolean;
}> = [
  { value: "crypto", label: "Crypto wallet" },
  { value: "stripe", label: "Stripe API", needsKey: true },
  { value: "bank", label: "Bank / API", needsKey: true },
  { value: "manual", label: "Manual ledger" },
  { value: "other", label: "Other API", needsKey: true },
];

const emptyDraft = () => ({
  name: "",
  kind: "crypto" as Exclude<FinanceSourceKind, "beancount">,
  status: "active" as FinanceSourceType["status"],
  ledgerAccount: "",
  envVar: "",
  reference: "",
  chain: "",
  apiKey: "",
  notes: "",
  tags: "",
});

const secretKey = (id: string) => `sk-finance-secret:${id}`;

const readSecret = (id: string) => {
  try {
    return localStorage.getItem(secretKey(id)) || "";
  } catch {
    return "";
  }
};

const writeSecret = (id: string, value: string) => {
  try {
    if (value) localStorage.setItem(secretKey(id), value);
    else localStorage.removeItem(secretKey(id));
  } catch {
    // Storage failures are non-fatal.
  }
};

const numeric = (value: any): number => {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value === "object") {
    return numeric(value.number ?? value.amount ?? value.value ?? 0);
  }
  return 0;
};

const sumBalance = (balance: any): number => {
  if (!balance) return 0;
  if (Array.isArray(balance)) {
    return balance.reduce((sum, row) => sum + numeric(row), 0);
  }
  return Object.values(balance).reduce(
    (sum: number, row) => sum + numeric(row),
    0,
  );
};

const findTree = (trees: any[], accountPrefix: string): any | null =>
  (trees || []).find((node) => node.account === accountPrefix) || null;

const FinancePage: React.FC = () => {
  const {
    project,
    addFinanceSource,
    updateFinanceSource,
    deleteFinanceSource,
  } = useProjectData();
  const { showSuccess, showError, showInfo } = useNotification();

  const [tab, setTab] = useState<"dashboard" | "books" | "sources">(
    "dashboard",
  );
  const [status, setStatus] = useState<BeancountStatus | null>(null);
  const [statusError, setStatusError] = useState("");
  const [balanceSheet, setBalanceSheet] = useState<any>(null);
  const [incomeStatement, setIncomeStatement] = useState<any>(null);
  const [watcherState, setWatcherState] = useState<WatcherState>({
    config: {},
    addresses: {},
    configReadable: false,
    xmrError: "",
  });
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);

  const sources = useMemo(
    () => project?.financeSources || [],
    [project?.financeSources],
  );
  const booksConnected = Boolean(status?.reachable ?? status?.ok);

  const loadFinance = async () => {
    setStatusError("");
    try {
      const nextStatus = await beancountStatus();
      setStatus(nextStatus);
      if (nextStatus.reachable === false || nextStatus.ok === false) {
        setStatusError(nextStatus.error || "Fava is not reachable.");
      }
      const [bs, is] = await Promise.all([
        beancountReport("balance_sheet").catch(() => null),
        beancountReport("income_statement").catch(() => null),
      ]);
      setBalanceSheet(bs);
      setIncomeStatement(is);
    } catch (error) {
      setStatus(null);
      setStatusError(
        error instanceof Error ? error.message : String(error),
      );
    }
  };

  const loadWatchers = async () => {
    setWatcherState(await readWatcherState());
  };

  useEffect(() => {
    void loadFinance();
    void loadWatchers();
  }, []);

  useEffect(() => {
    const onFocus = () => void loadWatchers();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    const plan = planWatcherReconcile(
      sources,
      watcherState.addresses,
      watcherState.configReadable ? ["btc", "ltc", "eth"] : [],
    );
    if (!plan.create.length && !plan.update.length && !plan.remove.length) {
      return;
    }
    for (const source of plan.create) addFinanceSource(source);
    for (const { id, patch } of plan.update) {
      const existing = sources.find((source) => source.id === id);
      if (existing) updateFinanceSource({ ...existing, ...patch });
    }
    for (const id of plan.remove) deleteFinanceSource(id);
  }, [
    sources,
    watcherState.addresses,
    watcherState.configReadable,
    addFinanceSource,
    updateFinanceSource,
    deleteFinanceSource,
  ]);

  const totals = useMemo(() => {
    const trees = balanceSheet?.data?.trees || [];
    const assets = findTree(trees, "Assets");
    const liabilities = findTree(trees, "Liabilities");
    const incomeTrees = incomeStatement?.data?.trees || [];
    const income = findTree(incomeTrees, "Income");
    const expenses = findTree(incomeTrees, "Expenses");
    const assetTotal = sumBalance(assets?.balance_children);
    const liabilityTotal = Math.abs(sumBalance(liabilities?.balance_children));
    const incomeTotal = Math.abs(sumBalance(income?.balance_children));
    const expenseTotal = Math.abs(sumBalance(expenses?.balance_children));
    return {
      assets: assetTotal,
      liabilities: liabilityTotal,
      net: assetTotal - liabilityTotal,
      income: incomeTotal,
      expenses: expenseTotal,
      savings: incomeTotal - expenseTotal,
    };
  }, [balanceSheet, incomeStatement]);

  const watchedCount = useMemo(
    () =>
      sources.filter((source) => {
        if (source.kind !== "crypto") return false;
        const chain = watcherChain(source.chain || source.name);
        if (!chain) return false;
        return (
          String(watcherState.addresses[chain] || "").toLowerCase() ===
          source.reference.trim().toLowerCase()
        );
      }).length,
    [sources, watcherState.addresses],
  );

  const resetDraft = () => {
    setDraft(emptyDraft());
    setEditingId(null);
  };

  const maybeAddToWatcher = async (
    chain: string,
    address: string,
    name: string,
  ) => {
    const key = watcherChain(chain || name);
    if (!key) {
      showInfo("Choose BTC, LTC, ETH, or XMR to link this source to a watcher.");
      return;
    }
    if (!isAddressWatcherChain(key)) {
      showInfo(
        "Monero is watched by the local view-only wallet, not the address config.",
      );
      return;
    }
    if (!address.trim()) {
      showInfo("Add the wallet address so the watcher can track it.");
      return;
    }
    if (
      !window.confirm(
        `Add this ${key.toUpperCase()} address to the crypto watcher?\n\n${address.trim()}`,
      )
    ) {
      return;
    }
    try {
      await writeCryptoWatcherAddress(key, address.trim());
      await loadWatchers();
      showSuccess(`${key.toUpperCase()} address added to the crypto watcher.`);
    } catch (error) {
      showError(
        `Could not update the crypto watcher: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  };

  const saveSource = async () => {
    const name = draft.name.trim();
    if (!name) return;
    const isCrypto = draft.kind === "crypto";
    if (isCrypto && !draft.reference.trim()) {
      showError("Crypto sources need the wallet address to watch.");
      return;
    }

    const payload = {
      name,
      kind: draft.kind,
      status: draft.status,
      ledgerAccount: draft.ledgerAccount.trim(),
      envVar: isCrypto ? "" : draft.envVar.trim(),
      reference: draft.reference.trim(),
      chain: isCrypto ? draft.chain.trim() : "",
      notes: draft.notes.trim(),
      tags: draft.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      lastSync: "",
    };

    let sourceId = editingId;
    if (editingId) {
      const existing = sources.find((source) => source.id === editingId);
      if (existing) {
        updateFinanceSource({ ...existing, ...payload });
        showSuccess("Finance source updated.");
      }
    } else {
      sourceId = addFinanceSource({ ...payload, lastSync: "" });
      showSuccess("Finance source added.");
    }

    if (sourceId && draft.apiKey.trim()) {
      writeSecret(sourceId, draft.apiKey.trim());
      showSuccess("API key saved locally, not in the project file.");
    }

    if (isCrypto) {
      await maybeAddToWatcher(draft.chain, draft.reference, draft.name);
    }
    resetDraft();
  };

  const startEdit = (source: FinanceSourceType) => {
    setEditingId(source.id);
    setDraft({
      name: source.name,
      kind: (source.kind === "beancount"
        ? "other"
        : source.kind) as Exclude<FinanceSourceKind, "beancount">,
      status: source.status,
      ledgerAccount: source.ledgerAccount || "",
      envVar: source.envVar || "",
      reference: source.reference || "",
      chain: source.chain || "",
      apiKey: readSecret(source.id),
      notes: source.notes || "",
      tags: (source.tags || []).join(", "),
    });
  };

  const kindNeedsKey = KIND_OPTIONS.find(
    (option) => option.value === draft.kind,
  )?.needsKey;

  return (
    <MainContentArea
      title="Personal Finances"
      inlineActions={
        <div className="flex items-center gap-1 rounded-lg bg-gray-200 p-1 dark:bg-gray-700">
          {(["dashboard", "books", "sources"] as const).map((next) => (
            <button
              key={next}
              type="button"
              onClick={() => setTab(next)}
              className={`rounded-md px-3 py-1 text-sm font-medium capitalize ${
                tab === next
                  ? "bg-white text-blue-600 shadow dark:bg-gray-800 dark:text-blue-300"
                  : "text-gray-600 dark:text-gray-300"
              }`}
            >
              {next === "books" ? "Beancount" : next}
            </button>
          ))}
        </div>
      }
    >
      {tab === "dashboard" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Net worth", totals.net, "text-gray-900 dark:text-white"],
              ["Assets", totals.assets, "text-green-600 dark:text-green-400"],
              [
                "Liabilities",
                totals.liabilities,
                "text-red-600 dark:text-red-400",
              ],
              [
                "Savings this period",
                totals.savings,
                "text-blue-600 dark:text-blue-400",
              ],
            ].map(([label, value, color]) => (
              <div
                key={String(label)}
                className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {label}
                </p>
                <p className={`mt-1 text-2xl font-semibold ${color}`}>
                  {Number(value).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Beancount
                </h3>
                <span
                  className={`text-xs ${
                    status
                      ? "text-green-600 dark:text-green-400"
                      : "text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {booksConnected ? "Fava connected" : "offline"}
                </span>
              </div>
              <p className="mt-2 break-all text-xs text-gray-500 dark:text-gray-400">
                {status?.ledgerFile || project?.financeSettings?.ledgerFile || "Ledger not configured"}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {status?.root || project?.financeSettings?.favaUrl || "Fava not configured"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => void loadFinance()}>
                  Refresh
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTab("books")}
                >
                  Open books
                </Button>
              </div>
              {statusError && (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                  {statusError}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Watched sources
              </h3>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
                {watchedCount}
                <span className="ml-1 text-sm font-normal text-gray-500 dark:text-gray-400">
                  / {sources.filter((source) => source.kind === "crypto").length} crypto
                </span>
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {sources.length} source{sources.length === 1 ? "" : "s"} total
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => setTab("sources")}
              >
                Manage sources
              </Button>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Income / expenses
              </h3>
              <div className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between text-gray-600 dark:text-gray-300">
                  <span>Income</span>
                  <span>{totals.income.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-300">
                  <span>Expenses</span>
                  <span>{totals.expenses.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-1 font-medium text-gray-900 dark:border-gray-700 dark:text-white">
                  <span>Net</span>
                  <span>{(totals.income - totals.expenses).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Sources
            </h3>
            {sources.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                No sources yet. Add a crypto wallet or API in Sources.
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {sources.map((source) => (
                  <span
                    key={source.id}
                    className="rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-300"
                  >
                    {source.name}
                    <span className="ml-1 text-gray-400">{source.kind}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "books" && (
        <div className="space-y-2">
          {booksConnected && status ? (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
              <iframe
                title="Beancount · Fava"
                src={status.root}
                className="h-[75vh] w-full"
              />
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Beancount is offline
              </h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Start it with <code>npm run beancount</code>. Ledger and Fava
                URL are configured in Settings → Finances.
              </p>
              {status?.error && (
                <p className="mt-2 break-all text-xs text-gray-500 dark:text-gray-400">
                  {status.error}
                </p>
              )}
              {statusError && (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                  {statusError}
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => void loadFinance()}>
                  Retry
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<FiExternalLink className="h-4 w-4" />}
                  onClick={() =>
                    window.open(
                      project?.financeSettings?.favaUrl ||
                        "http://127.0.0.1:5001",
                      "_blank",
                    )
                  }
                >
                  Open in browser
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "sources" && (
        <div className="space-y-4">
          <section className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
              {editingId ? "Edit source" : "Add source"}
            </h3>
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
                  placeholder="e.g. Monero wallet, Stripe payouts"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                  Type
                </label>
                <select
                  className={inputClass}
                  value={draft.kind}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      kind: event.target.value as typeof current.kind,
                    }))
                  }
                >
                  {KIND_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
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

              {draft.kind === "crypto" ? (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                      Network
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
                      <option value="">Choose network</option>
                      <option value="BTC">Bitcoin (BTC)</option>
                      <option value="LTC">Litecoin (LTC)</option>
                      <option value="ETH">Ethereum (ETH)</option>
                      <option value="XMR">Monero (XMR)</option>
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                      Address to watch
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
                      placeholder="Wallet address"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                      {kindNeedsKey ? "API key" : "Reference"}
                    </label>
                    {kindNeedsKey ? (
                      <div className="relative">
                        <FiLock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                          type="password"
                          className={`${inputClass} pl-9`}
                          value={draft.apiKey}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              apiKey: event.target.value,
                            }))
                          }
                          placeholder="Stored locally, never in the project"
                          autoComplete="off"
                        />
                      </div>
                    ) : (
                      <input
                        className={inputClass}
                        value={draft.reference}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            reference: event.target.value,
                          }))
                        }
                        placeholder="Account, endpoint, or note"
                      />
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                      Env var (optional)
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
                </>
              )}

              <div className="md:col-span-2">
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
                  placeholder="Assets:Crypto:BTC"
                />
              </div>
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
              <div className="md:col-span-4">
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
                onClick={() => void saveSource()}
                disabled={!draft.name.trim()}
              >
                {editingId ? "Save source" : "Add source"}
              </Button>
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {watcherState.xmrError
                ? "Monero wallet RPC is offline; XMR watch status is unknown."
                : "Watched sources are synced from the local crypto watchers."}
            </p>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<FiRefreshCw className="h-4 w-4" />}
              onClick={() => void loadWatchers()}
            >
              Sync watchers
            </Button>
          </div>

          <section className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  {["Source", "Type", "Status", "Watched", "Account", ""].map(
                    (label) => (
                      <th
                        key={label}
                        className="whitespace-nowrap px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300"
                      >
                        {label}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {sources.map((source) => {
                  const chain = watcherChain(source.chain || source.name);
                  const watched =
                    source.kind === "crypto" && chain
                      ? String(
                          watcherState.addresses[chain] || "",
                        ).toLowerCase() ===
                        source.reference.trim().toLowerCase()
                      : false;
                  return (
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
                      <td className="px-3 py-2 text-xs">
                        {source.kind === "crypto" ? (
                          watched ? (
                            <span className="text-green-600 dark:text-green-400">
                              watched
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400">
                              not watched
                            </span>
                          )
                        ) : readSecret(source.id) ? (
                          <span className="text-green-600 dark:text-green-400">
                            key saved
                          </span>
                        ) : (
                          <span className="text-gray-400">env</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-300">
                        {source.ledgerAccount}
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
                            writeSecret(source.id, "");
                            showSuccess("Finance source removed.");
                          }}
                          title="Delete"
                        >
                          <FiTrash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {sources.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                    >
                      No sources yet. Add a crypto wallet or an API source.
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
