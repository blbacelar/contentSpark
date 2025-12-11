import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { fetchUserPersona, saveUserPersona, updateUserPersona } from '../services/genai';
import { PersonaData } from '../types';
import { ArrowLeft, Camera, Loader2, CheckCircle2, AlertCircle, Save, Trash2, Plus, Target, HeartCrack, HelpCircle, User, Info } from 'lucide-react';
import CustomSelect from './CustomSelect';

interface ProfilePageProps {
    onBack: () => void;
}

// Tooltip Component
const Tooltip = ({ text }: { text: string }) => {
  return (
    <div className="group relative flex items-center">
      <Info size={14} className="text-gray-400 hover:text-[#1A1A1A] cursor-help transition-colors" />
      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-[#1A1A1A] text-white text-xs font-medium rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 shadow-xl pointer-events-none z-50 text-center leading-relaxed transform translate-y-2 group-hover:translate-y-0">
        {text}
        <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[#1A1A1A]"></div>
      </div>
    </div>
  );
};

// Internal Component for Dynamic Lists
const DynamicList = ({ 
  items, 
  onChange, 
  onAdd, 
  onRemove, 
  placeholder 
}: { 
  items: string[], 
  onChange: (idx: number, val: string) => void, 
  onAdd: () => void, 
  onRemove: (idx: number) => void,
  placeholder: string
}) => {
  const { t } = useTranslation();
  
  return (
    <div className="space-y-3 animate-fade-in">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2 group">
           <input
             type="text"
             value={item}
             onChange={(e) => onChange(index, e.target.value)}
             placeholder={placeholder}
             className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-5 py-3 text-sm font-medium text-[#1A1A1A] placeholder-gray-400 outline-none focus:border-[#FFDA47] focus:ring-1 focus:ring-[#FFDA47] transition-all"
           />
           <button 
             onClick={() => onRemove(index)}
             className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
             title={t('profile.remove_item')}
           >
             <Trash2 size={16} />
           </button>
        </div>
      ))}
      <button 
        onClick={onAdd}
        className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-[#1A1A1A] px-2 py-1 transition-colors"
      >
        <Plus size={16} /> Add another
      </button>
    </div>
  );
};

export default function ProfilePage({ onBack }: ProfilePageProps) {
    const { user, profile, signOut, refreshProfile } = useAuth();
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    
    // Profile State - Initialize from context immediately if available
    const [firstName, setFirstName] = useState(profile?.first_name || '');
    const [lastName, setLastName] = useState(profile?.last_name || '');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url || null);
    
    // Persona State
    const [personaLoading, setPersonaLoading] = useState(false);
    const [savingPersona, setSavingPersona] = useState(false);
    const [hasExistingPersona, setHasExistingPersona] = useState(false);
    const [activeTab, setActiveTab] = useState<number>(0);

    const [personaData, setPersonaData] = useState<PersonaData>({
        gender: '',
        age_range: '',
        occupation: '',
        education: '',
        marital_status: '',
        has_children: false,
        income_level: '',
        social_networks: '',
        pain_points: '',
        goals: '',
        pains_list: [''],
        goals_list: [''],
        questions_list: ['']
    });

    // Feedback
    const [toast, setToast] = useState<{ message: string; isError: boolean } | null>(null);

    // Sync state with profile updates from context
    useEffect(() => {
        if (profile) {
            setFirstName(profile.first_name || '');
            setLastName(profile.last_name || '');
            setAvatarUrl(profile.avatar_url || null);
        }
    }, [profile]);

    useEffect(() => {
        if (user) {
            getPersona();
        }
    }, [user]);

    const showToast = (message: string, isError: boolean = false) => {
        setToast({ message, isError });
        setTimeout(() => setToast(null), 4000);
    };

    const getPersona = async () => {
        if (!user) return;
        setPersonaLoading(true);
        try {
            const data = await fetchUserPersona(user.id);
            if (data) {
                // Ensure arrays exist, if not provide defaults
                const pList = (data.pains_list && data.pains_list.length > 0) ? data.pains_list : [''];
                const gList = (data.goals_list && data.goals_list.length > 0) ? data.goals_list : [''];
                const qList = (data.questions_list && data.questions_list.length > 0) ? data.questions_list : [''];

                setPersonaData(prev => ({ 
                    ...prev, 
                    ...data,
                    pains_list: pList,
                    goals_list: gList,
                    questions_list: qList
                }));
                setHasExistingPersona(true);
            } else {
                setHasExistingPersona(false);
            }
        } catch (error) {
            console.error('Failed to load persona', error);
        } finally {
            setPersonaLoading(false);
        }
    };

    const updateProfile = async () => {
        try {
            setLoading(true);
            const updates = {
                id: user!.id,
                first_name: firstName,
                last_name: lastName,
                avatar_url: avatarUrl,
                updated_at: new Date(),
            };

            const { error } = await supabase.from('profiles').upsert(updates);

            if (error) {
                throw error;
            }

            await refreshProfile(); // Refresh context to sync UI
            showToast(t('profile.toast_updated'));
        } catch (error) {
            console.error('Error updating the data!', error);
            showToast('Error updating profile.', true);
        } finally {
            setLoading(false);
        }
    };

    const handleSavePersona = async () => {
        if (!user) return;
        setSavingPersona(true);
        
        // Clean up empty strings from lists before saving, but ensure at least one empty string remains for UI if user clears all
        const cleanData = {
            ...personaData,
            pains_list: personaData.pains_list.filter(i => i.trim() !== ''),
            goals_list: personaData.goals_list.filter(i => i.trim() !== ''),
            questions_list: personaData.questions_list.filter(i => i.trim() !== ''),
            user_id: user.id
        };

        try {
            if (hasExistingPersona) {
                await updateUserPersona(cleanData);
            } else {
                await saveUserPersona(cleanData);
                setHasExistingPersona(true);
            }
            
            // Re-pad arrays for UI after save
            setPersonaData(prev => ({
                ...prev,
                pains_list: cleanData.pains_list.length ? cleanData.pains_list : [''],
                goals_list: cleanData.goals_list.length ? cleanData.goals_list : [''],
                questions_list: cleanData.questions_list.length ? cleanData.questions_list : ['']
            }));

            showToast(t('profile.toast_saved'));
        } catch (error: any) {
            console.error(error);
            showToast(error.message || 'Failed to save persona. Please try again.', true);
        } finally {
            setSavingPersona(false);
        }
    };

    const handleClearPersona = () => {
        if (window.confirm("Are you sure you want to clear all persona fields?")) {
            setPersonaData(prev => ({
                ...prev,
                gender: '',
                age_range: '',
                occupation: '',
                education: '',
                marital_status: '',
                has_children: false,
                income_level: '',
                social_networks: '',
                pain_points: '',
                goals: '',
                pains_list: [''],
                goals_list: [''],
                questions_list: ['']
            }));
            showToast(t('profile.toast_cleared'));
        }
    };

    const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setUploading(true);
            if (!event.target.files || event.target.files.length === 0) {
                throw new Error('You must select an image to upload.');
            }
            const file = event.target.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${user!.id}/${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;
            const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
            if (uploadError) throw uploadError;
            const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
            
            // Update local state and trigger profile update
            const newAvatarUrl = data.publicUrl;
            setAvatarUrl(newAvatarUrl);
            
            // Note: We don't save to DB immediately here to allow user to confirm with "Save Changes", 
            // but for UX it might be better to show preview. Current implementation shows preview via avatarUrl state.
        } catch (error) {
            showToast('Error uploading avatar!', true);
        } finally {
            setUploading(false);
        }
    };

    const handlePersonaChange = (field: keyof PersonaData, value: any) => {
        setPersonaData(prev => ({ ...prev, [field]: value }));
    };

    // List Handlers
    const updateList = (field: 'pains_list' | 'goals_list' | 'questions_list', idx: number, val: string) => {
        setPersonaData(prev => {
            const newList = [...prev[field]];
            newList[idx] = val;
            return { ...prev, [field]: newList };
        });
    };
    const addListItem = (field: 'pains_list' | 'goals_list' | 'questions_list') => {
        setPersonaData(prev => ({ ...prev, [field]: [...prev[field], ''] }));
    };
    const removeListItem = (field: 'pains_list' | 'goals_list' | 'questions_list', idx: number) => {
        setPersonaData(prev => {
            const newList = prev[field].filter((_, i) => i !== idx);
            // Always keep at least one input
            if (newList.length === 0) return { ...prev, [field]: [''] };
            return { ...prev, [field]: newList };
        });
    };

    // Select Options
    const genderOptions = [
        { value: 'Male', label: t('options.gender.Male') },
        { value: 'Female', label: t('options.gender.Female') },
        { value: 'Non-binary', label: t('options.gender.NonBinary') },
        { value: 'All', label: t('options.gender.All') },
    ];
    const eduOptions = [
        { value: 'High School', label: t('options.education.HighSchool') },
        { value: 'Bachelor\'s', label: t('options.education.Bachelor') },
        { value: 'Master\'s', label: t('options.education.Master') },
        { value: 'PhD', label: t('options.education.PhD') },
    ];
    const maritalOptions = [
        { value: 'Single', label: t('options.marital.Single') },
        { value: 'Married', label: t('options.marital.Married') },
        { value: 'Divorced', label: t('options.marital.Divorced') },
    ];
    const incomeOptions = [
        { value: 'Low', label: t('options.income.Low') },
        { value: 'Middle', label: t('options.income.Middle') },
        { value: 'High', label: t('options.income.High') },
        { value: 'Affluent', label: t('options.income.Affluent') },
    ];

    const tabs = [
        { id: 0, label: t('profile.tabs.identity'), icon: User },
        { id: 1, label: t('profile.tabs.pains'), icon: HeartCrack },
        { id: 2, label: t('profile.tabs.goals'), icon: Target },
        { id: 3, label: t('profile.tabs.questions'), icon: HelpCircle },
    ];

    return (
        <div className="flex flex-col h-screen w-full items-center bg-[#F2F2F2] p-4 overflow-y-auto custom-scrollbar">
            {/* Header / Nav */}
            <div className="w-full max-w-6xl mb-4 flex items-center justify-between flex-shrink-0">
                <button 
                    onClick={onBack}
                    className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-gray-600 shadow-sm hover:text-[#1A1A1A] hover:shadow-md transition-all"
                >
                    <ArrowLeft size={16} /> {t('profile.back_calendar')}
                </button>
            </div>

            {/* Main Content Stack */}
            <div className="w-full max-w-6xl space-y-6 pb-20">

                {/* --- CARD 1: USER PROFILE --- */}
                <div className="w-full overflow-hidden rounded-[32px] bg-white shadow-sm animate-scale-in">
                    <div className="p-8 flex flex-col items-center">
                        {/* Avatar */}
                        <div className="relative mb-8 group">
                            <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-gray-50 bg-gray-100 shadow-inner flex items-center justify-center relative">
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                                ) : (
                                    <span className="text-3xl font-bold text-gray-300">
                                        {firstName ? firstName[0].toUpperCase() : user?.email?.[0]?.toUpperCase()}
                                    </span>
                                )}
                                {uploading && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm z-10">
                                        <Loader2 className="animate-spin text-white" />
                                    </div>
                                )}
                            </div>
                            <label className="absolute bottom-0 right-0 cursor-pointer rounded-full bg-[#1A1A1A] p-2 text-white shadow-lg transition-transform hover:scale-110 hover:bg-black z-20">
                                <Camera size={14} />
                                <input
                                    type="file"
                                    id="single"
                                    accept="image/*"
                                    onChange={uploadAvatar}
                                    disabled={uploading}
                                    className="hidden"
                                />
                            </label>
                        </div>

                        {/* Inputs */}
                        <div className="w-full grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="pl-3 text-xs font-bold uppercase tracking-wider text-gray-400">{t('auth.first_name')}</label>
                                <input 
                                    type="text"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    className="w-full rounded-2xl bg-gray-50 px-5 py-3 text-sm font-bold text-[#1A1A1A] placeholder-gray-300 outline-none focus:ring-2 focus:ring-[#FFDA47] transition-all"
                                    placeholder={t('auth.name_placeholder')}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="pl-3 text-xs font-bold uppercase tracking-wider text-gray-400">{t('auth.last_name')}</label>
                                <input 
                                    type="text"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    className="w-full rounded-2xl bg-gray-50 px-5 py-3 text-sm font-bold text-[#1A1A1A] placeholder-gray-300 outline-none focus:ring-2 focus:ring-[#FFDA47] transition-all"
                                    placeholder={t('auth.surname_placeholder')}
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between w-full mt-8 pt-6 border-t border-gray-100">
                            <button 
                                onClick={signOut}
                                className="text-xs font-bold text-red-500 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors"
                            >
                                {t('profile.sign_out')}
                            </button>
                            <button 
                                onClick={updateProfile}
                                disabled={loading}
                                className="flex items-center justify-center gap-2 rounded-xl bg-[#1A1A1A] px-6 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-black hover:shadow-lg disabled:opacity-70 hover:scale-105"
                            >
                                {loading ? <Loader2 className="animate-spin" size={16} /> : null}
                                {t('profile.save_changes')}
                            </button>
                        </div>
                    </div>
                </div>

                {/* --- CARD 2: STRATEGY CENTER --- */}
                <div id="tour-persona-card" className="w-full overflow-hidden rounded-[32px] bg-white shadow-sm animate-scale-in" style={{ animationDelay: '0.1s' }}>
                    
                    {/* Header */}
                    <div className="p-8 pb-0 flex items-start justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-[#1A1A1A] tracking-tight">{t('profile.strategy_title')}</h2>
                            <p className="text-sm text-gray-500 font-medium mt-1">{t('profile.strategy_desc')}</p>
                        </div>
                        <button 
                            onClick={handleClearPersona}
                            className="text-xs font-bold text-red-400 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5"
                            title={t('profile.clear_fields')}
                        >
                            <Trash2 size={14} /> {t('profile.clear_all')}
                        </button>
                    </div>

                    {/* Tab Navigation */}
                    <div className="mt-6 px-6 border-b border-gray-100 flex gap-6 overflow-x-auto custom-scrollbar">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`
                                        flex items-center gap-2 pb-4 text-sm font-medium transition-all whitespace-nowrap
                                        ${isActive 
                                            ? 'text-[#1A1A1A] font-bold border-b-2 border-[#FFDA47]' 
                                            : 'text-gray-400 hover:text-gray-600'}
                                    `}
                                >
                                    <Icon size={16} />
                                    {tab.label}
                                </button>
                            )
                        })}
                    </div>

                    <div className="p-8 pt-6 min-h-[400px]">
                        {personaLoading ? (
                             <div className="flex justify-center py-12">
                                <Loader2 className="animate-spin text-gray-300 w-8 h-8" />
                             </div>
                        ) : (
                            <>
                            {/* --- TAB 1: IDENTITY --- */}
                            {activeTab === 0 && (
                                <div className="space-y-8 animate-fade-in">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                                        {/* Gender */}
                                        <div className="space-y-2">
                                            <label className="pl-2 text-xs font-bold uppercase tracking-wider text-gray-500">{t('profile.gender')}</label>
                                            <CustomSelect 
                                                value={personaData.gender || t('common.select')}
                                                onChange={(val) => handlePersonaChange('gender', val)}
                                                options={genderOptions}
                                                className="bg-gray-50 rounded-xl px-4 py-3 text-sm font-bold text-[#1A1A1A] focus:ring-2 focus:ring-[#FFDA47]"
                                            />
                                        </div>

                                        {/* Age Range */}
                                        <div className="space-y-2">
                                            <label className="pl-2 text-xs font-bold uppercase tracking-wider text-gray-500">{t('profile.age_range')}</label>
                                            <input 
                                                type="text"
                                                value={personaData.age_range}
                                                onChange={(e) => handlePersonaChange('age_range', e.target.value)}
                                                placeholder={t('placeholders.age')}
                                                className="w-full rounded-xl bg-gray-50 px-4 py-3 text-sm font-bold text-[#1A1A1A] placeholder-gray-300 outline-none focus:ring-2 focus:ring-[#FFDA47] transition-all"
                                            />
                                        </div>

                                        {/* Occupation */}
                                        <div className="space-y-2">
                                            <label className="pl-2 text-xs font-bold uppercase tracking-wider text-gray-500">{t('profile.occupation')}</label>
                                            <input 
                                                type="text"
                                                value={personaData.occupation}
                                                onChange={(e) => handlePersonaChange('occupation', e.target.value)}
                                                placeholder={t('placeholders.marketing')}
                                                className="w-full rounded-xl bg-gray-50 px-4 py-3 text-sm font-bold text-[#1A1A1A] placeholder-gray-300 outline-none focus:ring-2 focus:ring-[#FFDA47] transition-all"
                                            />
                                        </div>

                                        {/* Education */}
                                        <div className="space-y-2">
                                            <label className="pl-2 text-xs font-bold uppercase tracking-wider text-gray-500">{t('profile.education')}</label>
                                            <CustomSelect 
                                                value={personaData.education || t('common.select')}
                                                onChange={(val) => handlePersonaChange('education', val)}
                                                options={eduOptions}
                                                className="bg-gray-50 rounded-xl px-4 py-3 text-sm font-bold text-[#1A1A1A] focus:ring-2 focus:ring-[#FFDA47]"
                                            />
                                        </div>

                                        {/* Marital Status */}
                                        <div className="space-y-2">
                                            <label className="pl-2 text-xs font-bold uppercase tracking-wider text-gray-500">{t('profile.marital_status')}</label>
                                            <CustomSelect 
                                                value={personaData.marital_status || t('common.select')}
                                                onChange={(val) => handlePersonaChange('marital_status', val)}
                                                options={maritalOptions}
                                                className="bg-gray-50 rounded-xl px-4 py-3 text-sm font-bold text-[#1A1A1A] focus:ring-2 focus:ring-[#FFDA47]"
                                            />
                                        </div>

                                        {/* Income Level */}
                                        <div className="space-y-2">
                                            <label className="pl-2 text-xs font-bold uppercase tracking-wider text-gray-500">{t('profile.income_level')}</label>
                                            <CustomSelect 
                                                value={personaData.income_level || t('common.select')}
                                                onChange={(val) => handlePersonaChange('income_level', val)}
                                                options={incomeOptions}
                                                className="bg-gray-50 rounded-xl px-4 py-3 text-sm font-bold text-[#1A1A1A] focus:ring-2 focus:ring-[#FFDA47]"
                                            />
                                        </div>

                                        {/* Social Networks */}
                                        <div className="space-y-2 md:col-span-2">
                                            <label className="pl-2 text-xs font-bold uppercase tracking-wider text-gray-500">{t('profile.social_networks')}</label>
                                            <input 
                                                type="text"
                                                value={personaData.social_networks}
                                                onChange={(e) => handlePersonaChange('social_networks', e.target.value)}
                                                placeholder={t('placeholders.networks')}
                                                className="w-full rounded-xl bg-gray-50 px-4 py-3 text-sm font-bold text-[#1A1A1A] placeholder-gray-300 outline-none focus:ring-2 focus:ring-[#FFDA47] transition-all"
                                            />
                                        </div>

                                        {/* Has Children Toggle */}
                                        <div className="md:col-span-2 flex items-center gap-3 pl-2 py-1">
                                            <button 
                                                type="button"
                                                onClick={() => handlePersonaChange('has_children', !personaData.has_children)}
                                                className={`
                                                    relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#FFDA47] focus:ring-offset-2
                                                    ${personaData.has_children ? 'bg-[#FFDA47]' : 'bg-gray-200'}
                                                `}
                                            >
                                                <span 
                                                    className={`
                                                        pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
                                                        ${personaData.has_children ? 'translate-x-5' : 'translate-x-0'}
                                                    `} 
                                                />
                                            </button>
                                            <span className="text-sm font-bold text-[#1A1A1A]">{t('profile.has_children')}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* --- TAB 2: PAINS & FRUSTRATIONS --- */}
                            {activeTab === 1 && (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-sm font-bold text-[#1A1A1A]">{t('profile.tabs.pains')}</h3>
                                        <Tooltip text={t('profile.pains_desc')} />
                                    </div>
                                    <DynamicList 
                                        items={personaData.pains_list}
                                        onChange={(idx, val) => updateList('pains_list', idx, val)}
                                        onAdd={() => addListItem('pains_list')}
                                        onRemove={(idx) => removeListItem('pains_list', idx)}
                                        placeholder={t('placeholders.pains')}
                                    />
                                </div>
                            )}

                            {/* --- TAB 3: DREAMS & GOALS --- */}
                            {activeTab === 2 && (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-sm font-bold text-[#1A1A1A]">{t('profile.tabs.goals')}</h3>
                                        <Tooltip text={t('profile.goals_desc')} />
                                    </div>
                                    <DynamicList 
                                        items={personaData.goals_list}
                                        onChange={(idx, val) => updateList('goals_list', idx, val)}
                                        onAdd={() => addListItem('goals_list')}
                                        onRemove={(idx) => removeListItem('goals_list', idx)}
                                        placeholder={t('placeholders.goals')}
                                    />
                                </div>
                            )}

                            {/* --- TAB 4: BURNING QUESTIONS --- */}
                            {activeTab === 3 && (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-sm font-bold text-[#1A1A1A]">{t('profile.tabs.questions')}</h3>
                                        <Tooltip text={t('profile.questions_desc')} />
                                    </div>
                                    <DynamicList 
                                        items={personaData.questions_list}
                                        onChange={(idx, val) => updateList('questions_list', idx, val)}
                                        onAdd={() => addListItem('questions_list')}
                                        onRemove={(idx) => removeListItem('questions_list', idx)}
                                        placeholder={t('placeholders.questions')}
                                    />
                                </div>
                            )}

                            {/* Save Button (Always Visible) */}
                            <div className="flex justify-end pt-8 mt-4 border-t border-gray-100">
                                <button 
                                    onClick={handleSavePersona}
                                    disabled={savingPersona}
                                    className="flex items-center gap-2 bg-[#FFDA47] text-[#1A1A1A] px-8 py-3.5 rounded-xl text-base font-bold shadow-md hover:shadow-xl hover:bg-[#FFC040] hover:scale-[1.02] transition-all disabled:opacity-70 disabled:hover:scale-100"
                                >
                                    {savingPersona ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                    {t('profile.save_strategy')}
                                </button>
                            </div>
                            </>
                        )}
                    </div>
                </div>

            </div>
            
            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold text-white shadow-2xl animate-fade-in z-50 ${toast.isError ? 'bg-red-500' : 'bg-[#1A1A1A]'}`}>
                    {toast.isError ? <AlertCircle size={18} /> : <CheckCircle2 size={18} className={toast.isError ? 'text-white' : 'text-[#FFDA47]'} />}
                    {toast.message}
                </div>
            )}
        </div>
    );
}