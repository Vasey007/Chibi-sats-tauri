use tauri::{
    menu::{ContextMenu, Menu, MenuItem, CheckMenuItem},
    Emitter, Manager,
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, show_context_menu])
        .setup(|app| {
            let handle = app.handle();

            // Create menu items
            let tf_24h = CheckMenuItem::with_id(handle, "24h", "24 hours", true, true, None::<&str>)?;
            let tf_1w = CheckMenuItem::with_id(handle, "1w", "1 week", true, false, None::<&str>)?;
            let tf_1m = CheckMenuItem::with_id(handle, "1m", "1 month", true, false, None::<&str>)?;
            let tf_1y = CheckMenuItem::with_id(handle, "1y", "1 year", true, false, None::<&str>)?;
            let quit = MenuItem::with_id(handle, "quit", "Close Application", true, None::<&str>)?;

            let menu = Menu::with_items(
                handle,
                &[
                    &tf_24h,
                    &tf_1w,
                    &tf_1m,
                    &tf_1y,
                    &tauri::menu::PredefinedMenuItem::separator(handle)?,
                    &quit,
                ],
            )?;

            let handle_clone = handle.clone();
            let tf_24h_clone = tf_24h.clone();
            let tf_1w_clone = tf_1w.clone();
            let tf_1m_clone = tf_1m.clone();
            let tf_1y_clone = tf_1y.clone();

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
