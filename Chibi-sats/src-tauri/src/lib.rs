use tauri::{
    menu::{ContextMenu, Menu, MenuItem, CheckMenuItem},
    Emitter, Manager, PhysicalPosition,
};

struct MenuState(Menu<tauri::Wry>);

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn show_context_menu(
    window: tauri::Window,
    menu_state: tauri::State<'_, MenuState>,
) -> Result<(), String> {
    menu_state.0.popup(window).map_err(|e| e.to_string())
}

use tauri_plugin_autostart::ManagerExt;

#[tauri::command]
async fn set_autostart(app_handle: tauri::AppHandle, enable: bool) -> Result<(), String> {
    if enable {
        app_handle.autolaunch().enable().map_err(|e| e.to_string())
    } else {
        app_handle.autolaunch().disable().map_err(|e| e.to_string())
    }
}

#[tauri::command]
async fn get_autostart_status(app_handle: tauri::AppHandle) -> Result<bool, String> {
    app_handle.autolaunch().is_enabled().map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(Default::default(), None))
        .invoke_handler(tauri::generate_handler![greet, show_context_menu, set_autostart, get_autostart_status])
        .setup(|app| {
            let handle = app.handle();

            // Get the main window
            let window = app.get_webview_window("main").unwrap();

            // Get the primary monitor
            if let Some(monitor) = window.primary_monitor().unwrap() {
                let screen_size = monitor.size();
                let window_size = window.outer_size().unwrap();

                // Calculate position for bottom-right corner
                let x = screen_size.width - window_size.width - 10; // 10px padding from right
                let y = screen_size.height - window_size.height - 50; // 50px padding from bottom

                window.set_position(PhysicalPosition::new(x, y)).unwrap();
            }

            // Temporarily keep the window on top, then disable it
            let window_clone = window.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(2)); // Wait for 2 seconds
                window_clone.set_always_on_top(false).unwrap();
            });

            // Create menu items
            let tf_24h = CheckMenuItem::with_id(handle, "24h", "24 hours", true, true, None::<&str>)?;
            let tf_1w = CheckMenuItem::with_id(handle, "1w", "1 week", true, false, None::<&str>)?;
            let tf_1m = CheckMenuItem::with_id(handle, "1m", "1 month", true, false, None::<&str>)?;
            let tf_1y = CheckMenuItem::with_id(handle, "1y", "1 year", true, false, None::<&str>)?;
            let theme_light = CheckMenuItem::with_id(handle, "theme_light", "Light", true, true, None::<&str>)?;
            let theme_dark = CheckMenuItem::with_id(handle, "theme_dark", "Dark", true, false, None::<&str>)?;

            // Create the Submenu object for themes
            let theme_submenu = tauri::menu::Submenu::with_items(
                handle,
                "Themes",
                true,
                &[
                    &theme_light,
                    &theme_dark,
                ],
            )?;

            let autostart_status = handle.autolaunch().is_enabled().unwrap_or(false);
            let autostart_item = CheckMenuItem::with_id(handle, "autostart", "Launch at startup", true, autostart_status, None::<&str>)?;
            let quit = MenuItem::with_id(handle, "quit", "Close Application", true, None::<&str>)?;

            // Create the Submenu object with items
            let timeframe_submenu = tauri::menu::Submenu::with_items(
                handle,
                "Timeframes",
                true,
                &[
                    &tf_24h,
                    &tf_1w,
                    &tf_1m,
                    &tf_1y,
                ],
            )?;

            let menu = Menu::with_items(
                handle,
                &[
                    &timeframe_submenu,
                    &theme_submenu, // Add the theme submenu here
                    &tauri::menu::PredefinedMenuItem::separator(handle)?,
                    &autostart_item,
                    &quit,
                ],
            )?;

            let _handle_clone = handle.clone();
            let tf_24h_clone = tf_24h.clone();
            let tf_1w_clone = tf_1w.clone();
            let tf_1m_clone = tf_1m.clone();
            let tf_1y_clone = tf_1y.clone();
            let autostart_item_clone = autostart_item.clone();
            let theme_light_clone = theme_light.clone();
            let theme_dark_clone = theme_dark.clone();

            app.on_menu_event(move |app_handle, event| {
                let id = event.id.0.as_str();
                match id {
                    "24h" | "1w" | "1m" | "1y" => {
                        tf_24h_clone.set_checked(id == "24h").unwrap();
                        tf_1w_clone.set_checked(id == "1w").unwrap();
                        tf_1m_clone.set_checked(id == "1m").unwrap();
                        tf_1y_clone.set_checked(id == "1y").unwrap();
                        let _ = app_handle.emit("timeframe-changed", id);
                    }
                    "theme_light" | "theme_dark" => {
                        theme_light_clone.set_checked(id == "theme_light").unwrap();
                        theme_dark_clone.set_checked(id == "theme_dark").unwrap();
                        let _ = app_handle.emit("theme-changed", id);
                    }
                    "autostart" => {
                        let current_status = autostart_item_clone.is_checked().unwrap_or(false);
                        let new_status = !current_status;
                        if new_status {
                            let _ = app_handle.autolaunch().enable();
                        } else {
                            let _ = app_handle.autolaunch().disable();
                        }
                        autostart_item_clone.set_checked(new_status).unwrap();
                    }
                    "quit" => {
                        app_handle.exit(0);
                    }
                    _ => {}
                }
            });

            app.manage(MenuState(menu));

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
