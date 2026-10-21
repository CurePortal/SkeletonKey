import React, { useState, useEffect, useRef } from "react";
import InputField from "../components/common/InputField";
import Button from "../components/common/Button";
// FIX 1: Removed { Option } from import as it's not exported from SelectDropdown per TS2614
import SelectDropdown from "../components/common/SelectDropdown";
import { useProjectData } from "../contexts/ProjectDataContext";
import useKnowledgeBaseOptions from "../hooks/useKnowledgeBaseOptions";
import { CharacterType, ID } from "../types/project";

// FIX 1: Define Option type locally. Ideally, this should be exported from SelectDropdown.tsx
// or a shared types file. Ensure this matches the structure used by SelectDropdown and kbOptions.
interface Option {
  value: ID; // Assuming value is of type ID based on usage with relatedCharacterIds etc.
  label: string;
  [key: string]: any; // For flexibility if options have other data (e.g., disabled, color)
}

interface CharacterFormProps {
  initialData?: Partial<CharacterType>;
  onSubmit: (data: any, imageFile?: File | null) => void;
  onCancel: () => void;
}

const CharacterForm: React.FC<CharacterFormProps> = ({
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
    birthDate: "",
    deathDate: "",
    traits: "",
    motivation: "",
    background: "",
    notes: "",
    isHistorical: false,
    imageUrl: "",
    tags: "",
  });

  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imageFileName, setImageFileName] = useState<string | null>(null);
  const [imageSource, setImageSource] = useState<"url" | "file">("url");
  const imageFileInputRef = useRef<HTMLInputElement>(null);

  const [relatedCharacterIds, setRelatedCharacterIds] = useState<ID[]>([]);
  const [linkedEventIds, setLinkedEventIds] = useState<ID[]>([]);
  const [locationIds, setLocationIds] = useState<ID[]>([]);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || "",
        description: initialData.description || "",
        birthDate: initialData.birthDate || "",
        deathDate: initialData.deathDate || "",
        traits: Array.isArray(initialData.traits)
          ? initialData.traits.join(", ")
          : initialData.traits || "",
        motivation: initialData.motivation || "",
        background: initialData.background || "",
        notes: initialData.notes || "",
        isHistorical: initialData.isHistorical || false,
        imageUrl: initialData.imageUrl || "",
        tags: Array.isArray(initialData.tags)
          ? initialData.tags.join(", ")
          : initialData.tags || "",
      });

      if (initialData.imageUrl) {
        setImageSource("url");
      } else if (
        (initialData as any).imageFileName ||
        (initialData as any).imagePath
      ) {
        setImageSource("file");
        setImageFileName(
          (initialData as any).imageFileName || (initialData as any).imagePath,
        );
      }

      if (initialData.relatedCharacterIds) {
        if (Array.isArray(initialData.relatedCharacterIds)) {
          setRelatedCharacterIds(initialData.relatedCharacterIds);
        } else {
          const allRelatedIds: ID[] = [];
          Object.values(initialData.relatedCharacterIds).forEach((idArray) => {
            if (Array.isArray(idArray)) {
              allRelatedIds.push(...idArray);
            }
          });
          setRelatedCharacterIds(allRelatedIds);
        }
      }

      setLinkedEventIds(initialData.linkedEventIds || []);
      setLocationIds(initialData.locations || []); // CharacterType.locations is ID[]
    }
  }, [initialData]);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImageFile(file);
      setImageFileName(file.name);
      setFormData((prev) => ({
        ...prev,
        imageUrl: "",
      }));
    }
  };

  const handleImageFileUploadClick = () => {
    imageFileInputRef.current?.click();
  };

  const handleImageSourceChange = (source: "url" | "file") => {
    setImageSource(source);
    if (source === "url") {
      setSelectedImageFile(null);
      setImageFileName(null);
    } else {
      setFormData((prev) => ({
        ...prev,
        imageUrl: "",
      }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "Name is required";

    if (formData.birthDate && formData.deathDate) {
      const birthDate = new Date(formData.birthDate);
      const deathDate = new Date(formData.deathDate);
      if (birthDate > deathDate) {
        newErrors.deathDate = "Death date cannot be before birth date";
      }
    }

    if (
      imageSource === "url" &&
      formData.imageUrl &&
      !isValidUrl(formData.imageUrl)
    ) {
      newErrors.imageUrl = "Please enter a valid URL";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (urlString: string): boolean => {
    try {
      const url = new URL(urlString);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) {
      return false;
    }
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    const processedData = {
      ...formData,
      traits: formData.traits
        .split(",")
        .map((trait) => trait.trim())
        .filter((trait) => trait.length > 0),
      tags: formData.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
      timelineIds: initialData?.timelineIds || [],
      relatedCharacterIds: relatedCharacterIds,
      linkedEventIds: linkedEventIds,
      locations: locationIds, // Ensure this matches the expected field name for character locations
      imageUrl: imageSource === "file" ? "" : formData.imageUrl,
    };

    onSubmit(processedData, selectedImageFile);
  };

  // Improved handleChange for type safety
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const target = e.target;
    const name = target.name;
    let valueToSet: string | boolean;

    // Check if the target is an HTMLInputElement and its type is checkbox
    if (target instanceof HTMLInputElement && target.type === "checkbox") {
      valueToSet = target.checked;
    } else {
      valueToSet = target.value;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: valueToSet,
    }));
  };

  // FIX 2: Call getCharacterOptions without arguments and filter manually per TS2554
  const allCharacterOptionsUnfiltered: Option[] =
    kbOptions.getCharacterOptions();
  const characterOptions: Option[] = initialData?.id
    ? allCharacterOptionsUnfiltered.filter(
        (option) => option.value !== initialData.id,
      )
    : allCharacterOptionsUnfiltered;

  const eventOptions: Option[] = kbOptions.getEventOptions();
  const locationOptions: Option[] = kbOptions.getLocationOptions();

  const getSelectedOptions = (
    selectedIds: ID[],
    allOptions: Option[],
  ): Option[] => {
    if (!selectedIds || selectedIds.length === 0) return [];
    return allOptions.filter((option) => selectedIds.includes(option.value));
  };

  const selectedCharacterOptions = getSelectedOptions(
    relatedCharacterIds,
    characterOptions,
  );
  const selectedEventOptions = getSelectedOptions(linkedEventIds, eventOptions);
  const selectedLocationOptions = getSelectedOptions(
    locationIds,
    locationOptions,
  );

  const getImagePreviewUrl = () => {
    if (imageSource === "file" && selectedImageFile) {
      return URL.createObjectURL(selectedImageFile);
    } else if (imageSource === "url" && formData.imageUrl) {
      return formData.imageUrl;
    }
    return null;
  };

  return (
    <div className="space-y-8">
      {/* Section 1: Basic Information */}
      <div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6 items-start">
          <div className="md:col-span-2 space-y-6">
            <InputField
              label="Name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter character name"
              required
              error={errors.name}
            />

            <InputField
              label="Description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe the character"
              as="textarea"
              rows={4}
            />
          </div>

          <div className="md:col-span-1 space-y-6">
            {/* Image Source Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Character Image
              </label>
              <div className="flex space-x-4 mb-3">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="imageSource"
                    value="url"
                    checked={imageSource === "url"}
                    onChange={() => handleImageSourceChange("url")}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    URL
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="imageSource"
                    value="file"
                    checked={imageSource === "file"}
                    onChange={() => handleImageSourceChange("file")}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Upload File
                  </span>
                </label>
              </div>

              {imageSource === "url" ? (
                <InputField
                  label=""
                  name="imageUrl"
                  value={formData.imageUrl}
                  onChange={handleChange}
                  placeholder="https://example.com/character-image.jpg"
                  helpText="Enter image URL"
                  error={errors.imageUrl}
                />
              ) : (
                <div>
                  <div
                    className="mt-1 flex items-center justify-between p-3 cursor-pointer border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                    onClick={handleImageFileUploadClick}
                  >
                    <span
                      className={
                        imageFileName
                          ? "text-gray-900 dark:text-white"
                          : "text-gray-500 dark:text-gray-400"
                      }
                    >
                      {imageFileName || "Click to upload image"}
                    </span>
                    <input
                      type="file"
                      ref={imageFileInputRef}
                      onChange={handleImageFileChange}
                      className="hidden"
                      accept="image/*"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleImageFileUploadClick();
                      }}
                      className="ml-3 whitespace-nowrap"
                    >
                      Browse
                    </Button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Upload an image file (JPG, PNG, etc.)
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center pt-2">
              <input
                type="checkbox"
                id="isHistorical"
                name="isHistorical"
                checked={formData.isHistorical}
                onChange={handleChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600 dark:focus:ring-offset-gray-800"
              />
              <label
                htmlFor="isHistorical"
                className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
              >
                Historical Character
              </label>
            </div>

            {/* Image Preview */}
            {getImagePreviewUrl() && (
              <div className="mt-2 border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden">
                <img
                  src={getImagePreviewUrl()!}
                  alt={formData.name || "Character portrait"}
                  className="w-full h-auto object-cover max-h-64"
                  onError={(e) => {
                    e.currentTarget.src =
                      "https://via.placeholder.com/300x300?text=Image+Not+Found";
                    e.currentTarget.onerror = null;
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 2: Timeline & Dates */}
      <div className="pt-6 mt-6 border-t dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Timeline & Dates
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <InputField
            label="Birth Date"
            name="birthDate"
            value={formData.birthDate}
            onChange={handleChange}
            placeholder="YYYY-MM-DD"
            type="date"
          />

          <InputField
            label="Death Date"
            name="deathDate"
            value={formData.deathDate}
            onChange={handleChange}
            placeholder="YYYY-MM-DD"
            type="date"
            error={errors.deathDate}
          />

          <div className="md:col-span-2">
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

      {/* Section 3: Character Details */}
      <div className="pt-6 mt-6 border-t dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Character Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <InputField
            label="Traits"
            name="traits"
            value={formData.traits}
            onChange={handleChange}
            placeholder="brave, intelligent, loyal (comma-separated)"
            helpText="Separate traits with commas"
          />

          <InputField
            label="Motivation"
            name="motivation"
            value={formData.motivation}
            onChange={handleChange}
            placeholder="What drives this character?"
          />

          <div className="md:col-span-2">
            <InputField
              label="Background"
              name="background"
              value={formData.background}
              onChange={handleChange}
              placeholder="Character's history and background"
              as="textarea"
              rows={4}
            />
          </div>
        </div>
      </div>

      {/* Section 4: Relationships */}
      <div className="pt-6 mt-6 border-t dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Relationships
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <div>
            <SelectDropdown
              label="Related Characters"
              options={characterOptions}
              value={relatedCharacterIds}
              onChange={(value) => setRelatedCharacterIds(value as ID[])}
              multiple
              searchable
              helpText="Characters with a relationship to this one"
            />
            {relatedCharacterIds.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selectedCharacterOptions.map((option) => (
                  <span
                    key={option.value}
                    className="inline-flex items-center py-0.5 px-2 text-xs font-medium rounded-full text-purple-700 bg-purple-100 dark:text-purple-100 dark:bg-purple-700"
                  >
                    {option.label}
                    <button
                      type="button"
                      className="ml-1 flex-shrink-0 inline-flex items-center justify-center h-3.5 w-3.5 rounded-full text-purple-500 hover:bg-purple-200 hover:text-purple-600 dark:text-purple-300 dark:hover:bg-purple-600 dark:hover:text-purple-100 focus:outline-none"
                      onClick={() => {
                        setRelatedCharacterIds((prev) =>
                          prev.filter((id) => id !== option.value),
                        );
                      }}
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
            )}
          </div>

          <div>
            <SelectDropdown
              label="Associated Events"
              options={eventOptions}
              value={linkedEventIds}
              onChange={(value) => setLinkedEventIds(value as ID[])}
              multiple
              searchable
              helpText="Events this character participated in"
            />
            {linkedEventIds.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selectedEventOptions.map((option) => (
                  <span
                    key={option.value}
                    className="inline-flex items-center py-0.5 px-2 text-xs font-medium rounded-full text-sky-700 bg-sky-100 dark:text-sky-100 dark:bg-sky-600"
                  >
                    {option.label}
                    <button
                      type="button"
                      className="ml-1 flex-shrink-0 inline-flex items-center justify-center h-3.5 w-3.5 rounded-full text-sky-500 hover:bg-sky-200 hover:text-sky-600 dark:text-sky-300 dark:hover:bg-sky-500 dark:hover:text-sky-100 focus:outline-none"
                      onClick={() => {
                        setLinkedEventIds((prev) =>
                          prev.filter((id) => id !== option.value),
                        );
                      }}
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
            )}
          </div>

          <div className="md:col-span-2">
            <SelectDropdown
              label="Locations"
              options={locationOptions}
              value={locationIds}
              onChange={(value) => setLocationIds(value as ID[])}
              multiple
              searchable
              helpText="Places associated with this character"
            />
            {locationIds.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selectedLocationOptions.map((option) => (
                  <span
                    key={option.value}
                    className="inline-flex items-center py-0.5 px-2 text-xs font-medium rounded-full text-green-700 bg-green-100 dark:text-green-100 dark:bg-green-700"
                  >
                    {option.label}
                    <button
                      type="button"
                      className="ml-1 flex-shrink-0 inline-flex items-center justify-center h-3.5 w-3.5 rounded-full text-green-500 hover:bg-green-200 hover:text-green-600 dark:text-green-300 dark:hover:bg-green-600 dark:hover:text-green-100 focus:outline-none"
                      onClick={() => {
                        setLocationIds((prev) =>
                          prev.filter((id) => id !== option.value),
                        );
                      }}
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
            )}
          </div>
        </div>
      </div>

      {/* Section 5: Additional Information */}
      <div className="pt-6 mt-6 border-t dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Additional Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <InputField
            label="Notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            placeholder="Research notes or additional details"
            as="textarea"
            rows={4}
          />

          <InputField
            label="Tags"
            name="tags"
            value={formData.tags}
            onChange={handleChange}
            placeholder="tag1, tag2, tag3"
            helpText="Separate tags with commas"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-8 flex justify-end space-x-3 border-t dark:border-gray-700 mt-8">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSubmit}>
          {initialData ? "Update Character" : "Create Character"}
        </Button>
      </div>
    </div>
  );
};

export default CharacterForm;
