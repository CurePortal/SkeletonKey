use crate::core::data_models::Project;
use crate::core::error::AppError;
use chrono::Utc;
use std::fs;
use std::path::Path;
use uuid::Uuid;

// Create a new project (core business logic - not a Tauri command)
pub fn create_new_project(name: &str, description: &str) -> Project {
    let now = Utc::now().to_rfc3339();

    Project {
        id: Uuid::new_v4().to_string(),
        name: name.to_string(),
        description: Some(description.to_string()),
        created_at: now.clone(),
        updated_at: now.clone(),
        timelines: Vec::new(),
        characters: Vec::new(),
        locations: Vec::new(),
        technologies: Vec::new(),
        cultures: Vec::new(),
        source_documents: Vec::new(),
        narratives: Vec::new(), // Add narratives field
        version: "1.0".to_string(),
    }
}

// Load a project from file (core business logic - not a Tauri command)
pub fn load_project_from_file(path: &str) -> Result<Project, AppError> {
    println!("Loading project from: {}", path);

    let file_content = fs::read_to_string(path)
        .map_err(|e| AppError::FileError(format!("Failed to read file: {}", e)))?;

    let mut project: Project = serde_json::from_str(&file_content)
        .map_err(|e| AppError::ParseError(format!("Failed to parse project: {}", e)))?;

    // Ensure the project has a narratives field (for backwards compatibility)
    if project.narratives.is_empty() && project.version == "1.0" {
        project.narratives = Vec::new();
    }

    println!("Successfully loaded project: {}", project.name);
    Ok(project)
}

// Save a project to file (core business logic - not a Tauri command)
pub fn save_project_to_file(project: &Project, path: &str) -> Result<(), AppError> {
    println!("Saving project to: {}", path);

    // Update the timestamp
    let mut project_to_save = project.clone();
    project_to_save.updated_at = Utc::now().to_rfc3339();

    let json = serde_json::to_string_pretty(&project_to_save)
        .map_err(|e| AppError::SerializeError(format!("Failed to serialize project: {}", e)))?;

    // Ensure the directory exists
    if let Some(parent) = Path::new(path).parent() {
        fs::create_dir_all(parent)
            .map_err(|e| AppError::FileError(format!("Failed to create directory: {}", e)))?;
    }

    fs::write(path, json)
        .map_err(|e| AppError::FileError(format!("Failed to write file: {}", e)))?;

    println!("Successfully saved project to: {}", path);
    Ok(())
}

// Check if a file exists (utility function)
#[allow(dead_code)] // This function might be useful in the future
pub fn file_exists(path: &str) -> bool {
    Path::new(path).exists()
}
