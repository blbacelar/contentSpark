import React, { useEffect, useRef } from 'react';
import { Notification } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { enUS, ptBR } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { Check, Bell } from 'lucide-react';

interface NotificationListProps {
    notifications: Notification[];
    onClose: () => void;
    onMarkAsRead: (id: string) => void;
    onMarkAllRead: () => void;
}

const NotificationList: React.FC<NotificationListProps> = ({ notifications, onClose, onMarkAsRead, onMarkAllRead }) => {
    const { t, i18n } = useTranslation();
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Close when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                onClose();
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [onClose]);

    const getDateLocale = () => {
        return (i18n.resolvedLanguage || 'en').startsWith('pt') ? ptBR : enUS;
    };

    return (
        <div
            ref={wrapperRef}
            className="absolute top-16 right-8 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-[60] animate-scale-in origin-top-right"
        >
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-sm font-bold text-[#1A1A1A]">{t('settings.notifications_tab')}</h3>
                {notifications.some(n => !n.read_at) && (
                    <button
                        onClick={onMarkAllRead}
                        className="text-xs font-bold text-[#1A1A1A] hover:bg-gray-100 px-2 py-1 rounded-lg transition-colors"
                    >
                        Mark all read
                    </button>
                )}
            </div>

            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                {notifications.length === 0 ? (
                    <div className="p-8 text-center flex flex-col items-center gap-3 text-gray-400">
                        <Bell className="w-8 h-8 opacity-20" />
                        <span className="text-sm font-medium">No updates yet</span>
                    </div>
                ) : (
                    notifications.map((notification) => (
                        <div
                            key={notification.id}
                            className={`p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors relative group ${!notification.read_at ? 'bg-blue-50/30' : ''}`}
                            onClick={() => !notification.read_at && onMarkAsRead(notification.id)}
                        >
                            <div className="flex items-start gap-3">
                                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!notification.read_at ? 'bg-blue-500' : 'bg-gray-300'}`} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-[#1A1A1A] truncate">{notification.title}</p>
                                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notification.message}</p>
                                    <span className="text-[10px] text-gray-400 font-medium mt-2 block">
                                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: getDateLocale() })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default NotificationList;
