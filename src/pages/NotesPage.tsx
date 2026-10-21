// src/pages/NotesPage.tsx
import React from "react";
import { useProjectData } from "../contexts/ProjectDataContext";
import { useAppState } from "../contexts/AppStateContext";
import MainContentArea from "../components/layout/MainContentArea";
import NotesApp from "../components/notes/NotesApp";

const NotesPage: React.FC = () => {
  const { project } = useProjectData();
  const { appState } = useAppState();

  if (!project) {
    return (
      <MainContentArea title="Notes">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              No project is currently loaded.
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Open or create a project to start taking notes
            </p>
          </div>
        </div>
      </MainContentArea>
    );
  }

  return (
    <MainContentArea noPadding={true}>
      <div className="h-full">
        <NotesApp
          project={project}
          knowledgeBase={{
            characters: project.characters,
            locations: project.locations,
            technologies: project.technologies,
            cultures: project.cultures,
            events: project.timelines?.flatMap((t) => t.events || []),
          }}
        />
      </div>
    </MainContentArea>
  );
};

export default NotesPage;
