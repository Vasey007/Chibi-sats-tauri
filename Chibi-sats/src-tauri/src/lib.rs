use tauri::{
    menu::{ContextMenu, Menu, MenuItem},
    Manager, PhysicalPosition, Listener,
};
use lazy_static::lazy_static;
use std::sync::Mutex;

struct MenuState(Menu<tauri::Wry>);

lazy_static! {
    static ref CURRENT_LANGUAGE: Mutex<String> = Mutex::new("en".to_string());
    static ref QUIT_MENU_ITEM: Mutex<Option<MenuItem<tauri::Wry>>> = Mutex::new(None);
}

lazy_static! {
    static ref TRANSLATION_MAP: std::collections::HashMap<String, std::collections::HashMap<String, String>> = {
        let mut map = std::collections::HashMap::new();

        let mut en_translations = std::collections::HashMap::new();
        en_translations.insert("About Developer".to_string(), "About Developer".to_string());
        en_translations.insert("Close Widget".to_string(), "Close Widget".to_string());
        map.insert("en".to_string(), en_translations);

        let mut ru_translations = std::collections::HashMap::new();
        ru_translations.insert("About Developer".to_string(), "О разработчике".to_string());
        ru_translations.insert("Close Widget".to_string(), "Закрыть виджет".to_string());
        map.insert("ru".to_string(), ru_translations);

        map
    };
}

fn get_translated_string(key: &'static str) -> &'static str {
    let lang = CURRENT_LANGUAGE.lock().unwrap();
    TRANSLATION_MAP.get(&*lang)
        .and_then(|l| l.get(key))
        .map(|s| s.as_str())
        .unwrap_or(key)
}

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
    let status = app_handle.autolaunch().is_enabled().map_err(|e| e.to_string())?;
    Ok(status)
}

#[tauri::command]
async fn open_settings(app_handle: tauri::AppHandle) -> Result<(), String> {
    // Check if window already exists
    if let Some(window) = app_handle.get_webview_window("settings") {
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let settings_window = tauri::WebviewWindowBuilder::new(
        &app_handle,
        "settings",
        tauri::WebviewUrl::App("index.html?window=settings".into()),
    )
    .title("Settings")
    .inner_size(400.0, 500.0)
    .resizable(true)
    .decorations(true)
    .always_on_top(false)
    .center()
    .skip_taskbar(false)
    .build();

    match settings_window {
        Ok(_) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
async fn open_about(app_handle: tauri::AppHandle) -> Result<(), String> {
    let lang = if *CURRENT_LANGUAGE.lock().unwrap() == "ru" { "ru" } else { "en" };
    let about_url = format!("about.html?lang={}", lang);
    
    if let Some(about_window) = app_handle.get_webview_window("about") {
        let _ = about_window.set_focus();
    } else {
        let _ = tauri::WebviewWindowBuilder::new(
            &app_handle,
            "about",
            tauri::WebviewUrl::App(about_url.into())
        )
        .title(get_translated_string("About Developer"))
        .inner_size(400.0, 350.0)
        .resizable(false)
        .always_on_top(true)
        .decorations(true)
        .build();
    }
    Ok(())
}

#[tauri::command]
fn set_always_on_top(app_handle: tauri::AppHandle, always_on_top: bool) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("main") {
        window.set_always_on_top(always_on_top).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[tauri::command]
fn open_external_url(app_handle: tauri::AppHandle, url: String) -> Result<(), String> {
    // Валидация URL перед открытием
    if !url.starts_with("https://t.me/") && !url.starts_with("https://www.bybit.com/") {
        return Err("Unauthorized URL".to_string());
    }
    use tauri_plugin_opener::OpenerExt;
    app_handle.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())
}

pub fn run() {
    tauri::Builder::default()

        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(Default::default(), None))
        .invoke_handler(tauri::generate_handler![greet, show_context_menu, set_autostart, get_autostart_status, open_external_url, open_settings, open_about, set_always_on_top])
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



            let quit = MenuItem::with_id(handle, "quit", get_translated_string("Close Widget"), true, None::<&str>)?;
            *QUIT_MENU_ITEM.lock().unwrap() = Some(quit.clone());

            let menu = Menu::with_items(
                handle,
                &[
                    &quit,
                ],
            )?;

            // Listen for language changes from the frontend to update Rust state and menu
            handle.listen("language-changed", move |event: tauri::Event| {
                let lang_id = event.payload().trim_matches('"');
                let new_lang = if lang_id == "lang_en" { "en" } else { "ru" };
                
                if let Ok(mut lang) = CURRENT_LANGUAGE.lock() {
                    *lang = new_lang.to_string();
                }

                if let Some(quit) = QUIT_MENU_ITEM.lock().unwrap().as_ref() {
                    let _ = quit.set_text(get_translated_string("Close Widget"));
                }
            });

            app.on_menu_event(move |app_handle, event| {
                let id = event.id.0.as_str();
                match id {
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
