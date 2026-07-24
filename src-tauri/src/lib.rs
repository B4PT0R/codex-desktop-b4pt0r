mod app_server;
mod chromium;
mod desktop_settings;
mod startup;

use app_server::{AppServer, send_app_server, start_app_server};
use chromium::{
    ChromiumManager, cancel_chromium_install, install_chromium, open_chromium_image,
    open_chromium_target, read_chromium_status,
};
use desktop_settings::{read_desktop_settings, update_desktop_settings};
use startup::{read_launch_at_login, set_launch_at_login};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppServer::default())
        .manage(ChromiumManager::default())
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            show_main_window(app)
        }))
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .arg("--hidden")
                .app_name("Codex Desktop")
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let open = MenuItem::with_id(app, "open", "Ouvrir Codex", true, None::<&str>)?;
            let new_chat = MenuItem::with_id(app, "new-chat", "Nouveau chat", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quitter", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &new_chat, &quit])?;
            TrayIconBuilder::new()
                .icon(
                    app.default_window_icon()
                        .cloned()
                        .expect("application icon"),
                )
                .tooltip("Codex Desktop")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_main_window(app),
                    "new-chat" => {
                        show_main_window(app);
                        let _ = app.emit("new-chat", ());
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;
            if std::env::args().any(|arg| arg == "--hidden")
                && let Some(window) = app.get_webview_window("main")
            {
                let _ = window.hide();
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            start_app_server,
            send_app_server,
            read_desktop_settings,
            update_desktop_settings,
            read_launch_at_login,
            set_launch_at_login,
            read_chromium_status,
            open_chromium_target,
            open_chromium_image,
            install_chromium,
            cancel_chromium_install
        ])
        .run(tauri::generate_context!())
        .expect("error while running Codex Desktop");
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}
