import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Webhook, CheckCircle2, Bell, Settings as SettingsIcon } from 'lucide-react';
import { WebhookConfig, UserSettings } from '../types';
import { useAuth } from '../context/AuthContext';
import { fetchUserSettings, updateUserSettings } from '../services/user';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: WebhookConfig;
  setConfig: (config: WebhookConfig) => void;
}

type Tab = 'general' | 'notifications';

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, config, setConfig }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [localUrl, setLocalUrl] = useState(config.url);

  // Notification Settings State
  const [notificationSettings, setNotificationSettings] = useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      setIsLoading(true);
      fetchUserSettings(user.id)
        .then(settings => {
          if (settings) {
            setNotificationSettings(settings);
          } else {
            // Default settings if not found
            setNotificationSettings({
              user_id: user.id,
              notify_on_team_join: true,
              notify_on_idea_due: true,
              idea_due_threshold_hours: 24
            });
          }
        })
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleSave = async () => {
    // Save Webhook Config
    setConfig({
      useWebhook: !!localUrl,
      url: localUrl
    });

    // Save Notification Settings
    if (user && notificationSettings) {
      try {
        await updateUserSettings(notificationSettings);
      } catch (error) {
        console.error("Failed to save settings", error);
        // Ideally show a toast here, but for now we just log
      }
    }

    onClose();
  };

  const toggleNotification = (key: keyof UserSettings) => {
    if (!notificationSettings) return;
    setNotificationSettings(prev => prev ? ({
      ...prev,
      [key]: !prev[key as keyof UserSettings]
    }) : null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A1A1A]/20 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden animate-scale-in border border-white flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h3 className="text-[#1A1A1A] text-lg font-bold flex items-center gap-2">
            <div className="p-2 bg-[#F5F5F5] rounded-full">
              <SettingsIcon className="w-4 h-4 text-[#1A1A1A]" />
            </div>
            {t('common.settings')}
          </h3>
          <button onClick={onClose} className="p-2 bg-[#F5F5F5] rounded-full text-gray-500 hover:text-black hover:bg-gray-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-6 border-b border-gray-100 shrink-0">
          <button
            onClick={() => setActiveTab('general')}
            className={`py-3 px-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'general' ? 'border-[#FFDA47] text-[#1A1A1A]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            {t('settings.general_tab')}
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`py-3 px-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'notifications' ? 'border-[#FFDA47] text-[#1A1A1A]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            {t('settings.notifications_tab')}
          </button>
        </div>

        <div className="p-8 overflow-y-auto custom-scrollbar">
          {activeTab === 'general' ? (
            <div className="space-y-6">
              <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <Webhook className="w-5 h-5 text-gray-500 mt-1" />
                <p className="text-sm font-medium text-gray-500 leading-relaxed">
                  {t('settings.description')}
                </p>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-[#1A1A1A] uppercase tracking-wider">
                  {t('settings.webhook_url')}
                </label>
                <input
                  type="url"
                  value={localUrl}
                  onChange={(e) => setLocalUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-[#F5F5F5] border-2 border-transparent focus:border-[#FFE566] rounded-2xl px-5 py-3 text-sm text-[#1A1A1A] placeholder-gray-400 outline-none transition-all"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {isLoading ? (
                <div className="text-center py-8 text-gray-400">{t('common.loading')}</div>
              ) : notificationSettings && (
                <div className="space-y-6">
                  {/* Team Join Notification */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded-lg shadow-sm">
                        <Bell className="w-4 h-4 text-[#1A1A1A]" />
                      </div>
                      <span className="text-sm font-bold text-[#1A1A1A]">{t('settings.notify_team_join')}</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={notificationSettings.notify_on_team_join}
                        onChange={() => toggleNotification('notify_on_team_join')}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1A1A1A]"></div>
                    </label>
                  </div>

                  {/* Idea Due Notification */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded-lg shadow-sm">
                        <Bell className="w-4 h-4 text-[#1A1A1A]" />
                      </div>
                      <span className="text-sm font-bold text-[#1A1A1A]">{t('settings.notify_idea_due')}</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={notificationSettings.notify_on_idea_due}
                        onChange={() => toggleNotification('notify_on_idea_due')}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1A1A1A]"></div>
                    </label>
                  </div>

                  {/* Threshold Input */}
                  {notificationSettings.notify_on_idea_due && (
                    <div className="space-y-3 pl-4 border-l-2 border-gray-100">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        {t('settings.idea_due_threshold')}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max="72"
                          value={notificationSettings.idea_due_threshold_hours}
                          onChange={(e) => setNotificationSettings(posts => posts ? ({ ...posts, idea_due_threshold_hours: parseInt(e.target.value) || 24 }) : null)}
                          className="w-24 bg-[#F5F5F5] border-2 border-transparent focus:border-[#FFE566] rounded-xl px-4 py-2 text-sm text-[#1A1A1A] outline-none transition-all font-bold text-center"
                        />
                        <span className="text-sm font-medium text-gray-400">hours</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-6 bg-[#F9F9F9] flex justify-end shrink-0">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 bg-[#1A1A1A] text-white px-6 py-3 rounded-2xl text-sm font-bold hover:bg-black transition-transform hover:scale-105"
          >
            <CheckCircle2 className="w-4 h-4" />
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;