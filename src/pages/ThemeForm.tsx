import React, { useState, useEffect } from "react";
import InputField from "../components/common/InputField";
import Button from "../components/common/Button";
import SelectDropdown from "../components/common/SelectDropdown";
import RichTextEditor from "../components/common/RichTextEditor";
import { useProjectData } from "../contexts/ProjectDataContext";
import useKnowledgeBaseOptions from "../hooks/useKnowledgeBaseOptions";
import { ID } from "../types/project";
import { GenericEntity } from "../types/dynamicEntity";

interface ThemeFormProps {
  initialData?: Partial<GenericEntity>;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

const THEME_TYPES = [
  "Central Theme",
  "Motif",
  "Symbol",
  "Archetype",
  "Moral",
  "Other",
];

const ThemeForm: React.FC<ThemeFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
}) => {
  const { project } = useProjectData();
  const kbOptions = useKnowledgeBaseOptions(project);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    tags: "",
    theme_type: THEME_TYPES[0],
    manifestation: "",
  });
  const [relatedCharacterIds, setRelatedCharacterIds] = useState<ID[]>([]);
  const [relatedSettingIds, setRelatedSettingIds] = useState<ID[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || "",
        description: initialData.description || "",
        tags: Array.isArray(initialData.tags)
          ? initialData.tags.join(", ")
          : "",
        theme_type: initialData.fields?.theme_type || THEME_TYPES[0],
        manifestation: initialData.fields?.manifestation || "",
      });
      setRelatedCharacterIds(initialData.fields?.related_characters || []);
      setRelatedSettingIds(initialData.fields?.related_settings || []);
    }
  }, [initialData]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "Name is required.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    const processedData = {
      ...initialData,
      name: formData.name,
      description: formData.description,
      tags: formData.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      fields: {
        theme_type: formData.theme_type,
        manifestation: formData.manifestation,
        related_characters: relatedCharacterIds,
        related_settings: relatedSettingIds,
      },
    };
    onSubmit(processedData);
  };

  const characterOptions = kbOptions.getCharacterOptions();
  // Note: We need options for 'settings'. We'll get them from the locations list for now.
  const settingOptions = kbOptions.getLocationOptions();

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="space-y-6">
        <InputField
          label="Name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          error={errors.name}
        />
        <RichTextEditor
          label="Description"
          value={formData.description}
          onChange={(val) => setFormData((p) => ({ ...p, description: val }))}
        />
      </div>

      <div className="pt-6 mt-6 border-t dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Details
        </h3>
        <div className="grid grid-cols-1 gap-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Type
            </label>
            <select
              name="theme_type"
              value={formData.theme_type}
              onChange={handleChange}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              {THEME_TYPES.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <RichTextEditor
            label="How it Manifests"
            value={formData.manifestation}
            onChange={(val) =>
              setFormData((p) => ({ ...p, manifestation: val }))
            }
          />
        </div>
      </div>

      <div className="pt-6 mt-6 border-t dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Relationships
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <SelectDropdown
            label="Related Characters"
            options={characterOptions}
            value={relatedCharacterIds}
            onChange={(val) => setRelatedCharacterIds(val as ID[])}
            multiple
            searchable
          />
          <SelectDropdown
            label="Related Settings"
            options={settingOptions}
            value={relatedSettingIds}
            onChange={(val) => setRelatedSettingIds(val as ID[])}
            multiple
            searchable
          />
        </div>
      </div>

      <div className="pt-6 mt-6 border-t dark:border-gray-700">
        <InputField
          label="Tags"
          name="tags"
          value={formData.tags}
          onChange={handleChange}
          placeholder="tag1, tag2, tag3"
          helpText="Separate tags with commas"
        />
      </div>

      <div className="pt-8 flex justify-end space-x-3 border-t dark:border-gray-700 mt-8">
        <Button variant="outline" onClick={onCancel} type="button">
          Cancel
        </Button>
        <Button variant="primary" type="submit">
          {initialData?.id ? "Update Theme" : "Create Theme"}
        </Button>
      </div>
    </form>
  );
};

export default ThemeForm;
