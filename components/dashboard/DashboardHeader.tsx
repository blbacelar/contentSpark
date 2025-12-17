
import React from 'react';
import { format, addMonths } from 'date-fns';
import { enUS, ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Settings, LogOut, Globe, Zap, Bell } from 'lucide-react';
import { Button } from '../ui/button';
import NotificationList from '../NotificationList';
import { useTranslation } from 'react-i18next';

interface DashboardHeaderProps {
    currentDate: Date;
    setCurrentDate: (date: Date) => void;
    isFetching: boolean;
    isPt: boolean;
    toggleLanguage: () => void;
    credits: number;
    isLowCredits: boolean;
    notifications: any[];
    isNotificationsOpen: boolean;
    setIsNotificationsOpen: (open: boolean) => void;
    onMarkAsRead: (id: string) => void;
    onMarkAllRead: () => void;
    onOpenSettings: () => void;
    onSignOut: () => void;
}

export function DashboardHeader({
    currentDate,
    setCurrentDate,
    isFetching,
    isPt,
    toggleLanguage,
    credits,
    isLowCredits,
    notifications,
    isNotificationsOpen,
    setIsNotificationsOpen,
    onMarkAsRead,
    onMarkAllRead,
    onOpenSettings,
    onSignOut
}: DashboardHeaderProps) {
    const { t } = useTranslation();
    const dateLocale = isPt ? ptBR : enUS;

    return (
        <header className="flex items-center justify-between px-8 py-5 bg-[#F2F2F2] border-b border-gray-200/50">
            <div className="flex items-center gap-6">
                <h2 className="text-2xl font-bold text-[#1A1A1A] tracking-tight capitalize">
                    {format(currentDate, 'MMMM yyyy', { locale: dateLocale })}
                </h2>
                <div className="flex items-center gap-1 bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
                    <button onClick={() => setCurrentDate(addMonths(currentDate, -1))} className="p-1.5 hover:bg-gray-100 rounded-md text-gray-600">
                        <ChevronLeft size={18} />
                    </button>
                    <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-gray-600 hover:bg-gray-100 rounded-md">
                        {t('calendar.today')}
                    </button>
                    <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-1.5 hover:bg-gray-100 rounded-md text-gray-600">
                        <ChevronRight size={18} />
                    </button>
                </div>
                {isFetching && <span className="text-xs text-gray-400 font-medium animate-pulse">{t('calendar.syncing')}</span>}
            </div>

            <div className="flex items-center gap-3">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleLanguage}
                    className="text-gray-400 hover:text-gray-600 transition-colors gap-2"
                    title={t('common.switch_language')}
                >
                    <Globe className="w-4 h-4" />
                    <span className="text-sm font-medium">{isPt ? 'PT' : 'EN'}</span>
                </Button>

                <div className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors
                    ${isLowCredits ? 'bg-red-50 text-red-600 border-red-100' : 'bg-gray-100 text-gray-700 border-gray-200'}
                `}>
                    <Zap size={14} className={isLowCredits ? 'fill-red-600' : 'fill-gray-400 text-gray-400'} />
                    {credits} {t('calendar.credits')}
                </div>

                <div className="relative">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                        className="w-10 h-10 rounded-xl hover:bg-gray-100 relative"
                        title="Notifications"
                    >
                        <Bell size={20} className="text-gray-600" />
                        {notifications.some(n => !n.read_at) && (
                            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
                        )}
                    </Button>
                    {isNotificationsOpen && (
                        <NotificationList
                            notifications={notifications}
                            onClose={() => setIsNotificationsOpen(false)}
                            onMarkAsRead={onMarkAsRead}
                            onMarkAllRead={onMarkAllRead}
                        />
                    )}
                </div>

                <Button
                    variant="outline"
                    size="icon"
                    onClick={onOpenSettings}
                    className="w-10 h-10 rounded-xl"
                    title={t('common.settings')}
                >
                    <Settings size={20} />
                </Button>
                <Button
                    variant="default"
                    size="icon"
                    onClick={onSignOut}
                    className="w-10 h-10 rounded-xl bg-[#1A1A1A] hover:bg-black text-white"
                    title={t('common.sign_out')}
                >
                    <LogOut size={20} />
                </Button>
            </div>
        </header>
    );
}
