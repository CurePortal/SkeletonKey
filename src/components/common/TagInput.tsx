// src/components/common/TagInput.tsx
import React, { useState, useRef, useEffect } from "react";
import TagCloud from "./TagCloud";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  maxTags?: number;
  allowDuplicates?: boolean;
  colorScheme?: "default" | "blue" | "green" | "purple" | "amber" | "pink";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
}

const TagInput: React.FC<TagInputProps> = ({
  tags = [],
  onChange,
  placeholder = "Add tags...",
  suggestions = [],
  maxTags,
  allowDuplicates = false,
  colorScheme = "default",
  size = "md",
  disabled = false,
}) => {
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter suggestions based on input value
  useEffect(() => {
    if (inputValue.trim()) {
      const filtered = suggestions.filter(
        (suggestion) =>
          suggestion.toLowerCase().includes(inputValue.toLowerCase()) &&
          (allowDuplicates || !tags.includes(suggestion)),
      );
      setFilteredSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
      setFilteredSuggestions([]);
    }
  }, [inputValue, suggestions, tags, allowDuplicates]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim();
    if (!trimmedTag) return;

    if (!allowDuplicates && tags.includes(trimmedTag)) return;
    if (maxTags && tags.length >= maxTags) return;

    onChange([...tags, trimmedTag]);
    setInputValue("");
    setShowSuggestions(false);
  };

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    switch (e.key) {
      case "Enter":
        e.preventDefault();
        if (inputValue.trim()) {
          addTag(inputValue);
        }
        break;
      case "Backspace":
        if (!inputValue && tags.length > 0) {
          removeTag(tags[tags.length - 1]);
        }
        break;
      case "Escape":
        setShowSuggestions(false);
        break;
      case "ArrowDown":
        e.preventDefault();
        // Handle suggestion navigation if needed
        break;
      case "Tab":
        if (showSuggestions && filteredSuggestions.length > 0) {
          e.preventDefault();
          addTag(filteredSuggestions[0]);
        }
        break;
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    addTag(suggestion);
    inputRef.current?.focus();
  };

  const inputSizeClasses = {
    sm: "text-sm py-1",
    md: "text-sm py-2",
    lg: "text-base py-2.5",
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="min-h-10 p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
        <div className="flex flex-wrap gap-2 mb-2">
          {tags.length > 0 && (
            <TagCloud
              tags={tags}
              editable
              onTagRemove={removeTag}
              size={size}
              colorScheme={colorScheme}
              clickable={false}
            />
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleInputKeyDown}
          onFocus={() => {
            if (inputValue.trim() && filteredSuggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          placeholder={tags.length === 0 ? placeholder : ""}
          disabled={disabled || (maxTags ? tags.length >= maxTags : false)}
          className={`w-full border-none outline-none bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 ${inputSizeClasses[size]}`}
        />
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {filteredSuggestions.map((suggestion, index) => (
            <button
              key={index}
              type="button"
              className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-white text-sm first:rounded-t-md last:rounded-b-md"
              onClick={() => handleSuggestionClick(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Tag count indicator */}
      {maxTags && (
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {tags.length}/{maxTags} tags
        </div>
      )}
    </div>
  );
};

export default TagInput;
