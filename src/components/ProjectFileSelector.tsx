import { useState, useRef, ChangeEvent } from "react"; // Added ChangeEvent
import { useProjectData } from "../contexts/ProjectDataContext";
import { ProjectType } from "../types/project.ts";
import { useNotification } from "../contexts/NotificationContext";
import Button from "./common/Button";
import MessageBox from "./common/MessageBox";
import LoadingSpinner from "./common/LoadingSpinner";

/**
 * Component for selecting and reading project files directly in the browser
 * without generating mock data
 */
const ProjectFileSelector = () => {
  const { setProject, setCurrentFilePath } = useProjectData();
  const { showSuccess, showError } = useNotification();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null); // Explicitly type the error state
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const readProjectFile = async (file: File): Promise<any> => {
    // Consider typing the return more strictly if possible, e.g., Promise<ProjectType>
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event: ProgressEvent<FileReader>) => {
        try {
          if (event.target && typeof event.target.result === "string") {
            const fileContent: string = event.target.result;
            const projectData = JSON.parse(fileContent) as ProjectType;
            resolve(projectData);
          } else {
            reject(
              new Error("File content is invalid or event target is missing."),
            );
          }
        } catch (err) {
          // Renamed to 'err' to avoid conflict with outer scope 'error' state
          if (err instanceof Error) {
            reject(new Error(`Failed to parse project file: ${err.message}`));
          } else {
            reject(
              new Error(
                `Failed to parse project file: An unknown error occurred.`,
              ),
            );
          }
        }
      };

      reader.onerror = () => reject(new Error("Error reading file"));
      reader.readAsText(file);
    });
  };

  // Fix for error TS7006: Parameter 'event' implicitly has an 'any' type.
  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    // Check if event.target and event.target.files exist
    if (
      !event.target ||
      !event.target.files ||
      event.target.files.length === 0
    ) {
      // Optionally, handle the case where no file is selected or event.target is null
      // setError("No file selected."); // Example
      return;
    }
    const file = event.target.files[0];
    // The check `if (!file) return;` below is technically redundant now but doesn't hurt
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      const projectData = await readProjectFile(file);

      if (
        !projectData ||
        !projectData.id ||
        !projectData.name ||
        !Array.isArray(projectData.timelines)
      ) {
        throw new Error("Invalid project file format");
      }

      setProject(projectData as ProjectType); // Assuming projectData is validated or readProjectFile returns ProjectType
      setCurrentFilePath(file.name);

      showSuccess(`Project "${projectData.name}" loaded successfully`);
    } catch (err) {
      // Renamed to 'err' to avoid conflict with outer scope 'error' state
      // Fix for errors TS18046: 'err' is of type 'unknown'.
      if (err instanceof Error) {
        setError(err.message);
        showError(`Failed to load project: ${err.message}`);
      } else {
        const unknownErrorMessage =
          "An unknown error occurred while loading the project.";
        setError(unknownErrorMessage);
        showError(unknownErrorMessage);
      }
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        Open Project File
      </h2>

      {error && (
        <MessageBox
          type="error"
          title="Error Loading Project"
          message={error} // 'error' state is now string | null, which should be compatible
          className="mb-4 w-full"
        />
      )}

      <p className="text-gray-600 dark:text-gray-300 mb-6 text-center">
        Select a project file (.ark) from your computer to open
      </p>

      <div className="relative">
        <input
          type="file"
          ref={fileInputRef}
          accept=".ark,.ahp,.json"
          onChange={handleFileChange}
          className="hidden"
        />
        <Button
          variant="primary"
          onClick={handleFileSelect}
          disabled={isLoading}
          leftIcon={
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
              />
            </svg>
          }
        >
          {isLoading ? "Loading..." : "Select Project File"}
        </Button>
      </div>

      {isLoading && (
        <div className="mt-4">
          <LoadingSpinner size="md" label="Reading project file..." showLabel />
        </div>
      )}

      <div className="mt-6 text-sm text-gray-500 dark:text-gray-400">
        Supported formats: .ark, .json
      </div>
    </div>
  );
};

export default ProjectFileSelector;
