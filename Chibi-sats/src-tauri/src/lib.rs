use tauri::{
    menu::{ContextMenu, Menu, MenuItem, CheckMenuItem},
    Emitter, Manager, PhysicalPosition,
};
use lazy_static::lazy_static;
use std::sync::Mutex;

struct MenuState(Menu<tauri::Wry>);

lazy_static! {
    static ref CURRENT_LANGUAGE: Mutex<String> = Mutex::new("en".to_string());
    static ref LANG_EN_MENU_ITEM: Mutex<Option<CheckMenuItem<tauri::Wry>>> = Mutex::new(None);
    static ref LANG_RU_MENU_ITEM: Mutex<Option<CheckMenuItem<tauri::Wry>>> = Mutex::new(None);
    static ref TF_24H_MENU_ITEM: Mutex<Option<CheckMenuItem<tauri::Wry>>> = Mutex::new(None);
    static ref TF_1W_MENU_ITEM: Mutex<Option<CheckMenuItem<tauri::Wry>>> = Mutex::new(None);
    static ref TF_1M_MENU_ITEM: Mutex<Option<CheckMenuItem<tauri::Wry>>> = Mutex::new(None);
    static ref TF_1Y_MENU_ITEM: Mutex<Option<CheckMenuItem<tauri::Wry>>> = Mutex::new(None);
    static ref THEME_LIGHT_MENU_ITEM: Mutex<Option<CheckMenuItem<tauri::Wry>>> = Mutex::new(None);
    static ref THEME_DARK_MENU_ITEM: Mutex<Option<CheckMenuItem<tauri::Wry>>> = Mutex::new(None);
    static ref AUTOSTART_MENU_ITEM: Mutex<Option<CheckMenuItem<tauri::Wry>>> = Mutex::new(None);
    static ref ABOUT_MENU_ITEM: Mutex<Option<MenuItem<tauri::Wry>>> = Mutex::new(None);
    static ref QUIT_MENU_ITEM: Mutex<Option<MenuItem<tauri::Wry>>> = Mutex::new(None);
}

fn get_translation_map() -> std::collections::HashMap<String, std::collections::HashMap<String, String>> {
    let mut map = std::collections::HashMap::new();

    let mut en_translations = std::collections::HashMap::new();
    en_translations.insert("24 hours".to_string(), "24 hours".to_string());
    en_translations.insert("1 week".to_string(), "1 week".to_string());
    en_translations.insert("1 month".to_string(), "1 month".to_string());
    en_translations.insert("1 year".to_string(), "1 year".to_string());
    en_translations.insert("Themes".to_string(), "Themes".to_string());
    en_translations.insert("Light".to_string(), "Light".to_string());
    en_translations.insert("Dark".to_string(), "Dark".to_string());
    en_translations.insert("Language".to_string(), "Language".to_string());
    en_translations.insert("English".to_string(), "English".to_string());
    en_translations.insert("Russian".to_string(), "Russian".to_string());
    en_translations.insert("Launch at startup".to_string(), "Launch at startup".to_string());
    en_translations.insert("Close Application".to_string(), "Close Application".to_string());
    en_translations.insert("Timeframes".to_string(), "Timeframes".to_string());
    map.insert("en".to_string(), en_translations);

    let mut ru_translations = std::collections::HashMap::new();
    ru_translations.insert("24 hours".to_string(), "24 часа".to_string());
    ru_translations.insert("1 week".to_string(), "1 неделя".to_string());
    ru_translations.insert("1 month".to_string(), "1 месяц".to_string());
    ru_translations.insert("1 year".to_string(), "1 год".to_string());
    ru_translations.insert("Themes".to_string(), "Темы".to_string());
    ru_translations.insert("Light".to_string(), "Светлая".to_string());
    ru_translations.insert("Dark".to_string(), "Темная".to_string());
    ru_translations.insert("Language".to_string(), "Язык".to_string());
    ru_translations.insert("English".to_string(), "Английский".to_string());
    ru_translations.insert("Russian".to_string(), "Русский".to_string());
    ru_translations.insert("Launch at startup".to_string(), "Автозагрузка".to_string());
    ru_translations.insert("About Author".to_string(), "Об авторе".to_string());
    ru_translations.insert("Close Widget".to_string(), "Закрыть виджет".to_string());
    ru_translations.insert("Timeframes".to_string(), "Таймфреймы".to_string());
    map.insert("ru".to_string(), ru_translations);

    map
}

fn get_translated_string(key: &str) -> String {
    let lang = CURRENT_LANGUAGE.lock().unwrap();
    let translations = get_translation_map();
    translations.get(&*lang)
        .and_then(|l| l.get(key))
        .unwrap_or(&key.to_string())
        .clone()
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[tauri::command]
fn open_external_url(app_handle: tauri::AppHandle, url: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app_handle.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(Default::default(), None))
        .invoke_handler(tauri::generate_handler![greet, show_context_menu, set_autostart, get_autostart_status, open_external_url])
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
            let tf_24h = CheckMenuItem::with_id(handle, "24h", get_translated_string("24 hours"), true, true, None::<&str>)?;
            let tf_1w = CheckMenuItem::with_id(handle, "1w", get_translated_string("1 week"), true, false, None::<&str>)?;
            let tf_1m = CheckMenuItem::with_id(handle, "1m", get_translated_string("1 month"), true, false, None::<&str>)?;
            let tf_1y = CheckMenuItem::with_id(handle, "1y", get_translated_string("1 year"), true, false, None::<&str>)?;
            let theme_light = CheckMenuItem::with_id(handle, "theme_light", get_translated_string("Light"), true, true, None::<&str>)?;
            let theme_dark = CheckMenuItem::with_id(handle, "theme_dark", get_translated_string("Dark"), true, false, None::<&str>)?;

            let lang_en = CheckMenuItem::with_id(handle, "lang_en", get_translated_string("English"), true, true, None::<&str>)?;
            let lang_ru = CheckMenuItem::with_id(handle, "lang_ru", "Русский", true, false, None::<&str>)?;

            // Store language menu items globally
            *LANG_EN_MENU_ITEM.lock().unwrap() = Some(lang_en.clone());
            *LANG_RU_MENU_ITEM.lock().unwrap() = Some(lang_ru.clone());
            *TF_24H_MENU_ITEM.lock().unwrap() = Some(tf_24h.clone());
            *TF_1W_MENU_ITEM.lock().unwrap() = Some(tf_1w.clone());
            *TF_1M_MENU_ITEM.lock().unwrap() = Some(tf_1m.clone());
            *TF_1Y_MENU_ITEM.lock().unwrap() = Some(tf_1y.clone());
            *THEME_LIGHT_MENU_ITEM.lock().unwrap() = Some(theme_light.clone());
            *THEME_DARK_MENU_ITEM.lock().unwrap() = Some(theme_dark.clone());

            // Create the Submenu object for themes
            let theme_submenu = tauri::menu::Submenu::with_items(
                handle,
                get_translated_string("Themes"),
                true,
                &[
                    &theme_light,
                    &theme_dark,
                ],
            )?;

            // Create the Submenu object for language
            let lang_submenu = tauri::menu::Submenu::with_items(
                handle,
                get_translated_string("Language"),
                true,
                &[
                    &lang_en,
                    &lang_ru,
                ],
            )?;

            let is_autostart_enabled = handle.autolaunch().is_enabled().unwrap_or(false);
            let autostart_item = CheckMenuItem::with_id(handle, "autostart", get_translated_string("Launch at startup"), true, is_autostart_enabled, None::<&str>)?;

            // Если автозагрузка еще не включена, включаем её автоматически при первом запуске
            if !is_autostart_enabled {
                match handle.autolaunch().enable() {
                    Ok(_) => {
                        autostart_item.set_checked(true).unwrap();
                    },
                    Err(_) => {},
                }
            } else {
                autostart_item.set_checked(true).unwrap();
            }
            *AUTOSTART_MENU_ITEM.lock().unwrap() = Some(autostart_item.clone());

            let about = MenuItem::with_id(handle, "about", get_translated_string("About Author"), true, None::<&str>)?;
            *ABOUT_MENU_ITEM.lock().unwrap() = Some(about.clone());

            let quit = MenuItem::with_id(handle, "quit", get_translated_string("Close Widget"), true, None::<&str>)?;
            *QUIT_MENU_ITEM.lock().unwrap() = Some(quit.clone());

            // Create the Submenu object with items
            let timeframe_submenu = tauri::menu::Submenu::with_items(
                handle,
                get_translated_string("Timeframes"),
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
                    &lang_submenu, // Add the language submenu here
                    &tauri::menu::PredefinedMenuItem::separator(handle)?,
                    &autostart_item,
                    &about,
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
            let lang_en_clone = lang_en.clone();
            let lang_ru_clone = lang_ru.clone();

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
                    "lang_en" | "lang_ru" => {
                        let new_lang = if id == "lang_en" { "en" } else { "ru" };
                        *CURRENT_LANGUAGE.lock().unwrap() = new_lang.to_string();

                        lang_en_clone.set_checked(id == "lang_en").unwrap();
                        lang_ru_clone.set_checked(id == "lang_ru").unwrap();

                        // Update all menu item texts
                        if let Some(item) = LANG_EN_MENU_ITEM.lock().unwrap().as_ref() {
                            item.set_text("English").unwrap();
                        }
                        if let Some(item) = LANG_RU_MENU_ITEM.lock().unwrap().as_ref() {
                            item.set_text("Русский").unwrap();
                        }
                        if let Some(item) = TF_24H_MENU_ITEM.lock().unwrap().as_ref() {
                            item.set_text(get_translated_string("24 hours")).unwrap();
                        }
                        if let Some(item) = TF_1W_MENU_ITEM.lock().unwrap().as_ref() {
                            item.set_text(get_translated_string("1 week")).unwrap();
                        }
                        if let Some(item) = TF_1M_MENU_ITEM.lock().unwrap().as_ref() {
                            item.set_text(get_translated_string("1 month")).unwrap();
                        }
                        if let Some(item) = TF_1Y_MENU_ITEM.lock().unwrap().as_ref() {
                            item.set_text(get_translated_string("1 year")).unwrap();
                        }
                        if let Some(item) = THEME_LIGHT_MENU_ITEM.lock().unwrap().as_ref() {
                            item.set_text(get_translated_string("Light")).unwrap();
                        }
                        if let Some(item) = THEME_DARK_MENU_ITEM.lock().unwrap().as_ref() {
                            item.set_text(get_translated_string("Dark")).unwrap();
                        }
                        if let Some(item) = AUTOSTART_MENU_ITEM.lock().unwrap().as_ref() {
                            item.set_text(get_translated_string("Launch at startup")).unwrap();
                        }
                        if let Some(item) = ABOUT_MENU_ITEM.lock().unwrap().as_ref() {
                            item.set_text(get_translated_string("About Author")).unwrap();
                        }
                        if let Some(item) = QUIT_MENU_ITEM.lock().unwrap().as_ref() {
                            item.set_text(get_translated_string("Close Widget")).unwrap();
                        }
                        
                        let _ = app_handle.emit("language-changed", id);
                    }
                    "autostart" => {
                        // Опрашиваем систему напрямую, а не доверяем состоянию меню
                        let is_enabled = app_handle.autolaunch().is_enabled().unwrap_or(false);
                        
                        let new_status = !is_enabled;
                        if new_status {
                            let _ = app_handle.autolaunch().enable();
                        } else {
                            let _ = app_handle.autolaunch().disable();
                        }
                        
                        // Синхронизируем галочку в меню с новым состоянием
                        autostart_item_clone.set_checked(new_status).unwrap();
                    }
                    "about" => {
                        let lang = if *CURRENT_LANGUAGE.lock().unwrap() == "ru" { "ru" } else { "en" };
                        
                        // В Tauri v2 при использовании Vite многостраничность работает через URL вида about.html
                        // В режиме разработки это /about.html, в билде это тоже /about.html
                        let about_url = format!("about.html?lang={}", lang);
                        
                        use tauri::Manager;
                        if let Some(about_window) = app_handle.get_webview_window("about") {
                            let _ = about_window.set_focus();
                        } else {
                            let _ = tauri::WebviewWindowBuilder::new(
                                app_handle,
                                "about",
                                tauri::WebviewUrl::App(about_url.into())
                            )
                            .title(get_translated_string("About Author"))
                            .inner_size(400.0, 350.0)
                            .resizable(false)
                            .always_on_top(true)
                            .decorations(true)
                            .build();
                        }
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
