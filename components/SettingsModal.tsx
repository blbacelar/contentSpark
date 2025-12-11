import React, { useState } from 'react';
import { X, Webhook, CheckCircle2 } from 'lucide-react';
import { WebhookConfig } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: WebhookConfig;
  setConfig: (config: WebhookConfig) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, config, setConfig }) => {
  const [localUrl, setLocalUrl] = useState(config.url);

  if (!isOpen) return null;

  const handleSave = () => {
    setConfig({
      useWebhook: !!localUrl,
      url: localUrl
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A1A1A]/20 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden animate-scale-in border border-white">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-[#1A1A1A] text-lg font-bold flex items-center gap-2">
            <div className="p-2 bg-[#F5F5F5] rounded-full">
                <Webhook className="w-4 h-4 text-[#1A1A1A]" />
            </div>
            Connection
          </h3>
          <button onClick={onClose} className="p-2 bg-[#F5F5F5] rounded-full text-gray-500 hover:text-black hover:bg-gray-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-8 space-y-6">
          <p className="text-sm font-medium text-gray-500">
            Configure external processing via n8n. Leaving this empty defaults to the internal AI Engine.
          </p>
          
          <div className="space-y-3">
            <label className="text-xs font-bold text-[#1A1A1A] uppercase tracking-wider">
              n8n Webhook URL
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

        <div className="p-6 bg-[#F9F9F9] flex justify-end">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 bg-[#1A1A1A] text-white px-6 py-3 rounded-2xl text-sm font-bold hover:bg-black transition-transform hover:scale-105"
          >
            <CheckCircle2 className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;