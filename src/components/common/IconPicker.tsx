// src/components/common/IconPicker.tsx - Standalone icon picker component
import React, { useState, useMemo } from "react";
import { MAP_ICONS, getIconsByCategory } from "../../utils/mapIcons";

interface IconPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectIcon: (iconId: string) => void;
  selectedIconId?: string;
  title?: string;
}

const IconPicker: React.FC<IconPickerProps> = ({
  isOpen,
  onClose,
  onSelectIcon,
  selectedIconId,
  title = "Choose Icon",
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("pins");

  const iconsByCategory = useMemo(() => getIconsByCategory(), []);
  const categories = Object.keys(iconsByCategory);

  if (!isOpen) return null;

  // Helper function to safely get svg content
  const getIconSvg = (icon: any): string => {
    return (icon as any).svg || "";
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center"
      style={{ zIndex: 1002 }}
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Category tabs */}
        <div className="flex space-x-2 mb-4 overflow-x-auto pb-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-2 rounded text-sm whitespace-nowrap transition-colors ${
                selectedCategory === category
                  ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600"
              }`}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </button>
          ))}
        </div>

        {/* Icon grid */}
        <div className="flex-1 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded p-4">
          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-3">
            {iconsByCategory[selectedCategory]?.map((icon) => (
              <button
                key={icon.id}
                onClick={() => onSelectIcon(icon.id)}
                className={`flex flex-col items-center p-3 rounded-lg transition-all hover:bg-gray-100 dark:hover:bg-gray-700 group border-2 ${
                  selectedIconId === icon.id
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-transparent hover:border-gray-300 dark:hover:border-gray-600"
                }`}
                title={icon.name}
              >
                <div
                  className="w-8 h-8 mb-2 transition-transform group-hover:scale-110"
                  style={{ color: icon.color }}
                  dangerouslySetInnerHTML={{ __html: getIconSvg(icon) }}
                />
                <span className="text-xs text-gray-600 dark:text-gray-400 text-center leading-tight font-medium">
                  {icon.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {iconsByCategory[selectedCategory]?.length || 0} icons in{" "}
            {selectedCategory}
          </div>
          {selectedIconId && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Selected:
              </span>
              <div className="flex items-center space-x-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                <div
                  className="w-4 h-4"
                  style={{
                    color: MAP_ICONS.find((i) => i.id === selectedIconId)
                      ?.color,
                  }}
                  dangerouslySetInnerHTML={{
                    __html: getIconSvg(
                      MAP_ICONS.find((i) => i.id === selectedIconId),
                    ),
                  }}
                />
                <span className="text-xs font-medium">
                  {MAP_ICONS.find((i) => i.id === selectedIconId)?.name}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IconPicker;
