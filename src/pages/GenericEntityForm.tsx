import React, { useState, useEffect } from "react";
import InputField from "../components/common/InputField";
import Button from "../components/common/Button";
import SelectDropdown from "../components/common/SelectDropdown";
import RichTextEditor from "../components/common/RichTextEditor";
import { useProjectData } from "../contexts/ProjectDataContext";
import useKnowledgeBaseOptions from "../hooks/useKnowledgeBaseOptions";
import { ID } from "../types/project";
import {
  CustomEntityType,
  GenericEntity,
  FieldDefinition,
} from "../types/dynamicEntity";
import { FaPlus, FaTrash, FaGripVertical } from "react-icons/fa";

interface GenericEntityFormProps {
  entityType: CustomEntityType;
  initialData?: Partial<GenericEntity>;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

// Field type components
const TextField: React.FC<{
  field: FieldDefinition;
  value: any;
  onChange: (value: any) => void;
  error?: string;
}> = ({ field, value, onChange, error }) => {
  return (
    <InputField
      label={field.label}
      name={field.key}
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      required={field.required}
      error={error}
      placeholder={field.placeholder}
      helpText={field.helpText}
    />
  );
};

const TextAreaField: React.FC<{
  field: FieldDefinition;
  value: any;
  onChange: (value: any) => void;
  error?: string;
}> = ({ field, value, onChange, error }) => {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
        rows={4}
        placeholder={field.placeholder}
      />
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
      {field.helpText && (
        <p className="text-gray-500 text-xs mt-1">{field.helpText}</p>
      )}
    </div>
  );
};

const RichTextField: React.FC<{
  field: FieldDefinition;
  value: any;
  onChange: (value: any) => void;
}> = ({ field, value, onChange }) => {
  return (
    <RichTextEditor
      label={field.label}
      value={value || ""}
      onChange={onChange}
    />
  );
};

const SelectField: React.FC<{
  field: FieldDefinition;
  value: any;
  onChange: (value: any) => void;
  options: Array<{ value: string; label: string }>;
}> = ({ field, value, onChange, options }) => {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
      >
        <option value="">Select...</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {field.helpText && (
        <p className="text-gray-500 text-xs mt-1">{field.helpText}</p>
      )}
    </div>
  );
};

const DateField: React.FC<{
  field: FieldDefinition;
  value: any;
  onChange: (value: any) => void;
  error?: string;
}> = ({ field, value, onChange, error }) => {
  return (
    <InputField
      label={field.label}
      name={field.key}
      type="date"
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      required={field.required}
      error={error}
      helpText={field.helpText}
    />
  );
};

const NumberField: React.FC<{
  field: FieldDefinition;
  value: any;
  onChange: (value: any) => void;
  error?: string;
}> = ({ field, value, onChange, error }) => {
  return (
    <InputField
      label={field.label}
      name={field.key}
      type="number"
      value={value || ""}
      onChange={(e) => onChange(e.target.valueAsNumber)}
      required={field.required}
      error={error}
      helpText={field.helpText}
    />
  );
};

const BooleanField: React.FC<{
  field: FieldDefinition;
  value: any;
  onChange: (value: any) => void;
}> = ({ field, value, onChange }) => {
  return (
    <div className="flex items-center">
      <input
        id={field.key}
        type="checkbox"
        checked={value || false}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
      />
      <label
        htmlFor={field.key}
        className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
      >
        {field.label}
      </label>
      {field.helpText && (
        <p className="text-gray-500 text-xs ml-6">{field.helpText}</p>
      )}
    </div>
  );
};

const ListField: React.FC<{
  field: FieldDefinition;
  value: any;
  onChange: (value: any) => void;
}> = ({ field, value, onChange }) => {
  const items = Array.isArray(value) ? value : [];
  const [newItem, setNewItem] = useState("");

  const addItem = () => {
    if (newItem.trim()) {
      onChange([...items, newItem.trim()]);
      setNewItem("");
    }
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {field.label}
      </label>
      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyPress={(e) =>
              e.key === "Enter" && (e.preventDefault(), addItem())
            }
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            placeholder={field.placeholder || "Add item..."}
          />
          <Button variant="outline" size="sm" onClick={addItem} type="button">
            <FaPlus className="h-4 w-4" />
          </Button>
        </div>
        <ul className="space-y-1">
          {items.map((item, index) => (
            <li
              key={index}
              className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-md"
            >
              <span className="text-sm">{item}</span>
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="text-red-500 hover:text-red-700"
              >
                <FaTrash className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      </div>
      {field.helpText && (
        <p className="text-gray-500 text-xs mt-1">{field.helpText}</p>
      )}
    </div>
  );
};

const GenericEntityForm: React.FC<GenericEntityFormProps> = ({
  entityType,
  initialData,
  onSubmit,
  onCancel,
}) => {
  const { project } = useProjectData();
  const kbOptions = useKnowledgeBaseOptions(project);

  // Initialize form data
  const [formData, setFormData] = useState<Record<string, any>>({
    name: initialData?.name || "",
    description: initialData?.description || "",
    tags: Array.isArray(initialData?.tags) ? initialData.tags.join(", ") : "",
  });

  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize field values from initial data
  useEffect(() => {
    if (initialData?.fields) {
      setFieldValues(initialData.fields);
    }
  }, [initialData]);

  // Get relationship options based on target type
  const getRelationshipOptions = (targetType: string) => {
    switch (targetType) {
      case "character":
        return kbOptions.getCharacterOptions();
      case "location":
      case "setting":
        return kbOptions.getLocationOptions();
      case "technology":
      case "plot_device":
        return kbOptions.getTechnologyOptions();
      case "culture":
        return kbOptions.getCultureOptions();
      case "source":
        return kbOptions.getSourceDocumentOptions();
      default:
        return [];
    }
  };

  // Render a field based on its type
  const renderField = (field: FieldDefinition) => {
    const value = fieldValues[field.key];
    const onChange = (val: any) => {
      setFieldValues((prev) => ({ ...prev, [field.key]: val }));
    };

    switch (field.type) {
      case "text":
        return (
          <TextField
            field={field}
            value={value}
            onChange={onChange}
            error={errors[field.key]}
          />
        );
      case "textarea":
        return (
          <TextAreaField
            field={field}
            value={value}
            onChange={onChange}
            error={errors[field.key]}
          />
        );
      case "richtext":
        return (
          <RichTextField field={field} value={value} onChange={onChange} />
        );
      case "select":
        return (
          <SelectField
            field={field}
            value={value}
            onChange={onChange}
            options={field.options || []}
          />
        );
      case "date":
        return (
          <DateField
            field={field}
            value={value}
            onChange={onChange}
            error={errors[field.key]}
          />
        );
      case "number":
        return (
          <NumberField
            field={field}
            value={value}
            onChange={onChange}
            error={errors[field.key]}
          />
        );
      case "boolean":
        return <BooleanField field={field} value={value} onChange={onChange} />;
      case "list":
        return <ListField field={field} value={value} onChange={onChange} />;
      case "relationship":
        return (
          <SelectDropdown
            label={field.label}
            options={getRelationshipOptions(field.targetType || "")}
            value={value || (field.multiple ? [] : "")}
            onChange={(val) => onChange(val)}
            multiple={field.multiple}
            searchable
          />
        );
      default:
        return (
          <TextField
            field={field}
            value={value}
            onChange={onChange}
            error={errors[field.key]}
          />
        );
    }
  };

  // Group fields by category
  const groupedFields = useMemo(() => {
    if (!entityType.fields) return {};

    const groups: Record<string, FieldDefinition[]> = {
      basic: [],
      details: [],
      relationships: [],
      other: [],
    };

    entityType.fields.forEach((field) => {
      const category = field.category || "other";
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(field);
    });

    // Remove empty groups
    Object.keys(groups).forEach((key) => {
      if (groups[key].length === 0) {
        delete groups[key];
      }
    });

    return groups;
  }, [entityType]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Validate required base fields
    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    // Validate custom required fields
    entityType.fields?.forEach((field) => {
      if (field.required && !fieldValues[field.key]) {
        newErrors[field.key] = `${field.label} is required`;
      }
    });

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
        .map((tag: string) => tag.trim())
        .filter(Boolean),
      fields: fieldValues,
      entityType: entityType.id,
    };

    onSubmit(processedData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Basic Information */}
      <div className="space-y-6">
        <InputField
          label="Name"
          name="name"
          value={formData.name}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, name: e.target.value }))
          }
          required
          error={errors.name}
        />
        <RichTextEditor
          label="Description"
          value={formData.description}
          onChange={(val) =>
            setFormData((prev) => ({ ...prev, description: val }))
          }
        />
      </div>

      {/* Custom Fields by Category */}
      {Object.entries(groupedFields).map(([category, fields]) => (
        <div key={category} className="pt-6 mt-6 border-t dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 capitalize">
            {category === "basic" ? "Additional Information" : category}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {fields.map((field) => (
              <div
                key={field.key}
                className={
                  field.type === "richtext" ||
                  field.type === "textarea" ||
                  field.type === "list"
                    ? "md:col-span-2"
                    : ""
                }
              >
                {renderField(field)}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Tags */}
      <div className="pt-6 mt-6 border-t dark:border-gray-700">
        <InputField
          label="Tags"
          name="tags"
          value={formData.tags}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, tags: e.target.value }))
          }
          placeholder="tag1, tag2, tag3"
          helpText="Separate tags with commas"
        />
      </div>

      {/* Form Actions */}
      <div className="pt-8 flex justify-end space-x-3 border-t dark:border-gray-700 mt-8">
        <Button variant="outline" onClick={onCancel} type="button">
          Cancel
        </Button>
        <Button variant="primary" type="submit">
          {initialData?.id
            ? `Update ${entityType.name}`
            : `Create ${entityType.name}`}
        </Button>
      </div>
    </form>
  );
};

export default GenericEntityForm;
