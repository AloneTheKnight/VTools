import '../styles/Notification.css'

interface NotificationState {
    text: string;
    type: 'wait' | 'success' | 'error';
}

interface NotificationProps {
    status: NotificationState | null;
    timerKey: number;
    onAnimationEnd: () => void;
}

export function Notification({ status, timerKey, onAnimationEnd }: NotificationProps) {
    return (
        <div className={`notification-toast ${status ? 'visible' : ''} ${status?.type || ''}`}>
            <div className="notification-content">
                {status?.text}
            </div>
        
            {status && (
                <div
                    key={timerKey}
                    className={`notification-timer ${status.type}`}
                    onAnimationEnd={onAnimationEnd}
                />
            )}
        </div>
    );
}