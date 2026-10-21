import { ProjectType } from "../types";

const STORAGE_KEY = "recentProjects";
const MAX_RECENT_PROJECTS = 10;

export interface RecentProject {
  id: string;
  name: string;
  description: string;
  path: string;
  lastAccessed: string;
}

export function getRecentProjects(): RecentProject[] {
  try {
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (!storedData) return [];
    const projects = JSON.parse(storedData) as RecentProject[];
    return projects.sort((a, b) => {
      const dateA = new Date(a.lastAccessed);
      const dateB = new Date(b.lastAccessed);
      return dateB.getTime() - dateA.getTime();
    });
  } catch (error) {
    console.error("Error loading recent projects:", error);
    return [];
  }
}

export function addRecentProject(project: ProjectType, filePath: string): void {
  try {
    const recentProjects = getRecentProjects();
    const recentProject: RecentProject = {
      id: project.id,
      name: project.name,
      description: project.description || "",
      path: filePath,
      lastAccessed: new Date().toISOString(),
    };
    const filteredProjects = recentProjects.filter(
      (p) => !(p.id === project.id || p.path === filePath),
    );
    const updatedProjects = [recentProject, ...filteredProjects];
    const limitedProjects = updatedProjects.slice(0, MAX_RECENT_PROJECTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(limitedProjects));
    console.log(`Added/updated project "${project.name}" to recent projects`);
  } catch (error) {
    console.error("Error saving recent project:", error);
  }
}

export function removeRecentProject(projectId: string): void {
  try {
    const recentProjects = getRecentProjects();
    const updatedProjects = recentProjects.filter((p) => p.id !== projectId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedProjects));
  } catch (error) {
    console.error("Error removing recent project:", error);
  }
}

export function removeRecentProjectByPath(path: string): void {
  try {
    const recentProjects = getRecentProjects();
    const updatedProjects = recentProjects.filter((p) => p.path !== path);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedProjects));
  } catch (error) {
    console.error("Error removing recent project by path:", error);
  }
}

export function clearRecentProjects(): boolean {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log("All recent projects cleared");
    const remaining = localStorage.getItem(STORAGE_KEY);
    if (remaining) {
      console.error("Failed to clear recent projects, still found:", remaining);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Error clearing recent projects:", error);
    return false;
  }
}

export function debugRecentProjects(): void {
  try {
    const projects = getRecentProjects();
    console.log("Current recent projects:", projects);
    const storageKeys = Object.keys(localStorage);
    console.log("All localStorage keys:", storageKeys);
    const rawData = localStorage.getItem(STORAGE_KEY);
    console.log("Raw storage data:", rawData);
  } catch (error) {
    console.error("Error debugging recent projects:", error);
  }
}
