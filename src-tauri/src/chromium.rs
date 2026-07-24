use serde::Serialize;
use std::env;
use std::fs;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use tauri::{AppHandle, Manager, State};
use tokio::sync::{Mutex as AsyncMutex, oneshot};

const CHROMIUM_PROFILE_DIR: &str = "chromium-profile";
const CHROMIUM_ARTIFACT_DIR: &str = "chromium-artifacts";
const MAX_IMAGE_DATA_URL_LENGTH: usize = 20_000_000;
static ARTIFACT_SEQUENCE: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChromiumStatus {
    available: bool,
    executable: Option<String>,
    version: Option<String>,
    installing: bool,
    install_supported: bool,
    install_package: Option<String>,
}

#[derive(Default)]
pub struct ChromiumManager {
    browser: Mutex<Option<Child>>,
    install_cancel: AsyncMutex<Option<oneshot::Sender<()>>>,
    installing: AtomicBool,
}

impl Drop for ChromiumManager {
    fn drop(&mut self) {
        if let Ok(browser) = self.browser.get_mut()
            && let Some(child) = browser.as_mut()
        {
            let _ = child.kill();
        }
    }
}

#[tauri::command]
pub fn read_chromium_status(manager: State<'_, ChromiumManager>) -> ChromiumStatus {
    chromium_status(manager.installing.load(Ordering::SeqCst))
}

#[tauri::command]
pub fn open_chromium_target(
    app: AppHandle,
    manager: State<'_, ChromiumManager>,
    target: String,
) -> Result<(), String> {
    let target = validated_target(&target)?;
    open_target(&app, &manager, target)
}

#[tauri::command]
pub fn open_chromium_image(
    app: AppHandle,
    manager: State<'_, ChromiumManager>,
    data_url: String,
) -> Result<(), String> {
    validate_image_data_url(&data_url)?;
    let directory = app
        .path()
        .home_dir()
        .map(|home| home.join(".codex").join(CHROMIUM_ARTIFACT_DIR))
        .map_err(|error| error.to_string())?;
    create_private_directory(&directory)?;
    prune_artifacts(&directory);
    let path = directory.join(format!(
        "generated-{}-{}.html",
        std::process::id(),
        ARTIFACT_SEQUENCE.fetch_add(1, Ordering::Relaxed)
    ));
    write_image_document(&path, &data_url)?;
    open_target(&app, &manager, path.to_string_lossy().into_owned())
}

fn open_target(app: &AppHandle, manager: &ChromiumManager, target: String) -> Result<(), String> {
    let executable = discover_chromium().ok_or_else(|| "Chromium is not installed".to_string())?;
    let profile = chromium_profile(app)?;
    create_private_directory(&profile)?;
    let mut browser = manager
        .browser
        .lock()
        .map_err(|_| "Chromium process lock is unavailable".to_string())?;
    if let Some(child) = browser.as_mut() {
        match child.try_wait() {
            Ok(None) => {
                spawn_chromium(&executable, &profile, &target, LaunchMode::NewTab)?;
                return Ok(());
            }
            Ok(Some(_)) | Err(_) => *browser = None,
        }
    }
    *browser = Some(spawn_chromium(
        &executable,
        &profile,
        &target,
        LaunchMode::FirstWindow,
    )?);
    Ok(())
}

fn validate_image_data_url(data_url: &str) -> Result<(), String> {
    if data_url.len() > MAX_IMAGE_DATA_URL_LENGTH {
        return Err("Generated image is too large to open".into());
    }
    let payload = [
        "data:image/png;base64,",
        "data:image/jpeg;base64,",
        "data:image/gif;base64,",
        "data:image/webp;base64,",
        "data:image/svg+xml;base64,",
    ]
    .into_iter()
    .find_map(|prefix| data_url.strip_prefix(prefix))
    .filter(|payload| !payload.is_empty())
    .ok_or_else(|| "Generated image data is invalid".to_string())?;
    if !payload
        .bytes()
        .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'+' | b'/' | b'='))
    {
        return Err("Generated image data is invalid".into());
    }
    Ok(())
}

fn write_image_document(path: &Path, data_url: &str) -> Result<(), String> {
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(path).map_err(|error| error.to_string())?;
    file.write_all(b"<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'><meta http-equiv=Content-Security-Policy content=\"default-src 'none'; img-src data:; style-src 'unsafe-inline'\"><title>Codex generated image</title><style>html,body{height:100%;margin:0;background:#181817}body{display:grid;place-items:center}img{max-width:100%;max-height:100%;object-fit:contain}</style><img alt='Codex generated image' src='")
        .and_then(|_| file.write_all(data_url.as_bytes()))
        .and_then(|_| file.write_all(b"'>"))
        .map_err(|error| error.to_string())
}

fn prune_artifacts(directory: &Path) {
    let Ok(entries) = fs::read_dir(directory) else {
        return;
    };
    let mut artifacts = entries
        .flatten()
        .filter(|entry| {
            entry
                .path()
                .extension()
                .is_some_and(|value| value == "html")
        })
        .filter_map(|entry| {
            let modified = entry.metadata().ok()?.modified().ok()?;
            Some((modified, entry.path()))
        })
        .collect::<Vec<_>>();
    artifacts.sort_by_key(|(modified, _)| *modified);
    let remove_count = artifacts.len().saturating_sub(19);
    for (_, path) in artifacts.into_iter().take(remove_count) {
        let _ = fs::remove_file(path);
    }
}

#[tauri::command]
pub async fn install_chromium(
    manager: State<'_, ChromiumManager>,
    confirmed: bool,
) -> Result<ChromiumStatus, String> {
    if !confirmed {
        return Err("Chromium installation requires explicit confirmation".into());
    }
    if discover_chromium().is_some() {
        return Ok(chromium_status(false));
    }
    if manager.installing.swap(true, Ordering::SeqCst) {
        return Err("Chromium installation is already running".into());
    }
    let result = run_installation(&manager).await;
    manager.installing.store(false, Ordering::SeqCst);
    manager.install_cancel.lock().await.take();
    result?;
    let status = chromium_status(false);
    if status.available {
        Ok(status)
    } else {
        Err("Chromium installation completed but no executable was found".into())
    }
}

#[tauri::command]
pub async fn cancel_chromium_install(manager: State<'_, ChromiumManager>) -> Result<bool, String> {
    Ok(manager
        .install_cancel
        .lock()
        .await
        .take()
        .is_some_and(|cancel| cancel.send(()).is_ok()))
}

async fn run_installation(manager: &ChromiumManager) -> Result<(), String> {
    let plan = install_plan().ok_or_else(|| {
        "Automatic Chromium installation is not supported on this distribution".to_string()
    })?;
    let pkexec = find_in_path("pkexec").ok_or_else(|| "pkexec is not installed".to_string())?;
    let mut child = tokio::process::Command::new(pkexec)
        .arg(plan.program)
        .args(plan.args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .kill_on_drop(true)
        .spawn()
        .map_err(|error| format!("Unable to start Chromium installation: {error}"))?;
    let (cancel, cancelled) = oneshot::channel();
    *manager.install_cancel.lock().await = Some(cancel);
    tokio::select! {
        status = child.wait() => {
            let status = status.map_err(|error| format!("Chromium installation failed: {error}"))?;
            if status.success() { Ok(()) } else { Err(format!("Chromium installation exited with {status}")) }
        }
        _ = cancelled => {
            child.kill().await.map_err(|error| format!("Unable to cancel Chromium installation: {error}"))?;
            Err("Chromium installation was cancelled".into())
        }
    }
}

fn chromium_status(installing: bool) -> ChromiumStatus {
    let executable = discover_chromium();
    let plan = install_plan();
    ChromiumStatus {
        available: executable.is_some(),
        version: executable.as_deref().and_then(chromium_version),
        executable: executable.map(|path| path.to_string_lossy().into_owned()),
        installing,
        install_supported: plan.is_some() && find_in_path("pkexec").is_some(),
        install_package: plan.map(|candidate| candidate.package.to_string()),
    }
}

fn discover_chromium() -> Option<PathBuf> {
    if let Some(override_path) = env::var_os("CODEX_CHROMIUM_EXECUTABLE") {
        let path = PathBuf::from(override_path);
        if is_executable_file(&path) {
            return Some(path);
        }
    }
    ["chromium", "chromium-browser"]
        .into_iter()
        .find_map(find_in_path)
}

fn find_in_path(name: &str) -> Option<PathBuf> {
    env::split_paths(&env::var_os("PATH")?)
        .map(|directory| directory.join(name))
        .find(|path| is_executable_file(path))
}

fn is_executable_file(path: &Path) -> bool {
    let Ok(metadata) = path.metadata() else {
        return false;
    };
    if !metadata.is_file() {
        return false;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        metadata.permissions().mode() & 0o111 != 0
    }
    #[cfg(not(unix))]
    true
}

fn chromium_version(executable: &Path) -> Option<String> {
    let output = Command::new(executable).arg("--version").output().ok()?;
    output.status.success().then(|| {
        String::from_utf8_lossy(&output.stdout)
            .trim()
            .chars()
            .take(200)
            .collect()
    })
}

fn chromium_profile(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .home_dir()
        .map(|home| home.join(".codex").join(CHROMIUM_PROFILE_DIR))
        .map_err(|error| error.to_string())
}

fn create_private_directory(path: &Path) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|error| error.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o700))
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

enum LaunchMode {
    FirstWindow,
    NewTab,
}

fn spawn_chromium(
    executable: &Path,
    profile: &Path,
    target: &str,
    mode: LaunchMode,
) -> Result<Child, String> {
    let mut command = Command::new(executable);
    command
        .arg(format!("--user-data-dir={}", profile.display()))
        .args(["--no-first-run", "--no-default-browser-check"])
        .arg(match mode {
            LaunchMode::FirstWindow => "--new-window",
            LaunchMode::NewTab => "--new-tab",
        })
        .arg(target)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("Unable to start Chromium: {error}"))
}

fn validated_target(target: &str) -> Result<String, String> {
    if target.len() > 32_768 || target.contains(['\0', '\n', '\r']) {
        return Err("Invalid Chromium target".into());
    }
    if target.starts_with("https://") || target.starts_with("http://") {
        return Ok(target.to_string());
    }
    let path = Path::new(target);
    if !path.is_absolute() {
        return Err("Chromium target must be an HTTP(S) URL or absolute path".into());
    }
    let canonical = path
        .canonicalize()
        .map_err(|error| format!("Unable to open media target: {error}"))?;
    if !canonical.is_file() || !supported_media_path(&canonical) {
        return Err("Chromium target is not a supported media file".into());
    }
    Ok(canonical.to_string_lossy().into_owned())
}

fn supported_media_path(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            matches!(
                extension.to_ascii_lowercase().as_str(),
                "png"
                    | "jpg"
                    | "jpeg"
                    | "gif"
                    | "webp"
                    | "svg"
                    | "pdf"
                    | "html"
                    | "htm"
                    | "txt"
                    | "mp3"
                    | "wav"
                    | "ogg"
                    | "mp4"
                    | "webm"
            )
        })
}

struct InstallPlan {
    program: &'static str,
    args: &'static [&'static str],
    package: &'static str,
}

fn install_plan() -> Option<InstallPlan> {
    let os_release = fs::read_to_string("/etc/os-release").ok()?;
    install_plan_for(&os_release)
}

fn install_plan_for(os_release: &str) -> Option<InstallPlan> {
    let id = os_release.lines().find_map(|line| {
        line.strip_prefix("ID=")
            .map(|value| value.trim_matches(['\'', '"']))
    })?;
    match id {
        "ubuntu" => Some(InstallPlan {
            program: "apt-get",
            args: &["install", "-y", "chromium-browser"],
            package: "chromium-browser",
        }),
        "debian" => Some(InstallPlan {
            program: "apt-get",
            args: &["install", "-y", "chromium"],
            package: "chromium",
        }),
        "fedora" => Some(InstallPlan {
            program: "dnf",
            args: &["install", "-y", "chromium"],
            package: "chromium",
        }),
        "arch" | "manjaro" => Some(InstallPlan {
            program: "pacman",
            args: &["-S", "--noconfirm", "chromium"],
            package: "chromium",
        }),
        _ => None,
    }
}

#[cfg(test)]
#[path = "chromium_tests.rs"]
mod tests;
