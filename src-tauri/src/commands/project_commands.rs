// src-tauri/src/commands/project_commands.rs

use crate::core::data_models::Project;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{command, Manager};

// Command to create a new project from the UI
#[derive(Deserialize)]
#[allow(dead_code)] // These fields are used for deserialization
pub struct CreateProjectRequest {
    name: String,
    description: String,
}

// Response for project-related commands
#[derive(Serialize)]
pub struct ProjectResponse {
    success: bool,
    project: Option<Project>,
    error: Option<String>,
}

// Request for loading a project
#[derive(Deserialize)]
#[allow(dead_code)] // This field is used for deserialization
pub struct LoadProjectRequest {
    file_path: String,
}

// Response for save operations that include file path
#[derive(Serialize)]
pub struct SaveResponse {
    #[serde(rename = "filePath")]
    file_path: String,
}

// Create a new project command
#[command]
pub fn create_new_project_cmd(name: &str, description: &str) -> Result<Project, String> {
    let project = crate::core::project_manager::create_new_project(name, description);
    Ok(project)
}

// Load a project from file command
#[command]
pub fn load_project_cmd(file_path: &str) -> Result<Project, String> {
    match crate::core::project_manager::load_project_from_file(file_path) {
        Ok(project) => Ok(project),
        Err(err) => Err(format!("Failed to load project: {}", err)),
    }
}

// Save a project to file command - handles both new files and existing files
#[command]
pub fn save_project_cmd(project: Value, file_path: Option<String>) -> Result<(), String> {
    println!("save_project_cmd called with file_path: {:?}", file_path);

    // Parse the project from JSON Value
    let parsed_project: Project = serde_json::from_value(project)
        .map_err(|e| format!("Failed to parse project data: {}", e))?;

    println!("Parsed project: {}", parsed_project.name);

    // If no file path provided, this is an error since we need a path to save
    let path = file_path.ok_or_else(|| "No file path provided for save operation".to_string())?;

    println!("Attempting to save to: {}", path);

    match crate::core::project_manager::save_project_to_file(&parsed_project, &path) {
        Ok(_) => {
            println!("Project saved successfully to: {}", path);
            Ok(())
        }
        Err(err) => {
            println!("Failed to save project to {}: {}", path, err);
            Err(format!("Failed to save project: {}", err))
        }
    }
}

// Save a project with file dialog (Save As functionality) - For Tauri v2
#[command]
pub async fn save_project_as_cmd(
    app_handle: tauri::AppHandle,
    project: Value,
) -> Result<SaveResponse, String> {
    println!("save_project_as_cmd called");

    // Parse the project from JSON Value
    let parsed_project: Project = serde_json::from_value(project)
        .map_err(|e| format!("Failed to parse project data: {}", e))?;

    println!("Parsed project for save as: {}", parsed_project.name);

    // Get the window to show the save dialog
    let _window = app_handle
        .get_webview_window("main")
        .ok_or_else(|| "Could not get main window".to_string())?;

    // For Tauri v2, we need to use a different approach for file dialogs
    // Since the dialog API has changed, let's use a simpler approach
    // You might need to implement this using the file system API or a custom solution

    // For now, let's generate a default filename and save to documents
    use std::env;

    let project_name = parsed_project
        .name
        .replace(|c: char| !c.is_alphanumeric() && c != '_' && c != '-', "_");
    let filename = format!("{}.ark", project_name);

    // Try to get the documents directory, fallback to current directory
    let documents_dir = dirs::document_dir()
        .or_else(|| env::current_dir().ok())
        .ok_or_else(|| "Could not determine save directory".to_string())?;

    let file_path = documents_dir.join(&filename);
    let path_str = file_path.to_string_lossy().to_string();

    println!("Saving to: {}", path_str);

    match crate::core::project_manager::save_project_to_file(&parsed_project, &path_str) {
        Ok(_) => {
            println!("Project saved successfully to: {}", path_str);
            Ok(SaveResponse {
                file_path: path_str,
            })
        }
        Err(err) => {
            println!("Failed to save project to {}: {}", path_str, err);
            Err(format!("Failed to save project: {}", err))
        }
    }
}

// Update an event in a project (for real-time saving)
#[command]
pub fn update_event(
    project_id: String,
    timeline_id: String,
    event: Value,
) -> Result<Value, String> {
    // This is a simplified version - in reality, you'd want to:
    // 1. Load the project from storage
    // 2. Update the specific event
    // 3. Save the project back
    // For now, we'll just return the event as confirmation

    println!(
        "Updating event in project {} timeline {}",
        project_id, timeline_id
    );
    Ok(event)
}

#[command]
pub fn document_dir() -> Result<String, String> {
    dirs::document_dir()
        .map(|path| path.to_string_lossy().to_string())
        .ok_or_else(|| "Could not resolve the documents directory".to_string())
}
