import { TimelineType, EventType } from "../types";
import { parseCalendarDate } from "./helpers";

/**
 * Get a random color for a new timeline
 * If a parent color is provided, will avoid matching it
 */
export function getRandomColor(parentColor?: string): string {
  const colors = [
    "#EF4444", // red
    "#10B981", // green
    "#F59E0B", // amber
    "#8B5CF6", // purple
    "#EC4899", // pink
    "#14B8A6", // teal
    "#F97316", // orange
    "#6366F1", // indigo
    "#D946EF", // fuchsia
    "#06B6D4", // cyan
    "#F472B6", // pink
  ];

  const availableColors = parentColor
    ? colors.filter((c) => c.toLowerCase() !== parentColor.toLowerCase())
    : colors;

  if (availableColors.length === 0)
    return colors[Math.floor(Math.random() * colors.length)] || "#3B82F6"; // Fallback if all colors match parent (unlikely)

  return availableColors[Math.floor(Math.random() * availableColors.length)];
}

/**
 * Calculate date range across all timelines
 */
export function calculateDateRange(timelines: TimelineType[]) {
  let minDateEpoch = Infinity;
  let maxDateEpoch = -Infinity;

  timelines.forEach((timeline) => {
    timeline.events.forEach((event) => {
      const eventEpoch = parseCalendarDate(event.date).getTime();
      minDateEpoch = Math.min(minDateEpoch, eventEpoch);
      maxDateEpoch = Math.max(maxDateEpoch, eventEpoch);
    });
  });

  // Handle no events case
  if (minDateEpoch === Infinity) {
    minDateEpoch = new Date().getTime();
    maxDateEpoch = new Date().getTime() + 1; // Avoid division by zero
  }

  return {
    minDateEpoch,
    maxDateEpoch,
    totalDuration:
      maxDateEpoch === minDateEpoch ? 1 : maxDateEpoch - minDateEpoch,
  };
}

/**
 * Convert a date to X position for timeline layout
 */
export function dateToXPosition(
  dateStr: string,
  minDateEpoch: number,
  maxDateEpoch: number,
  viewWidth: number,
  initialX: number,
  nodeWidth: number,
  spacing: number,
): number {
  if (maxDateEpoch === minDateEpoch) return initialX + nodeWidth / 2; // Center if single point in time

  const eventEpoch = parseCalendarDate(dateStr).getTime();
  const relativePos =
    (eventEpoch - minDateEpoch) / (maxDateEpoch - minDateEpoch);

  // Ensure X positions are spread out enough
  return initialX + relativePos * (viewWidth - nodeWidth - initialX - spacing);
}

/**
 * Sort events by date
 */
export function sortEventsByDate(events: EventType[]): EventType[] {
  return [...events].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateA - dateB;
  });
}
