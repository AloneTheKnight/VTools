import { CustomSelect } from './CustomSelect';
import "../styles/Downloader.css"

interface VideoFormat {
    format_id: string;
    ext: string;
    height?: number;
    format_note?: string;
    vcodec?: string;
    tbr?: number;
}

interface DownloaderProps {
    url: string;
    setUrl: (val: string) => void;
    isLoading: boolean;
    handleGetInfo: () => void;
    title: string;
    previewImg: string;
    formats: VideoFormat[];
    duration: number;
    selectedQuality: string;
    setSelectedQuality: (val: string) => void;
    handleDownload: () => void;
}

export function Downloader({
    url,
    setUrl,
    isLoading,
    handleGetInfo,
    title,
    previewImg,
    formats,
    duration,
    selectedQuality,
    setSelectedQuality,
    handleDownload
}: DownloaderProps) {
    return (
        <>
            <h1 className="app-title">YouTube Downloader</h1>
        
            <div className="search-box">
                <div className={`floating-group ${url ? 'has-value' : ''}`} style={{ flex: 1 }}>
                    <input
                        type="text"
                        id="url-input"
                        className="floating-input"
                        placeholder=" "
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                    />
                    <label htmlFor="url-input" className="floating-label">Video URL</label>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={handleGetInfo}
                    disabled={isLoading}
                >
                    {isLoading ? "Searching..." : "Search"}
                </button>
            </div>

            {isLoading && (
                <div className="loader">
                    <div>
                        Loading video data...
                        <div className="indicator"></div>
                    </div>
                </div>
            )}

            {!isLoading && title && (
                <div className="video-card">
                    {previewImg && <img src={previewImg} alt="Thumbnail" className="thumbnail" />}
                    <h3 className="video-title">{title}</h3>
                
                    <div className="download-box">
                        <CustomSelect
                            formats={formats}
                            duration={duration}
                            selectedFormat={selectedQuality}
                            onSelect={(val) => setSelectedQuality(val)}
                        />

                        <button className="btn btn-download" onClick={handleDownload}>
                            Download
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}