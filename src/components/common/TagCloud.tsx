// src/components/common/TagCloud.tsx
import React from "react";

interface TagCloudProps {
  tags: string[];
  onTagClick?: (tag: string) => void;
  maxTags?: number;
  size?: "sm" | "md" | "lg";
  colorScheme?: "default" | "blue" | "green" | "purple" | "amber" | "pink";
  showCount?: boolean;
  editable?: boolean;
  onTagRemove?: (tag: string) => void;
  clickable?: boolean;
}

const TagCloud: React.FC<TagCloudProps> = ({
  tags = [],
  onTagClick,
  maxTags,
  size = "md",
  colorScheme = "default",
  showCount = false,
  editable = false,
  onTagRemove,
  clickable = true,
}) => {
  // Filter out empty tags and duplicates
  const uniqueTags = Array.from(
    new Set(tags.filter((tag) => tag.trim() !== "")),
  );

  // Sort tags alphabetically and apply max limit if specified
  const sortedTags = uniqueTags.sort();
  const displayTags = maxTags ? sortedTags.slice(0, maxTags) : sortedTags;
  const remainingCount =
    maxTags && uniqueTags.length > maxTags ? uniqueTags.length - maxTags : 0;

  // Size styles
  const sizeStyles = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5",
  };

  // Color scheme styles
  const colorSchemes = {
    default:
      "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600",
    blue: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:bg-opacity-30 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800 dark:hover:bg-opacity-50",
    green:
      "bg-green-100 text-green-800 dark:bg-green-900 dark:bg-opacity-30 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800 dark:hover:bg-opacity-50",
    purple:
      "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:bg-opacity-30 dark:text-purple-200 hover:bg-purple-200 dark:hover:bg-purple-800 dark:hover:bg-opacity-50",
    amber:
      "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:bg-opacity-30 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-800 dark:hover:bg-opacity-50",
    pink: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:bg-opacity-30 dark:text-pink-200 hover:bg-pink-200 dark:hover:bg-pink-800 dark:hover:bg-opacity-50",
  };

  const baseClasses = `inline-flex items-center rounded-full font-medium transition-colors ${sizeStyles[size]} ${colorSchemes[colorScheme]}`;

  const handleTagClick = (tag: string) => {
    if (clickable && onTagClick) {
      onTagClick(tag);
    }
  };

  const handleTagRemove = (tag: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (onTagRemove) {
      onTagRemove(tag);
    }
  };

  if (uniqueTags.length === 0) {
    return (
      <div className="text-gray-500 dark:text-gray-400 text-sm italic">
        No tags
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {displayTags.map((tag, index) => (
        <span
          key={index}
          className={`${baseClasses} ${
            clickable && onTagClick ? "cursor-pointer" : ""
          }`}
          onClick={() => handleTagClick(tag)}
          title={tag}
        >
          {tag}
          {showCount && (
            <span className="ml-1 text-xs opacity-75">
              {tags.filter((t) => t === tag).length}
            </span>
          )}
          {editable && onTagRemove && (
            <button
              type="button"
              className="ml-1.5 flex-shrink-0 inline-flex items-center justify-center h-3.5 w-3.5 rounded-full hover:bg-current hover:bg-opacity-20 focus:outline-none"
              onClick={(e) => handleTagRemove(tag, e)}
              aria-label={`Remove ${tag} tag`}
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
          )}
        </span>
      ))}
      {remainingCount > 0 && (
        <span className={`${baseClasses} opacity-75`}>
          +{remainingCount} more
        </span>
      )}
    </div>
  );
};

export default TagCloud;
