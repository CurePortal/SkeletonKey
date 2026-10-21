import React, { useState, useEffect } from "react";
import { useProjectData } from "../../contexts/ProjectDataContext";
import { EventType, ID, EventIconId, Option } from "../../types"; // Make sure EventType in ../../types has linkedNarrativeIds
import InputField from "../../components/common/InputField";
import Button from "../../components/common/Button";
import IconSelector from "../../components/timeline/IconSelector";
import SelectDropdown from "../../components/common/SelectDropdown"; // Assuming Option type is exported
import useKnowledgeBaseOptions from "../../hooks/useKnowledgeBaseOptions";
import { parseCalendarDate } from "../../utils/helpers";

// Helper Types and Functions for Date Handling
interface HistoricalDateParts {
  year: string;
  month: string;
  day: string;
  era: "AD" | "BC";
}

const MONTH_OPTIONS: Option[] = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const ERA_OPTIONS: Option[] = [
  { value: "AD", label: "AD/CE" },
  { value: "BC", label: "BC/BCE" },
];

function parseHistoricalDateString(
  dateString: string | null | undefined,
): HistoricalDateParts | null {
  if (!dateString) return null;

  const bcMatch = dateString.match(/^-(\d{1,6})-(\d{1,2})-(\d{1,2})/);
  if (bcMatch) {
    const yearNum = parseInt(bcMatch[1], 10);
    if (yearNum > 0) {
      return {
        year: yearNum.toString(),
        month: parseInt(bcMatch[2], 10).toString(),
        day: parseInt(bcMatch[3], 10).toString(),
        era: "BC",
      };
    }
  }

  try {
    const d = parseCalendarDate(dateString);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      if (year > 0) {
        return {
          year: year.toString(),
          month: (d.getMonth() + 1).toString(),
          day: d.getDate().toString(),
          era: "AD",
        };
      } else if (year === 0 && dateString.startsWith("0000")) {
        // Handles "0000-MM-DD" as 1 BC
        return {
          year: "1",
          month: (d.getMonth() + 1).toString(),
          day: d.getDate().toString(),
          era: "BC",
        };
      }
    }
  } catch (e) {
    // Fall through
  }

  const adMatch = dateString.match(/^(\d{1,6})-(\d{1,2})-(\d{1,2})/);
  if (adMatch) {
    return {
      year: parseInt(adMatch[1], 10).toString(),
      month: parseInt(adMatch[2], 10).toString(),
      day: parseInt(adMatch[3], 10).toString(),
      era: "AD",
    };
  }

  console.warn(`Could not parse date string: ${dateString}`);
  return null;
}

function formatHistoricalDateToString(
  parts: HistoricalDateParts | null,
): string | null {
  if (
    !parts ||
    !parts.year.trim() ||
    !parts.month.trim() ||
    !parts.day.trim()
  ) {
    return null;
  }

  const numYear = parseInt(parts.year, 10);
  const numMonth = parseInt(parts.month, 10);
  const numDay = parseInt(parts.day, 10);

  if (
    isNaN(numYear) ||
    isNaN(numMonth) ||
    isNaN(numDay) ||
    numMonth < 1 ||
    numMonth > 12 ||
    numDay < 1 ||
    numDay > 31
  ) {
    return ""; // Invalid parts, return empty string to signify error for handleSubmit
  }

  const yearString = Math.abs(numYear).toString().padStart(4, "0");
  const monthString = numMonth.toString().padStart(2, "0");
  const dayString = numDay.toString().padStart(2, "0");

  if (parts.era === "BC") {
    if (numYear <= 0) return ""; // BC Year 0 is invalid
    return `-${yearString}-${monthString}-${dayString}`;
  } else {
    return `${yearString}-${monthString}-${dayString}`;
  }
}

interface EventFormProps {
  event?: EventType;
  timelineId: ID;
  onSubmit: (event: Omit<EventType, "id"> | EventType) => void;
  onCancel: () => void;
  initialValues?: Partial<EventType>;
}

// Helper function to get labels for selected IDs
const getSelectedOptions = (
  selectedIds: ID[],
  allOptions: Option[],
): Option[] => {
  if (!selectedIds || selectedIds.length === 0) return [];
  return allOptions.filter((option) => selectedIds.includes(option.value));
};

const EventForm: React.FC<EventFormProps> = ({
  event,
  timelineId,
  onSubmit,
  onCancel,
  initialValues,
}) => {
  const { project } = useProjectData();
  const isEditing = !!event;
  const kbOptions = useKnowledgeBaseOptions(project);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [importance, setImportance] = useState(5);
  const [isPointOfDivergence, setIsPointOfDivergence] = useState(false);
  const [iconId, setIconId] = useState<EventIconId>("default");
  const [tags, setTags] = useState("");
  const [causes, setCauses] = useState<ID[]>([]);
  const [effects, setEffects] = useState<ID[]>([]);
  const [linkedCharacters, setLinkedCharacters] = useState<ID[]>([]);
  const [linkedLocations, setLinkedLocations] = useState<ID[]>([]);
  const [linkedTechnologies, setLinkedTechnologies] = useState<ID[]>([]);
  const [linkedCultures, setLinkedCultures] = useState<ID[]>([]);
  const [linkedSourceDocuments, setLinkedSourceDocuments] = useState<ID[]>([]);
  const [linkedNarratives, setLinkedNarratives] = useState<ID[]>([]);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Define empty date parts
  const emptyDateParts: HistoricalDateParts = {
    year: "",
    month: "",
    day: "",
    era: "AD", // Default era to AD
  };

  // Initialize state with empty date parts
  const [startDateParts, setStartDateParts] =
    useState<HistoricalDateParts>(emptyDateParts);
  const [endDateParts, setEndDateParts] = useState<HistoricalDateParts | null>(
    null,
  );
  const [showEndDate, setShowEndDate] = useState(false);

  useEffect(() => {
    const source = event || initialValues;
    if (source) {
      setTitle(source.title || "");
      setDescription(source.description || "");

      // Only populate dates if editing an existing event with a date
      if (isEditing && source.date) {
        const parsedStartDate = parseHistoricalDateString(source.date);
        setStartDateParts(parsedStartDate || { ...emptyDateParts });

        if (source.endDate) {
          const parsedEndDate = parseHistoricalDateString(source.endDate);
          setEndDateParts(parsedEndDate);
          setShowEndDate(!!parsedEndDate);
        } else {
          setEndDateParts(null);
          setShowEndDate(false);
        }
      } else {
        // For new events or editing an event without a date, ensure dates are empty
        setStartDateParts({ ...emptyDateParts });
        setEndDateParts(null);
        setShowEndDate(false);
      }

      setImportance(source.importance || 5);
      setIsPointOfDivergence(source.isPointOfDivergence || false);
      setIconId(source.iconId || "default");
      setTags(source.tags?.join(", ") || "");
      setCauses(source.causes || []);
      setEffects(source.effects || []);
      setLinkedCharacters(source.linkedCharacterIds || []);
      setLinkedLocations(source.linkedLocationIds || []);
      setLinkedTechnologies(source.linkedTechnologyIds || []);
      setLinkedCultures(source.linkedCultureIds || []);
      setLinkedSourceDocuments(source.linkedSourceDocumentIds || []);
      setLinkedNarratives(source.linkedNarrativeIds || []);
      setNotes(source.notes || "");
    } else {
      // For new events without initialValues, initialize all with empty/default values
      setTitle("");
      setDescription("");
      setStartDateParts({ ...emptyDateParts });
      setEndDateParts(null);
      setShowEndDate(false);
      setImportance(5);
      setIsPointOfDivergence(false);
      setIconId("default");
      setTags("");
      setCauses([]);
      setEffects([]);
      setLinkedCharacters([]);
      setLinkedLocations([]);
      setLinkedTechnologies([]);
      setLinkedCultures([]);
      setLinkedSourceDocuments([]);
      setLinkedNarratives([]);
      setNotes("");
    }
    setErrors({});
  }, [event, initialValues, isEditing]); // Added isEditing to dependency array

  const handleDatePartChange = (
    type: "start" | "end",
    part: keyof HistoricalDateParts,
    value: string,
  ) => {
    const targetParts = type === "start" ? startDateParts : endDateParts;
    const newParts = {
      ...(targetParts || { year: "", month: "", day: "", era: "AD" }), // Ensure default structure even if targetParts is null
      [part]: value,
    };
    if (type === "start") {
      setStartDateParts(newParts);
    } else {
      setEndDateParts(newParts);
    }
  };

  const getComparableValue = (parts: HistoricalDateParts | null): number => {
    if (!parts || !parts.year || !parts.month || !parts.day) return 0;
    let year = parseInt(parts.year, 10);
    const month = parseInt(parts.month, 10);
    const day = parseInt(parts.day, 10);

    if (isNaN(year) || isNaN(month) || isNaN(day)) return 0;

    if (parts.era === "BC") {
      if (year === 0) return 0;
      year = -Math.abs(year);
    }
    return year * 10000 + month * 100 + day;
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = "Title is required";

    // Validate Start Date
    if (
      !startDateParts.year.trim() ||
      !startDateParts.month.trim() ||
      !startDateParts.day.trim()
    ) {
      newErrors.startDate = "Full start date (Year, Month, Day) is required.";
    } else {
      const yr = parseInt(startDateParts.year, 10);
      const mth = parseInt(startDateParts.month, 10);
      const dy = parseInt(startDateParts.day, 10);
      if (isNaN(yr) || (yr === 0 && startDateParts.era === "BC"))
        newErrors.startDateYear = "Valid year required for BC (cannot be 0).";
      if (isNaN(yr) && startDateParts.era === "AD")
        newErrors.startDateYear = "Valid AD year required.";
      if (isNaN(mth) || mth < 1 || mth > 12)
        newErrors.startDateMonth = "Valid month (1-12) required.";
      if (isNaN(dy) || dy < 1 || dy > 31)
        newErrors.startDateDay = "Valid day (1-31) required.";
    }

    // Validate End Date if shown
    if (showEndDate) {
      if (
        !endDateParts ||
        !endDateParts.year.trim() ||
        !endDateParts.month.trim() ||
        !endDateParts.day.trim()
      ) {
        newErrors.endDate =
          "Full end date (Year, Month, Day) is required if shown.";
      } else {
        const yr = parseInt(endDateParts.year, 10);
        const mth = parseInt(endDateParts.month, 10);
        const dy = parseInt(endDateParts.day, 10);
        if (isNaN(yr) || (yr === 0 && endDateParts.era === "BC"))
          newErrors.endDateYear = "Valid year required for BC (cannot be 0).";
        if (isNaN(yr) && endDateParts.era === "AD")
          newErrors.endDateYear = "Valid AD year required.";
        if (isNaN(mth) || mth < 1 || mth > 12)
          newErrors.endDateMonth = "Valid month (1-12) required.";
        if (isNaN(dy) || dy < 1 || dy > 31)
          newErrors.endDateDay = "Valid day (1-31) required.";

        // Compare start and end dates if both are valid
        if (
          !newErrors.startDate &&
          !newErrors.startDateYear &&
          !newErrors.startDateMonth &&
          !newErrors.startDateDay &&
          !newErrors.endDateYear &&
          !newErrors.endDateMonth &&
          !newErrors.endDateDay
        ) {
          const startComparable = getComparableValue(startDateParts);
          const endComparable = getComparableValue(endDateParts);
          if (
            startComparable !== 0 && // Only compare if start date is valid
            endComparable !== 0 && // Only compare if end date is valid
            endComparable < startComparable
          ) {
            newErrors.endDate = "End date must be after or same as start date.";
          }
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleIconChange = (newIconId: string) => {
    setIconId(newIconId as EventIconId);
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    const processedTags = tags
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    const finalStartDateString = formatHistoricalDateToString(startDateParts);
    // The validateForm already checks for null/empty start date parts,
    // but this check ensures we don't proceed with a null date string.
    if (!finalStartDateString) {
      setErrors((prev) => ({
        ...prev,
        startDate: "Invalid start date components.",
      }));
      return;
    }

    let finalEndDateString: string | null = null;
    if (showEndDate && endDateParts) {
      finalEndDateString = formatHistoricalDateToString(endDateParts);
      // The validateForm already checks for invalid end date parts when showEndDate is true,
      // but this check ensures we don't proceed with an invalid date string.
      if (finalEndDateString === "") {
        setErrors((prev) => ({
          ...prev,
          endDate: "Invalid end date components.",
        }));
        return;
      }
    } else if (showEndDate && !endDateParts) {
      // This case is already covered by validateForm, but kept for clarity
      setErrors((prev) => ({
        ...prev,
        endDate: "End date is enabled but not set.",
      }));
      return;
    }

    const eventDataPayload: Omit<EventType, "id"> | EventType = {
      ...(event ? { id: event.id } : {}),
      title,
      description,
      date: finalStartDateString,
      endDate: finalEndDateString,
      timelineId,
      importance,
      isPointOfDivergence,
      iconId,
      causes,
      effects,
      linkedCharacterIds: linkedCharacters,
      linkedLocationIds: linkedLocations,
      linkedTechnologyIds: linkedTechnologies,
      linkedCultureIds: linkedCultures,
      linkedSourceDocumentIds: linkedSourceDocuments,
      linkedNarrativeIds: linkedNarratives,
      notes,
      tags: processedTags,
    };
    onSubmit(eventDataPayload);
  };

  const causeOptions = kbOptions.getEventOptions(
    isEditing && event ? event.id : undefined,
  );
  const selectedCauseObjects = getSelectedOptions(causes, causeOptions);

  const effectOptions = kbOptions.getEventOptions(
    isEditing && event ? event.id : undefined,
  );
  const selectedEffectObjects = getSelectedOptions(effects, effectOptions);

  const characterOptions = kbOptions.getCharacterOptions();
  const selectedCharacterObjects = getSelectedOptions(
    linkedCharacters,
    characterOptions,
  );

  const locationOptions = kbOptions.getLocationOptions();
  const selectedLocationObjects = getSelectedOptions(
    linkedLocations,
    locationOptions,
  );

  const technologyOptions = kbOptions.getTechnologyOptions();
  const selectedTechnologyObjects = getSelectedOptions(
    linkedTechnologies,
    technologyOptions,
  );

  const cultureOptions = kbOptions.getCultureOptions();
  const selectedCultureObjects = getSelectedOptions(
    linkedCultures,
    cultureOptions,
  );

  const sourceDocumentOptions = kbOptions.getSourceDocumentOptions();
  const selectedSourceDocumentObjects = getSelectedOptions(
    linkedSourceDocuments,
    sourceDocumentOptions,
  );

  const narrativeOptions = kbOptions.getNarrativeOptions();
  const selectedNarrativeObjects = getSelectedOptions(
    linkedNarratives,
    narrativeOptions,
  );

  return (
    <div className="space-y-8">
      {/* Section 1: Core Details & Attributes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6 items-start">
        <div className="md:col-span-2 space-y-6">
          <InputField
            label="Event Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="E.g., The Great Upheaval"
            error={errors.title}
            required
          />
          <InputField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A detailed account of what occurred"
            as="textarea"
            rows={4}
          />
        </div>
        <div className="md:col-span-1 space-y-6">
          <div>
            <IconSelector selectedIconId={iconId} onChange={handleIconChange} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Significance (1-10)
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="range"
                min="1"
                max="10"
                value={importance}
                onChange={(e) => setImportance(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600 thumb:bg-blue-500"
              />
              <span className="ml-3 w-8 text-center text-sm text-gray-700 dark:text-gray-300 tabular-nums">
                {importance}
              </span>
            </div>
          </div>
          <div className="flex items-center pt-2">
            <input
              type="checkbox"
              id="isPointOfDivergence"
              checked={isPointOfDivergence}
              onChange={(e) => setIsPointOfDivergence(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600 dark:focus:ring-offset-gray-800"
            />
            <label
              htmlFor="isPointOfDivergence"
              className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
            >
              Mark as Point of Divergence
            </label>
          </div>
        </div>
      </div>

      {/* Section 2: Date Fields */}
      <div className="pt-6 mt-6 border-t dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Event Dates
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <div className="space-y-4">
            <fieldset className="border border-gray-300 dark:border-gray-600 p-4 rounded-md">
              <legend className="text-sm font-medium text-gray-700 dark:text-gray-300 px-1">
                Start Date
                {errors.startDate && (
                  <span className="text-red-500 text-xs ml-1">
                    ({errors.startDate})
                  </span>
                )}
              </legend>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                <InputField
                  label="Year"
                  type="number"
                  value={startDateParts.year}
                  onChange={(e) =>
                    handleDatePartChange("start", "year", e.target.value)
                  }
                  placeholder="YYYY"
                  error={errors.startDateYear}
                />
                <SelectDropdown
                  label="Month"
                  options={MONTH_OPTIONS}
                  value={startDateParts.month}
                  onChange={(val) =>
                    handleDatePartChange("start", "month", val as string)
                  }
                  error={errors.startDateMonth}
                />
                <InputField
                  label="Day"
                  type="number"
                  min="1"
                  max="31"
                  value={startDateParts.day}
                  onChange={(e) =>
                    handleDatePartChange("start", "day", e.target.value)
                  }
                  placeholder="DD"
                  error={errors.startDateDay}
                />
                <SelectDropdown
                  label="Era"
                  options={ERA_OPTIONS}
                  value={startDateParts.era}
                  onChange={(val) =>
                    handleDatePartChange("start", "era", val as "AD" | "BC")
                  }
                />
              </div>
            </fieldset>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="showEndDate"
                checked={showEndDate}
                onChange={(e) => {
                  setShowEndDate(e.target.checked);
                  if (!e.target.checked) {
                    setEndDateParts(null);
                    setErrors((prev) => {
                      const n = { ...prev };
                      delete n.endDate;
                      delete n.endDateYear;
                      delete n.endDateMonth;
                      delete n.endDateDay;
                      return n;
                    });
                  } else if (!endDateParts) {
                    // Initialize with empty parts when checkbox is checked
                    setEndDateParts({
                      year: "",
                      month: "",
                      day: "",
                      era: "AD",
                    });
                  }
                }}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label
                htmlFor="showEndDate"
                className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
              >
                Event has an End Date / Duration
              </label>
            </div>
          </div>
          <div className="space-y-4">
            {showEndDate && (
              <fieldset className="border border-gray-300 dark:border-gray-600 p-4 rounded-md">
                <legend className="text-sm font-medium text-gray-700 dark:text-gray-300 px-1">
                  End Date
                  {errors.endDate && (
                    <span className="text-red-500 text-xs ml-1">
                      ({errors.endDate})
                    </span>
                  )}
                </legend>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                  <InputField
                    label="Year"
                    type="number"
                    value={endDateParts?.year || ""}
                    onChange={(e) =>
                      handleDatePartChange("end", "year", e.target.value)
                    }
                    placeholder="YYYY"
                    error={errors.endDateYear}
                  />
                  <SelectDropdown
                    label="Month"
                    options={MONTH_OPTIONS}
                    value={endDateParts?.month || ""}
                    onChange={(val) =>
                      handleDatePartChange("end", "month", val as string)
                    }
                    error={errors.endDateMonth}
                  />
                  <InputField
                    label="Day"
                    type="number"
                    min="1"
                    max="31"
                    value={endDateParts?.day || ""}
                    onChange={(e) =>
                      handleDatePartChange("end", "day", e.target.value)
                    }
                    placeholder="DD"
                    error={errors.endDateDay}
                  />
                  <SelectDropdown
                    label="Era"
                    options={ERA_OPTIONS}
                    value={endDateParts?.era || "AD"}
                    onChange={(val) =>
                      handleDatePartChange("end", "era", val as "AD" | "BC")
                    }
                  />
                </div>
              </fieldset>
            )}
          </div>
        </div>
      </div>

      {/* Section 3: Relations */}
      <div className="pt-6 mt-6 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Relations
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <div>
            <SelectDropdown
              label="Causes (Events that caused this event)"
              options={causeOptions}
              value={causes}
              onChange={(value) => setCauses(value as string[])}
              multiple
              searchable
            />
            {causes.length > 0 && ( // Corrected condition to check if there are any selected causes
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selectedCauseObjects.map((option) => (
                  <span
                    key={option.value}
                    className="inline-flex items-center py-0.5 px-2 text-xs font-medium rounded-full text-sky-700 bg-sky-100 dark:text-sky-100 dark:bg-sky-600"
                  >
                    {option.label}
                    <button
                      type="button"
                      className="ml-1 flex-shrink-0 inline-flex items-center justify-center h-3.5 w-3.5 rounded-full text-sky-500 hover:bg-sky-200 hover:text-sky-600 dark:text-sky-300 dark:hover:bg-sky-500 dark:hover:text-sky-100 focus:outline-none"
                      onClick={() => {
                        setCauses((prev) =>
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
              label="Effects (Events affected by this event)"
              options={effectOptions}
              value={effects}
              onChange={(value) => setEffects(value as string[])}
              multiple
              searchable
            />
            {effects.length > 0 && ( // Corrected condition to check if there are any selected effects
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selectedEffectObjects.map((option) => (
                  <span
                    key={option.value}
                    className="inline-flex items-center py-0.5 px-2 text-xs font-medium rounded-full text-sky-700 bg-sky-100 dark:text-sky-100 dark:bg-sky-600"
                  >
                    {option.label}
                    <button
                      type="button"
                      className="ml-1 flex-shrink-0 inline-flex items-center justify-center h-3.5 w-3.5 rounded-full text-sky-500 hover:bg-sky-200 hover:text-sky-600 dark:text-sky-300 dark:hover:bg-sky-500 dark:hover:text-sky-100 focus:outline-none"
                      onClick={() => {
                        setEffects((prev) =>
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
              label="Characters involved"
              options={characterOptions}
              value={linkedCharacters}
              onChange={(value) => setLinkedCharacters(value as string[])}
              multiple
              searchable
            />
            {linkedCharacters.length > 0 && ( // Corrected condition
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selectedCharacterObjects.map((option) => (
                  <span
                    key={option.value}
                    className="inline-flex items-center py-0.5 px-2 text-xs font-medium rounded-full text-sky-700 bg-sky-100 dark:text-sky-100 dark:bg-sky-600"
                  >
                    {option.label}
                    <button
                      type="button"
                      className="ml-1 flex-shrink-0 inline-flex items-center justify-center h-3.5 w-3.5 rounded-full text-sky-500 hover:bg-sky-200 hover:text-sky-600 dark:text-sky-300 dark:hover:bg-sky-500 dark:hover:text-sky-100 focus:outline-none"
                      onClick={() => {
                        setLinkedCharacters((prev) =>
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
              label="Locations"
              options={locationOptions}
              value={linkedLocations}
              onChange={(value) => setLinkedLocations(value as string[])}
              multiple
              searchable
            />
            {linkedLocations.length > 0 && ( // Corrected condition
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selectedLocationObjects.map((option) => (
                  <span
                    key={option.value}
                    className="inline-flex items-center py-0.5 px-2 text-xs font-medium rounded-full text-sky-700 bg-sky-100 dark:text-sky-100 dark:bg-sky-600"
                  >
                    {option.label}
                    <button
                      type="button"
                      className="ml-1 flex-shrink-0 inline-flex items-center justify-center h-3.5 w-3.5 rounded-full text-sky-500 hover:bg-sky-200 hover:text-sky-600 dark:text-sky-300 dark:hover:bg-sky-500 dark:hover:text-sky-100 focus:outline-none"
                      onClick={() => {
                        setLinkedLocations((prev) =>
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
              label="Technologies"
              options={technologyOptions}
              value={linkedTechnologies}
              onChange={(value) => setLinkedTechnologies(value as string[])}
              multiple
              searchable
            />
            {linkedTechnologies.length > 0 && ( // Corrected condition
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selectedTechnologyObjects.map((option) => (
                  <span
                    key={option.value}
                    className="inline-flex items-center py-0.5 px-2 text-xs font-medium rounded-full text-sky-700 bg-sky-100 dark:text-sky-100 dark:bg-sky-600"
                  >
                    {option.label}
                    <button
                      type="button"
                      className="ml-1 flex-shrink-0 inline-flex items-center justify-center h-3.5 w-3.5 rounded-full text-sky-500 hover:bg-sky-200 hover:text-sky-600 dark:text-sky-300 dark:hover:bg-sky-500 dark:hover:text-sky-100 focus:outline-none"
                      onClick={() => {
                        setLinkedTechnologies((prev) =>
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
              label="Cultures"
              options={cultureOptions}
              value={linkedCultures}
              onChange={(value) => setLinkedCultures(value as string[])}
              multiple
              searchable
            />
            {linkedCultures.length > 0 && ( // Corrected condition
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selectedCultureObjects.map((option) => (
                  <span
                    key={option.value}
                    className="inline-flex items-center py-0.5 px-2 text-xs font-medium rounded-full text-sky-700 bg-sky-100 dark:text-sky-100 dark:bg-sky-600"
                  >
                    {option.label}
                    <button
                      type="button"
                      className="ml-1 flex-shrink-0 inline-flex items-center justify-center h-3.5 w-3.5 rounded-full text-sky-500 hover:bg-sky-200 hover:text-sky-600 dark:text-sky-300 dark:hover:bg-sky-500 dark:hover:text-sky-100 focus:outline-none"
                      onClick={() => {
                        setLinkedCultures((prev) =>
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
              label="Source Documents"
              options={sourceDocumentOptions}
              value={linkedSourceDocuments}
              onChange={(value) => setLinkedSourceDocuments(value as string[])}
              multiple
              searchable
            />
            {linkedSourceDocuments.length > 0 && ( // Corrected condition
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selectedSourceDocumentObjects.map((option) => (
                  <span
                    key={option.value}
                    className="inline-flex items-center py-0.5 px-2 text-xs font-medium rounded-full text-sky-700 bg-sky-100 dark:text-sky-100 dark:bg-sky-600"
                  >
                    {option.label}
                    <button
                      type="button"
                      className="ml-1 flex-shrink-0 inline-flex items-center justify-center h-3.5 w-3.5 rounded-full text-sky-500 hover:bg-sky-200 hover:text-sky-600 dark:text-sky-300 dark:hover:bg-sky-500 dark:hover:text-sky-100 focus:outline-none"
                      onClick={() => {
                        setLinkedSourceDocuments((prev) =>
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
              label="Narratives"
              options={narrativeOptions}
              value={linkedNarratives}
              onChange={(value) => setLinkedNarratives(value as string[])}
              multiple
              searchable
              helpText="Link this event to narrative entries"
            />
            {linkedNarratives.length > 0 && ( // Corrected condition
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selectedNarrativeObjects.map((option) => (
                  <span
                    key={option.value}
                    className="inline-flex items-center py-0.5 px-2 text-xs font-medium rounded-full text-sky-700 bg-sky-100 dark:text-sky-100 dark:bg-sky-600"
                  >
                    {option.label}
                    <button
                      type="button"
                      className="ml-1 flex-shrink-0 inline-flex items-center justify-center h-3.5 w-3.5 rounded-full text-sky-500 hover:bg-sky-200 hover:text-sky-600 dark:text-sky-300 dark:hover:bg-sky-500 dark:hover:text-sky-100 focus:outline-none"
                      onClick={() => {
                        setLinkedNarratives((prev) =>
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

      {/* Section 4: Additional Information */}
      <div className="pt-6 mt-6 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Additional Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <InputField
            label="Research Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional research or notes about this event"
            as="textarea"
            rows={5}
          />
          <InputField
            label="Tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="E.g., political, technological, personal"
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
          {isEditing ? "Update Event" : "Create Event"}
        </Button>
      </div>
    </div>
  );
};

export default EventForm;
