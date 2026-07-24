use super::*;
use std::time::{SystemTime, UNIX_EPOCH};

fn temporary_settings_path() -> PathBuf {
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock")
        .as_nanos();
    std::env::temp_dir()
        .join(format!("codex-desktop-linux-settings-{unique}"))
        .join(SETTINGS_FILE)
}

#[test]
fn updates_settings_atomically_and_preserves_unknown_fields() {
    let path = temporary_settings_path();
    fs::create_dir_all(path.parent().expect("parent")).expect("create test directory");
    fs::write(
        &path,
        r#"{"version":1,"locale":"fr","futureSetting":{"enabled":true}}"#,
    )
    .expect("seed settings");

    let settings = update_settings(
        &path,
        DesktopSettingsPatch {
            locale: Some("en".into()),
            last_workspace: Some("/work/codex".into()),
            theme: Some("light".into()),
            font_size: Some("large".into()),
        },
    )
    .expect("update settings");

    assert_eq!(
        settings,
        DesktopSettings {
            version: 1,
            locale: Some("en".into()),
            last_workspace: Some("/work/codex".into()),
            theme: Some("light".into()),
            font_size: Some("large".into()),
        }
    );
    let document: Value =
        serde_json::from_slice(&fs::read(&path).expect("read settings")).expect("valid JSON");
    assert_eq!(document["futureSetting"]["enabled"], true);

    fs::remove_dir_all(path.parent().expect("parent")).expect("remove test directory");
}

#[test]
fn rejects_invalid_values_without_replacing_existing_settings() {
    let path = temporary_settings_path();
    fs::create_dir_all(path.parent().expect("parent")).expect("create test directory");
    fs::write(&path, r#"{"version":1,"locale":"fr"}"#).expect("seed settings");

    let error = update_settings(
        &path,
        DesktopSettingsPatch {
            locale: Some("invalid".into()),
            last_workspace: None,
            theme: None,
            font_size: None,
        },
    )
    .expect_err("invalid locale");

    assert_eq!(error.kind(), std::io::ErrorKind::InvalidInput);
    assert_eq!(
        read_settings(&path)
            .expect("unchanged settings")
            .locale
            .as_deref(),
        Some("fr")
    );
    fs::remove_dir_all(path.parent().expect("parent")).expect("remove test directory");
}

#[test]
fn rejects_invalid_appearance_values() {
    let path = temporary_settings_path();
    let error = update_settings(
        &path,
        DesktopSettingsPatch {
            locale: None,
            last_workspace: None,
            theme: Some("sepia".into()),
            font_size: Some("huge".into()),
        },
    )
    .expect_err("invalid appearance");

    assert_eq!(error.kind(), std::io::ErrorKind::InvalidInput);
    assert!(!path.exists());
}
