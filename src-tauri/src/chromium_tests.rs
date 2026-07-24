use super::*;

#[test]
fn accepts_safe_urls_and_supported_existing_media() {
    assert_eq!(
        validated_target("https://example.com/path").unwrap(),
        "https://example.com/path"
    );
    assert!(validated_target("javascript:alert(1)").is_err());
    assert!(validated_target("relative/image.png").is_err());

    let directory = std::env::temp_dir().join(format!("codex-media-{}", std::process::id()));
    fs::create_dir_all(&directory).unwrap();
    let image = directory.join("preview.png");
    fs::write(&image, b"png").unwrap();
    assert_eq!(
        validated_target(image.to_str().unwrap()).unwrap(),
        image.canonicalize().unwrap().to_string_lossy()
    );
    let executable = directory.join("payload.sh");
    fs::write(&executable, b"echo unsafe").unwrap();
    assert!(validated_target(executable.to_str().unwrap()).is_err());
    fs::remove_dir_all(directory).unwrap();
}

#[test]
fn chooses_only_predefined_distribution_install_plans() {
    let ubuntu = install_plan_for("NAME=Ubuntu\nID=ubuntu\n").unwrap();
    assert_eq!(ubuntu.program, "apt-get");
    assert_eq!(ubuntu.args, ["install", "-y", "chromium-browser"]);
    assert_eq!(ubuntu.package, "chromium-browser");

    let fedora = install_plan_for("ID=fedora\n").unwrap();
    assert_eq!(fedora.program, "dnf");
    assert_eq!(fedora.package, "chromium");
    assert!(install_plan_for("ID=unknown\n").is_none());
}

#[test]
fn supported_media_extensions_are_case_insensitive_and_bounded() {
    assert!(supported_media_path(Path::new("/tmp/report.PDF")));
    assert!(supported_media_path(Path::new("/tmp/video.webm")));
    assert!(!supported_media_path(Path::new("/tmp/archive.zip")));
    assert!(validated_target(&format!("https://example.com/{}", "a".repeat(40_000))).is_err());
}

#[test]
fn accepts_only_bounded_base64_image_data() {
    assert!(validate_image_data_url("data:image/png;base64,iVBORw0KGgo=").is_ok());
    assert!(validate_image_data_url("data:image/svg+xml;base64,PHN2Zz4=").is_ok());
    assert!(validate_image_data_url("data:text/html;base64,PHNjcmlwdD4=").is_err());
    assert!(validate_image_data_url("data:image/png;base64,<script>").is_err());
    assert!(validate_image_data_url("data:image/png;base64,").is_err());
}
