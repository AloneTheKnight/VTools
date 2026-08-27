import { useState, useRef, useEffect } from 'react';
import '../styles/CustomSelect.css';

interface CustomSelectProps {
    formats: any[];
    duration: number;
    selectedFormat: string;
    onSelect: (formatId: string) => void;
}

export function CustomSelect({ formats, duration, selectedFormat, onSelect }: CustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
        const pill = e.currentTarget;
        const tooltip = pill.querySelector('.format-tooltip') as HTMLElement;
        const container = pill.closest('.select-scroll-content');

        if (tooltip && container) {
            const pillRect = pill.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
    
            if (pillRect.top - containerRect.top < 110) {
                pill.classList.add('tooltip-bottom');
            } else {
                pill.classList.remove('tooltip-bottom');
            }
        }
    };

    const formatFileSize = (tbr?: number, dur?: number) => {
        if (!tbr || !dur) return '???';
        const totalMb = (tbr * dur) / 8192;
        if (totalMb >= 1024) return `~${(totalMb / 1024).toFixed(1)} GB`;
        if (totalMb >= 1) return `~${Math.round(totalMb)} MB`;
        return `~${Math.round(totalMb * 1024)} KB`;
    };

    const getAudioCodecLabel = (f: any) => {
        const acodec = (f.acodec || '').toLowerCase();
        if (acodec.includes('opus')) return 'Opus';
        if (acodec.includes('mp4a') || acodec.includes('aac')) return 'AAC';
        if (acodec.includes('vorbis')) return 'Vorbis';
        return f.acodec ? f.acodec.toUpperCase() : f.ext.toUpperCase();
    };

    const normalizeSampleRate = (asr?: number) => {
        const rate = asr || 44100;
        if (rate > 21000 && rate < 23000) return 22050;
        if (rate > 10000 && rate < 12000) return 11025;
        return rate;
    };

    const getWavBitrate = (asr?: number) => {
        const sampleRate = normalizeSampleRate(asr);
        return Math.round((sampleRate * 16 * 2) / 1000);
    };

    const getWavSampleRateText = (asr?: number) => {
        const sampleRate = normalizeSampleRate(asr);
        return `${(sampleRate / 1000).toFixed(2)} kHz`;
    };

    const allowedExtensions = ['mp4', 'webm', 'm4a'];

    const audioFormats = formats.filter((f) =>
        f.vcodec === 'none' &&
        f.acodec &&
        f.acodec !== 'none' &&
        (f.abr || f.tbr || 0) > 8 &&
        allowedExtensions.includes((f.ext || '').toLowerCase())
    );

    const bestAudioBitrate = audioFormats.reduce((max, f) => Math.max(max, f.abr || f.tbr || 0), 0);

    const getSelectedLabel = () => {
        if (selectedFormat.startsWith('mp3_')) {
            const bitrate = parseInt(selectedFormat.split('_')[1], 10);
            return `🎵 MP3 | ~${bitrate} kbps (${formatFileSize(bitrate, duration)})`;
        }
        if (selectedFormat.startsWith('wav_')) {
            const asr = parseInt(selectedFormat.split('_')[1], 10);
            const bitrate = getWavBitrate(asr);
            return `🎵 WAV | ${getWavSampleRateText(asr)} / 16-bit (${formatFileSize(bitrate, duration)})`;
        }

        if (selectedFormat.endsWith('_muted')) {
            const parts = selectedFormat.split('_');
            const ext = parts[0].toUpperCase();
            const realId = parts.slice(1, -1).join('_');
            const found = formats.find(f => f.format_id === realId);
            if (found) {
                return `📹 🔇 ${found.height}p (No Audio) | ${ext} (${formatFileSize(found.tbr, duration)})`;
            }
        }

        if (selectedFormat.endsWith('_audio')) {
            const realId = selectedFormat.replace('_audio', '');
            const cleanAudioId = realId.includes('_') ? realId.split('_').slice(1).join('_') : realId;
            const audioFound = audioFormats.find(f => f.format_id === cleanAudioId || f.format_id === realId);
            if (audioFound) {
                const bitrate = audioFound.abr || audioFound.tbr;
                const codecLabel = getAudioCodecLabel(audioFound);
                return `🎵 ${audioFound.ext.toUpperCase()} (${codecLabel}) | ~${Math.round(bitrate || 0)}k (${formatFileSize(bitrate, duration)})`;
            }
        }

        const realVideoId = selectedFormat.includes('_') ? selectedFormat.split('_').slice(1).join('_') : selectedFormat;
        const found = formats.find(f => f.format_id === realVideoId);
        if (found) {
            const totalTbr = (found.tbr || 0) + bestAudioBitrate;
            return `📹 ${found.height}p | ${found.ext.toUpperCase()} (${formatFileSize(totalTbr, duration)})`;
        }
        return selectedFormat;
    };

    const availableBitrates = Array.from(
        new Set(audioFormats.map((f) => Math.round(f.abr || f.tbr || 0)))
    ).filter((b) => b > 0).sort((a, b) => b - a);

    const availableSampleRates = Array.from(
        new Set(audioFormats.map((f) => f.asr || 44100))
    ).filter((rate) => rate > 0);
    if (availableSampleRates.length === 0) availableSampleRates.push(44100);
    availableSampleRates.sort((a, b) => b - a);

    const audioFormatsByExt = audioFormats.reduce((acc: { [key: string]: any[] }, f) => {
        const ext = f.ext.toUpperCase();
        if (!acc[ext]) acc[ext] = [];
        if (!acc[ext].some(existing => existing.format_id === f.format_id)) {
            acc[ext].push(f);
        }
        return acc;
    }, {});

    const sortedAudioExts = Object.keys(audioFormatsByExt);

    const videoFormatsByHeight = formats
        .filter((f) => f.height && f.vcodec !== 'none' && f.tbr && allowedExtensions.includes((f.ext || '').toLowerCase()))
        .reduce((acc: { [key: number]: any[] }, f) => {
            if (!acc[f.height]) acc[f.height] = [];
            if (!acc[f.height].some(existing => existing.format_id === f.format_id)) {
                acc[f.height].push(f);
            }
            return acc;
        }, {});

    const mutedVideoFormatsByHeight = formats
        .filter((f) => f.height && f.vcodec !== 'none' && f.acodec === 'none' && f.tbr && allowedExtensions.includes((f.ext || '').toLowerCase()))
        .reduce((acc: { [key: number]: any[] }, f) => {
            if (!acc[f.height]) acc[f.height] = [];
            if (!acc[f.height].some(existing => existing.format_id === f.format_id)) {
                acc[f.height].push(f);
            }
            return acc;
        }, {});

    const sortedHeights = Object.keys(videoFormatsByHeight).map(Number).sort((a, b) => b - a);
    const sortedMutedHeights = Object.keys(mutedVideoFormatsByHeight).map(Number).sort((a, b) => b - a);

    return (
        <div className="custom-select-container" ref={dropdownRef}>
            <div className="select-header" onClick={() => setIsOpen(!isOpen)}>
                <span>{getSelectedLabel()}</span>
                <span className={`arrow ${isOpen ? 'open' : ''}`}>▼</span>
            </div>

            {isOpen && (
                <div className="select-dropdown">
                    <div className="select-scroll-content">
                
                        {audioFormats.length > 0 && (
                            <>
                                <div className="select-section-title">Audio</div>
                        
                                <div className="resolution-row">
                                    <div className="resolution-label">MP3</div>
                                    <div className="formats-pills-list">
                                        {availableBitrates.map((bitrate) => {
                                            const formatId = `mp3_${bitrate}`;
                                            return (
                                                <div
                                                    key={formatId}
                                                    className={`format-pill ${selectedFormat === formatId ? 'selected' : ''}`}
                                                    onMouseEnter={handleMouseEnter}
                                                    onClick={() => { onSelect(formatId); setIsOpen(false); }}
                                                >
                                                    <span className="pill-ext">MP3</span>
                                                    <span className="pill-bitrate">~{bitrate}k</span>

                                                    <div className="format-tooltip">
                                                        <div>Container: MP3</div>
                                                        <div>Codec: MP3 (Converted)</div>
                                                        <div>Bitrate: ~{bitrate} kbps</div>
                                                        <div>Size: {formatFileSize(bitrate, duration)}</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="resolution-row">
                                    <div className="resolution-label">WAV</div>
                                    <div className="formats-pills-list">
                                        {availableSampleRates.map((asr) => {
                                            const formatId = `wav_${asr}`;
                                            const bitrate = getWavBitrate(asr);
                                            const sampleRateText = getWavSampleRateText(asr);
                                            return (
                                                <div
                                                    key={formatId}
                                                    className={`format-pill ${selectedFormat === formatId ? 'selected' : ''}`}
                                                    onMouseEnter={handleMouseEnter}
                                                    onClick={() => { onSelect(formatId); setIsOpen(false); }}
                                                >
                                                    <span className="pill-ext">WAV</span>
                                                    <span className="pill-bitrate">{sampleRateText}</span>

                                                    <div className="format-tooltip">
                                                        <div>Container: WAV</div>
                                                        <div>Codec: PCM (Lossless)</div>
                                                        <div>Sample Rate: {sampleRateText} / 16-bit</div>
                                                        <div>Data Rate: ~{bitrate} kbps</div>
                                                        <div>Size: {formatFileSize(bitrate, duration)}</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {sortedAudioExts.map((ext) => (
                                    <div key={ext} className="resolution-row">
                                        <div className="resolution-label">{ext}</div>
                                        <div className="formats-pills-list">
                                            {audioFormatsByExt[ext]
                                                .sort((a: any, b: any) => (b.abr || b.tbr || 0) - (a.abr || a.tbr || 0))
                                                .map((f: any) => {
                                                    const formatId = `${f.ext.toLowerCase()}_${f.format_id}_audio`;
                                                    const bitrate = f.abr || f.tbr;
                                                    const codecLabel = getAudioCodecLabel(f);
                                                    return (
                                                        <div
                                                            key={formatId}
                                                            className={`format-pill ${selectedFormat === formatId ? 'selected' : ''}`}
                                                            onMouseEnter={handleMouseEnter}
                                                            onClick={() => { onSelect(formatId); setIsOpen(false); }}
                                                        >
                                                            <span className="pill-ext">{codecLabel}</span>
                                                            {bitrate && <span className="pill-bitrate">~{Math.round(bitrate)}k</span>}

                                                            <div className="format-tooltip">
                                                                <div>Container: {ext}</div>
                                                                <div>Codec: {f.acodec}</div>
                                                                <div>Bitrate: {bitrate ? `~${Math.round(bitrate)} kbps` : 'N/A'}</div>
                                                                <div>Size: {formatFileSize(bitrate, duration)}</div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}

                        {sortedHeights.length > 0 && (
                            <>
                                <div className="select-section-title">Video</div>
                                <div className="video-groups-container">
                                    {sortedHeights.map((height) => (
                                        <div key={height} className="resolution-row">
                                            <div className="resolution-label">{height}p</div>
                                            <div className="formats-pills-list">
                                                {videoFormatsByHeight[height]
                                                    .sort((a: any, b: any) => (b.tbr || 0) - (a.tbr || 0))
                                                    .map((f: any) => {
                                                        const totalTbr = (f.tbr || 0) + (bestAudioBitrate > 0 ? bestAudioBitrate : 0);
                                                        const roundedTbr = Math.round(totalTbr);
                                                        const formatId = `${f.ext.toLowerCase()}_${f.format_id}`;
                                                
                                                        return (
                                                            <div
                                                                key={f.format_id}
                                                                className={`format-pill ${selectedFormat === formatId ? 'selected' : ''}`}
                                                                onMouseEnter={handleMouseEnter}
                                                                onClick={() => { onSelect(formatId); setIsOpen(false); }}
                                                            >
                                                                <span className="pill-ext">{f.ext.toUpperCase()}</span>
                                                                <span className="pill-bitrate">~{roundedTbr}k</span>

                                                                <div className="format-tooltip">
                                                                    <div>Container: {f.ext.toUpperCase()}</div>
                                                                    <div>Codec: {f.vcodec}</div>
                                                                    <div>Video Bitrate: {f.tbr ? `~${Math.round(f.tbr)} kbps` : 'N/A'}</div>
                                                                    <div>Total Bitrate: ~{roundedTbr} kbps</div>
                                                                    <div>Size: {formatFileSize(totalTbr, duration)}</div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {sortedMutedHeights.length > 0 && (
                            <>
                                <div className="select-section-title">Video (No Audio)</div>
                                <div className="video-groups-container">
                                    {sortedMutedHeights.map((height) => (
                                        <div key={`muted_${height}`} className="resolution-row">
                                            <div className="resolution-label">{height}p 🔇</div>
                                            <div className="formats-pills-list">
                                                {mutedVideoFormatsByHeight[height]
                                                    .sort((a: any, b: any) => (b.tbr || 0) - (a.tbr || 0))
                                                    .map((f: any) => {
                                                        const formatId = `${f.ext.toLowerCase()}_${f.format_id}_muted`;
                                                        return (
                                                            <div
                                                                key={formatId}
                                                                className={`format-pill ${selectedFormat === formatId ? 'selected' : ''}`}
                                                                onMouseEnter={handleMouseEnter}
                                                                onClick={() => { onSelect(formatId); setIsOpen(false); }}
                                                            >
                                                                <span className="pill-ext">{f.ext.toUpperCase()}</span>
                                                                {f.tbr && <span className="pill-bitrate">~{Math.round(f.tbr)}k</span>}

                                                                <div className="format-tooltip">
                                                                    <div>Container: {f.ext.toUpperCase()}</div>
                                                                    <div>Bitrate: {f.tbr ? `~${Math.round(f.tbr)} kbps` : 'N/A'}</div>
                                                                    <div>Size: {formatFileSize(f.tbr, duration)}</div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                    </div>
                </div>
            )}
        </div>
    );
}