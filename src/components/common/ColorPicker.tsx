import React from "react";

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  presetColors?: string[];
}

const ColorPicker: React.FC<ColorPickerProps> = ({
  color,
  onChange,
  presetColors = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
  ],
}) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <div
          className="w-8 h-8 rounded-md border border-gray-300 dark:border-gray-600 flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <input
          type="text"
          value={color}
          onChange={(e) => onChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white w-32"
        />
        <input
          type="color"
          value={color}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 p-0 border-0 rounded-md cursor-pointer"
        />
      </div>

      <div className="flex flex-wrap gap-2 mt-2">
        {presetColors.map((presetColor) => (
          <button
            key={presetColor}
            type="button"
            onClick={() => onChange(presetColor)}
            className={`w-8 h-8 rounded-md shadow-sm transition-transform ${
              color === presetColor
                ? "ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-gray-800"
                : "hover:scale-110"
            }`}
            style={{ backgroundColor: presetColor }}
            aria-label={`Select color ${presetColor}`}
          />
        ))}
      </div>
    </div>
  );
};

export default ColorPicker;
