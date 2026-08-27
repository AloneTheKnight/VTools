import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import './styles/App.css';
import { HeaderTabs } from "./components/HeaderTabs";
import { Downloader } from "./components/Downloader";
import { Settings } from './components/Settings';
import { Notification } from "./components/Notification";

interface VideoFormat {
    format_id: string;
    ext: string;
    height?: number;
    format_note?: string;
    vcodec?: string;
    tbr?: number;
}

interface NotificationState {
    text: string;
    type: 'wait' | 'success' | 'error';
}

interface AppSettings {
    download_path: string;
    create_dirs: boolean;
    open_folder: boolean;
    embed_subs: boolean;
}

function App() {
    const [activeTab, setActiveTab] = useState<'main' | 'settings'>('main');
    const [url, setUrl] = useState("");
    const [status, setStatus] = useState<NotificationState | null>(null);

    const [previewImg, setPreviewImg] = useState("");
    const [title, setTitle] = useState("");
    const [formats, setFormats] = useState<VideoFormat[]>([]);
    const [duration, setDuration] = useState<number>(0);
    const [selectedQuality, setSelectedQuality] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const [downloadPath, setDownloadPath] = useState("");
    const [embedSubs, setEmbedSubs] = useState(false);
    const [createDirs, setCreateDirs] = useState(true);
    const [openFolder, setOpenFolder] = useState(true);

    const [timerKey, setTimerKey] = useState(0);

    useEffect(() => {
        invoke<AppSettings>("load_settings")
            .then((settings) => {
                setDownloadPath(settings.download_path);
                setCreateDirs(settings.create_dirs);
                setOpenFolder(settings.open_folder);
                setEmbedSubs(settings.embed_subs);
            })
            .catch((err) => console.error("Failed to load settings:", err));
    }, []);

    const saveCurrentSettings = useCallback(async (newSettings: {
        download_path?: string;
        create_dirs?: boolean;
        open_folder?: boolean;
        embed_subs?: boolean;
    }) => {
        const settingsToSave: AppSettings = {
            download_path: newSettings.download_path ?? downloadPath,
            create_dirs: newSettings.create_dirs ?? createDirs,
            open_folder: newSettings.open_folder ?? openFolder,
            embed_subs: newSettings.embed_subs ?? embedSubs
        };

        try {
            await invoke("save_settings", { settings: settingsToSave });
        } catch (err) {
            console.error("Failed to save settings:", err);
        }
    }, [downloadPath, createDirs, openFolder, embedSubs]);

    const triggerNotification = useCallback((text: string, type: 'wait' | 'success' | 'error') => {
        setStatus({ text, type });
        setTimerKey(prev => prev + 1);
    }, []);

    const handleDownload = async () => {
        if (!url || !selectedQuality) {
            alert("Please enter a URL and choose a format!");
            return;
        }

        try {
            triggerNotification("Downloading...", 'wait');

            const result = await invoke<string>("download_video", {
                url,
                formatId: selectedQuality,
                downloadPath,
                embedSubs,
                createDirs,
                openFolder
            });

            triggerNotification(result, 'success');
        } catch (error) {
            console.error(error);
            triggerNotification(`Download error: ${error}`, 'error');
        }
    };

    const handleGetInfo = async () => {
        if (!url) return;
        setIsLoading(true);
        triggerNotification("Getting video information...", 'wait');

        try {
            const rawJson = await invoke<string>("get_video_info", { url });
            const data = JSON.parse(rawJson);

            setPreviewImg(data.thumbnail);
            setTitle(data.title);
            setFormats(data.formats);
            setDuration(data.duration || 0);
        
            triggerNotification("Video information loaded!", 'success');

            const videoFormats = data.formats.filter((f: any) => f.height && f.vcodec !== 'none');
            if (videoFormats.length > 0) {
                videoFormats.sort((a: any, b: any) => (b.height || 0) - (a.height || 0) || (b.tbr || 0) - (a.tbr || 0));
                const bestVideo = videoFormats[0];
                setSelectedQuality(`${bestVideo.ext.toLowerCase()}_${bestVideo.format_id}`);
            } else {
                setSelectedQuality('mp3_192');
            }
        } catch (error) {
            triggerNotification(`Error getting info: ${error}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="app-container" id="main-app">
            <HeaderTabs activeTab={activeTab} setActiveTab={setActiveTab} />

            {activeTab === 'main' ? (
                <Downloader
                    url={url}
                    setUrl={setUrl}
                    isLoading={isLoading}
                    handleGetInfo={handleGetInfo}
                    title={title}
                    previewImg={previewImg}
                    formats={formats}
                    duration={duration}
                    selectedQuality={selectedQuality}
                    setSelectedQuality={setSelectedQuality}
                    handleDownload={handleDownload}
                />
            ) : (
                <Settings
                    downloadPath={downloadPath}
                    setDownloadPath={(path) => {
                        setDownloadPath(path);
                        saveCurrentSettings({ download_path: path });
                    }}
                    embedSubs={embedSubs}
                    setEmbedSubs={(val) => {
                        setEmbedSubs(val);
                        saveCurrentSettings({ embed_subs: val });
                    }}
                    createDirs={createDirs}
                    setCreateDirs={(val) => {
                        setCreateDirs(val);
                        saveCurrentSettings({ create_dirs: val });
                    }}
                    openFolder={openFolder}
                    setOpenFolder={(val) => {
                        setOpenFolder(val);
                        saveCurrentSettings({ open_folder: val });
                    }}
                    triggerNotification={triggerNotification}
                />
            )}

            <Notification
                status={status}
                timerKey={timerKey}
                onAnimationEnd={() => {
                    if (status?.type !== 'wait') setStatus(null);
                }}
            />
        </div>
    );
}

export default App;