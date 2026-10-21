import React, { useState, useEffect, useRef } from "react";
import InputField from "../components/common/InputField";
import Button from "../components/common/Button";
// Import 'Option' from SelectDropdown and make SelectDropdown a default import
import SelectDropdown, {
  SelectOption as Option,
} from "../components/common/SelectDropdown";
import { useProjectData } from "../contexts/ProjectDataContext";
import useKnowledgeBaseOptions from "../hooks/useKnowledgeBaseOptions";
// Removed 'Option' from this import
import { CultureType, ID } from "../types/project";

interface CultureFormProps {
  initialData?: Partial<CultureType>;
  onSubmit: (data: any, imageFile?: File | null) => void;
  onCancel: () => void;
}

const CultureForm: React.FC<CultureFormProps> = ({
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
    foundedDate: "",
    endDate: "",
    values: "",
    practices: "",
    languages: "",
    beliefs: "",
    notes: "",
    tags: "",
    imageUrl: "",
  });

  // Image upload state
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imageFileName, setImageFileName] = useState<string | null>(null);
  const [imageSource, setImageSource] = useState<"url" | "file">("url");
  const imageFileInputRef = useRef<HTMLInputElement>(null);

  // Related entities state
  const [linkedLocationIds, setLinkedLocationIds] = useState<ID[]>([]);
  const [linkedCharacterIds, setLinkedCharacterIds] = useState<ID[]>([]);
  const [linkedEventIds, setLinkedEventIds] = useState<ID[]>([]);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || "",
        description: initialData.description || "",
        foundedDate: initialData.foundedDate || "",
        endDate: initialData.endDate || "",
        values: Array.isArray(initialData.values)
          ? initialData.values.join(", ")
          : initialData.values || "",
        practices: Array.isArray(initialData.practices)
          ? initialData.practices.join(", ")
          : initialData.practices || "",
        languages: Array.isArray(initialData.languages)
          ? initialData.languages.join(", ")
          : initialData.languages || "",
        beliefs: Array.isArray(initialData.beliefs)
          ? initialData.beliefs.join(", ")
          : initialData.beliefs || "",
        notes: initialData.notes || "",
        tags: Array.isArray(initialData.tags)
          ? initialData.tags.join(", ")
          : initialData.tags || "",
        imageUrl: initialData.imageUrl || "",
      });

      // Set image source based on existing data
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

      // Set related entities
      setLinkedLocationIds(initialData.linkedLocationIds || []);
      setLinkedCharacterIds(initialData.linkedCharacterIds || []);
      setLinkedEventIds(initialData.linkedEventIds || []);
    }
  }, [initialData]);

  // Handle image file change
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImageFile(file);
      setImageFileName(file.name);
      // Clear URL when file is selected
      setFormData((prev) => ({
        ...prev,
        imageUrl: "",
      }));
    }
  };

  const handleImageFileUploadClick = () => {
    imageFileInputRef.current?.click();
  };

  // Handle image source toggle
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

  // Helper function to validate URLs
  const isValidUrl = (urlString: string): boolean => {
    try {
      const url = new URL(urlString);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) {
      return false;
    }
  };

  // Validate the form
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "Name is required";

    // Validate image URL if provided and URL source is selected
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

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    // Transform data to match expected format
    const processedData = {
      ...formData,
      values: formData.values
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
      practices: formData.practices
        .split(",")
        .map((practice) => practice.trim())
        .filter((practice) => practice.length > 0),
      languages: formData.languages
        .split(",")
        .map((language) => language.trim())
        .filter((language) => language.length > 0),
      beliefs: formData.beliefs
        .split(",")
        .map((belief) => belief.trim())
        .filter((belief) => belief.length > 0),
      tags: formData.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
      // Include relationship IDs
      timelineIds: initialData?.timelineIds || [],
      linkedLocationIds,
      linkedCharacterIds,
      linkedEventIds,
      // Clear imageUrl if file is being uploaded
      imageUrl: imageSource === "file" ? "" : formData.imageUrl,
    };

    onSubmit(processedData, selectedImageFile);
  };

  // Get dropdown options
  const locationOptions = kbOptions.getLocationOptions();
  const characterOptions = kbOptions.getCharacterOptions();
  const eventOptions = kbOptions.getEventOptions();

  // Helper function to get selected option objects for display
  const getSelectedOptions = (
    selectedIds: ID[],
    allOptions: Option[],
  ): Option[] => {
    if (!selectedIds || selectedIds.length === 0) return [];
    return allOptions.filter((option) => selectedIds.includes(option.value));
  };

  // Get selected options for display
  const selectedLocationOptions = getSelectedOptions(
    linkedLocationIds,
    locationOptions,
  );
  const selectedCharacterOptions = getSelectedOptions(
    linkedCharacterIds,
    characterOptions,
  );
  const selectedEventOptions = getSelectedOptions(linkedEventIds, eventOptions);

  // Get image preview URL
  const getImagePreviewUrl = () => {
    if (imageSource === "file" && selectedImageFile) {
      return URL.createObjectURL(selectedImageFile);
    } else if (imageSource === "url" && formData.imageUrl) {
      return formData.imageUrl;
    }
    return null;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Section 1: Basic Information */}
      <div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6 items-start">
          <div className="md:col-span-2 space-y-6">
            <InputField
              label="Name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter culture name"
              required
              error={errors.name}
            />

            <InputField
              label="Description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe the culture"
              as="textarea"
              rows={4}
            />
          </div>

          <div className="md:col-span-1 space-y-6">
            {/* Image Source Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Culture Image
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
                  placeholder="https://example.com/culture-image.jpg"
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

            {/* Image Preview */}
            {getImagePreviewUrl() && (
              <div className="mt-2 border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden">
                <img
                  src={getImagePreviewUrl()!}
                  alt={formData.name || "Culture image"}
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
            label="Founded Date"
            name="foundedDate"
            value={formData.foundedDate}
            onChange={handleChange}
            placeholder="YYYY-MM-DD"
            type="date"
          />

          <InputField
            label="End Date"
            name="endDate"
            value={formData.endDate}
            onChange={handleChange}
            placeholder="YYYY-MM-DD"
            type="date"
            helpText="Leave empty if culture still exists"
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

      {/* Section 3: Cultural Characteristics */}
      <div className="pt-6 mt-6 border-t dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Cultural Characteristics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <InputField
            label="Values"
            name="values"
            value={formData.values}
            onChange={handleChange}
            placeholder="honor, family, tradition (comma-separated)"
            helpText="Separate core values with commas"
          />

          <InputField
            label="Practices"
            name="practices"
            value={formData.practices}
            onChange={handleChange}
            placeholder="rituals, customs, traditions (comma-separated)"
            helpText="Separate cultural practices with commas"
          />

          <InputField
            label="Languages"
            name="languages"
            value={formData.languages}
            onChange={handleChange}
            placeholder="English, Spanish, French (comma-separated)"
            helpText="Separate languages with commas"
          />

          <InputField
            label="Beliefs"
            name="beliefs"
            value={formData.beliefs}
            onChange={handleChange}
            placeholder="Religious or philosophical beliefs (comma-separated)"
            helpText="Separate beliefs with commas"
          />
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
              label="Locations"
              options={locationOptions}
              value={linkedLocationIds}
              onChange={(value) => setLinkedLocationIds(value as string[])}
              multiple
              searchable
              helpText="Locations associated with this culture"
            />
            {linkedLocationIds.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selectedLocationOptions.map((option) => (
                  <span
                    key={option.value}
                    className="inline-flex items-center py-0.5 px-2 text-xs font-medium rounded-full text-sky-700 bg-sky-100 dark:text-sky-100 dark:bg-sky-600"
                  >
                    {option.label}
                    <button
                      type="button"
                      className="ml-1 flex-shrink-0 inline-flex items-center justify-center h-3.5 w-3.5 rounded-full text-sky-500 hover:bg-sky-200 hover:text-sky-600 dark:text-sky-300 dark:hover:bg-sky-500 dark:hover:text-sky-100 focus:outline-none"
                      onClick={() => {
                        setLinkedLocationIds((prev) =>
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
              label="Characters"
              options={characterOptions}
              value={linkedCharacterIds}
              onChange={(value) => setLinkedCharacterIds(value as string[])}
              multiple
              searchable
              helpText="Characters belonging to this culture"
            />
            {linkedCharacterIds.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selectedCharacterOptions.map((option) => (
                  <span
                    key={option.value}
                    className="inline-flex items-center py-0.5 px-2 text-xs font-medium rounded-full text-sky-700 bg-sky-100 dark:text-sky-100 dark:bg-sky-600"
                  >
                    {option.label}
                    <button
                      type="button"
                      className="ml-1 flex-shrink-0 inline-flex items-center justify-center h-3.5 w-3.5 rounded-full text-sky-500 hover:bg-sky-200 hover:text-sky-600 dark:text-sky-300 dark:hover:bg-sky-500 dark:hover:text-sky-100 focus:outline-none"
                      onClick={() => {
                        setLinkedCharacterIds((prev) =>
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
              label="Events"
              options={eventOptions}
              value={linkedEventIds}
              onChange={(value) => setLinkedEventIds(value as string[])}
              multiple
              searchable
              helpText="Historical events related to this culture"
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
            placeholder="Research notes or additional information"
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
        <Button variant="primary" type="submit">
          {initialData ? "Update Culture" : "Create Culture"}
        </Button>
      </div>
    </form>
  );
};

export default CultureForm;
