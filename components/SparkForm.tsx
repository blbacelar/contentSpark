import React from 'react';
import { useTranslation } from 'react-i18next';
import { FormData, Tone, PersonaData } from '../types';
import { Sparkles, Users, Target, Mic, ZapOff, UserCheck, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { cn } from '../utils';

interface SparkFormProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  onSubmit: () => void;
  isLoading: boolean;
  credits: number;
  personas: PersonaData[];
}

const SparkForm: React.FC<SparkFormProps> = ({ formData, setFormData, onSubmit, isLoading, credits, personas }) => {
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

      {/* Persona Select */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider pl-2">
          <UserCheck className="w-3.5 h-3.5" /> {t('form.persona')}
        </Label>
        <Select
          value={formData.persona_id || undefined}
          onValueChange={(val) => setFormData(prev => ({ ...prev, persona_id: val }))}
        >
          <SelectTrigger className="w-full bg-gray-50 border-transparent focus:bg-white rounded-xl h-12 text-base font-medium text-[#1A1A1A]">
            <SelectValue placeholder={t('common.select')} />
          </SelectTrigger>
          <SelectContent>
            {personas.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name || 'Untitled Persona'}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Niche/Topic */}
      <div className="space-y-2">
        <Label htmlFor="tour-generator-input" className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider pl-2">
          <Target className="w-3.5 h-3.5" /> {t('form.topic')}
        </Label>
        <Input
          id="tour-generator-input"
          type="text"
          name="topic"
          value={formData.topic}
          onChange={handleChange}
          placeholder={t('form.topic_placeholder')}
          className="w-full bg-gray-50 border-transparent focus-visible:bg-white focus-visible:ring-[#FFDA47] rounded-xl h-12 px-5 text-base font-medium placeholder:text-gray-400 transition-all shadow-none"
        />
      </div>

      {/* Target Audience */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider pl-2">
          <Users className="w-3.5 h-3.5" /> {t('form.audience')}
        </Label>
        <Input
          type="text"
          name="audience"
          value={formData.audience}
          onChange={handleChange}
          placeholder={t('form.audience_placeholder')}
          className="w-full bg-gray-50 border-transparent focus-visible:bg-white focus-visible:ring-[#FFDA47] rounded-xl h-12 px-5 text-base font-medium placeholder:text-gray-400 transition-all shadow-none"
        />
      </div>

      {/* Tone */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider pl-2">
          <Mic className="w-3.5 h-3.5" /> {t('form.tone')}
        </Label>
        <Select
          value={formData.tone}
          onValueChange={(val) => setFormData(prev => ({ ...prev, tone: val as Tone }))}
        >
          <SelectTrigger className="w-full bg-gray-50 border-transparent focus:bg-white rounded-xl h-12 text-base font-medium text-[#1A1A1A]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {toneOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Action Button */}
      <div className="space-y-2">
        <Button
          onClick={onSubmit}
          disabled={isLoading || !formData.topic || !formData.audience || !hasCredits}
          className={cn(
            "w-full mt-2 h-14 rounded-xl font-bold text-base tracking-wide flex items-center justify-center gap-3 transition-all duration-300 transform shadow-none",
            isLoading ? "bg-[#1A1A1A] text-white opacity-80" :
              !hasCredits ? "bg-gray-100 text-gray-400" :
                "bg-[#FFDA47] text-[#1A1A1A] hover:bg-[#FFC040] hover:scale-[1.02] hover:shadow-lg hover:shadow-yellow-400/20"
          )}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
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
        </Button>
        {!hasCredits && (
          <p className="text-center text-xs font-bold text-red-500">{t('form.upgrade_text')}</p>
        )}
      </div>
    </div>
  );
};

export default SparkForm;