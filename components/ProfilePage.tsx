import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { supabase, supabaseFetch } from '../services/supabase';
import { fetchUserPersona, saveUserPersona, updateUserPersona, fetchPersonas, deletePersona } from '../services/genai';

import { PersonaData, SOCIAL_PLATFORMS } from '../types';
import { ArrowLeft, Camera, Loader2, CheckCircle2, AlertCircle, Save, Trash2, Plus, Target, HeartCrack, HelpCircle, User, Info } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';

interface ProfilePageProps {
    onBack: () => void;
}

// Tooltip Component
const HelperTooltip = ({ text }: { text: string }) => {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Info size={14} className="text-gray-400 hover:text-[#1A1A1A] cursor-help transition-colors" />
                </TooltipTrigger>
                <TooltipContent>
                    <p className="w-64 text-center">{text}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
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
                    <Input
                        type="text"
                        value={item}
                        onChange={(e) => onChange(index, e.target.value)}
                        placeholder={placeholder}
                        className="flex-1"
                    />
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onRemove(index)}
                        className="text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                        title={t('profile.remove_item')}
                    >
                        <Trash2 size={16} />
                    </Button>
                </div>
            ))}
            <Button
                variant="ghost"
                onClick={onAdd}
                className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-[#1A1A1A] px-2 py-1 transition-colors"
            >
                <Plus size={16} /> Add another
            </Button>
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
    const [personas, setPersonas] = useState<PersonaData[]>([]);
    const [selectedPersonaId, setSelectedPersonaId] = useState<string | 'new'>('new');
    const [personaLoading, setPersonaLoading] = useState(false);
    const [savingPersona, setSavingPersona] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [activeTab, setActiveTab] = useState<number>(0);

    const defaultPersona: PersonaData = {
        name: '',
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
    };

    const [personaData, setPersonaData] = useState<PersonaData>(defaultPersona);

    // Feedback
    // const [toast, setToast] = useState<{ message: string; isError: boolean } | null>(null);

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
            loadPersonas();
        }
    }, [user]);

    // Toast removed, using sonner
    // const showToast = (message: string, isError: boolean = false) => {
    //     setToast({ message, isError });
    //     setTimeout(() => setToast(null), 4000);
    // };

    const loadPersonas = async () => {
        if (!user) return;
        setPersonaLoading(true);
        try {
            const data = await fetchPersonas(user.id); // Updated to fetch list
            if (data && data.length > 0) {
                setPersonas(data);
                // Select the first one by default
                selectPersona(data[0]);
            } else {
                setPersonas([]);
                setPersonaData(defaultPersona);
                setSelectedPersonaId('new');
            }
        } catch (error) {
            console.error('Failed to load personas', error);
        } finally {
            setPersonaLoading(false);
        }
    };

    const selectPersona = (p: PersonaData) => {
        setSelectedPersonaId(p.id || 'new');
        setPersonaData({
            ...p,
            pains_list: (p.pains_list && p.pains_list.length > 0) ? p.pains_list : [''],
            goals_list: (p.goals_list && p.goals_list.length > 0) ? p.goals_list : [''],
            questions_list: (p.questions_list && p.questions_list.length > 0) ? p.questions_list : ['']
        });
    };

    const handleCreateNew = () => {
        // Plan Restrictions
        const isPro = profile?.tier === 'pro';
        if (!isPro && personas.length >= 1) {
            toast.error("Upgrade to Pro to create multiple personas.");
            // Reset selection to the first existing persona if available
            if (personas.length > 0 && selectedPersonaId !== personas[0].id) {
                selectPersona(personas[0]);
            }
            return;
        }

        setSelectedPersonaId('new');
        setPersonaData(defaultPersona);
    };

    const handleDeletePersona = async () => {
        if (!user || selectedPersonaId === 'new') return;
        setShowDeleteConfirm(true);
    };

    const confirmDeletePersona = async () => {
        if (!user || selectedPersonaId === 'new') return;

        try {
            // Get Token
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error("No auth session found");

            await deletePersona(selectedPersonaId, user.id, token);
            // Remove from local list
            const updatedList = personas.filter(p => p.id !== selectedPersonaId);
            setPersonas(updatedList);

            if (updatedList.length > 0) {
                selectPersona(updatedList[0]);
            } else {
                handleCreateNew();
            }
            toast.success(t('profile.persona_deleted') || "Persona deleted");
            setShowDeleteConfirm(false);
        } catch (e) {
            toast.error(t('profile.delete_failed') || "Failed to delete persona");
        }
    };

    const updateProfile = async () => {
        try {
            if (!user) return;
            // Get session token for REST call
            // We can get it from useAuth session or trust the cookie? 
            // REST requires explicit token.
            // ProfilePage uses useAuth, so we have session theoretically?
            // AuthContext provides user, session, profile.
            // But session might be missing from destructuring in line 89.
            // Let's add session to destructuring.
            setLoading(true);

            // Note: We need the access token for the REST call. 
            // supabaseFetch handles headers but we need to pass the token.
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            if (!token) throw new Error("No auth session found");

            const updates = {
                first_name: firstName,
                last_name: lastName,
                avatar_url: avatarUrl,
                updated_at: new Date(),
            };

            // Using REST API via supabaseFetch to prevent SDK hangs
            // PATCH /rest/v1/profiles?id=eq.{user.id}
            await supabaseFetch(`profiles?id=eq.${user.id}`, {
                method: 'PATCH',
                body: JSON.stringify(updates),
                headers: {
                    'Prefer': 'return=representation'
                }
            }, token);

            await refreshProfile(); // Refresh context to sync UI using its own logic
            toast.success(t('profile.toast_updated'));
        } catch (error: any) {
            console.error('Error updating the data!', error);
            // Show more detailed error
            toast.error(error.message || 'Error updating profile.');
        } finally {
            setLoading(false);
        }
    };

    const handleSavePersona = async () => {
        if (!user) return;

        // Validation: Name is required
        if (!personaData.name || personaData.name.trim() === '') {
            toast.error(t('profile.name_required') || "Please enter a name for your Persona.");
            return;
        }

        setSavingPersona(true);

        // Clean up empty strings from lists before saving
        const cleanData = {
            ...personaData,
            pains_list: personaData.pains_list.filter(i => i.trim() !== ''),
            goals_list: personaData.goals_list.filter(i => i.trim() !== ''),
            questions_list: personaData.questions_list.filter(i => i.trim() !== ''),
            user_id: user.id
        };

        // If creating new, ensure ID is undefined
        if (selectedPersonaId === 'new') {
            delete cleanData.id;
        }

        try {
            let saved;
            let webhookFailed = false;

            // Get Token
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error("No auth session found");

            if (cleanData.id) {
                const result = await updateUserPersona(cleanData, token);
                // @ts-ignore
                webhookFailed = result.webhookFailed;
                saved = result.data; // key is 'data' from our new return shape
            } else {
                const result = await saveUserPersona(cleanData, token);
                // @ts-ignore
                webhookFailed = result.webhookFailed;
                saved = result;
            }

            if (webhookFailed) {
                toast.warning(t('profile.saved_local_webhook_failed') || "Persona saved locally, but AI sync failed.");
            } else {
                toast.success(t('profile.persona_saved') || "Persona saved successfully!");
            }

            // Refresh list
            if (saved) {
                // If it was new, add to list, else update list
                if (selectedPersonaId === 'new') {
                    setPersonas(prev => [saved, ...prev]);
                    selectPersona(saved);
                } else {
                    setPersonas(prev => prev.map(p => p.id === saved.id ? saved : p));
                    // Re-pad inputs
                    selectPersona(saved);
                }
            } else {
                // Fallback if no return data (shouldn't happen with new logic)
                loadPersonas();
            }


        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Failed to save persona. Please try again.');
        } finally {
            setSavingPersona(false);
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
            toast.error('Error uploading avatar!');
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
                <Button
                    variant="outline"
                    onClick={onBack}
                    className="flex items-center gap-2"
                >
                    <ArrowLeft size={16} /> {t('profile.back_calendar')}
                </Button>
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
                                <Label className="pl-3 text-xs font-bold uppercase tracking-wider text-gray-400">{t('auth.first_name')}</Label>
                                <Input
                                    type="text"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    placeholder={t('auth.name_placeholder')}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="pl-3 text-xs font-bold uppercase tracking-wider text-gray-400">{t('auth.last_name')}</Label>
                                <Input
                                    type="text"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    placeholder={t('auth.surname_placeholder')}
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between w-full mt-8 pt-6 border-t border-gray-100">
                            <Button
                                variant="ghost"
                                onClick={signOut}
                                className="text-xs font-bold text-red-500 hover:text-red-600 hover:bg-red-50"
                            >
                                {t('profile.sign_out')}
                            </Button>
                            <Button
                                onClick={updateProfile}
                                disabled={loading}
                                className="flex items-center justify-center gap-2 font-bold"
                            >
                                {loading ? <Loader2 className="animate-spin" size={16} /> : null}
                                {t('profile.save_changes')}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* --- CARD 2: STRATEGY CENTER --- */}
                <div id="tour-persona-card" className="w-full overflow-hidden rounded-[32px] bg-white shadow-sm animate-scale-in" style={{ animationDelay: '0.1s' }}>

                    {/* Header */}
                    <div className="p-8 pb-0 flex flex-col md:flex-row items-start justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-[#1A1A1A] tracking-tight">{t('profile.strategy_title')}</h2>
                            <p className="text-sm text-gray-500 font-medium mt-1">{t('profile.strategy_desc')}</p>
                        </div>

                        {/* Persona Selector */}
                        <div className="flex items-center gap-2">
                            <Select
                                value={selectedPersonaId}
                                onValueChange={(val) => {
                                    if (val === 'new') {
                                        // Check restrictions before switching
                                        const isPro = profile?.tier === 'pro';
                                        if (!isPro && personas.length >= 1) {
                                            toast.error("Upgrade to Pro to create multiple personas.");
                                            return;
                                        }
                                        handleCreateNew();
                                    } else {
                                        const p = personas.find(per => per.id === val);
                                        if (p) selectPersona(p);
                                    }
                                }}
                            >
                                <SelectTrigger className="w-[200px]">
                                    <SelectValue placeholder={t('profile.create_new_persona')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="new">+ {t('profile.create_new_persona')}</SelectItem>
                                    {personas.map(p => (
                                        <SelectItem key={p.id} value={p.id || 'err'}>{p.name || 'Untitled'}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {selectedPersonaId !== 'new' && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleDeletePersona}
                                    className="text-gray-400 hover:text-red-500 hover:bg-red-50"
                                    title={t('profile.delete_persona')}
                                >
                                    <Trash2 size={14} />
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Tabs */}
                    <Tabs value={String(activeTab)} onValueChange={(v) => setActiveTab(Number(v))} className="w-full">
                        <div className="px-6 border-b border-gray-100">
                            <TabsList className="bg-transparent h-auto p-0 gap-6">
                                {tabs.map((tab) => {
                                    const Icon = tab.icon;
                                    return (
                                        <TabsTrigger
                                            key={tab.id}
                                            value={String(tab.id)}
                                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#FFDA47] rounded-none pb-4 pt-2 px-1"
                                        >
                                            <div className="flex items-center gap-2">
                                                <Icon size={16} />
                                                {tab.label}
                                            </div>
                                        </TabsTrigger>
                                    )
                                })}
                            </TabsList>
                        </div>

                        <div className="p-8 pt-6 min-h-[400px]">
                            {personaLoading ? (
                                <div className="flex justify-center py-12">
                                    <Loader2 className="animate-spin text-gray-300 w-8 h-8" />
                                </div>
                            ) : (
                                <>
                                    <TabsContent value="0" className="mt-0">
                                        <div className="space-y-8 animate-fade-in">
                                            {/* Persona Name Input */}
                                            <div className="space-y-2">
                                                <Label className="pl-2 text-xs font-bold uppercase tracking-wider text-gray-500">{t('profile.persona_name')}</Label>
                                                <Input
                                                    type="text"
                                                    value={personaData.name || ''}
                                                    onChange={(e) => handlePersonaChange('name', e.target.value)}
                                                    placeholder="e.g. Corporate Execs, Busy Moms..."
                                                />
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                                                {/* Gender */}
                                                <div className="space-y-2">
                                                    <Label className="pl-2 text-xs font-bold uppercase tracking-wider text-gray-500">{t('profile.gender')}</Label>
                                                    <Select
                                                        value={personaData.gender || ''}
                                                        onValueChange={(val) => handlePersonaChange('gender', val)}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder={t('common.select')} />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {genderOptions.map(opt => (
                                                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                {/* Age Range */}
                                                <div className="space-y-2">
                                                    <Label className="pl-2 text-xs font-bold uppercase tracking-wider text-gray-500">{t('profile.age_range')}</Label>
                                                    <Input
                                                        type="text"
                                                        value={personaData.age_range}
                                                        onChange={(e) => handlePersonaChange('age_range', e.target.value)}
                                                        placeholder={t('placeholders.age')}
                                                    />
                                                </div>

                                                {/* Occupation */}
                                                <div className="space-y-2">
                                                    <Label className="pl-2 text-xs font-bold uppercase tracking-wider text-gray-500">{t('profile.occupation')}</Label>
                                                    <Input
                                                        type="text"
                                                        value={personaData.occupation}
                                                        onChange={(e) => handlePersonaChange('occupation', e.target.value)}
                                                        placeholder={t('placeholders.marketing')}
                                                    />
                                                </div>

                                                {/* Education */}
                                                <div className="space-y-2">
                                                    <Label className="pl-2 text-xs font-bold uppercase tracking-wider text-gray-500">{t('profile.education')}</Label>
                                                    <Select
                                                        value={personaData.education || ''}
                                                        onValueChange={(val) => handlePersonaChange('education', val)}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder={t('common.select')} />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {eduOptions.map(opt => (
                                                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                {/* Marital Status */}
                                                <div className="space-y-2">
                                                    <Label className="pl-2 text-xs font-bold uppercase tracking-wider text-gray-500">{t('profile.marital_status')}</Label>
                                                    <Select
                                                        value={personaData.marital_status || ''}
                                                        onValueChange={(val) => handlePersonaChange('marital_status', val)}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder={t('common.select')} />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {maritalOptions.map(opt => (
                                                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                {/* Income Level */}
                                                <div className="space-y-2">
                                                    <Label className="pl-2 text-xs font-bold uppercase tracking-wider text-gray-500">{t('profile.income_level')}</Label>
                                                    <Select
                                                        value={personaData.income_level || ''}
                                                        onValueChange={(val) => handlePersonaChange('income_level', val)}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder={t('common.select')} />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {incomeOptions.map(opt => (
                                                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                {/* Social Networks */}
                                                <div className="space-y-2 md:col-span-2">
                                                    <Label className="pl-2 text-xs font-bold uppercase tracking-wider text-gray-500">{t('profile.social_networks')}</Label>
                                                    <ToggleGroup
                                                        type="multiple"
                                                        variant="outline"
                                                        value={personaData.social_networks ? personaData.social_networks.split(',') : []}
                                                        onValueChange={(val) => handlePersonaChange('social_networks', val.join(','))}
                                                        className="justify-start flex-wrap gap-2"
                                                    >
                                                        {SOCIAL_PLATFORMS.map((platform) => (
                                                            <ToggleGroupItem
                                                                key={platform}
                                                                value={platform}
                                                                aria-label={`Toggle ${platform}`}
                                                                className="data-[state=on]:bg-[#FFDA47] data-[state=on]:text-[#1A1A1A] data-[state=on]:font-bold border-gray-200"
                                                            >
                                                                {platform}
                                                            </ToggleGroupItem>
                                                        ))}
                                                    </ToggleGroup>
                                                </div>

                                                {/* Has Children Toggle */}
                                                <div className="md:col-span-2 flex items-center gap-3 pl-2 py-1">
                                                    <Switch
                                                        checked={personaData.has_children}
                                                        onCheckedChange={(checked) => handlePersonaChange('has_children', checked)}
                                                    />
                                                    <span className="text-sm font-bold text-[#1A1A1A]">{t('profile.has_children')}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="1" className="mt-0">
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="text-sm font-bold text-[#1A1A1A]">{t('profile.tabs.pains')}</h3>
                                                <HelperTooltip text={t('profile.pains_desc')} />
                                            </div>
                                            <DynamicList
                                                items={personaData.pains_list}
                                                onChange={(idx, val) => updateList('pains_list', idx, val)}
                                                onAdd={() => addListItem('pains_list')}
                                                onRemove={(idx) => removeListItem('pains_list', idx)}
                                                placeholder={t('placeholders.pains')}
                                            />
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="2" className="mt-0">
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="text-sm font-bold text-[#1A1A1A]">{t('profile.tabs.goals')}</h3>
                                                <HelperTooltip text={t('profile.goals_desc')} />
                                            </div>
                                            <DynamicList
                                                items={personaData.goals_list}
                                                onChange={(idx, val) => updateList('goals_list', idx, val)}
                                                onAdd={() => addListItem('goals_list')}
                                                onRemove={(idx) => removeListItem('goals_list', idx)}
                                                placeholder={t('placeholders.goals')}
                                            />
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="3" className="mt-0">
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="text-sm font-bold text-[#1A1A1A]">{t('profile.tabs.questions')}</h3>
                                                <HelperTooltip text={t('profile.questions_desc')} />
                                            </div>
                                            <DynamicList
                                                items={personaData.questions_list}
                                                onChange={(idx, val) => updateList('questions_list', idx, val)}
                                                onAdd={() => addListItem('questions_list')}
                                                onRemove={(idx) => removeListItem('questions_list', idx)}
                                                placeholder={t('placeholders.questions')}
                                            />
                                        </div>
                                    </TabsContent>

                                    {/* Save Button / Delete Confirm */}
                                    <div className="flex justify-end pt-8 mt-4 border-t border-gray-100">
                                        {showDeleteConfirm ? (
                                            <div className="flex items-center justify-between w-full animate-fade-in bg-red-50 p-2 rounded-xl border border-red-100">
                                                <div className="flex items-center gap-2 px-2">
                                                    <AlertCircle className="w-5 h-5 text-red-600" />
                                                    <span className="text-xs font-bold text-red-700">{t('common.delete_confirm_msg')}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setShowDeleteConfirm(false)}
                                                        className="text-gray-500 hover:text-gray-700 px-3 h-8 text-xs font-bold"
                                                    >
                                                        {t('common.cancel')}
                                                    </Button>
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={confirmDeletePersona}
                                                        className="px-4 h-8 rounded-lg text-xs font-bold shadow-sm"
                                                    >
                                                        {t('common.confirm_delete')}
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <Button
                                                onClick={handleSavePersona}
                                                disabled={savingPersona}
                                                className="font-bold text-[#1A1A1A] bg-[#FFDA47] hover:bg-[#FFC040] hover:text-[#1A1A1A]"
                                                size="lg"
                                            >
                                                {savingPersona ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                                {t('profile.save_strategy')}
                                            </Button>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </Tabs>
                </div>

            </div>
            {/* Manual Toast Removed */}
        </div>
    );
}