use tauri::{
    menu::{ContextMenu, Menu, MenuItem},
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
            let tf_24h = MenuItem::with_id(handle, "24h", "24 hours", true, None::<&str>)?;
            let tf_1w = MenuItem::with_id(handle, "1w", "1 week", true, None::<&str>)?;
            let tf_1m = MenuItem::with_id(handle, "1m", "1 month", true, None::<&str>)?;
            let tf_1y = MenuItem::with_id(handle, "1y", "1 year", true, None::<&str>)?;
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
            app.on_menu_event(move |_app, event| {
                let id = event.id.0.as_str();
                match id {
                    "24h" | "1w" | "1m" | "1y" => {
                        let _ = handle_clone.emit("timeframe-changed", id);
                    }
                    "quit" => {
                        handle_clone.exit(0);
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
