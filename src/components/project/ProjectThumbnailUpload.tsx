// components/project/ProjectThumbnailUpload.tsx

import React, { useRef, useState } from "react";
import { ProjectThumbnailService } from "../../services/projectThumnailService.ts";

interface ProjectThumbnailUploadProps {
  currentThumbnail?: string | null;
  onThumbnailChange: (thumbnailUrl: string | null) => void;
  disabled?: boolean;
}

/**
 * Component for uploading and managing project thumbnails
 * Follows Single Responsibility - handles only thumbnail upload UI
 */
export const ProjectThumbnailUpload: React.FC<ProjectThumbnailUploadProps> = ({
  currentThumbnail,
  onThumbnailChange,
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(
    currentThumbnail || null,
  );

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const processedImage =
        await ProjectThumbnailService.processImageFile(file);
      setPreview(processedImage);
      onThumbnailChange(processedImage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process image");
      console.error("Thumbnail upload error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveThumbnail = () => {
    setPreview(null);
    onThumbnailChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="project-thumbnail-upload">
      <div className="thumbnail-section">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
          Project Thumbnail
        </label>

        <div className="flex items-start gap-4">
          {/* Preview Area */}
          <div className="thumbnail-preview-container">
            {preview ? (
              <div className="relative group">
                <img
                  src={preview}
                  alt="Project thumbnail"
                  className="w-32 h-24 object-cover rounded-lg border border-gray-300 dark:border-gray-600"
                />
                {!disabled && (
                  <button
                    onClick={handleRemoveThumbnail}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove thumbnail"
                  >
                    <svg
                      className="w-4 h-4"
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
                )}
              </div>
            ) : (
              <div className="w-32 h-24 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-400 dark:border-gray-600">
                <svg
                  className="w-8 h-8 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
            )}
          </div>

          {/* Upload Controls */}
          <div className="flex-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              disabled={disabled || isProcessing}
              className="hidden"
            />

            <button
              onClick={handleUploadClick}
              disabled={disabled || isProcessing}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing
                ? "Processing..."
                : preview
                  ? "Change Thumbnail"
                  : "Upload Thumbnail"}
            </button>

            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Accepted formats: JPEG, PNG, WebP (max 5MB)
            </p>

            {error && (
              <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
