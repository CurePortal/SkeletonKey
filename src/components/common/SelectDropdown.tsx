import React, { useState, useEffect, useRef } from "react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}

interface SelectDropdownProps {
  options: SelectOption[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  helpText?: string;
  disabled?: boolean;
  required?: boolean;
  multiple?: boolean;
  searchable?: boolean;
  clearable?: boolean;
  fullWidth?: boolean;
  className?: string;
  id?: string;
}

const SelectDropdown: React.FC<SelectDropdownProps> = ({
  options,
  value,
  onChange,
  label,
  placeholder = "Select option",
  error,
  helpText,
  disabled = false,
  required = false,
  multiple = false,
  searchable = false,
  clearable = true,
  fullWidth = true,
  className = "",
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Generate a unique ID if none is provided
  const selectId = id || `select-${Math.random().toString(36).substring(2, 9)}`;

  // Filter options based on search term
  const filteredOptions =
    searchTerm.trim() === ""
      ? options
      : options.filter((option) =>
          option.label.toLowerCase().includes(searchTerm.toLowerCase()),
        );

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  // Get the display value
  const getDisplayValue = () => {
    if (multiple && Array.isArray(value)) {
      if (value.length === 0) return placeholder;

      if (value.length === 1) {
        const option = options.find((opt) => opt.value === value[0]);
        return option ? option.label : placeholder;
      }

      return `${value.length} items selected`;
    } else if (!multiple && typeof value === "string") {
      const option = options.find((opt) => opt.value === value);
      return option ? option.label : placeholder;
    }

    return placeholder;
  };

  // Handle option selection
  const handleSelect = (optionValue: string) => {
    if (multiple && Array.isArray(value)) {
      if (value.includes(optionValue)) {
        onChange(value.filter((val) => val !== optionValue));
      } else {
        onChange([...value, optionValue]);
      }
    } else {
      onChange(optionValue);
      setIsOpen(false);
    }
  };

  // Handle clear selection
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(multiple ? [] : "");
  };

  // Check if an option is selected
  const isSelected = (optionValue: string) => {
    if (multiple && Array.isArray(value)) {
      return value.includes(optionValue);
    }
    return value === optionValue;
  };

  return (
    <div className={`${fullWidth ? "w-full" : ""} ${className}`}>
      {label && (
        <label
          htmlFor={selectId}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative" ref={dropdownRef}>
        <div
          id={selectId}
          className={`
            bg-white dark:bg-gray-700 border rounded-md shadow-sm w-full py-2 pl-3 pr-10 text-left cursor-default
            ${
              error
                ? "border-red-300 text-red-900 focus:ring-red-500 focus:border-red-500 dark:border-red-600 dark:text-red-100"
                : "border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600 dark:text-white"
            }
            ${disabled ? "bg-gray-100 text-gray-500 cursor-not-allowed dark:bg-gray-800" : "hover:border-gray-400"}
            focus:outline-none focus:ring-2 focus:ring-offset-0
          `}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          role="combobox"
          aria-controls="options"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-disabled={disabled}
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              !disabled && setIsOpen(!isOpen);
            } else if (e.key === "Escape" && isOpen) {
              setIsOpen(false);
            }
          }}
        >
          <span className="block truncate">{getDisplayValue()}</span>

          <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
            {clearable &&
            !disabled &&
            value !== "" &&
            (!multiple ||
              (multiple && Array.isArray(value) && value.length > 0)) ? (
              <button
                type="button"
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 mr-2"
                onClick={handleClear}
                tabIndex={-1}
                aria-label="Clear selection"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            ) : null}

            <svg
              className="h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 9l4 4 4-4"
              />
            </svg>
          </span>
        </div>

        {isOpen && (
          <div className="absolute z-10 mt-1 w-full rounded-md bg-white dark:bg-gray-700 shadow-lg">
            {searchable && (
              <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600">
                <input
                  ref={searchInputRef}
                  type="text"
                  className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      setSearchTerm("");
                    }
                  }}
                />
              </div>
            )}

            <ul
              className="max-h-60 overflow-auto py-1 text-base"
              role="listbox"
              aria-labelledby={selectId}
              id="options"
            >
              {filteredOptions.length === 0 ? (
                <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                  No options found
                </li>
              ) : (
                filteredOptions.map((option) => (
                  <li
                    key={option.value}
                    className={`
                      cursor-default select-none relative py-2 pl-3 pr-9
                      ${
                        option.disabled
                          ? "text-gray-400 cursor-not-allowed dark:text-gray-500"
                          : isSelected(option.value)
                            ? "text-white bg-blue-600"
                            : "text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-600"
                      }
                    `}
                    role="option"
                    aria-selected={isSelected(option.value)}
                    onClick={() => {
                      if (!option.disabled) {
                        handleSelect(option.value);
                      }
                    }}
                  >
                    <div className="flex items-center">
                      {option.icon && (
                        <span className="mr-2 flex-shrink-0">
                          {option.icon}
                        </span>
                      )}
                      <span
                        className={`block truncate ${isSelected(option.value) ? "font-medium" : "font-normal"}`}
                      >
                        {option.label}
                      </span>
                    </div>

                    {isSelected(option.value) && (
                      <span
                        className={`absolute inset-y-0 right-0 flex items-center pr-4 ${
                          isSelected(option.value)
                            ? "text-white"
                            : "text-blue-600 dark:text-blue-400"
                        }`}
                      >
                        <svg
                          className="h-5 w-5"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </span>
                    )}
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {helpText && !error && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {helpText}
        </p>
      )}
    </div>
  );
};

export default SelectDropdown;
