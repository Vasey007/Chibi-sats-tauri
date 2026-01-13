use tauri::{
    menu::{ContextMenu, Menu, MenuItem, Submenu, PredefinedMenuItem},
    Manager, PhysicalPosition, Listener, Emitter,
    tray::{TrayIconBuilder, TrayIconEvent, TrayIcon, MouseButton, MouseButtonState},
};
use lazy_static::lazy_static;
use std::sync::Mutex;

struct MenuState(Menu<tauri::Wry>);

lazy_static! {
    static ref CURRENT_LANGUAGE: Mutex<String> = Mutex::new("en".to_string());
    static ref QUIT_MENU_ITEM: Mutex<Option<MenuItem<tauri::Wry>>> = Mutex::new(None);
    static ref TRAY_ICON: Mutex<Option<TrayIcon>> = Mutex::new(None);
    static ref TRAY_TOGGLE_ITEM: Mutex<Option<MenuItem<tauri::Wry>>> = Mutex::new(None);
}

lazy_static! {
    static ref TRANSLATION_MAP: std::collections::HashMap<String, std::collections::HashMap<String, String>> = {
        let mut map = std::collections::HashMap::new();

        let mut en_translations = std::collections::HashMap::new();
        en_translations.insert("About Developer".to_string(), "About Developer".to_string());
        en_translations.insert("Close Widget".to_string(), "Close Widget".to_string());
        en_translations.insert("Settings".to_string(), "Settings".to_string());
        en_translations.insert("Exit".to_string(), "Exit".to_string());
        en_translations.insert("Themes".to_string(), "Themes".to_string());
        en_translations.insert("Light".to_string(), "Light".to_string());
        en_translations.insert("Dark".to_string(), "Dark".to_string());
        en_translations.insert("Anime".to_string(), "Anime".to_string());
        en_translations.insert("Billionaire".to_string(), "Billionaire".to_string());
        en_translations.insert("Golden Dragon".to_string(), "Golden Dragon".to_string());
        en_translations.insert("Bender".to_string(), "Bender".to_string());
        en_translations.insert("Casino".to_string(), "Blackjack and hookers".to_string());
        en_translations.insert("Lord".to_string(), "The Lord".to_string());
        en_translations.insert("Minimize".to_string(), "Minimize".to_string());
        en_translations.insert("Restore".to_string(), "Restore".to_string());
        map.insert("en".to_string(), en_translations);

        let mut ru_translations = std::collections::HashMap::new();
        ru_translations.insert("About Developer".to_string(), "О разработчике".to_string());
        ru_translations.insert("Close Widget".to_string(), "Закрыть виджет".to_string());
        ru_translations.insert("Settings".to_string(), "Настройки".to_string());
        ru_translations.insert("Exit".to_string(), "Выход".to_string());
        ru_translations.insert("Themes".to_string(), "Темы".to_string());
        ru_translations.insert("Light".to_string(), "Светлая".to_string());
        ru_translations.insert("Dark".to_string(), "Темная".to_string());
        ru_translations.insert("Anime".to_string(), "Аниме".to_string());
        ru_translations.insert("Billionaire".to_string(), "Миллиардер".to_string());
        ru_translations.insert("Golden Dragon".to_string(), "Золотой Дракон".to_string());
        ru_translations.insert("Bender".to_string(), "Бендер".to_string());
        ru_translations.insert("Casino".to_string(), "Блэкджек и шлюхи".to_string());
        ru_translations.insert("Lord".to_string(), "Властелин".to_string());
        ru_translations.insert("Minimize".to_string(), "Свернуть".to_string());
        ru_translations.insert("Restore".to_string(), "Развернуть".to_string());
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

fn update_tray_toggle_text(_app_handle: &tauri::AppHandle, is_visible: bool) {
    if let Some(item) = TRAY_TOGGLE_ITEM.lock().unwrap().as_ref() {
        let text = if is_visible {
            get_translated_string("Minimize")
        } else {
            get_translated_string("Restore")
        };
        let _ = item.set_text(text);
    }
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
fn set_autostart(app_handle: tauri::AppHandle, enable: bool) -> Result<(), String> {
    if enable {
        app_handle.autolaunch().enable().map_err(|e| e.to_string())
    } else {
        app_handle.autolaunch().disable().map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn get_autostart_status(app_handle: tauri::AppHandle) -> Result<bool, String> {
    let status = app_handle.autolaunch().is_enabled().map_err(|e| e.to_string())?;
    Ok(status)
}

#[tauri::command]
fn hide_window(window: tauri::Window) -> Result<(), String> {
    let app_handle = window.app_handle().clone();
    window.hide().map_err(|e| e.to_string())?;
    update_tray_toggle_text(&app_handle, false);
    Ok(())
}

#[tauri::command]
fn close_window(window: tauri::Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
fn show_window(window: tauri::Window) -> Result<(), String> {
    let app_handle = window.app_handle().clone();
    window.show().map_err(|e| e.to_string())?;
    update_tray_toggle_text(&app_handle, true);
    Ok(())
}

#[tauri::command]
fn open_settings(app_handle: tauri::AppHandle) -> Result<(), String> {
    // Run on main thread to avoid any UI hangs or deadlocks
    let handle_clone = app_handle.clone();
    let _ = app_handle.run_on_main_thread(move || {
        // If window exists, just show it
        if let Some(window) = handle_clone.get_webview_window("settings") {
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
        } else {
            let settings_window = tauri::WebviewWindowBuilder::new(
                &handle_clone,
                "settings",
                tauri::WebviewUrl::App("index.html?window=settings".into()),
            )
            .title(get_translated_string("Settings"))
            .inner_size(400.0, 500.0)
            .resizable(false)
            .decorations(false)
            .always_on_top(true)
            .center()
            .skip_taskbar(false)
            .visible(false) // Still hidden, show only when React is ready
            .build();
            
            match settings_window {
                Ok(_) => {},
                Err(e) => println!("Error building settings window: {}", e),
            }
        }
    });
    Ok(())
}

#[tauri::command]
fn open_settings_alt(app_handle: tauri::AppHandle) -> Result<(), String> {
    open_settings(app_handle)
}

#[tauri::command]
fn exit_app(app_handle: tauri::AppHandle) {
    app_handle.exit(0);
}

#[tauri::command]
fn uninstall_app(app_handle: tauri::AppHandle) -> Result<(), String> {
    let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let exe_dir = current_exe.parent().ok_or("Could not find executable directory")?;
    let uninstaller_path = exe_dir.join("uninstall.exe");

    if uninstaller_path.exists() {
        // Режим установщика (NSIS)
        std::process::Command::new(uninstaller_path)
            .spawn()
            .map_err(|e| e.to_string())?;
        app_handle.exit(0);
        Ok(())
    } else {
        // Портативный режим (просто .exe файл)
        // 1. Отключаем автозагрузку, если она была включена
        let _ = set_autostart(app_handle.clone(), false);

        // 2. Получаем путь к папке с данными приложения (AppData/Roaming/com.chibi.sats)
        // В Tauri 2.0 доступ к путям через app_handle.path()
        let data_dir = app_handle.path().app_config_dir().ok();
        
        // 3. Формируем команду для удаления
        let exe_path = current_exe.to_str().ok_or("Invalid executable path")?;
        
        // Команда для Windows: ждем 2 секунды (чтобы процесс закрылся), удаляем exe и папку данных
        // Используем более надежный метод через временный батник
        let batch_content = if let Some(dir) = data_dir {
            let dir_path = dir.to_str().unwrap_or("");
            if !dir_path.is_empty() {
                format!(
                    "@echo off\ntimeout /t 2 /nobreak > NUL\nif exist \"{exe}\" del /f /q \"{exe}\"\nif exist \"{dir}\" rd /s /q \"{dir}\"\ndel \"%~f0\" & exit",
                    exe = exe_path, dir = dir_path
                )
            } else {
                format!(
                    "@echo off\ntimeout /t 2 /nobreak > NUL\nif exist \"{exe}\" del /f /q \"{exe}\"\ndel \"%~f0\" & exit",
                    exe = exe_path
                )
            }
        } else {
            format!(
                "@echo off\ntimeout /t 2 /nobreak > NUL\nif exist \"{exe}\" del /f /q \"{exe}\"\ndel \"%~f0\" & exit",
                exe = exe_path
            )
        };

        let temp_dir = std::env::temp_dir();
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let batch_path = temp_dir.join(format!("chibi_cleanup_{}.bat", timestamp));
        if let Err(e) = std::fs::write(&batch_path, batch_content) {
            return Err(format!("Failed to create cleanup script: {}", e));
        }

        // Запускаем батник
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            std::process::Command::new("cmd")
                .arg("/C")
                .arg(&batch_path)
                .creation_flags(CREATE_NO_WINDOW)
                .spawn()
                .map_err(|e| e.to_string())?;
        }

        // 4. Завершаем работу приложения
        app_handle.exit(0);
        Ok(())
    }
}

#[tauri::command]
fn open_about(app_handle: tauri::AppHandle) -> Result<(), String> {
    let handle_clone = app_handle.clone();
    let _ = handle_clone.clone().run_on_main_thread(move || {
        if let Some(about_window) = handle_clone.get_webview_window("about") {
            let _ = about_window.show();
            let _ = about_window.unminimize();
            let _ = about_window.set_focus();
        } else {
            let _ = tauri::WebviewWindowBuilder::new(
                &handle_clone,
                "about",
                tauri::WebviewUrl::App("index.html?window=about".into())
            )
            .title(get_translated_string("About Developer"))
            .inner_size(400.0, 350.0)
            .resizable(false)
            .always_on_top(true)
            .decorations(true)
            .visible(false) // Show only when React is ready
            .build();
        }
    });
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
        .invoke_handler(tauri::generate_handler![greet, show_context_menu, set_autostart, get_autostart_status, open_external_url, open_settings, open_settings_alt, open_about, set_always_on_top, exit_app, close_window, show_window, hide_window, uninstall_app])
        .setup(|app| {
            let handle = app.handle().clone();

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



            let quit = MenuItem::with_id(&handle, "quit", get_translated_string("Close Widget"), true, None::<&str>)?;
            *QUIT_MENU_ITEM.lock().unwrap() = Some(quit.clone());

            let menu = Menu::with_items(
                &handle,
                &[
                    &quit,
                ],
            )?;

            // Tray Menu
            let tray_toggle = MenuItem::with_id(&handle, "tray_toggle", get_translated_string("Minimize"), true, None::<&str>)?;
            *TRAY_TOGGLE_ITEM.lock().unwrap() = Some(tray_toggle.clone());

            let tray_settings = MenuItem::with_id(&handle, "tray_settings", get_translated_string("Settings"), true, None::<&str>)?;
            let tray_exit = MenuItem::with_id(&handle, "tray_exit", get_translated_string("Exit"), true, None::<&str>)?;
            
            // Listen for request to open settings from the gear icon (frontend event)
            let handle_clone = handle.clone();
            handle.listen("request-open-settings", move |_| {
                let _ = open_settings(handle_clone.clone());
            });

            let handle_clone_about = handle.clone();
            handle.listen("request-open-about", move |_| {
                let _ = open_about(handle_clone_about.clone());
            });

            let theme_light = MenuItem::with_id(&handle, "theme_light", get_translated_string("Light"), true, None::<&str>)?;
            let theme_dark = MenuItem::with_id(&handle, "theme_dark", get_translated_string("Dark"), true, None::<&str>)?;
            let theme_anime = MenuItem::with_id(&handle, "theme_anime", get_translated_string("Anime"), true, None::<&str>)?;
            let theme_billionaire = MenuItem::with_id(&handle, "theme_billionaire", get_translated_string("Billionaire"), true, None::<&str>)?;
            let theme_dragon = MenuItem::with_id(&handle, "theme_dragon", get_translated_string("Golden Dragon"), true, None::<&str>)?;
            let theme_bender = MenuItem::with_id(&handle, "theme_bender", get_translated_string("Bender"), true, None::<&str>)?;
            let theme_casino = MenuItem::with_id(&handle, "theme_casino", get_translated_string("Casino"), true, None::<&str>)?;
            let theme_lord = MenuItem::with_id(&handle, "theme_lord", get_translated_string("Lord"), true, None::<&str>)?;

            let themes_submenu = Submenu::with_items(
                &handle,
                get_translated_string("Themes"),
                true,
                &[
                    &theme_light, &theme_dark, &theme_anime, &theme_billionaire,
                    &theme_dragon, &theme_bender, &theme_casino, &theme_lord
                ]
            )?;

            let tray_menu = Menu::with_items(
                &handle,
                &[
                    &tray_toggle,
                    &PredefinedMenuItem::separator(&handle)?,
                    &tray_settings,
                    &themes_submenu,
                    &PredefinedMenuItem::separator(&handle)?,
                    &tray_exit,
                ]
            )?;

            let tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray: &TrayIcon, event: TrayIconEvent| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            update_tray_toggle_text(app, true);
                        }
                    }
                })
                .on_menu_event(move |app_handle: &tauri::AppHandle, event| {
                    match event.id.as_ref() {
                        "tray_toggle" => {
                            if let Some(window) = app_handle.get_webview_window("main") {
                                let is_visible = window.is_visible().unwrap_or(false);
                                if is_visible {
                                    let _ = window.hide();
                                    update_tray_toggle_text(app_handle, false);
                                } else {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                    update_tray_toggle_text(app_handle, true);
                                }
                            }
                        }
                        "tray_settings" => {
                            let _ = open_settings(app_handle.clone());
                        }
                        "tray_exit" => {
                            app_handle.exit(0);
                        }
                        id if id.starts_with("theme_") => {
                            let _ = app_handle.emit("theme-changed", id);
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            *TRAY_ICON.lock().unwrap() = Some(tray);

            // Listen for language changes from the frontend to update Rust state and menu
            let handle_clone = handle.clone();
            handle.listen("language-changed", move |event: tauri::Event| {
                let lang_id = event.payload().trim_matches('"');
                let new_lang = if lang_id == "lang_en" { "en" } else { "ru" };
                
                if let Ok(mut lang) = CURRENT_LANGUAGE.lock() {
                    *lang = new_lang.to_string();
                }

                if let Some(quit) = QUIT_MENU_ITEM.lock().unwrap().as_ref() {
                    let _ = quit.set_text(get_translated_string("Close Widget"));
                }

                if let Some(item) = TRAY_TOGGLE_ITEM.lock().unwrap().as_ref() {
                    let is_visible = if let Some(window) = handle_clone.get_webview_window("main") {
                        window.is_visible().unwrap_or(true)
                    } else {
                        true
                    };
                    let text = if is_visible {
                        get_translated_string("Minimize")
                    } else {
                        get_translated_string("Restore")
                    };
                    let _ = item.set_text(text);
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
