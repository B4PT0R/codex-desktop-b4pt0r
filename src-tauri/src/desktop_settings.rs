use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

const SETTINGS_FILE: &str = "codex-desktop-linux.json";
const SETTINGS_VERSION: u32 = 1;

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSettings {
    pub version: u32,
    pub locale: Option<String>,
    pub last_workspace: Option<String>,
    pub theme: Option<String>,
    pub font_size: Option<String>,
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSettingsPatch {
    pub locale: Option<String>,
    pub last_workspace: Option<String>,
    pub theme: Option<String>,
    pub font_size: Option<String>,
}

#[tauri::command]
pub fn read_desktop_settings(app: AppHandle) -> Result<DesktopSettings, String> {
    let path = settings_path(&app).map_err(|error| error.to_string())?;
    read_settings(&path).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn update_desktop_settings(
    app: AppHandle,
    patch: DesktopSettingsPatch,
) -> Result<DesktopSettings, String> {
    let path = settings_path(&app).map_err(|error| error.to_string())?;
    update_settings(&path, patch).map_err(|error| error.to_string())
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, std::io::Error> {
    let home = app
        .path()
        .home_dir()
        .map_err(|error| std::io::Error::other(error.to_string()))?;
    Ok(home.join(".codex").join(SETTINGS_FILE))
}

fn read_settings(path: &Path) -> Result<DesktopSettings, std::io::Error> {
    if !path.exists() {
        return Ok(DesktopSettings {
            version: SETTINGS_VERSION,
            ..DesktopSettings::default()
        });
    }
    let bytes = fs::read(path)?;
    let mut settings: DesktopSettings = serde_json::from_slice(&bytes)
        .map_err(|error| std::io::Error::new(std::io::ErrorKind::InvalidData, error))?;
    if settings.version == 0 {
        settings.version = SETTINGS_VERSION;
    }
    Ok(settings)
}

fn update_settings(
    path: &Path,
    patch: DesktopSettingsPatch,
) -> Result<DesktopSettings, std::io::Error> {
    validate_patch(&patch)?;
    let mut document = read_document(path)?;
    document.insert("version".into(), Value::from(SETTINGS_VERSION));
    if let Some(locale) = patch.locale {
        document.insert("locale".into(), Value::from(locale));
    }
    if let Some(last_workspace) = patch.last_workspace {
        document.insert("lastWorkspace".into(), Value::from(last_workspace));
    }
    if let Some(theme) = patch.theme {
        document.insert("theme".into(), Value::from(theme));
    }
    if let Some(font_size) = patch.font_size {
        document.insert("fontSize".into(), Value::from(font_size));
    }
    write_document(path, &document)?;
    serde_json::from_value(Value::Object(document))
        .map_err(|error| std::io::Error::new(std::io::ErrorKind::InvalidData, error))
}

fn validate_patch(patch: &DesktopSettingsPatch) -> Result<(), std::io::Error> {
    if let Some(locale) = patch.locale.as_deref()
        && locale != "fr"
        && locale != "en"
    {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "locale must be fr or en",
        ));
    }
    if patch
        .last_workspace
        .as_ref()
        .is_some_and(|path| path.len() > 32_768)
    {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "lastWorkspace is too long",
        ));
    }
    if let Some(theme) = patch.theme.as_deref()
        && theme != "system"
        && theme != "dark"
        && theme != "light"
    {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "theme must be system, dark, or light",
        ));
    }
    if let Some(font_size) = patch.font_size.as_deref()
        && font_size != "small"
        && font_size != "default"
        && font_size != "large"
    {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "fontSize must be small, default, or large",
        ));
    }
    Ok(())
}

fn read_document(path: &Path) -> Result<Map<String, Value>, std::io::Error> {
    if !path.exists() {
        return Ok(Map::new());
    }
    let value: Value = serde_json::from_slice(&fs::read(path)?)
        .map_err(|error| std::io::Error::new(std::io::ErrorKind::InvalidData, error))?;
    value.as_object().cloned().ok_or_else(|| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "desktop settings must contain a JSON object",
        )
    })
}

fn write_document(path: &Path, document: &Map<String, Value>) -> Result<(), std::io::Error> {
    let parent = path.parent().ok_or_else(|| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "settings path has no parent",
        )
    })?;
    fs::create_dir_all(parent)?;
    let temporary = parent.join(format!(".{SETTINGS_FILE}.{}.tmp", std::process::id()));
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(&temporary)?;
    let bytes = serde_json::to_vec_pretty(&Value::Object(document.clone()))
        .map_err(std::io::Error::other)?;
    let result = (|| {
        file.write_all(&bytes)?;
        file.write_all(b"\n")?;
        file.sync_all()?;
        fs::rename(&temporary, path)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}

#[cfg(test)]
#[path = "desktop_settings_tests.rs"]
mod tests;
