// components/project/ProjectCard.tsx

import React from "react";
import { ProjectType } from "../../types";

interface ProjectCardProps {
  project: Partial<ProjectType> & { name: string; lastModified?: string };
  onOpen?: () => void;
  onDelete?: () => void;
  onSync?: () => void;
  isLocal?: boolean;
  isCloud?: boolean;
  isEncrypted?: boolean;
}

/**
 * Project card component with thumbnail support
 * Displays project thumbnail if available, falls back to folder icon
 */
export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onOpen,
  onDelete,
  onSync,
  isLocal = false,
  isCloud = false,
  isEncrypted = false,
}) => {
  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger card click if clicking on action buttons
    if ((e.target as HTMLElement).closest(".card-actions")) {
      return;
    }
    onOpen?.();
  };

  return (
    <div
      className="project-card bg-white dark:bg-gray-800 rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer"
      onClick={handleCardClick}
    >
      {/* Badge Icons */}
      <div className="absolute top-2 right-2 flex gap-1">
        {isCloud && (
          <span
            className="bg-blue-500 text-white p-1 rounded"
            title="Local record"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z" />
            </svg>
          </span>
        )}
        {isEncrypted && (
          <span
            className="bg-green-500 text-white p-1 rounded"
            title="Encrypted"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        )}
      </div>

      {/* Thumbnail or Folder Icon */}
      <div className="thumbnail-container mb-4 flex justify-center">
        {project.thumbnailUrl ? (
          <img
            src={project.thumbnailUrl}
            alt={`${project.name} thumbnail`}
            className="w-full h-32 object-cover rounded-lg"
            onError={(e) => {
              // Fallback to folder icon if image fails to load
              const target = e.target as HTMLImageElement;
              target.style.display = "none";
              const fallback = target.nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = "flex";
            }}
          />
        ) : null}
        <div
          className={`fallback-icon w-full h-32 ${project.thumbnailUrl ? "hidden" : "flex"} items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg`}
        >
          <svg
            className="w-16 h-16 text-gray-400"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
        </div>
      </div>

      {/* Project Info */}
      <div className="project-info">
        <h3 className="font-semibold text-lg mb-1 truncate">{project.name}</h3>
        {project.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
            {project.description}
          </p>
        )}
        {project.lastModified && (
          <p className="text-xs text-gray-500 dark:text-gray-500">
            Last modified: {new Date(project.lastModified).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="card-actions mt-4 flex gap-2">
        {isLocal && onSync && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSync();
            }}
            className="flex-1 px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
            title="Sync to cloud"
          >
            <svg
              className="w-4 h-4 inline mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
              />
            </svg>
            Sync
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="px-3 py-1 text-sm bg-red-500 text-white hover:bg-red-600 rounded transition-colors"
            title="Delete project"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
};
