use tauri::command;
use std::process::Command;
use std::path::PathBuf;
use std::fs;
use dirs;
use tauri::Manager;
use serde::{Serialize, Deserialize};
use std::os::windows::process::CommandExt;

#[derive(Serialize, Deserialize, Debug, Clone)]
struct AppSettings {
    download_path: String,
    create_dirs: bool,
    open_folder: bool,
    embed_subs: bool
}

impl Default for AppSettings {
    fn default() -> Self {
        let default_path = dirs::download_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .to_string_lossy()
            .into_owned();

        AppSettings {
            download_path: default_path,
            create_dirs: true,
            open_folder: true,
            embed_subs: false
        }
    }
}

fn hidden_command(program: &str) -> Command {
    let mut cmd = Command::new(program);
    cmd.creation_flags(0x08000000);
    cmd
}

fn get_config_path(_app: &tauri::AppHandle) -> Option<PathBuf> {
    let exe_path = std::env::current_exe().ok()?;
    let exe_dir = exe_path.parent()?;
    Some(exe_dir.join("settings.json"))
}

#[tauri::command]
fn save_settings(app: tauri::AppHandle, settings: AppSettings) -> Result<(), String> {
    let config_path = get_config_path(&app)
        .ok_or("Failed to get config directory")?;

    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(config_path, json).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn load_settings(app: tauri::AppHandle) -> AppSettings {
    let config_path = match get_config_path(&app) {
        Some(p) => p,
        None => return AppSettings::default()
    };

    if config_path.exists() {
        if let Ok(json) = fs::read_to_string(config_path) {
            if let Ok(settings) = serde_json::from_str(&json) {
                return settings;
            }
        }
    }

    AppSettings::default()
}

#[tauri::command]
fn get_default_download_path() -> Result<String, String> {
    let path = dirs::download_dir()
        .ok_or("Could not find default downloads directory")?;
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
fn validate_path(path: String, create_dirs: bool) -> bool {
    let p = PathBuf::from(&path);

    if p.exists() {
        return p.is_dir();
    }

    if create_dirs {
        let mut check_path = p;
        let mut volume_exists = false;

        loop {
            if check_path.exists() {
                volume_exists = check_path.is_dir();
                break;
            }
            if let Some(parent) = check_path.parent() {
                if parent == check_path {
                    break;
                }
                check_path = parent.to_path_buf();
            } else {
                break;
            }
        }
        return volume_exists;
    }

    false
}

#[tauri::command]
async fn update_ytdlp() -> Result<String, String> {
    let output = tauri::async_runtime::spawn_blocking(move || {
        hidden_command("bin/yt-dlp")
            .arg("-U")
            .output()
    })
    .await
    .map_err(|e| e.to_string())?;

    match output {
        Ok(res) => {
            let stdout = String::from_utf8_lossy(&res.stdout).to_string();
            let stderr = String::from_utf8_lossy(&res.stderr).to_string();
            let combined = format!("{}\n{}", stdout, stderr);

            if combined.contains("Updated yt-dlp to") {
                let old_path = PathBuf::from("bin/yt-dlp.exe.old");
                if old_path.exists() {
                    let _ = fs::remove_file(old_path);
                }
            }

            if combined.contains("is up to date") {
                Ok("up to date".into())
            } else if combined.contains("Updated yt-dlp to") || res.status.success() {
                Ok("successfully updated".into())
            } else {
                Err(format!("failed to update: {}", combined))
            }
        }
        Err(e) => Err(format!("process error: {}", e))
    }
}

fn open_folder_focused(path: &PathBuf) {
    let path_str = path.to_string_lossy();

    let _ = hidden_command("cmd")
        .args(["/C", "start", "", &path_str])
        .spawn();
}

#[tauri::command]
async fn download_video(
    url: String,
    format_id: String,
    download_path: String,
    embed_subs: bool,
    create_dirs: bool,
    open_folder: bool
) -> Result<String, String> {
    let initial_target = if download_path.is_empty() {
        dirs::download_dir().ok_or("Could not find default downloads directory")?
    } else {
        PathBuf::from(&download_path)
    };

    let mut target_dir = initial_target.clone();
    let mut fallback_used = false;
    let mut warning_message: Option<String> = None;

    if create_dirs {
        if let Err(e) = fs::create_dir_all(&target_dir) {
            fallback_used = true;
            warning_message = Some(format!("Failed to create directories ({}). Fallback to default Downloads.", e));
        }
    } else {
        if !target_dir.exists() || !target_dir.is_dir() {
            fallback_used = true;
            warning_message = Some("Selected directory does not exist or is not a folder. Fallback to default Downloads.".into());
        }
    }

    if fallback_used {
        if let Some(default_dir) = dirs::download_dir() {
            target_dir = default_dir;
            let _ = fs::create_dir_all(&target_dir);
        } else {
            return Err("Failed to save to selected directory and default downloads directory is not available".into());
        }
    }

    let suffix = if format_id.starts_with("mp3_") {
        let bitrate = format_id.split('_').nth(1).unwrap_or("128");
        format!("[MP3, {}kbps]", bitrate)
    } else if format_id.starts_with("wav_") {
        let asr_str = format_id.split('_').nth(1).unwrap_or("44100");
        let asr: u32 = asr_str.parse().unwrap_or(44100);
        let khz = (asr as f32) / 1000.0;
        let data_rate = (asr * 16 * 2) / 1000;
        format!("[{:.2}kHz, {}kbps]", khz, data_rate)
    } else if format_id.ends_with("_audio") {
        "[%(acodec)s, %(abr).0fkbps]".to_string()
    } else if format_id.ends_with("_muted") {
        "[%(height)sp, %(tbr).0fkbps, No Audio]".to_string()
    } else {
        "[%(height)sp, %(tbr).0fkbps]".to_string()
    };

    let ext = if format_id.starts_with("mp3_") {
        "mp3".to_string()
    } else if format_id.starts_with("wav_") {
        "wav".to_string()
    } else {
        "%(ext)s".to_string()
    };

    let save_template = target_dir.join(format!("%(title)s {}.{}", suffix, ext));

    let mut args = vec![
        "--js-runtimes".to_string(),
        "quickjs".to_string(),
        url.clone(),
        "-o".to_string(),
        save_template.to_str().unwrap().to_string()
    ];

    if format_id.starts_with("mp3_") {
        let bitrate = format_id.split('_').nth(1).unwrap_or("128");
        args.extend(vec![
            "-x".to_string(),
            "--audio-format".to_string(),
            "mp3".to_string(),
            "--audio-quality".to_string(),
            format!("{}k", bitrate)
        ]);
    } else if format_id.starts_with("wav_") {
        let asr = format_id.split('_').nth(1).unwrap_or("44100");
        args.extend(vec![
            "-x".to_string(),
            "--audio-format".to_string(),
            "wav".to_string(),
            "--postprocessor-args".to_string(),
            format!("ffmpeg:-ar {}", asr)
        ]);
    } else if format_id.ends_with("_audio") {
        let real_format_id = format_id.replace("_audio", "");
        args.extend(vec![
            "-f".to_string(),
            real_format_id
        ]);
    } else if format_id.ends_with("_muted") {
        let clean_id = format_id.strip_suffix("_muted").unwrap();

        if let Some((_, real_id)) = clean_id.split_once('_') {
            args.extend(vec![
                "-f".to_string(),
                real_id.to_string()
            ]);
        }
    } else {
        let clean_id = if let Some((_, real_id)) = format_id.split_once('_') {
            real_id
        } else {
            &format_id
        };

        let format_arg = format!("{}+bestaudio/best", clean_id);
        let target_ext = if format_id.contains("webm") { "webm" } else { "mp4" };

        args.extend(vec![
            "-f".to_string(),
            format_arg,
            "--merge-output-format".to_string(),
            target_ext.to_string()
        ]);
    }

    if embed_subs && !format_id.ends_with("_audio") && !format_id.starts_with("mp3_") && !format_id.starts_with("wav_") {
        args.extend(vec![
            "--write-subs".to_string(),
            "--write-auto-subs".to_string(),
            "--sub-langs".to_string(),
            "en,ru,ru-orig".to_string()
        ]);
    }

    let status = hidden_command("bin/yt-dlp")
        .args(&args)
        .status()
        .map_err(|e| format!("Failed to run yt-dlp: {}", e))?;

    if status.success() {
        if format_id.ends_with("_muted") {
            if let Ok(entries) = fs::read_dir(&target_dir) {
                let mut files: Vec<_> = entries
                    .filter_map(|e| e.ok())
                    .filter(|e| e.path().is_file())
                    .collect();
            
                files.sort_by_key(|a| a.metadata().and_then(|m| m.modified()).ok());
            
                if let Some(latest_file) = files.last() {
                    let file_path = latest_file.path();
                    let file_path_str = file_path.to_string_lossy();
                    let temp_path = target_dir.join("temp_muted.mp4");
                    let temp_path_str = temp_path.to_string_lossy();

                    let ffmpeg_status = hidden_command("bin/ffmpeg")
                        .args([
                            "-y",
                            "-loglevel", "quiet",
                            "-i", &file_path_str,
                            "-f", "lavfi",
                            "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
                            "-c:v", "copy",
                            "-c:a", "aac",
                            "-shortest",
                            &temp_path_str
                        ])
                        .status();

                    if let Ok(f_stat) = ffmpeg_status {
                        if f_stat.success() {
                            let _ = fs::remove_file(&file_path);
                            let _ = fs::rename(&temp_path, &file_path);
                        }
                    }
                }
            }
        }

        if open_folder {
            open_folder_focused(&target_dir);
        }

        match warning_message {
            Some(msg) => Ok(format!("Downloaded successfully, but with warning: {}", msg)),
            None => Ok("Download completed successfully!".into())
        }
    } else {
        Err("yt-dlp exited with an error".into())
    }
}

#[command]
async fn get_video_info(url: String) -> Result<String, String> {
    let url_clone = url.clone();
    let output = tauri::async_runtime::spawn_blocking(move || {
        hidden_command("bin/yt-dlp")
            .arg("--js-runtimes")
            .arg("quickjs")
            .arg("--dump-json")
            .arg(&url_clone)
            .output()
    })
    .await
    .map_err(|e| e.to_string())?;

    match output {
        Ok(res) if res.status.success() => {
            Ok(String::from_utf8_lossy(&res.stdout).to_string())
        }
        Ok(res) => Err(String::from_utf8_lossy(&res.stderr).to_string()),
        Err(e) => Err(e.to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_video_info,
            download_video,
            validate_path,
            get_default_download_path,
            save_settings,
            load_settings,
            update_ytdlp
        ])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                if let Ok(Some(monitor)) = window.current_monitor() {
                    let size = monitor.size();
                    let screen_height = size.height;

                    let (target_width, target_height) = if screen_height <= 720 {
                        (800.0, 650.0)
                    } else {
                        (800.0, 800.0)
                    };

                    let scale_factor = window.scale_factor().unwrap_or(1.0);
                    let logical_width = target_width / scale_factor;
                    let logical_height = target_height / scale_factor;

                    let _ = window.set_size(tauri::LogicalSize::new(logical_width, logical_height));
                    let _ = window.center();
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}