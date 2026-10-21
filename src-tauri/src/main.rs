#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod core;

use commands::project_commands;
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use tauri::Manager;

fn port_open(port: u16) -> bool {
    TcpStream::connect(("127.0.0.1", port)).is_ok()
}

fn repo_root(app: &tauri::AppHandle) -> PathBuf {
    if let Ok(resource_dir) = app.path().resource_dir() {
        if resource_dir.join("tools").join("geo-http.mjs").exists() {
            return resource_dir;
        }
    }
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .to_path_buf()
}

fn spawn_node(root: &Path, script: &str) {
    let path = root.join(script);
    if !path.exists() {
        return;
    }
    let _ = Command::new("node")
        .arg(path)
        .current_dir(root)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn();
}

fn start_local_services(app: &tauri::AppHandle) {
    let root = repo_root(app);
    if !port_open(8797) {
        spawn_node(&root, "tools/setup-http.mjs");
    }
    if !port_open(8788) {
        spawn_node(&root, "tools/geo-http.mjs");
    }
    if !port_open(8799) {
        spawn_node(&root, "mcp/skeletonkey-mcp.mjs");
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            start_local_services(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            project_commands::create_new_project_cmd,
            project_commands::load_project_cmd,
            project_commands::save_project_cmd,
            project_commands::save_project_as_cmd,
            project_commands::update_event,
            project_commands::document_dir
        ])
        .run(tauri::generate_context!())
        .expect("error while running SkeletonKey");
}
