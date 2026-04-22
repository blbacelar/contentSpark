
import React from 'react';
import { UserCircle2, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PersonaMissingAlertProps {
    onClose: () => void;
    onGoToProfile: () => void;
    onContinue: () => void;
}

export function PersonaMissingAlert({ onClose, onGoToProfile, onContinue }: PersonaMissingAlertProps) {
    const { t } = useTranslation();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A1A1A]/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-[24px] w-full max-w-sm shadow-2xl overflow-hidden animate-scale-in p-6">
                <div className="flex flex-col items-center text-center space-y-4">
                    <div className="w-12 h-12 bg-yellow-50 rounded-full flex items-center justify-center">
                        <UserCircle2 className="w-6 h-6 text-[#E6C200]" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-[#1A1A1A]">{t('alert.missing_persona_title')}</h3>
                        <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                            {t('alert.missing_persona_desc')}
                        </p>
                    </div>
                    <div className="flex flex-col w-full gap-2 pt-2">
                        <button
                            onClick={() => {
                                onClose();
                                onGoToProfile();
                            }}
                            className="w-full bg-[#1A1A1A] text-white py-3 rounded-xl font-bold text-sm hover:bg-black transition-all shadow-lg shadow-black/5"
                        >
                            {t('alert.setup_profile')}
                        </button>
                        <button
                            onClick={onContinue}
                            className="w-full bg-white text-gray-500 py-3 rounded-xl font-bold text-sm hover:bg-gray-50 hover:text-gray-800 transition-all flex items-center justify-center gap-1"
                        >
                            {t('alert.continue_anyway')} <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Separating Overlay for cleaner file structure
import { ContentIdea } from '../../types';

export function IdeaDragOverlay({ activeIdea }: { activeIdea: ContentIdea | null }) {
    if (!activeIdea) return null;

    return (
        <div className="bg-white border border-[#FFDA47] shadow-xl p-3 rounded-lg w-48 rotate-3 cursor-grabbing z-50">
            <p className="font-bold text-sm text-[#1A1A1A] truncate">{activeIdea.title}</p>
        </div>
    );
}
