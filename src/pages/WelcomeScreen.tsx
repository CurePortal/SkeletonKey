import React from "react";
import { useAppState } from "../contexts/AppStateContext";
import { useNotification } from "../contexts/NotificationContext";
import Button from "../components/common/Button";
import { openAnotherProject } from "../services/mainProjectService";
import { FiPlusCircle, FiFolder } from "react-icons/fi";

const WelcomeScreen: React.FC = () => {
  const { openModal } = useAppState();
  const { showError } = useNotification();

  return (
    <div className="h-full overflow-auto bg-gray-50 dark:bg-gray-900">
      <div className="max-w-xl mx-auto p-6">
        <section className="rounded-md bg-gray-900 dark:bg-gray-800 border border-gray-700 text-white p-5">
          <h1 className="text-xl font-semibold tracking-tight">SkeletonKey</h1>
          <p className="text-sm text-gray-400 mt-1">No main project loaded.</p>
          <div className="flex flex-wrap gap-2 mt-4">
            <Button
              variant="primary"
              leftIcon={<FiPlusCircle className="h-4 w-4" />}
              onClick={() => openModal("new-project")}
            >
              Create main project
            </Button>
            <Button
              variant="outline"
              leftIcon={<FiFolder className="h-4 w-4" />}
              onClick={() => {
                void openAnotherProject().catch((error) => {
                  showError(
                    error instanceof Error ? error.message : String(error),
                  );
                });
              }}
              className="!border-gray-600 !text-gray-200 hover:!bg-gray-700"
            >
              Open another project
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default WelcomeScreen;
