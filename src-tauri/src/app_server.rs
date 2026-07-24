use serde::Serialize;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{ChildStdin, Command};
use tokio::sync::Mutex;

#[derive(Default)]
struct AppServerProcess {
    generation: u64,
    initialized: bool,
    stdin: Option<ChildStdin>,
}

#[derive(Default)]
pub(crate) struct AppServer(Arc<Mutex<AppServerProcess>>);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppServerExit {
    code: Option<i32>,
    message: Option<String>,
}

#[tauri::command]
pub(crate) async fn start_app_server(
    app: AppHandle,
    state: State<'_, AppServer>,
) -> Result<bool, String> {
    let mut process = state.0.lock().await;
    if process.stdin.is_some() {
        return Ok(!process.initialized);
    }

    let executable = find_codex_executable();
    let mut command = Command::new(&executable);
    command
        .arg("app-server")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    let mut child = command.spawn().map_err(|error| {
        format!(
            "Impossible de lancer `{} app-server`: {error}",
            executable.display()
        )
    })?;
    let stdin = child.stdin.take().ok_or("stdin indisponible")?;
    let stdout = child.stdout.take().ok_or("stdout indisponible")?;
    let stderr = child.stderr.take().ok_or("stderr indisponible")?;

    process.generation = process.generation.wrapping_add(1);
    process.initialized = false;
    let generation = process.generation;
    process.stdin = Some(stdin);
    drop(process);

    let output_app = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut lines = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = output_app.emit("app-server-message", line);
        }
    });

    let log_app = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut lines = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = log_app.emit("app-server-log", line);
        }
    });

    let shared_process = state.0.clone();
    tauri::async_runtime::spawn(async move {
        let exit = match child.wait().await {
            Ok(status) => AppServerExit {
                code: status.code(),
                message: None,
            },
            Err(error) => AppServerExit {
                code: None,
                message: Some(error.to_string()),
            },
        };
        let mut process = shared_process.lock().await;
        if process.generation != generation {
            return;
        }
        process.stdin = None;
        process.initialized = false;
        drop(process);
        let _ = app.emit("app-server-exited", exit);
    });

    Ok(true)
}

#[tauri::command]
pub(crate) async fn send_app_server(
    message: String,
    state: State<'_, AppServer>,
) -> Result<(), String> {
    let mut process = state.0.lock().await;
    let stdin = process.stdin.as_mut().ok_or("app-server non démarré")?;
    let result = async {
        stdin.write_all(format!("{message}\n").as_bytes()).await?;
        stdin.flush().await
    }
    .await;
    if let Err(error) = result {
        process.stdin = None;
        process.initialized = false;
        return Err(error.to_string());
    }
    if is_initialized_notification(&message) {
        process.initialized = true;
    }
    Ok(())
}

fn is_initialized_notification(message: &str) -> bool {
    serde_json::from_str::<serde_json::Value>(message)
        .ok()
        .and_then(|value| {
            value
                .get("method")
                .and_then(|method| method.as_str())
                .map(str::to_owned)
        })
        .is_some_and(|method| method == "initialized")
}

fn find_codex_executable() -> PathBuf {
    if let Some(path) = std::env::var_os("CODEX_EXECUTABLE") {
        return path.into();
    }
    for directory in std::env::split_paths(&std::env::var_os("PATH").unwrap_or_default()) {
        let candidate = directory.join("codex");
        if candidate.is_file() {
            return candidate;
        }
    }
    if let Some(home) = std::env::var_os("HOME") {
        let versions = PathBuf::from(home).join(".nvm/versions/node");
        if let Ok(entries) = std::fs::read_dir(versions) {
            let mut candidates = entries
                .filter_map(Result::ok)
                .map(|entry| entry.path().join("bin/codex"))
                .filter(|path| path.is_file())
                .collect::<Vec<_>>();
            candidates.sort();
            if let Some(candidate) = candidates.pop() {
                return candidate;
            }
        }
    }
    PathBuf::from("codex")
}

#[cfg(test)]
#[path = "app_server_tests.rs"]
mod tests;
