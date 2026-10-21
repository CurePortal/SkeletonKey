// src/components/common/KMZImportModal.tsx - Fixed importKMZ function calls
import React, { useState, useCallback, useMemo } from "react";
import { useProjectData } from "../../contexts/ProjectDataContext";
import { useNotification } from "../../contexts/NotificationContext";
import { useKMZImport } from "../../utils/kmzImportService";
import Button from "../common/Button";
import MessageBox from "../common/MessageBox";
import { MAP_ICONS, getIconFromGoogleEarthUrl } from "../../utils/mapIcons";
import { LocationType, AnchoredShape } from "../../types";

interface KMZImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTimelineId?: string | null;
  onImport: (shapes: AnchoredShape[]) => void; // This is now a required prop
}

interface IconMapping {
  originalUrl: string;
  suggestedIcon: string;
  customMapping?: string;
  placeName?: string;
}

interface ImportPreview {
  locations: LocationType[];
  shapes: AnchoredShape[];
  iconMappings: IconMapping[];
}

const EnhancedKMZImportModal: React.FC<KMZImportModalProps> = ({
  isOpen,
  onClose,
  selectedTimelineId,
  onImport,
}) => {
  const { project, addLocation } = useProjectData();
  const { showSuccess, showError, showWarning } = useNotification();
  const { importKMZ } = useKMZImport();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [importProgress, setImportProgress] = useState<string>("");

  const [importPreview, setImportPreview] = useState<ImportPreview | null>(
    null,
  );
  const [showIconManager, setShowIconManager] = useState(false);
  const [customIconsFolder, setCustomIconsFolder] = useState<FileList | null>(
    null,
  );
  const [iconMappings, setIconMappings] = useState<IconMapping[]>([]);

  const [importOptions, setImportOptions] = useState({
    createLocationsForPoints: true,
    preserveStyles: true,
  });

  const availableIcons = useMemo(() => {
    return MAP_ICONS.reduce(
      (acc, icon) => {
        if (!acc[icon.category]) acc[icon.category] = [];
        acc[icon.category].push(icon);
        return acc;
      },
      {} as Record<string, typeof MAP_ICONS>,
    );
  }, []);

  const resetState = useCallback(() => {
    setSelectedFile(null);
    setImportProgress("");
    setImportPreview(null);
    setShowIconManager(false);
    setCustomIconsFolder(null);
    setIconMappings([]);
    setIsImporting(false);
    setIsAnalyzing(false);
  }, []);

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        if (
          file.name.toLowerCase().endsWith(".kmz") ||
          file.name.toLowerCase().endsWith(".kml")
        ) {
          setSelectedFile(file);
          setImportPreview(null);
          setShowIconManager(false);
        } else {
          showError("Please select a KMZ or KML file");
          event.target.value = "";
        }
      }
    },
    [showError],
  );

  const handleCustomIconsSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (files && files.length > 0) {
        setCustomIconsFolder(files);
      }
    },
    [],
  );

  const analyzeFile = async () => {
    if (!selectedFile || !project) return;
    setIsAnalyzing(true);
    setImportProgress("Analyzing KML file...");

    try {
      // Create options object that combines all parameters
      const options = {
        timelineId: selectedTimelineId || undefined,
        analyzeOnly: true,
        createLocationsForPoints: true,
      };

      const analysisResult = await importKMZ(
        selectedFile,
        selectedTimelineId || undefined,
        options,
      );

      if (analysisResult.success && analysisResult.data) {
        const { locations, shapes } = analysisResult.data;
        const uniqueIcons = new Map<string, IconMapping>();

        locations.forEach((location) => {
          const originalUrl = location.properties?.originalIconUrl;
          if (originalUrl) {
            const suggestedIcon =
              location.properties?.importedIconId ||
              getIconFromGoogleEarthUrl(originalUrl);
            if (!uniqueIcons.has(originalUrl)) {
              uniqueIcons.set(originalUrl, {
                originalUrl,
                suggestedIcon,
                placeName: location.name,
              });
            }
          }
        });

        const preview: ImportPreview = {
          locations,
          shapes,
          iconMappings: Array.from(uniqueIcons.values()),
        };

        setImportPreview(preview);
        setIconMappings(preview.iconMappings);
        if (preview.iconMappings.length > 0) {
          setShowIconManager(true);
        } else {
          showSuccess(
            `Analysis complete: Found ${locations.length} locations and ${shapes.length} shapes.`,
          );
        }
      } else {
        showError(analysisResult.error || "Failed to analyze file");
      }
    } catch (error) {
      showError(
        `Analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsAnalyzing(false);
      setImportProgress("");
    }
  };

  const handleIconMappingChange = (originalUrl: string, newMapping: string) => {
    setIconMappings((prev) =>
      prev.map((mapping) =>
        mapping.originalUrl === originalUrl
          ? { ...mapping, customMapping: newMapping }
          : mapping,
      ),
    );
  };

  const proceedWithImport = async () => {
    if (!selectedFile || !project) return;
    setIsImporting(true);
    setImportProgress("Importing data...");

    try {
      const iconMappingForImport = iconMappings.reduce(
        (acc, mapping) => {
          acc[mapping.originalUrl] =
            mapping.customMapping || mapping.suggestedIcon;
          return acc;
        },
        {} as Record<string, string>,
      );

      // Create options object that combines all parameters
      const options = {
        timelineId: selectedTimelineId || undefined,
        analyzeOnly: false,
        iconMappings: iconMappingForImport,
        customIconsFolder: customIconsFolder,
        preserveStyles: importOptions.preserveStyles,
        createLocationsForPoints: importOptions.createLocationsForPoints,
      };

      const result = await importKMZ(
        selectedFile,
        selectedTimelineId || undefined,
        options,
      );

      if (result.success && result.data) {
        const { locations, shapes } = result.data;

        // The modal handles adding locations
        locations.forEach((loc) => {
          addLocation(loc);
        });

        // The parent page (MapEditorPage) handles adding shapes via this callback
        onImport(shapes);

        if (result.warnings && result.warnings.length > 0) {
          showWarning(`Import completed with warnings: ${result.warnings[0]}`);
        }

        handleClose();
      } else {
        showError(result.error || "Import failed");
      }
    } catch (error) {
      showError(
        `Import failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsImporting(false);
      setImportProgress("");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={!isImporting && !isAnalyzing ? handleClose : undefined}
        />
        <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
              Import from Google Earth (KMZ/KML)
            </h3>

            {(isImporting || isAnalyzing) && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-800 dark:text-blue-200">
                {importProgress}
              </div>
            )}

            {!showIconManager ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Select KMZ or KML File
                  </label>
                  <input
                    type="file"
                    accept=".kmz,.kml"
                    onChange={handleFileSelect}
                    disabled={isImporting || isAnalyzing}
                    className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-200 disabled:opacity-50"
                  />
                </div>
                <MessageBox
                  type="info"
                  title="Import Process"
                  message="Click 'Analyze File' to preview the import and manage any custom icons before adding them to your project."
                />
              </div>
            ) : (
              <div className="space-y-4">
                <h4 className="text-md font-medium text-gray-900 dark:text-white">
                  Icon Management
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Found {importPreview?.locations.length} locations and{" "}
                  {importPreview?.iconMappings.length} icon types. You can
                  upload missing files or map them to standard icons.
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Upload Missing Icon Files (Optional)
                  </label>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleCustomIconsSelect}
                    className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 dark:file:bg-green-900 dark:file:text-green-200"
                  />
                </div>
                <div className="max-h-64 overflow-y-auto border dark:border-gray-700 rounded-lg">
                  <table className="min-w-full divide-y dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                          Original Icon
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                          Remap To
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y dark:divide-gray-700">
                      {iconMappings.map((mapping, index) => (
                        <tr key={index}>
                          <td className="px-3 py-2 text-xs">
                            <p
                              className="font-medium truncate max-w-xs"
                              title={mapping.originalUrl}
                            >
                              {mapping.originalUrl}
                            </p>
                            <p className="text-gray-500">
                              Used by: {mapping.placeName}
                            </p>
                          </td>
                          <td className="px-3 py-2 text-xs">
                            <select
                              value={
                                mapping.customMapping || mapping.suggestedIcon
                              }
                              onChange={(e) =>
                                handleIconMappingChange(
                                  mapping.originalUrl,
                                  e.target.value,
                                )
                              }
                              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700"
                            >
                              {Object.entries(availableIcons).map(
                                ([category, icons]) => (
                                  <optgroup
                                    key={category}
                                    label={
                                      category.charAt(0).toUpperCase() +
                                      category.slice(1)
                                    }
                                  >
                                    {icons.map((icon) => (
                                      <option key={icon.id} value={icon.id}>
                                        {icon.name}
                                      </option>
                                    ))}
                                  </optgroup>
                                ),
                              )}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            {!showIconManager ? (
              <Button
                variant="primary"
                onClick={analyzeFile}
                disabled={!selectedFile || isAnalyzing || isImporting}
              >
                {isAnalyzing ? "Analyzing..." : "Analyze File"}
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={proceedWithImport}
                disabled={isImporting}
              >
                {isImporting ? "Importing..." : "Complete Import"}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isAnalyzing || isImporting}
              className="mr-2"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedKMZImportModal;
