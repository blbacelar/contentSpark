import React from 'react';
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
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toneOptions = Object.values(Tone).map(tone => ({
      value: tone,
      label: tone
  }));

  const hasCredits = credits > 0;

  return (
    <div className="bg-white rounded-[28px] p-6 space-y-6">
        <div className="text-center mb-2">
            <h3 className="text-xl font-bold text-[#1A1A1A]">Strategy Engine</h3>
            <p className="text-sm text-gray-400">Define parameters for your new content batch.</p>
        </div>

        {/* Niche/Topic */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider pl-2">
            <Target className="w-3.5 h-3.5" /> Topic
          </label>
          <input
            type="text"
            name="topic"
            value={formData.topic}
            onChange={handleChange}
            placeholder="e.g., Vegan Cooking"
            className="w-full bg-gray-50 border-2 border-transparent focus:border-[#FFDA47] focus:bg-white rounded-xl px-5 py-3 text-[#1A1A1A] font-medium placeholder-gray-400 outline-none transition-all"
          />
        </div>

        {/* Target Audience */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider pl-2">
            <Users className="w-3.5 h-3.5" /> Audience
          </label>
          <input
            type="text"
            name="audience"
            value={formData.audience}
            onChange={handleChange}
            placeholder="e.g., Busy Moms"
            className="w-full bg-gray-50 border-2 border-transparent focus:border-[#FFDA47] focus:bg-white rounded-xl px-5 py-3 text-[#1A1A1A] font-medium placeholder-gray-400 outline-none transition-all"
          />
        </div>

        {/* Tone */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider pl-2">
            <Mic className="w-3.5 h-3.5" /> Tone
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
                <span>Consulting AI...</span>
                </>
            ) : !hasCredits ? (
                <>
                <ZapOff className="w-4 h-4" />
                Out of Credits
                </>
            ) : (
                <>
                <Sparkles className="w-4 h-4" />
                Generate Magic
                </>
            )}
            </button>
            {!hasCredits && (
                <p className="text-center text-xs font-bold text-red-500">Upgrade to continue creating.</p>
            )}
        </div>
    </div>
  );
};

export default SparkForm;