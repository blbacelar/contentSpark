import React from 'react';
import { useTranslation } from 'react-i18next';
import { FormData, Tone } from '../types';
import { Sparkles, Users, Target, Mic, ZapOff } from 'lucide-react';
import CustomSelect from './CustomSelect';

interface SparkFormProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  onSubmit: () => void;
  isLoading: boolean;
  credits: number;
}

const SparkForm: React.FC<SparkFormProps> = ({ formData, setFormData, onSubmit, isLoading, credits }) => {
  const { t } = useTranslation();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toneOptions = Object.values(Tone).map(tone => ({
      value: tone,
      label: t(`tones.${tone}`)
  }));

  const hasCredits = credits > 0;

  return (
    <div className="bg-white rounded-[28px] p-6 space-y-6">
        <div className="text-center mb-2">
            <h3 className="text-xl font-bold text-[#1A1A1A]">{t('form.title')}</h3>
            <p className="text-sm text-gray-400">{t('form.subtitle')}</p>
        </div>

        {/* Niche/Topic */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider pl-2">
            <Target className="w-3.5 h-3.5" /> {t('form.topic')}
          </label>
          <input
            id="tour-generator-input"
            type="text"
            name="topic"
            value={formData.topic}
            onChange={handleChange}
            placeholder={t('form.topic_placeholder')}
            className="w-full bg-gray-50 border-2 border-transparent focus:border-[#FFDA47] focus:bg-white rounded-xl px-5 py-3 text-[#1A1A1A] font-medium placeholder-gray-400 outline-none transition-all"
          />
        </div>

        {/* Target Audience */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider pl-2">
            <Users className="w-3.5 h-3.5" /> {t('form.audience')}
          </label>
          <input
            type="text"
            name="audience"
            value={formData.audience}
            onChange={handleChange}
            placeholder={t('form.audience_placeholder')}
            className="w-full bg-gray-50 border-2 border-transparent focus:border-[#FFDA47] focus:bg-white rounded-xl px-5 py-3 text-[#1A1A1A] font-medium placeholder-gray-400 outline-none transition-all"
          />
        </div>

        {/* Tone */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider pl-2">
            <Mic className="w-3.5 h-3.5" /> {t('form.tone')}
          </label>
          <CustomSelect
            value={formData.tone}
            onChange={(val) => setFormData(prev => ({ ...prev, tone: val as Tone }))}
            options={toneOptions}
            className="bg-gray-50 border-2 border-transparent focus:border-[#FFDA47] focus:bg-white rounded-xl px-5 py-3 text-[#1A1A1A] font-medium"
          />
        </div>

        {/* Action Button */}
        <div className="space-y-2">
            <button
            onClick={onSubmit}
            disabled={isLoading || !formData.topic || !formData.audience || !hasCredits}
            className={`
                w-full mt-2 py-4 rounded-xl font-bold text-base tracking-wide
                flex items-center justify-center gap-3 transition-all duration-300 transform
                ${isLoading 
                ? 'bg-[#1A1A1A] text-white cursor-not-allowed opacity-80' 
                : !hasCredits
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-[#FFDA47] text-[#1A1A1A] hover:bg-[#FFC040] hover:scale-[1.02] hover:shadow-lg hover:shadow-yellow-400/20 active:scale-[0.98]'
                }
            `}
            >
            {isLoading ? (
                <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{t('form.consulting_ai')}</span>
                </>
            ) : !hasCredits ? (
                <>
                <ZapOff className="w-4 h-4" />
                {t('form.out_of_credits_btn')}
                </>
            ) : (
                <>
                <Sparkles className="w-4 h-4" />
                {t('form.generate_btn')}
                </>
            )}
            </button>
            {!hasCredits && (
                <p className="text-center text-xs font-bold text-red-500">{t('form.upgrade_text')}</p>
            )}
        </div>
    </div>
  );
};

export default SparkForm;