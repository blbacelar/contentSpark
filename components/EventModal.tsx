import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, Trash2, Calendar as CalendarIcon, Save, Monitor, Activity, Copy, Check, Clock, AlertCircle, Quote, MessageSquare, Hash, Target, Plus, FileText } from 'lucide-react';
import { ContentIdea, IdeaStatus, STATUS_COLORS, SOCIAL_PLATFORMS } from '../types';
import CustomSelect from './CustomSelect';

interface EventModalProps {
  isOpen: boolean;
  idea: ContentIdea | null;
  onClose: () => void;
  onSave: (updatedIdea: ContentIdea) => void;
  onDelete: (id: string) => void;
  isNew?: boolean;
}

// Helper Component for Header with Copy
const FieldHeader = ({ label, icon: Icon, text }: { label: string, icon: any, text?: string }) => {
    const { t } = useTranslation();
    const [copied, setCopied] = React.useState(false);

    const handleCopy = async () => {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Icon size={12} /> {label}
            </label>
            {text && (
                <button 
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 hover:text-[#1A1A1A] bg-gray-50 hover:bg-gray-200 px-2 py-1 rounded-md transition-all"
                    title={t('common.copy_clipboard')}
                >
                    {copied ? <Check size={10} className="text-green-600" /> : <Copy size={10} />}
                    {copied ? <span className="text-green-600">{t('common.copied')}</span> : <span>{t('common.copy')}</span>}
                </button>
            )}
        </div>
    );
};

const EventModal: React.FC<EventModalProps> = ({ isOpen, idea, onClose, onSave, onDelete, isNew = false }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = React.useState<ContentIdea | null>(null);
  const [showCopyFeedback, setShowCopyFeedback] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setFormData(idea);
    setShowCopyFeedback(false);
    setShowDeleteConfirm(false);
    setError(null);
  }, [idea, isOpen]);

  if (!isOpen || !formData) return null;

  const handleChange = (field: keyof ContentIdea, value: any) => {
    setFormData(prev => prev ? ({ ...prev, [field]: value }) : null);
    setError(null);
  };

  const togglePlatform = (platform: string) => {
    setFormData(prev => {
      if (!prev) return null;
      const currentPlatforms = prev.platform;
      if (currentPlatforms.includes(platform)) {
        return { ...prev, platform: currentPlatforms.filter(p => p !== platform) };
      } else {
        return { ...prev, platform: [...currentPlatforms, platform] };
      }
    });
  };

  const getMinDate = () => {
      if (!isNew) return undefined;
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
  };

  const handleSave = () => {
    if (formData) {
      if (!formData.title.trim()) {
        setError(t('modal.title_required'));
        return;
      }

      if (isNew && formData.date) {
         const minDate = getMinDate();
         if (minDate && formData.date < minDate) {
             setError(t('modal.date_past_error'));
             return;
         }
      }

      onSave(formData);
      onClose();
    }
  };

  const handleCopyContent = async () => {
    if (formData) {
      const content = formData.caption || formData.description;
      const textToCopy = `${formData.title}\n\n${content}\n\n${formData.hashtags || ''}`;
      
      try {
        await navigator.clipboard.writeText(textToCopy);
        setShowCopyFeedback(true);
        setTimeout(() => {
          setShowCopyFeedback(false);
        }, 2000);
      } catch (err) {
        console.error('Failed to copy text: ', err);
      }
    }
  };

  const statusOptions = Object.keys(STATUS_COLORS).map(status => ({
      value: status,
      label: t(`status.${status}`)
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A1A1A]/30 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-[24px] w-full max-w-5xl shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-100">
                <Activity size={18} className="text-[#1A1A1A]" />
             </div>
             <h3 className="text-lg font-bold text-[#1A1A1A]">{isNew ? t('modal.create_title') : t('modal.edit_title')}</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar flex-1">
          
          {/* Top Row: Title & Date - Uses 5 columns now */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
             <div className="md:col-span-3 space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{t('modal.title_label')}</label>
                <textarea 
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  rows={2}
                  className="w-full text-lg font-bold text-[#1A1A1A] placeholder-gray-300 border-b border-gray-200 outline-none focus:border-[#FFDA47] bg-transparent pb-2 transition-colors resize-none leading-snug"
                  placeholder={t('modal.title_placeholder')}
                />
             </div>
             <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{t('modal.scheduled_for')}</label>
                <div className="flex gap-3">
                  <div className="relative flex-1 bg-gray-50 border border-gray-200 rounded-xl focus-within:border-[#FFDA47] transition-colors">
                    <input 
                      type="date" 
                      value={formData.date || ''}
                      min={getMinDate()}
                      onChange={(e) => handleChange('date', e.target.value || null)}
                      className="w-full bg-transparent text-sm font-medium pl-9 pr-2 py-2.5 outline-none rounded-xl"
                    />
                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                  </div>
                  <div className="relative flex-1 bg-gray-50 border border-gray-200 rounded-xl focus-within:border-[#FFDA47] transition-colors">
                      <input 
                          type="time" 
                          value={formData.time || ''}
                          onChange={(e) => handleChange('time', e.target.value || null)}
                          className="w-full bg-transparent text-sm font-medium pl-9 pr-2 py-2.5 outline-none rounded-xl"
                      />
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                  </div>
                </div>
             </div>
          </div>

          {/* Middle Section: The Content */}
          <div className="space-y-6">

              {/* Description (Separated) */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText size={12} /> {t('modal.description_label')}
                </label>
                <textarea 
                  value={formData.description || ''}
                  onChange={(e) => handleChange('description', e.target.value)}
                  rows={3}
                  className="w-full text-sm text-gray-700 leading-relaxed placeholder-gray-300 border border-gray-200 rounded-xl p-4 outline-none focus:border-[#FFDA47] focus:ring-1 focus:ring-[#FFDA47] transition-all resize-none bg-white"
                  placeholder={t('modal.description_placeholder')}
                />
              </div>

              {/* Hook */}
              <div className="space-y-2">
                <FieldHeader label={t('modal.hook_label')} icon={Quote} text={formData.hook} />
                <input 
                    type="text"
                    value={formData.hook || ''}
                    onChange={(e) => handleChange('hook', e.target.value)}
                    placeholder={t('modal.hook_placeholder')}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-[#1A1A1A] outline-none focus:border-[#FFDA47] focus:ring-1 focus:ring-[#FFDA47] transition-all"
                />
              </div>              

              {/* Caption */}
              <div className="space-y-2">
                <FieldHeader label={t('modal.caption_label')} icon={MessageSquare} text={formData.caption} />
                <textarea 
                  value={formData.caption || ''}
                  onChange={(e) => handleChange('caption', e.target.value)}
                  rows={8}
                  className="w-full text-sm text-gray-700 leading-relaxed placeholder-gray-300 border border-gray-200 rounded-xl p-4 outline-none focus:border-[#FFDA47] focus:ring-1 focus:ring-[#FFDA47] transition-all resize-none bg-white"
                  placeholder={t('modal.caption_placeholder')}
                />
              </div>

              {/* CTA */}
              <div className="space-y-2">
                <FieldHeader label={t('modal.cta_label')} icon={Target} text={formData.cta} />
                <input 
                    type="text"
                    value={formData.cta || ''}
                    onChange={(e) => handleChange('cta', e.target.value)}
                    placeholder={t('modal.cta_placeholder')}
                    className="w-full bg-gray-50 border border-transparent rounded-xl px-4 py-3 text-sm font-medium text-[#1A1A1A] outline-none focus:bg-white focus:border-[#FFDA47] transition-all"
                />
              </div>
          </div>

          {/* Bottom Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
             
             {/* Hashtags */}
             <div className="space-y-2 md:col-span-2">
                 <FieldHeader label={t('modal.hashtags_label')} icon={Hash} text={formData.hashtags} />
                <input 
                    type="text"
                    value={formData.hashtags || ''}
                    onChange={(e) => handleChange('hashtags', e.target.value)}
                    placeholder={t('modal.hashtags_placeholder')}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-blue-600 font-medium outline-none focus:border-[#FFDA47] transition-all"
                />
             </div>

             {/* Status */}
             <div className="space-y-2">
               <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{t('modal.status_label')}</label>
               <CustomSelect
                value={formData.status}
                onChange={(val) => handleChange('status', val as IdeaStatus)}
                options={statusOptions}
                className={`border text-sm font-bold rounded-xl px-3 py-2.5 outline-none transition-all ${STATUS_COLORS[formData.status]}`}
              />
             </div>

             {/* Platforms */}
             <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <Monitor size={14} /> {t('modal.platforms_label')}
              </label>
              <div className="flex flex-wrap gap-2">
                {SOCIAL_PLATFORMS.map(p => (
                  <button
                    key={p}
                    onClick={() => togglePlatform(p)}
                    className={`
                      px-3 py-1.5 rounded-lg text-xs font-bold border transition-all
                      ${formData.platform.includes(p)
                        ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
                      }
                    `}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex justify-between items-center min-h-[80px]">
          {showDeleteConfirm ? (
            <div className="flex items-center justify-between w-full animate-fade-in bg-red-50 p-2 rounded-xl border border-red-100">
               <div className="flex items-center gap-2 px-2">
                   <AlertCircle className="w-5 h-5 text-red-600" />
                   <span className="text-xs font-bold text-red-700">{t('common.delete_confirm_msg')}</span>
               </div>
               <div className="flex items-center gap-2">
                   <button 
                       onClick={() => setShowDeleteConfirm(false)}
                       className="text-gray-500 hover:text-gray-700 px-3 py-1.5 text-xs font-bold transition-colors"
                   >
                       {t('common.cancel')}
                   </button>
                   <button 
                       onClick={() => { onDelete(formData.id); onClose(); }}
                       className="bg-red-500 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-600 transition-colors shadow-sm"
                   >
                       {t('common.confirm_delete')}
                   </button>
               </div>
            </div>
          ) : (
            <>
               {!isNew && (
                  <button 
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-red-500 text-sm font-bold hover:bg-red-50 px-4 py-2 rounded-xl transition-colors flex items-center gap-2"
                  >
                    <Trash2 size={16} /> {t('common.delete')}
                  </button>
               )}
               
               {error ? (
                   <div className="flex-1 px-4 text-center">
                       <span className="text-red-500 text-xs font-bold flex items-center justify-center gap-1">
                           <AlertCircle size={14} /> {error}
                       </span>
                   </div>
               ) : (
                   <div className="flex-1"></div>
               )}
              
              <div className="flex items-center gap-3">
                 {!isNew && (
                     <>
                        {showCopyFeedback && (
                            <span className="text-xs font-bold text-green-600 animate-fade-in flex items-center gap-1">
                                <Check size={14} /> {t('common.copied')}
                            </span>
                        )}
                        <button 
                           onClick={handleCopyContent}
                           disabled={showCopyFeedback}
                           className="text-gray-600 text-sm font-bold hover:bg-gray-100 px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
                         >
                           <Copy size={16} /> {t('common.copy_full')}
                         </button>
                     </>
                 )}

                  <button 
                    onClick={handleSave}
                    className="bg-[#FFDA47] text-[#1A1A1A] px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-[#FFC040] transition-colors flex items-center gap-2 shadow-sm"
                  >
                    {isNew ? (
                        <>
                            <Plus size={16} /> {t('common.add_calendar')}
                        </>
                    ) : (
                        <>
                            <Save size={16} /> {t('common.save')}
                        </>
                    )}
                  </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventModal;