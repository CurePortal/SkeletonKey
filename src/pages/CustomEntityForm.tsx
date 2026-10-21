import React, { useState } from "react";
import InputField from "../components/common/InputField";
import Button from "../components/common/Button";
import { CustomEntityType, GenericEntity } from "../types/dynamicEntity";

interface CustomEntityFormProps {
  entityType: CustomEntityType;
  initialData?: Partial<GenericEntity> | null;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

const CustomEntityForm: React.FC<CustomEntityFormProps> = ({
  entityType,
  initialData,
  onSubmit,
  onCancel,
}) => {
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(
    initialData?.description || "",
  );
  const [tags, setTags] = useState((initialData?.tags || []).join(", "));

  const submit = () => {
    if (!name.trim()) return;
    onSubmit({
      name: name.trim().slice(0, 200),
      description: description.trim(),
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 50),
    });
  };

  return (
    <div className="space-y-4">
      <InputField
        label={`${entityType.name} name`}
        value={name}
        onChange={(event) => setName(event.target.value)}
        required
      />
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Description
        </label>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={5}
          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <InputField
        label="Tags"
        value={tags}
        onChange={(event) => setTags(event.target.value)}
        placeholder="comma, separated, tags"
      />
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" onClick={submit} disabled={!name.trim()}>
          Save
        </Button>
      </div>
    </div>
  );
};

export default CustomEntityForm;
