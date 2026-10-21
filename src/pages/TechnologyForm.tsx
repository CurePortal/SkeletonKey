import React, { useState, useEffect } from "react";
import InputField from "../components/common/InputField";
import Button from "../components/common/Button";
import SelectDropdown, {
  SelectOption,
} from "../components/common/SelectDropdown";
// Removed ErrorDisplay import
import { useProjectData } from "../contexts/ProjectDataContext";
import useKnowledgeBaseOptions from "../hooks/useKnowledgeBaseOptions";
import { TechnologyType, ID } from "../types/project";

interface TechnologyFormProps {
  initialData?: Partial<TechnologyType> & { id?: ID };
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

const TechnologyForm: React.FC<TechnologyFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
}) => {
  const { project } = useProjectData();
  const kbOptions = useKnowledgeBaseOptions(project);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    discoveryDate: "",
    developmentLevel: 5,
    impact: 5,
    fields: "",
    notes: "",
    tags: "",
  });

  const [prerequisiteTechIds, setPrerequisiteTechIds] = useState<ID[]>([]);
  const [derivedTechIds, setDerivedTechIds] = useState<ID[]>([]);
  const [inventors, setInventors] = useState<ID[]>([]);
  const [linkedEventIds, setLinkedEventIds] = useState<ID[]>([]);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || "",
        description: initialData.description || "",
        discoveryDate: initialData.discoveryDate || "",
        developmentLevel: initialData.developmentLevel ?? 5,
        impact: initialData.impact ?? 5,
        fields: Array.isArray(initialData.fields)
          ? initialData.fields.join(", ")
          : "",
        notes: initialData.notes || "",
        tags: Array.isArray(initialData.tags)
          ? initialData.tags.join(", ")
          : "",
      });
      setPrerequisiteTechIds(initialData.prerequisiteTechIds || []);
      setDerivedTechIds(initialData.derivedTechIds || []);
      setInventors(initialData.inventors || []);
      setLinkedEventIds(initialData.linkedEventIds || []);
    }
    setErrors({});
  }, [initialData]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "Technology name is required.";
    if (!formData.description.trim())
      newErrors.description = "Description is required.";

    const overlap = prerequisiteTechIds.some((id) =>
      derivedTechIds.includes(id),
    );
    if (overlap) {
      const msg = "Cannot be both prerequisite and derived.";
      newErrors.derivedTechIds = msg;
      newErrors.prerequisiteTechIds = msg;
    }
    // Add more validation...
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleRangeChange = (name: string, value: number) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    const processedData = {
      ...formData,
      id: initialData?.id,
      developmentLevel: parseInt(formData.developmentLevel.toString()),
      impact: parseInt(formData.impact.toString()),
      fields: formData.fields
        .split(",")
        .map((field) => field.trim())
        .filter(Boolean),
      tags: formData.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      timelineIds: initialData?.timelineIds || [],
      prerequisiteTechIds,
      derivedTechIds,
      inventors,
      linkedEventIds,
    };
    onSubmit(processedData);
  };

  const baseTechnologyOptions = kbOptions.getTechnologyOptions();
  const technologyOptions = initialData?.id
    ? baseTechnologyOptions.filter((option) => option.value !== initialData.id)
    : baseTechnologyOptions;
  const characterOptions = kbOptions.getCharacterOptions();
  const eventOptions = kbOptions.getEventOptions();

  const getSelectedOptions = (
    selectedIds: ID[],
    allOptions: SelectOption[],
  ): SelectOption[] =>
    allOptions.filter((option) => selectedIds.includes(option.value));

  const selectedPrerequisiteOptions = getSelectedOptions(
    prerequisiteTechIds,
    technologyOptions,
  );
  const selectedDerivedOptions = getSelectedOptions(
    derivedTechIds,
    technologyOptions,
  );
  const selectedInventorOptions = getSelectedOptions(
    inventors,
    characterOptions,
  );
  const selectedEventOptions = getSelectedOptions(linkedEventIds, eventOptions);

  const TagDisplay: React.FC<{
    options: SelectOption[];
    onRemove: (id: ID) => void;
    colorClass: string;
  }> = ({ options, onRemove, colorClass }) => (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {options.map((option) => (
        <span
          key={option.value}
          className={`inline-flex items-center py-0.5 px-2 text-xs font-medium rounded-full ${colorClass}`}
        >
          {option.label}
          <button
            type="button"
            className="ml-1 flex-shrink-0 inline-flex items-center justify-center h-3.5 w-3.5 rounded-full text-current opacity-70 hover:opacity-100 focus:outline-none"
            onClick={() => onRemove(option.value)}
            aria-label={`Remove ${option.label}`}
          >
            <svg
              className="h-2 w-2"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 8 8"
            >
              <path
                strokeLinecap="round"
                strokeWidth="1.5"
                d="M1 1l6 6m0-6L1 7"
              />
            </svg>
          </button>
        </span>
      ))}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Section 1: Basic Information */}
      <div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <div className="md:col-span-2">
            <InputField
              label="Name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter technology name"
              required
              error={errors.name} // FIX: Pass string directly
              // REMOVED: ariaDescribedBy
            />
            {/* REMOVED: ErrorDisplay block */}
          </div>
          <div className="md:col-span-2">
            <InputField
              label="Description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe the technology"
              as="textarea"
              rows={4}
              required
              error={errors.description} // FIX: Pass string directly
              // REMOVED: ariaDescribedBy
            />
            {/* REMOVED: ErrorDisplay block */}
          </div>
        </div>
      </div>

      {/* Section 2: Timeline & Assessment */}
      <div className="pt-6 mt-6 border-t dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Timeline & Assessment
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
          <div>
            <InputField
              label="Discovery Date"
              name="discoveryDate"
              value={formData.discoveryDate}
              onChange={handleChange}
              placeholder="YYYY-MM-DD"
              type="date"
              error={errors.discoveryDate} // FIX: Pass string directly
              // REMOVED: ariaDescribedBy
            />
            {/* REMOVED: ErrorDisplay block */}
          </div>
          {/* Development Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Development Level ({formData.developmentLevel}/10)
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="range"
                min="1"
                max="10"
                name="developmentLevel"
                value={formData.developmentLevel}
                onChange={(e) =>
                  handleRangeChange(
                    "developmentLevel",
                    parseInt(e.target.value),
                  )
                }
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
              />
              <span className="w-8 text-center text-sm text-gray-700 dark:text-gray-300 tabular-nums">
                {formData.developmentLevel}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              How mature is this technology?
            </p>
          </div>
          {/* Impact Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Impact ({formData.impact}/10)
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="range"
                min="1"
                max="10"
                name="impact"
                value={formData.impact}
                onChange={(e) =>
                  handleRangeChange("impact", parseInt(e.target.value))
                }
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
              />
              <span className="w-8 text-center text-sm text-gray-700 dark:text-gray-300 tabular-nums">
                {formData.impact}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              How significant is its impact?
            </p>
          </div>
          <div className="md:col-span-3">
            <InputField
              label="Timelines"
              name="timelines"
              value={(initialData?.timelineIds || []).join(", ")}
              disabled={true}
              helpText="Timelines are managed in the Timeline view"
            />
          </div>
        </div>
      </div>

      {/* Section 3: Technology Relationships */}
      <div className="pt-6 mt-6 border-t dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Technology Relationships
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <div>
            <SelectDropdown
              label="Prerequisite Technologies"
              options={technologyOptions}
              value={prerequisiteTechIds}
              onChange={(value) => setPrerequisiteTechIds(value as ID[])}
              multiple
              searchable
              helpText="Technologies required for this one"
              error={errors.prerequisiteTechIds} // FIX: Pass string directly
              // REMOVED: ariaDescribedBy
            />
            {/* REMOVED: ErrorDisplay block */}
            <TagDisplay
              options={selectedPrerequisiteOptions}
              onRemove={(id) =>
                setPrerequisiteTechIds((prev) =>
                  prev.filter((pId) => pId !== id),
                )
              }
              colorClass="text-green-700 bg-green-100 dark:text-green-100 dark:bg-green-700"
            />
          </div>
          <div>
            <SelectDropdown
              label="Derived Technologies"
              options={technologyOptions}
              value={derivedTechIds}
              onChange={(value) => setDerivedTechIds(value as ID[])}
              multiple
              searchable
              helpText="Technologies derived from this one"
              error={errors.derivedTechIds} // FIX: Pass string directly
              // REMOVED: ariaDescribedBy
            />
            {/* REMOVED: ErrorDisplay block */}
            <TagDisplay
              options={selectedDerivedOptions}
              onRemove={(id) =>
                setDerivedTechIds((prev) => prev.filter((dId) => dId !== id))
              }
              colorClass="text-indigo-700 bg-indigo-100 dark:text-indigo-100 dark:bg-indigo-700"
            />
          </div>
        </div>
      </div>

      {/* Section 4: People & Events */}
      <div className="pt-6 mt-6 border-t dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
          People & Events
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <div>
            <SelectDropdown
              label="Inventors/Discoverers"
              options={characterOptions}
              value={inventors}
              onChange={(value) => setInventors(value as ID[])}
              multiple
              searchable
              helpText="Characters involved"
              error={errors.inventors} // FIX: Pass string directly
              // REMOVED: ariaDescribedBy
            />
            {/* REMOVED: ErrorDisplay block */}
            <TagDisplay
              options={selectedInventorOptions}
              onRemove={(id) =>
                setInventors((prev) => prev.filter((iId) => iId !== id))
              }
              colorClass="text-amber-700 bg-amber-100 dark:text-amber-100 dark:bg-amber-700"
            />
          </div>
          <div>
            <SelectDropdown
              label="Related Events"
              options={eventOptions}
              value={linkedEventIds}
              onChange={(value) => setLinkedEventIds(value as ID[])}
              multiple
              searchable
              helpText="Events linked"
              error={errors.linkedEventIds} // FIX: Pass string directly
              // REMOVED: ariaDescribedBy
            />
            {/* REMOVED: ErrorDisplay block */}
            <TagDisplay
              options={selectedEventOptions}
              onRemove={(id) =>
                setLinkedEventIds((prev) => prev.filter((eId) => eId !== id))
              }
              colorClass="text-sky-700 bg-sky-100 dark:text-sky-100 dark:bg-sky-600"
            />
          </div>
        </div>
      </div>

      {/* Section 5: Fields & Categorization */}
      <div className="pt-6 mt-6 border-t dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Fields & Categorization
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <div>
            <InputField
              label="Fields"
              name="fields"
              value={formData.fields}
              onChange={handleChange}
              placeholder="engineering, science (comma-separated)"
              helpText="Separate fields with commas"
              error={errors.fields} // FIX: Pass string directly
              // REMOVED: ariaDescribedBy
            />
            {/* REMOVED: ErrorDisplay block */}
          </div>
          <div>
            <InputField
              label="Tags"
              name="tags"
              value={formData.tags}
              onChange={handleChange}
              placeholder="tag1, tag2, tag3"
              helpText="Separate tags with commas"
              error={errors.tags} // FIX: Pass string directly
              // REMOVED: ariaDescribedBy
            />
            {/* REMOVED: ErrorDisplay block */}
          </div>
        </div>
      </div>

      {/* Section 6: Additional Information */}
      <div className="pt-6 mt-6 border-t dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Additional Information
        </h3>
        <div>
          <InputField
            label="Notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            placeholder="Research notes or additional information"
            as="textarea"
            rows={4}
            error={errors.notes} // FIX: Pass string directly
            // REMOVED: ariaDescribedBy
          />
          {/* REMOVED: ErrorDisplay block */}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-8 flex justify-end space-x-3 border-t dark:border-gray-700 mt-8">
        <Button variant="outline" onClick={onCancel} type="button">
          Cancel
        </Button>
        <Button variant="primary" type="submit">
          {initialData?.id ? "Update Technology" : "Create Technology"}
        </Button>
      </div>
    </form>
  );
};

export default TechnologyForm;
