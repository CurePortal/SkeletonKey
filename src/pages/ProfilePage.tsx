import React, { useMemo, useState } from "react";
import MainContentArea from "../components/layout/MainContentArea";
import Button from "../components/common/Button";
import { useProjectData } from "../contexts/ProjectDataContext";
import { useNotification } from "../contexts/NotificationContext";
import { OperativeProfileType } from "../types/project";
import { FiSave } from "react-icons/fi";

const inputClass =
  "w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500";

const FIELDS: Array<{
  key: keyof OperativeProfileType;
  label: string;
  placeholder: string;
  rows?: number;
}> = [
  { key: "name", label: "Name", placeholder: "What should HQ call you?" },
  {
    key: "callsign",
    label: "Callsign",
    placeholder: "Optional short handle, e.g. Echo",
  },
  { key: "pronouns", label: "Pronouns", placeholder: "e.g. they/them" },
  {
    key: "timezone",
    label: "Timezone",
    placeholder: "e.g. America/Los_Angeles",
  },
  {
    key: "homeBase",
    label: "Home base",
    placeholder: "Where you usually operate from",
  },
  { key: "languages", label: "Languages", placeholder: "e.g. English, Spanish" },
  {
    key: "communicationStyle",
    label: "Communication style",
    placeholder: "How HQ should talk to you: direct, brief, detailed, no fluff…",
    rows: 3,
  },
  {
    key: "accessibilityNeeds",
    label: "Accessibility needs",
    placeholder:
      "Anything HQ must account for: mobility, vision, hearing, sensory, cognitive…",
    rows: 3,
  },
  {
    key: "healthNotes",
    label: "Health notes",
    placeholder: "Relevant health context HQ should keep in mind",
    rows: 3,
  },
  {
    key: "constraints",
    label: "Constraints",
    placeholder:
      "Time, money, transport, legal, family, or other limits on what you can do",
    rows: 3,
  },
  {
    key: "skills",
    label: "Skills",
    placeholder: "What you are good at, so HQ can delegate appropriately",
    rows: 3,
  },
  {
    key: "resources",
    label: "Resources",
    placeholder:
      "People, tools, accounts, vehicles, spaces, or access you can draw on",
    rows: 3,
  },
  {
    key: "routines",
    label: "Routines",
    placeholder: "Your normal rhythms: wake, work, care, sleep, days off…",
    rows: 3,
  },
  {
    key: "currentObjectives",
    label: "Current objectives",
    placeholder: "What you are actually trying to get done right now",
    rows: 3,
  },
  {
    key: "importantPeople",
    label: "Important people",
    placeholder: "Who matters in your work or life, and why",
    rows: 3,
  },
  {
    key: "dislikes",
    label: "Dislikes / avoid",
    placeholder: "Things HQ should not do or suggest",
    rows: 3,
  },
  {
    key: "notes",
    label: "Other notes",
    placeholder: "Anything else the handler should know",
    rows: 4,
  },
];

const emptyProfile = (): OperativeProfileType => ({
  name: "",
  callsign: "",
  pronouns: "",
  timezone: "",
  homeBase: "",
  languages: "",
  communicationStyle: "",
  accessibilityNeeds: "",
  healthNotes: "",
  constraints: "",
  skills: "",
  resources: "",
  routines: "",
  currentObjectives: "",
  importantPeople: "",
  dislikes: "",
  notes: "",
  tags: [],
  updatedAt: "",
});

const ProfilePage: React.FC = () => {
  const { project, updateProfile } = useProjectData();
  const { showSuccess } = useNotification();
  const initial = useMemo(
    () => ({ ...emptyProfile(), ...(project?.profile || {}) }),
    [project?.profile],
  );
  const [draft, setDraft] = useState<OperativeProfileType>(initial);
  const [tagText, setTagText] = useState((initial.tags || []).join(", "));

  const setField = (key: keyof OperativeProfileType, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const save = () => {
    updateProfile({
      ...draft,
      tags: tagText
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    });
    showSuccess("Personnel file saved.");
  };

  return (
    <MainContentArea
      title="My Profile"
      inlineActions={
        <Button
          variant="primary"
          leftIcon={<FiSave className="h-4 w-4" />}
          onClick={save}
        >
          Save personnel file
        </Button>
      }
    >
      <div className="mx-auto max-w-4xl space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          This is your personnel file. HQ reads it before acting, so keep it
          accurate: how you want to be spoken to, what you can and cannot do,
          and what you are trying to accomplish.
        </p>

        <div className="grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 md:grid-cols-2">
          {FIELDS.map((field) => (
            <div
              key={field.key}
              className={field.rows && field.rows > 2 ? "md:col-span-2" : ""}
            >
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                {field.label}
              </label>
              {field.rows ? (
                <textarea
                  className={inputClass}
                  rows={field.rows}
                  value={String(draft[field.key] || "")}
                  placeholder={field.placeholder}
                  onChange={(event) =>
                    setField(field.key, event.target.value)
                  }
                />
              ) : (
                <input
                  className={inputClass}
                  value={String(draft[field.key] || "")}
                  placeholder={field.placeholder}
                  onChange={(event) =>
                    setField(field.key, event.target.value)
                  }
                />
              )}
            </div>
          ))}
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              Tags
            </label>
            <input
              className={inputClass}
              value={tagText}
              onChange={(event) => setTagText(event.target.value)}
              placeholder="comma, separated"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            variant="primary"
            leftIcon={<FiSave className="h-4 w-4" />}
            onClick={save}
          >
            Save personnel file
          </Button>
        </div>
      </div>
    </MainContentArea>
  );
};

export default ProfilePage;
