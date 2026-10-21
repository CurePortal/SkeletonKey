import React, { useEffect, useMemo, useState } from "react";
import Modal from "./common/Modal";
import Button from "./common/Button";
import InputField from "./common/InputField";
import { useProjectData } from "../contexts/ProjectDataContext";
import { CustomEntityType } from "../types/dynamicEntity";

export const DEFAULT_KB_TYPE_IDS = new Set([
  "character",
  "location",
  "technology",
  "culture",
  "source",
]);

const ICON_OPTIONS = [
  "FaUser",
  "FaMapMarkerAlt",
  "FaMicrochip",
  "FaGlobe",
  "FaFileAlt",
  "FaTags",
  "FaCog",
  "FaLightbulb",
];

interface KnowledgeBaseCategoryManagerProps {
  isOpen: boolean;
  onClose: () => void;
  sections: CustomEntityType[];
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

const emptyType = (): CustomEntityType => ({
  id: "",
  name: "",
  namePlural: "",
  description: "",
  icon: "FaBook",
  color: "#3B82F6",
  fields: [],
  canHaveTimeline: false,
  canHaveLocation: false,
  canHaveNarratives: false,
});

const KnowledgeBaseCategoryManager: React.FC<
  KnowledgeBaseCategoryManagerProps
> = ({ isOpen, onClose, sections }) => {
  const { upsertEntityType, deleteEntityType } = useProjectData();
  const [drafts, setDrafts] = useState<Record<string, CustomEntityType>>({});
  const [newType, setNewType] = useState<CustomEntityType>(emptyType);
  const [error, setError] = useState("");

  const editableSections = useMemo(
    () => sections.filter((section) => section.id !== "tags"),
    [sections],
  );

  useEffect(() => {
    if (!isOpen) return;
    const next: Record<string, CustomEntityType> = {};
    for (const section of editableSections) next[section.id] = { ...section };
    setDrafts(next);
    setNewType(emptyType());
    setError("");
  }, [isOpen, editableSections]);

  const updateDraft = (
    id: string,
    patch: Partial<CustomEntityType>,
  ) => {
    setDrafts((current) => ({
      ...current,
      [id]: { ...current[id], ...patch },
    }));
  };

  const saveDraft = (id: string) => {
    const draft = drafts[id];
    if (!draft?.name?.trim() || !draft.namePlural?.trim()) {
      setError("Both the singular and plural name are required.");
      return;
    }
    upsertEntityType({ ...draft, id });
    setError("");
  };

  const saveAllAndClose = () => {
    let saved = 0;
    for (const [id, draft] of Object.entries(drafts)) {
      if (!draft?.name?.trim() || !draft.namePlural?.trim()) continue;
      upsertEntityType({
        ...draft,
        id,
        name: draft.name.trim(),
        namePlural: draft.namePlural.trim(),
      });
      saved += 1;
    }
    if (saved === 0) {
      setError("Add a singular and plural name before saving.");
      return;
    }
    setError("");
    onClose();
  };

  const addCategory = () => {
    const name = newType.name.trim();
    const namePlural = newType.namePlural.trim() || `${name}s`;
    if (!name) {
      setError("Give the new category a name.");
      return;
    }
    const baseId = slugify(name);
    if (!baseId) {
      setError("Use a name with letters or numbers.");
      return;
    }
    let id = baseId;
    let suffix = 2;
    while (drafts[id]) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }
    upsertEntityType({ ...newType, id, name, namePlural });
    setNewType(emptyType());
    setError("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Knowledge base categories">
      <div className="space-y-4">
        {error && (
          <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="space-y-2">
          {editableSections.map((section) => {
            const draft = drafts[section.id] || section;
            const isBuiltIn = DEFAULT_KB_TYPE_IDS.has(section.id);
            return (
              <div
                key={section.id}
                className="rounded-lg border border-gray-200 p-2 dark:border-gray-700"
              >
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <InputField
                    label="Singular"
                    value={draft.name}
                    onChange={(event) =>
                      updateDraft(section.id, { name: event.target.value })
                    }
                  />
                  <InputField
                    label="Plural (tab label)"
                    value={draft.namePlural}
                    onChange={(event) =>
                      updateDraft(section.id, {
                        namePlural: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="mt-2 flex items-end gap-2">
                  <label className="flex-1 text-xs text-gray-500 dark:text-gray-400">
                    Icon
                    <select
                      className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      value={draft.icon}
                      onChange={(event) =>
                        updateDraft(section.id, { icon: event.target.value })
                      }
                    >
                      {ICON_OPTIONS.map((icon) => (
                        <option key={icon} value={icon}>
                          {icon}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button size="sm" variant="outline" onClick={() => saveDraft(section.id)}>
                    Save
                  </Button>
                  {!isBuiltIn && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        deleteEntityType(section.id);
                        setDrafts((current) => {
                          const next = { ...current };
                          delete next[section.id];
                          return next;
                        });
                      }}
                    >
                      Delete
                    </Button>
                  )}
                </div>
                {!isBuiltIn && (
                  <p className="mt-1 text-[10px] text-gray-400">
                    Custom category id: {section.id}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="rounded-lg border border-dashed border-gray-300 p-3 dark:border-gray-600">
          <h4 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
            New category
          </h4>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <InputField
              label="Singular"
              value={newType.name}
              onChange={(event) =>
                setNewType((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="Client"
            />
            <InputField
              label="Plural"
              value={newType.namePlural}
              onChange={(event) =>
                setNewType((current) => ({
                  ...current,
                  namePlural: event.target.value,
                }))
              }
              placeholder="Clients"
            />
          </div>
          <div className="mt-2 flex items-end gap-2">
            <label className="flex-1 text-xs text-gray-500 dark:text-gray-400">
              Icon
              <select
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                value={newType.icon}
                onChange={(event) =>
                  setNewType((current) => ({
                    ...current,
                    icon: event.target.value,
                  }))
                }
              >
                {ICON_OPTIONS.map((icon) => (
                  <option key={icon} value={icon}>
                    {icon}
                  </option>
                ))}
              </select>
            </label>
            <Button size="sm" variant="primary" onClick={addCategory}>
              Add category
            </Button>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={saveAllAndClose}>
            Save & close
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default KnowledgeBaseCategoryManager;
