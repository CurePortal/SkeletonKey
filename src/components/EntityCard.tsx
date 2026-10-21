// src/components/EntityCard.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  FaUser,
  FaMapMarkerAlt,
  FaMicrochip,
  FaGlobe,
  FaFileAlt,
  FaTag,
  FaCalendarAlt,
  FaExternalLinkAlt,
  FaEdit,
  FaTrash,
} from "react-icons/fa";

export interface EntityCardProps {
  entityType: string;
  entity: any;
  onClick: () => void;
  isSelected?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  allowExpand?: boolean;
}

// Custom CSS for standardized content styling
const entityContentStyles = `
  .standardized-entity-content * {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    box-sizing: border-box !important;
    max-width: 100% !important;
  }

  .standardized-entity-content p {
    margin: 0 0 8px 0 !important;
    padding: 0 !important;
    line-height: 1.4 !important;
    color: inherit !important;
    font-size: 14px !important;
    word-wrap: break-word !important;
  }

  .standardized-entity-content h1, .standardized-entity-content h2, .standardized-entity-content h3,
  .standardized-entity-content h4, .standardized-entity-content h5, .standardized-entity-content h6 {
    margin: 8px 0 4px 0 !important;
    padding: 0 !important;
    color: inherit !important;
    font-weight: 600 !important;
    line-height: 1.2 !important;
    word-wrap: break-word !important;
  }

  .standardized-entity-content h1 { font-size: 16px !important; }
  .standardized-entity-content h2 { font-size: 15px !important; }
  .standardized-entity-content h3 { font-size: 14px !important; }
  .standardized-entity-content h4, .standardized-entity-content h5, .standardized-entity-content h6 { font-size: 13px !important; }

  .standardized-entity-content strong, .standardized-entity-content b {
    font-weight: 600 !important;
    color: inherit !important;
  }

  .standardized-entity-content em, .standardized-entity-content i {
    font-style: italic !important;
    color: inherit !important;
  }

  .standardized-entity-content ul, .standardized-entity-content ol {
    margin: 4px 0 8px 16px !important;
    padding: 0 !important;
    list-style-position: outside !important;
  }

  .standardized-entity-content li {
    margin: 2px 0 !important;
    padding: 0 !important;
    color: inherit !important;
    font-size: 14px !important;
    line-height: 1.4 !important;
    word-wrap: break-word !important;
  }

  .standardized-entity-content a {
    color: #3b82f6 !important;
    text-decoration: underline !important;
    font-size: 14px !important;
  }

  .dark .standardized-entity-content a {
    color: #60a5fa !important;
  }

  .standardized-entity-content a:hover {
    color: #1d4ed8 !important;
  }

  .dark .standardized-entity-content a:hover {
    color: #93c5fd !important;
  }

  .standardized-entity-content blockquote {
    margin: 8px 0 !important;
    padding: 6px 10px !important;
    border-left: 2px solid #e5e7eb !important;
    background: #f9fafb !important;
    color: inherit !important;
    font-style: italic !important;
    font-size: 13px !important;
  }

  .dark .standardized-entity-content blockquote {
    border-left-color: #4b5563 !important;
    background: #374151 !important;
  }

  .standardized-entity-content code {
    background: #f3f4f6 !important;
    padding: 1px 3px !important;
    border-radius: 2px !important;
    font-family: monospace !important;
    font-size: 12px !important;
    color: inherit !important;
  }

  .dark .standardized-entity-content code {
    background: #4b5563 !important;
  }

  .standardized-entity-content pre {
    background: #f3f4f6 !important;
    padding: 8px !important;
    border-radius: 4px !important;
    overflow-x: auto !important;
    margin: 8px 0 !important;
    font-size: 12px !important;
  }

  .dark .standardized-entity-content pre {
    background: #4b5563 !important;
  }

  .standardized-entity-content table {
    width: 100% !important;
    border-collapse: collapse !important;
    margin: 8px 0 !important;
    font-size: 12px !important;
  }

  .standardized-entity-content th, .standardized-entity-content td {
    border: 1px solid #e5e7eb !important;
    padding: 4px 6px !important;
    text-align: left !important;
    word-wrap: break-word !important;
  }

  .dark .standardized-entity-content th, .dark .standardized-entity-content td {
    border-color: #4b5563 !important;
  }

  .standardized-entity-content th {
    background: #f9fafb !important;
    font-weight: 600 !important;
    color: inherit !important;
  }

  .dark .standardized-entity-content th {
    background: #374151 !important;
  }

  /* Truncate styles for card view */
  .standardized-entity-content.truncated {
    display: -webkit-box !important;
    -webkit-line-clamp: 2 !important;
    -webkit-box-orient: vertical !important;
    overflow: hidden !important;
  }

  .standardized-entity-content.truncated * {
    display: inline !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  .standardized-entity-content.truncated p + p::before {
    content: " " !important;
  }

  .standardized-entity-content.expanded {
    max-height: 200px !important;
    overflow-y: auto !important;
  }
`;

// Inject styles
if (typeof document !== "undefined") {
  const styleElement = document.getElementById("entity-content-styles");
  if (!styleElement) {
    const style = document.createElement("style");
    style.id = "entity-content-styles";
    style.textContent = entityContentStyles;
    document.head.appendChild(style);
  }
}

// Standardized Content Component for safe HTML rendering
const StandardizedContent: React.FC<{
  content: string;
  truncated?: boolean;
  className?: string;
}> = ({ content, truncated = false, className = "" }) => {
  const contentClasses = `standardized-entity-content ${
    truncated ? "truncated" : "expanded"
  } ${className}`;

  return (
    <div
      className={contentClasses}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
};

const EntityCard: React.FC<EntityCardProps> = ({
  entityType,
  entity,
  onClick,
  isSelected = false,
  onEdit,
  onDelete,
  allowExpand = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Handle clicking outside to close expanded card
  useEffect(() => {
    if (isExpanded && allowExpand) {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          cardRef.current &&
          !cardRef.current.contains(event.target as Node)
        ) {
          setIsExpanded(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isExpanded, allowExpand]);

  const getPrimaryText = () => {
    return entityType === "source" ? entity.title : entity.name;
  };

  const formatDatePart = (dateString: string) => {
    if (!dateString) return "";
    const yearStr = dateString.substring(0, dateString.indexOf("-", 1));
    const year = parseInt(yearStr, 10);
    if (isNaN(year)) return "";
    return year < 0 ? `${Math.abs(year)} BCE` : `${year} CE`;
  };

  const getSecondaryText = () => {
    switch (entityType) {
      case "character":
        if (entity.birthDate) {
          const birth = formatDatePart(entity.birthDate);
          const death = entity.deathDate
            ? formatDatePart(entity.deathDate)
            : "?";
          return `${birth} - ${death}`;
        }
        return null;
      case "location":
        return entity.type || "Location";
      case "culture":
        if (entity.foundedDate) {
          const founded = formatDatePart(entity.foundedDate);
          const ended = entity.endDate
            ? ` - ${formatDatePart(entity.endDate)}`
            : "";
          return `Founded: ${founded}${ended}`;
        }
        return null;
      case "source":
        return `${entity.authors?.join(", ") || "Unknown Author"}${
          entity.publicationDate ? ` (${entity.publicationDate})` : ""
        }`;
      default:
        return null;
    }
  };

  const getEntityIcon = () => {
    const iconClass = "h-5 w-5";
    const iconColorClass = getEntityColorClass();
    switch (entityType) {
      case "character":
        return <FaUser className={`${iconClass} ${iconColorClass}`} />;
      case "location":
        return <FaMapMarkerAlt className={`${iconClass} ${iconColorClass}`} />;
      case "technology":
        return <FaMicrochip className={`${iconClass} ${iconColorClass}`} />;
      case "culture":
        return <FaGlobe className={`${iconClass} ${iconColorClass}`} />;
      case "source":
        return <FaFileAlt className={`${iconClass} ${iconColorClass}`} />;
      default:
        return <FaTag className={`${iconClass} ${iconColorClass}`} />;
    }
  };

  const getEntityColorClass = () => {
    switch (entityType) {
      case "character":
        return "text-green-600 dark:text-green-400";
      case "location":
        return "text-amber-600 dark:text-amber-400";
      case "technology":
        return "text-purple-600 dark:text-purple-400";
      case "culture":
        return "text-pink-600 dark:text-pink-400";
      case "source":
        return "text-gray-600 dark:text-gray-400";
      default:
        return "text-blue-600 dark:text-blue-400";
    }
  };

  const getEntityBgClass = () => {
    switch (entityType) {
      case "character":
        return "bg-green-100 dark:bg-green-900";
      case "location":
        return "bg-amber-100 dark:bg-amber-900";
      case "technology":
        return "bg-purple-100 dark:bg-purple-900";
      case "culture":
        return "bg-pink-100 dark:bg-pink-900";
      case "source":
        return "bg-gray-100 dark:bg-gray-900";
      default:
        return "bg-blue-100 dark:bg-blue-900";
    }
  };

  const getBadge = () => {
    switch (entityType) {
      case "character":
        if (entity.isHistorical) {
          return (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">
              Historical
            </span>
          );
        }
        return null;
      case "source":
        return (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
            {entity.documentType || entity.type || "Document"}
          </span>
        );
      default:
        return null;
    }
  };

  const getSpecialTags = (limit?: number) => {
    const tagsToDisplay =
      entityType === "technology"
        ? entity.fields
        : entityType === "culture"
          ? entity.values
          : entity.tags;
    const color =
      entityType === "technology"
        ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200"
        : entityType === "culture"
          ? "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200"
          : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";

    if (!tagsToDisplay) return null;

    const displayLimit = limit || (isExpanded ? tagsToDisplay.length : 2);
    return tagsToDisplay.slice(0, displayLimit).map((tag: string) => (
      <span
        key={tag}
        className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${color}`}
      >
        {tag}
      </span>
    ));
  };

  const getOverflowCount = () => {
    const allTags =
      entityType === "technology"
        ? entity.fields
        : entityType === "culture"
          ? entity.values
          : entity.tags;
    return allTags?.length > 2 ? allTags.length - 2 : 0;
  };

  const renderDescription = () => {
    const description = entity.description || "No description available.";
    const hasHtmlTags = /<[^>]*>/g.test(description);

    if (hasHtmlTags) {
      return (
        <StandardizedContent
          content={description}
          truncated={!isExpanded}
          className="text-gray-600 dark:text-gray-300"
        />
      );
    } else {
      return (
        <p
          className={`text-gray-600 dark:text-gray-300 ${!isExpanded ? "line-clamp-2" : ""}`}
        >
          {description}
        </p>
      );
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (allowExpand && !isExpanded) {
      e.stopPropagation();
      setIsExpanded(true);
    }
  };

  const handleViewDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick();
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) {
      onEdit();
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete();
    }
  };

  const renderExpandedContent = () => {
    const connections = [];
    if (entity.linkedCharacterIds?.length) {
      connections.push({
        type: "Characters",
        count: entity.linkedCharacterIds.length,
        color: "bg-green-500",
      });
    }
    if (entity.linkedLocationIds?.length) {
      connections.push({
        type: "Locations",
        count: entity.linkedLocationIds.length,
        color: "bg-amber-500",
      });
    }
    if (entity.linkedTechnologyIds?.length) {
      connections.push({
        type: "Technologies",
        count: entity.linkedTechnologyIds.length,
        color: "bg-purple-500",
      });
    }
    if (entity.linkedCultureIds?.length) {
      connections.push({
        type: "Cultures",
        count: entity.linkedCultureIds.length,
        color: "bg-pink-500",
      });
    }

    return (
      <div className="border-t dark:border-gray-700 p-4 space-y-4">
        {/* Full Description */}
        <div>
          <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">
            Description
          </h4>
          <div className="text-sm">{renderDescription()}</div>
        </div>

        {/* Entity-specific metadata */}
        {entityType === "character" && (entity.role || entity.affiliation) && (
          <div>
            <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">
              Details
            </h4>
            <div className="space-y-1">
              {entity.role && (
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  <span className="font-semibold">Role:</span> {entity.role}
                </p>
              )}
              {entity.affiliation && (
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  <span className="font-semibold">Affiliation:</span>{" "}
                  {entity.affiliation}
                </p>
              )}
            </div>
          </div>
        )}

        {/* All Tags */}
        {entity.tags && entity.tags.length > 0 && (
          <div>
            <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">
              Tags
            </h4>
            <div className="flex flex-wrap gap-1">{getSpecialTags()}</div>
          </div>
        )}

        {/* Connections */}
        {connections.length > 0 && (
          <div>
            <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">
              Connected Entities
            </h4>
            <div className="space-y-1">
              {connections.map((conn) => (
                <div key={conn.type} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${conn.color}`}></div>
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {conn.count} {conn.type.toLowerCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleViewDetails}
            className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors flex items-center justify-center gap-1"
          >
            <FaExternalLinkAlt className="w-3 h-3" />
            View Full Details
          </button>
          {onEdit && (
            <button
              onClick={handleEdit}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-1"
            >
              <FaEdit className="w-3 h-3" />
              Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 transition-colors flex items-center justify-center gap-1"
            >
              <FaTrash className="w-3 h-3" />
              Delete
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="relative" ref={cardRef}>
      {/* Actual card */}
      <div
        key={entity.id}
        className={`
                bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                rounded-lg shadow-sm hover:shadow-md transition-all duration-200
                ${isExpanded ? "absolute top-0 left-0 right-0 z-50 shadow-2xl overflow-y-auto min-w-[300px]" : "h-full"}
                ${isSelected ? "ring-2 ring-blue-500 dark:ring-blue-400" : ""}
              `}
        style={
          isExpanded
            ? {
                maxHeight: "500px",
                width: "max(100%, 320px)",
              }
            : {}
        }
      >
        <div
          onClick={handleCardClick}
          className={`
          flex items-center justify-between p-4 cursor-pointer rounded-t-lg transition-colors
          ${isExpanded ? "bg-gray-100 dark:bg-gray-700" : "hover:bg-gray-50 dark:hover:bg-gray-700"}
        `}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div
              className={`flex-shrink-0 w-10 h-10 ${getEntityBgClass()} rounded-full flex items-center justify-center`}
            >
              {getEntityIcon()}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="font-semibold text-gray-900 dark:text-white truncate"
                title={getPrimaryText()}
              >
                {getPrimaryText()}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {getSecondaryText() ||
                  `${entityType.charAt(0).toUpperCase() + entityType.slice(1)}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {getBadge()}
            {!isExpanded && entity.tags && (
              <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-full">
                {entity.tags.length}
              </span>
            )}
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>

        {!isExpanded && (
          <div className="px-4 pb-3">
            <div className="text-sm mb-2">{renderDescription()}</div>
            <div className="flex flex-wrap gap-1">
              {getSpecialTags()}
              {getOverflowCount() > 0 && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                  +{getOverflowCount()}
                </span>
              )}
            </div>
          </div>
        )}

        {isExpanded && renderExpandedContent()}
      </div>
    </div>
  );
};

export { StandardizedContent };
export default EntityCard;
