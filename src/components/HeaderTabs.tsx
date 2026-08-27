interface HeaderTabsProps {
    activeTab: 'main' | 'settings';
    setActiveTab: (tab: 'main' | 'settings') => void;
}

export function HeaderTabs({ activeTab, setActiveTab }: HeaderTabsProps) {
    return (
        <div className="download-box" style={{ marginBottom: '25px', marginTop: '0' }}>
            <button
                className="btn btn-primary"
                onClick={() => setActiveTab('main')}
                style={{ flex: 1, width: 'auto', backgroundColor: activeTab === 'main' ? '#007acc' : '#2d2d2d', color: '#fff' }}
            >
                📥 Downloader
            </button>
            <button
                className="btn btn-primary"
                onClick={() => setActiveTab('settings')}
                style={{ flex: 1, width: 'auto', backgroundColor: activeTab === 'settings' ? '#007acc' : '#2d2d2d', color: '#fff' }}
            >
                ⚙️ Settings
            </button>
        </div>
    );
}