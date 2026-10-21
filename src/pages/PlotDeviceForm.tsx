import React, { useState, useEffect } from "react";
import InputField from "../components/common/InputField";
import Button from "../components/common/Button";
import SelectDropdown from "../components/common/SelectDropdown";
import { useProjectData } from "../contexts/ProjectDataContext";
import useKnowledgeBaseOptions from "../hooks/useKnowledgeBaseOptions";
import { ID } from "../types/project";
import { GenericEntity } from "../types/dynamicEntity";

interface PlotDeviceFormProps {
  initialData?: Partial<GenericEntity>;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

const PLOT_DEVICE_TYPES = [
  "MacGuffin",
  "Red Herring",
  "Chekhov's Gun",
  "Deus Ex Machina",
  "Plot Twist",
  "Other",
];

const PlotDeviceForm: React.FC<PlotDeviceFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
}) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    tags: "",
    device_type: PLOT_DEVICE_TYPES[0],
    purpose: "",
    introduction: "",
    resolution: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || "",
        description: initialData.description || "",
        tags: Array.isArray(initialData.tags)
          ? initialData.tags.join(", ")
          : "",
        device_type: initialData.fields?.device_type || PLOT_DEVICE_TYPES[0],
        purpose: initialData.fields?.purpose || "",
        introduction: initialData.fields?.introduction || "",
        resolution: initialData.fields?.resolution || "",
      });
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
        device_type: formData.device_type,
        purpose: formData.purpose,
        introduction: formData.introduction,
        resolution: formData.resolution,
      },
    };
    onSubmit(processedData);
  };

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
        <InputField
          label="Description"
          name="description"
          value={formData.description}
          as="textarea"
          rows={3}
          onChange={handleChange}
        />
      </div>

      <div className="pt-6 mt-6 border-t dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Type
            </label>
            <select
              name="device_type"
              value={formData.device_type}
              onChange={handleChange}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              {PLOT_DEVICE_TYPES.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <InputField
            label="Purpose"
            name="purpose"
            value={formData.purpose}
            as="textarea"
            rows={3}
            onChange={handleChange}
            helpText="What is the narrative purpose of this device?"
          />
          <InputField
            label="Introduction"
            name="introduction"
            value={formData.introduction}
            as="textarea"
            rows={3}
            onChange={handleChange}
            helpText="How is it introduced in the story?"
          />
          <InputField
            label="Resolution"
            name="resolution"
            value={formData.resolution}
            as="textarea"
            rows={3}
            onChange={handleChange}
            helpText="How is it resolved or concluded?"
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
          {initialData?.id ? "Update Plot Device" : "Create Plot Device"}
        </Button>
      </div>
    </form>
  );
};

export default PlotDeviceForm;
