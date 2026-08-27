import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import '../styles/Settings.css';

interface SettingsProps {
    downloadPath: string;
    setDownloadPath: (path: string) => void;
    embedSubs: boolean;
    setEmbedSubs: (val: boolean) => void;
    createDirs: boolean;
    setCreateDirs: (val: boolean) => void;
    openFolder: boolean;
    setOpenFolder: (val: boolean) => void;
    triggerNotification: (text: string, type: 'wait' | 'success' | 'error') => void;
}

export function Settings({
    downloadPath,
    setDownloadPath,
    embedSubs,
    setEmbedSubs,
    createDirs,
    setCreateDirs,
    openFolder,
    setOpenFolder,
    triggerNotification
}: SettingsProps) {
    const [pathError, setPathError] = useState("");
    const [isUpdating, setIsUpdating] = useState(false);

    const validateAndSetPath = async (path: string, isCreateDirsEnabled: boolean = createDirs) => {
        setDownloadPath(path);
    
        if (!path.trim()) {
            setPathError('');
            return;
        }

        try {
            const isValid = await invoke<boolean>("validate_path", {
                path,
                createDirs: isCreateDirsEnabled
            });

            if (isValid) {
                setPathError('');
            } else {
                const isRootPath = path.length <= 3 || /^[a-zA-Z]:[\\/]?$/.test(path);

                if (isCreateDirsEnabled || isRootPath) {
                    setPathError('Warning: The specified drive/volume does not exist.');
                } else {
                    setPathError('Warning: The specified directory does not exist or is a file.');
                }
            }
        } catch (err) {
            console.error("Validation error:", err);
            setPathError('Error validating path.');
        }
    };

    const handleBlur = async () => {
        if (!downloadPath.trim()) {
            try {
                const defaultPath = await invoke<string>("get_default_download_path");
                validateAndSetPath(defaultPath);
            } catch (err) {
                setPathError('Field cannot be empty.');
            }
        }
    };

    const handleCheckboxChange = (checked: boolean) => {
        setCreateDirs(checked);
        validateAndSetPath(downloadPath, checked);
    };

    const handleSelectFolder = async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                defaultPath: downloadPath || undefined,
            });

            if (selected && typeof selected === 'string') {
                validateAndSetPath(selected);
            }
        } catch (error) {
            console.error("Failed to select folder:", error);
        }
    };

    const handleUpdateYtdlp = async () => {
        setIsUpdating(true);
        triggerNotification("Updating...", 'wait');

        try {
            const result = await invoke<string>("update_ytdlp");
        
            if (result.includes("up to date")) {
                triggerNotification("Up to date", 'success');
            } else {
                triggerNotification("Successfully updated!", 'success');
            }
        } catch (error) {
            console.error(error);
            triggerNotification("Not updated", 'error');
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="settings-container">
            <h1>Settings</h1>

            <div className="setting-item">
                <div className={`floating-group path-group ${downloadPath ? 'has-value' : ''}`}>
                    <input
                        type="text"
                        id="path-input"
                        className={`floating-input ${pathError ? 'input-error' : ''}`}
                        value={downloadPath}
                        onChange={(e) => validateAndSetPath(e.target.value)}
                        onBlur={handleBlur}
                        placeholder=" "
                    />
                    <label htmlFor="path-input" className="floating-label">Download Directory</label>
                
                    <button className="btn btn-primary" onClick={handleSelectFolder}>
                        Browse
                    </button>
                </div>
            
                <div className="error-container">
                    {pathError && <span className="error-text">{pathError}</span>}
                </div>
            </div>

            <div className="checkbox-item">
                <label className="checkbox-label">
                    <input
                        type="checkbox"
                        checked={createDirs}
                        onChange={(e) => handleCheckboxChange(e.target.checked)}
                    />
                    Create missing directories automatically
                </label>
            </div>

            <div className="checkbox-item">
                <label className="checkbox-label">
                    <input
                        type="checkbox"
                        checked={openFolder}
                        onChange={(e) => setOpenFolder(e.target.checked)}
                    />
                    Open folder after download
                </label>
            </div>

            <div className="checkbox-item">
                <label className="checkbox-label">
                    <input
                        type="checkbox"
                        checked={embedSubs}
                        onChange={(e) => setEmbedSubs(e.target.checked)}
                    />
                    Embed Subtitles
                </label>
            </div>

            <div className="setting-item" style={{ marginTop: '20px' }}>
                <button
                    className="btn btn-primary"
                    style={{ width: '150px' }}
                    onClick={handleUpdateYtdlp}
                    disabled={isUpdating}
                >
                    {isUpdating ? "Checking..." : "Update yt-dlp"}
                </button>
            </div>
        </div>
    );
}