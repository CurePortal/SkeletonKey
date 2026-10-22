import React, { useMemo, useState } from "react";
import MainContentArea from "../components/layout/MainContentArea";
import Button from "../components/common/Button";
import { useProjectData } from "../contexts/ProjectDataContext";
import { useNotification } from "../contexts/NotificationContext";
import { PersonalAssetType } from "../types/project";
import { FiPlus, FiTrash2, FiEdit2 } from "react-icons/fi";

const inputClass =
  "w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500";

const ASSET_CATEGORIES = [
  "Tools",
  "Electronics",
  "Computers",
  "Cameras",
  "Audio",
  "Vehicles",
  "Camping",
  "Home",
  "Documents",
  "Collectibles",
  "Other",
];

const STATUS_OPTIONS: PersonalAssetType["status"][] = [
  "owned",
  "loaned",
  "stored",
  "sold",
  "lost",
];

const emptyDraft = () => ({
  name: "",
  category: "Tools",
  quantity: "1",
  condition: "Good",
  status: "owned" as PersonalAssetType["status"],
  location: "",
  serialNumber: "",
  value: "",
  acquiredDate: "",
  notes: "",
  tags: "",
});

const PersonalAssetsPage: React.FC = () => {
  const { project, addAsset, updateAsset, deleteAsset } = useProjectData();
  const { showSuccess } = useNotification();
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | PersonalAssetType["status"]>(
    "all",
  );

  const assets = useMemo(() => project?.assets || [], [project?.assets]);

  const categories = useMemo(
    () => [...new Set([...ASSET_CATEGORIES, ...assets.map((asset) => asset.category)])],
    [assets],
  );

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return assets
      .filter((asset) => statusFilter === "all" || asset.status === statusFilter)
      .filter((asset) => {
        if (!needle) return true;
        return [
          asset.name,
          asset.category,
          asset.location,
          asset.serialNumber,
          asset.notes,
          ...(asset.tags || []),
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [assets, filter, statusFilter]);

  const reset = () => {
    setDraft(emptyDraft());
    setEditingId(null);
  };

  const save = () => {
    const name = draft.name.trim();
    if (!name) return;
    const payload = {
      name,
      category: draft.category,
      quantity: Math.max(0, Number(draft.quantity) || 0),
      condition: draft.condition,
      status: draft.status,
      location: draft.location.trim(),
      serialNumber: draft.serialNumber.trim(),
      value: draft.value.trim() ? Number(draft.value) : null,
      acquiredDate: draft.acquiredDate,
      notes: draft.notes.trim(),
      tags: draft.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    };
    if (editingId) {
      const existing = assets.find((asset) => asset.id === editingId);
      if (existing) {
        updateAsset({ ...existing, ...payload });
        showSuccess("Asset updated.");
      }
    } else {
      addAsset(payload);
      showSuccess("Asset added.");
    }
    reset();
  };

  const startEdit = (asset: PersonalAssetType) => {
    setEditingId(asset.id);
    setDraft({
      name: asset.name,
      category: asset.category,
      quantity: String(asset.quantity ?? 1),
      condition: asset.condition || "",
      status: asset.status,
      location: asset.location || "",
      serialNumber: asset.serialNumber || "",
      value: asset.value == null ? "" : String(asset.value),
      acquiredDate: asset.acquiredDate || "",
      notes: asset.notes || "",
      tags: (asset.tags || []).join(", "),
    });
  };

  const remove = (asset: PersonalAssetType) => {
    if (!window.confirm(`Delete "${asset.name}" from the inventory?`)) return;
    deleteAsset(asset.id);
    if (editingId === asset.id) reset();
    showSuccess("Asset deleted.");
  };

  return (
    <MainContentArea
      title="Assets"
      inlineActions={
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {assets.length} item{assets.length === 1 ? "" : "s"} ·{" "}
          {assets.reduce((sum, asset) => sum + (asset.quantity || 0), 0)} units
        </span>
      }
    >
      <div className="space-y-4">
        <section className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                Item
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
                placeholder="e.g. Canon R6, cordless drill, tent"
                onKeyDown={(event) => {
                  if (event.key === "Enter") save();
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                Category
              </label>
              <input
                className={inputClass}
                value={draft.category}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    category: event.target.value,
                  }))
                }
                list="asset-categories"
              />
              <datalist id="asset-categories">
                {categories.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                Quantity
              </label>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={draft.quantity}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    quantity: event.target.value,
                  }))
                }
              />
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
                    status: event.target.value as PersonalAssetType["status"],
                  }))
                }
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                Condition
              </label>
              <input
                className={inputClass}
                value={draft.condition}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    condition: event.target.value,
                  }))
                }
                placeholder="Good, worn, broken"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                Location
              </label>
              <input
                className={inputClass}
                value={draft.location}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    location: event.target.value,
                  }))
                }
                placeholder="Home, truck, storage"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                Serial / ID
              </label>
              <input
                className={inputClass}
                value={draft.serialNumber}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    serialNumber: event.target.value,
                  }))
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                Value
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                className={inputClass}
                value={draft.value}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    value: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                Acquired
              </label>
              <input
                type="date"
                className={inputClass}
                value={draft.acquiredDate}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    acquiredDate: event.target.value,
                  }))
                }
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
              <textarea
                className={inputClass}
                rows={2}
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
          <div className="mt-2 flex justify-end gap-2">
            {editingId && (
              <Button variant="outline" onClick={reset}>
                Cancel
              </Button>
            )}
            <Button
              variant="primary"
              leftIcon={<FiPlus className="h-4 w-4" />}
              onClick={save}
              disabled={!draft.name.trim()}
            >
              {editingId ? "Save asset" : "Add asset"}
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 p-3 dark:border-gray-700">
            <input
              className={`${inputClass} sm:max-w-xs`}
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filter assets…"
            />
            <select
              className={`${inputClass} sm:max-w-[160px]`}
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as "all" | PersonalAssetType["status"],
                )
              }
            >
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  {[
                    "Item",
                    "Category",
                    "Qty",
                    "Status",
                    "Condition",
                    "Location",
                    "Serial",
                    "Value",
                    "Tags",
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
                {visible.map((asset) => (
                  <tr key={asset.id}>
                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">
                      {asset.name}
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                      {asset.category}
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                      {asset.quantity}
                    </td>
                    <td className="px-3 py-2 capitalize text-gray-600 dark:text-gray-300">
                      {asset.status}
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                      {asset.condition}
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                      {asset.location}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                      {asset.serialNumber}
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                      {asset.value == null ? "" : asset.value}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                      {(asset.tags || []).join(", ")}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <button
                        type="button"
                        className="mr-2 text-gray-400 hover:text-blue-600"
                        onClick={() => startEdit(asset)}
                        title="Edit"
                      >
                        <FiEdit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="text-gray-400 hover:text-red-500"
                        onClick={() => remove(asset)}
                        title="Delete"
                      >
                        <FiTrash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                    >
                      No assets yet. Add what you own so the assistant knows
                      what is at your disposal.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </MainContentArea>
  );
};

export default PersonalAssetsPage;
