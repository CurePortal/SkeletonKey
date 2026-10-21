export const getRandomColor = (parentColor?: string): string => {
  const colors = [
    "#EF4444",
    "#10B981",
    "#F59E0B",
    "#8B5CF6",
    "#EC4899",
    "#14B8A6",
    "#F97316",
    "#6366F1",
    "#D946EF",
    "#06B6D4",
    "#F472B6",
    "#3B82F6",
  ];
  let availableColors = colors;
  if (parentColor) {
    const filteredColors = colors.filter(
      (c) => c.toLowerCase() !== parentColor.toLowerCase(),
    );
    if (filteredColors.length > 0) {
      availableColors = filteredColors;
    }
  }
  const randomIndex = Math.floor(Math.random() * availableColors.length);
  return availableColors[randomIndex] || "#3B82F6";
};

/**
 * Parse a date value without shifting the calendar day.
 *
 * `new Date("2026-10-20")` is specified to parse as UTC midnight. Rendering
 * that with `toLocaleDateString()` west of UTC rolls it back to the previous
 * day, so an event dated the 20th displays as the 19th. Date-only strings are
 * therefore built from their parts, which yields local midnight and keeps the
 * rendered calendar day identical to the stored one. Anything with a time
 * component (a full ISO timestamp) is left to the native parser, since it
 * carries its own offset.
 */
export const parseCalendarDate = (value: string): Date => {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  return new Date(value);
};

/**
 * Serialize a Date back to a local `YYYY-MM-DD` calendar day.
 *
 * `toISOString()` converts to UTC first, so a local midnight west of UTC is
 * written as the previous day. Event dates are calendar days, not instants, so
 * they are written from the local parts instead.
 */
export const toCalendarDateString = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

export const formatDate = (
  isoDateString: string | null | undefined,
): string => {
  if (!isoDateString) {
    return "N/A";
  }
  try {
    const date = parseCalendarDate(isoDateString);
    if (isNaN(date.getTime())) {
      return "Invalid Date";
    }
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Invalid Date";
  }
};
