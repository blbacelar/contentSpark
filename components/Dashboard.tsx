import React, { useState, useEffect } from 'react';
import { DndContext, DragOverlay, DragEndEvent, useSensor, useSensors, MouseSensor, TouchSensor } from '@dnd-kit/core';
import { format, addMonths } from 'date-fns';
import { enUS, ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Settings, LogOut, Loader2, AlertCircle, CheckCircle2, UserCircle2, ArrowRight, Zap, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Joyride, { CallBackProps, EVENTS, STATUS, Step } from 'react-joyride';
import { FormData, Tone, ContentIdea, WebhookConfig, PersonaData, IdeaStatus } from '../types';
import Sidebar from './Sidebar';
import CalendarGrid from './IdeaGrid';
import EventModal from './EventModal';
import SparkForm from './SparkForm';
import SettingsModal from './SettingsModal';
import ProfilePage from './ProfilePage';
import { generateContent, updateContent, fetchUserIdeas, deleteContent, fetchUserPersona, fetchPersonas, generateId, createContentIdea, completeUserOnboarding } from '../services/genai';
import { useAuth } from '../context/AuthContext';

// Default Webhook URL
const DEFAULT_WEBHOOK = "https://n8n.bacelardigital.tech/webhook/f7465ddb-c12a-4f30-9917-7720c62876bc";

type ViewState = 'calendar' | 'profile';

// Define steps outside component to prevent re-render resets
const TOUR_STEPS: Step[] = [
    {
        target: 'body',
        placement: 'center',
        content: "Welcome to ContentSpark! Let's get your content engine running in 3 simple steps.",
        disableBeacon: true,
    },
    {
        target: '#tour-persona-card',
        content: "First, define your Audience here. The more details (Pains, Goals) you add, the better your AI ideas will be.",
        placement: 'left',
    },
    {
        target: '#tour-generator-input',
        content: "Enter a topic here (e.g., 'Vegan Diet') and click Generate to see the magic happen.",
        placement: 'bottom',
    },
    {
        target: '#tour-calendar',
        content: "Drag and drop your generated ideas onto the calendar to schedule your week.",
        placement: 'center',
    }
];

export default function Dashboard() {
    const { user, profile, refreshProfile, updateCredits, signOut } = useAuth();
    const { t, i18n } = useTranslation();

    // --- State ---
    const [view, setView] = useState<ViewState>('calendar');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [ideas, setIdeas] = useState<ContentIdea[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isFetching, setIsFetching] = useState(false);

    // Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<IdeaStatus | 'All'>('All');

    // Persona State
    const [userPersona, setUserPersona] = useState<PersonaData | null>(null);
    const [allPersonas, setAllPersonas] = useState<PersonaData[]>([]);
    const [showPersonaAlert, setShowPersonaAlert] = useState(false);

    // Toast State
    const [toast, setToast] = useState<{ message: string; isError: boolean } | null>(null);

    // Modals
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [editingIdea, setEditingIdea] = useState<ContentIdea | null>(null);

    // Joyride State
    const [runTour, setRunTour] = useState(false);
    const [stepIndex, setStepIndex] = useState(0);

    // Configuration
    const [formData, setFormData] = useState<FormData>({
        topic: '',
        audience: '',
        tone: Tone.Professional
    });

    const [webhookConfig, setWebhookConfig] = useState<WebhookConfig>({
        useWebhook: true,
        url: DEFAULT_WEBHOOK
    });

    // --- Handlers ---
    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
    );

    const triggerToast = (message: string, isError: boolean = false) => {
        setToast({ message, isError });
        setTimeout(() => setToast(null), 4000);
    };

    const refreshData = async () => {
        if (user) {
            setIsFetching(true);
            try {
                const [ideasData, personasList] = await Promise.all([
                    fetchUserIdeas(user.id),
                    fetchPersonas(user.id)
                ]);
                setIdeas(ideasData);
                setAllPersonas(personasList);
                // Default active persona to first one if not set
                if (!userPersona && personasList.length > 0) {
                    setUserPersona(personasList[0]);
                    setFormData(prev => ({ ...prev, persona_id: personasList[0].id }));
                }
            } catch (err) {
                console.error(err);
            } finally {
                setIsFetching(false);
            }
        }
    };

    // Load User Data
    useEffect(() => {
        refreshData();
    }, [user]);

    // Check for onboarding status
    useEffect(() => {
        if (profile && !profile.has_completed_onboarding) {
            setRunTour(true);
        }
    }, [profile]);

    const handleJoyrideCallback = async (data: CallBackProps) => {
        const { status, type, index, action } = data;

        if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
            setRunTour(false);
            setIsFormOpen(false);
            if (user) {
                await completeUserOnboarding(user.id);
                await refreshProfile();
            }
        } else if (type === EVENTS.STEP_AFTER && action === 'next') {
            const nextIndex = index + 1;

            if (index === 0) {
                setRunTour(false);
                setView('profile');
                setTimeout(() => {
                    setStepIndex(nextIndex);
                    setRunTour(true);
                }, 200);
            }
            else if (index === 1) {
                setRunTour(false);
                setView('calendar');
                setTimeout(() => {
                    setIsFormOpen(true);
                    setTimeout(() => {
                        setStepIndex(nextIndex);
                        setRunTour(true);
                    }, 500);
                }, 100);
            }
            else if (index === 2) {
                setRunTour(false);
                setIsFormOpen(false);
                setTimeout(() => {
                    setStepIndex(nextIndex);
                    setRunTour(true);
                }, 500);
            }
            else {
                setStepIndex(nextIndex);
            }
        }
    };

    const safeLower = (s?: string) => (s || '').toLowerCase();

    const calendarFilteredIdeas = ideas.filter(i => {
        const query = searchQuery.toLowerCase().trim();
        const matchesSearch = !query || (
            safeLower(i.title).includes(query) ||
            safeLower(i.description).includes(query) ||
            safeLower(i.hook).includes(query) ||
            safeLower(i.caption).includes(query) ||
            safeLower(i.cta).includes(query) ||
            safeLower(i.hashtags).includes(query) ||
            (Array.isArray(i.platform) && i.platform.some(p => safeLower(p).includes(query)))
        );
        const matchesStatus = statusFilter === 'All' || i.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const isPt = (i18n.resolvedLanguage || i18n.language || 'en').startsWith('pt');

    const validateAndGenerate = async () => {
        if (profile && profile.credits <= 0) {
            triggerToast(t('sidebar.out_of_credits'), true);
            return;
        }

        // Find selected persona object
        const selectedPersona = allPersonas.find(p => p.id === formData.persona_id) || userPersona;

        const isPersonaEmpty = !selectedPersona || (
            !selectedPersona.occupation &&
            !selectedPersona.pain_points &&
            !selectedPersona.goals &&
            !selectedPersona.age_range
        );

        if (isPersonaEmpty) {
            setShowPersonaAlert(true);
            setIsFormOpen(false);
        } else {
            // Pass the specific selected persona
            await performGeneration(selectedPersona);
        }
    };

    const performGeneration = async (specificPersona?: PersonaData) => {
        if (!user || !profile) return;
        const targetPersona = specificPersona || userPersona;

        setIsGenerating(true);
        setIsFormOpen(true);
        setShowPersonaAlert(false);

        try {
            const newIdeas = await generateContent(
                formData,
                webhookConfig.useWebhook ? webhookConfig.url : undefined,
                user.id,
                targetPersona,
                isPt ? 'pt' : 'en'
            );

            setIdeas(prev => [...prev, ...newIdeas]);
            setIsFormOpen(false);
            triggerToast(t('form.generate_btn') + " Success!", false);
            updateCredits(Math.max(0, profile.credits - 1));

        } catch (err: any) {
            console.error(err);
            const errorMessage = err.message || "";
            if (errorMessage.includes("402") || errorMessage.toLowerCase().includes("credits")) {
                triggerToast(t('form.upgrade_text'), true);
                refreshProfile();
            } else {
                triggerToast(errorMessage || "Failed to generate ideas.", true);
            }
        } finally {
            setIsGenerating(false);
        }
    };

    const handleManualCreate = () => {
        const newIdea: ContentIdea = {
            id: generateId(),
            title: '',
            description: '',
            status: 'Pending',
            platform: [],
            date: null,
            time: null,
            hook: '',
            caption: '',
            cta: '',
            hashtags: ''
        };
        setEditingIdea(newIdea);
    };

    const handleDragStart = (event: any) => {
        setActiveId(event.active.id);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        if (!over) return;

        const ideaId = active.id as string;
        const overId = over.id as string;

        setIdeas(prev => prev.map(idea => {
            if (idea.id !== ideaId) return idea;
            let updatedIdea = { ...idea };
            let changed = false;

            if (overId === 'backlog' && idea.date !== null) {
                updatedIdea = { ...idea, date: null, time: null, status: 'Pending' };
                changed = true;
            } else if (overId.match(/^\d{4}-\d{2}-\d{2}$/)) {
                if (idea.date !== overId) {
                    updatedIdea = { ...idea, date: overId, time: idea.time || '09:00' };
                    changed = true;
                }
            }

            if (changed && user) {
                updateContent({
                    id: updatedIdea.id,
                    date: updatedIdea.date,
                    time: updatedIdea.time,
                    status: updatedIdea.status,
                    platform: updatedIdea.platform
                }, user.id).catch(err => {
                    console.error("Drag update failed", err);
                    triggerToast(err.message || "Failed to update idea", true);
                });
                return updatedIdea;
            }
            return idea;
        }));
    };

    const updateIdea = async (updated: ContentIdea) => {
        const isNew = !ideas.some(i => i.id === updated.id);
        setIdeas(prev => {
            if (!isNew) {
                return prev.map(i => i.id === updated.id ? updated : i);
            } else {
                return [...prev, updated];
            }
        });

        if (user) {
            try {
                if (isNew) {
                    await createContentIdea(updated, user.id);
                } else {
                    await updateContent({
                        id: updated.id,
                        date: updated.date,
                        time: updated.time,
                        status: updated.status,
                        platform: updated.platform,
                        title: updated.title,
                        description: updated.description,
                        hook: updated.hook,
                        caption: updated.caption,
                        cta: updated.cta,
                        hashtags: updated.hashtags
                    }, user.id);
                }
            } catch (err: any) {
                console.error("Operation failed", err);
                triggerToast(err.message || "Failed to save changes", true);
            }
        }
    };

    const deleteIdea = (id: string) => {
        setIdeas(prev => prev.filter(i => i.id !== id));
        if (user) {
            deleteContent(id, user.id);
        }
    };

    const toggleLanguage = () => {
        const newLang = isPt ? 'en' : 'pt';
        i18n.changeLanguage(newLang);
    };

    const activeIdea = activeId ? ideas.find(i => i.id === activeId) : null;
    const isNewIdea = editingIdea ? !ideas.some(i => i.id === editingIdea.id) : false;
    const credits = profile?.credits ?? 0;
    const isLowCredits = credits <= 3;
    const dateLocale = isPt ? ptBR : enUS;

    return (
        <>
            <Joyride
                steps={TOUR_STEPS}
                run={runTour}
                stepIndex={stepIndex}
                continuous
                showSkipButton
                callback={handleJoyrideCallback}
                disableOverlayClose={true}
                spotlightClicks={true}
                styles={{
                    options: {
                        primaryColor: '#FFDA47',
                        textColor: '#1A1A1A',
                        zIndex: 10000,
                    },
                    tooltip: {
                        borderRadius: '16px',
                        padding: '20px',
                    },
                    buttonNext: {
                        backgroundColor: '#FFDA47',
                        color: '#1A1A1A',
                        fontWeight: 'bold',
                        borderRadius: '8px',
                        outline: 'none',
                    },
                    buttonBack: {
                        color: '#888',
                    }
                }}
            />
            {view === 'profile' ? (
                <ProfilePage onBack={() => {
                    setView('calendar');
                    refreshData();
                }} />
            ) : (
                <div className="flex h-screen w-screen overflow-hidden bg-[#F2F2F2] relative">
                    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>

                        {toast && (
                            <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl shadow-2xl z-[100] animate-fade-in flex items-center gap-3 font-bold text-sm border ${toast.isError ? 'bg-red-500 text-white border-red-600' : 'bg-[#1A1A1A] text-white border-black'}`}>
                                {toast.isError ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                                {toast.message}
                            </div>
                        )}

                        <Sidebar
                            ideas={ideas}
                            isLoading={isFetching}
                            onEventClick={setEditingIdea}
                            onGenerateClick={() => setIsFormOpen(true)}
                            onProfileClick={() => setView('profile')}
                            onManualCreate={handleManualCreate}
                            searchQuery={searchQuery}
                            setSearchQuery={setSearchQuery}
                            statusFilter={statusFilter}
                            setStatusFilter={setStatusFilter}
                        />

                        <div className="flex-1 flex flex-col h-full min-w-0">
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
                                    <button
                                        onClick={toggleLanguage}
                                        className="p-2.5 bg-white text-gray-500 hover:text-[#1A1A1A] border border-gray-200 rounded-xl hover:shadow-md transition-all flex items-center justify-center"
                                        title={t('common.switch_language')}
                                    >
                                        <Globe size={18} />
                                        <span className="ml-1 text-xs font-bold uppercase">{isPt ? 'PT' : 'EN'}</span>
                                    </button>

                                    <div className={`
                                flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors
                                ${isLowCredits ? 'bg-red-50 text-red-600 border-red-100' : 'bg-gray-100 text-gray-700 border-gray-200'}
                            `}>
                                        <Zap size={14} className={isLowCredits ? 'fill-red-600' : 'fill-gray-400 text-gray-400'} />
                                        {credits} {t('calendar.credits')}
                                    </div>

                                    <button
                                        onClick={() => setIsSettingsOpen(true)}
                                        className="p-2.5 bg-white text-gray-500 hover:text-[#1A1A1A] border border-gray-200 rounded-xl hover:shadow-md transition-all"
                                        title={t('common.settings')}
                                    >
                                        <Settings size={20} />
                                    </button>
                                    <button
                                        onClick={signOut}
                                        className="p-2.5 bg-[#1A1A1A] text-white border border-[#1A1A1A] rounded-xl hover:shadow-md hover:scale-105 transition-all"
                                        title={t('common.sign_out')}
                                    >
                                        <LogOut size={20} />
                                    </button>
                                </div>
                            </header>

                            <div className="flex-1 min-h-0 p-6 pt-2">
                                <CalendarGrid
                                    currentDate={currentDate}
                                    ideas={calendarFilteredIdeas}
                                    onEventClick={setEditingIdea}
                                />
                            </div>
                        </div>

                        <DragOverlay>
                            {activeIdea ? (
                                <div className="bg-white border border-[#FFDA47] shadow-xl p-3 rounded-lg w-48 rotate-3 cursor-grabbing z-50">
                                    <p className="font-bold text-sm text-[#1A1A1A] truncate">{activeIdea.title}</p>
                                </div>
                            ) : null}
                        </DragOverlay>

                        <EventModal
                            isOpen={!!editingIdea}
                            idea={editingIdea}
                            onClose={() => setEditingIdea(null)}
                            onSave={updateIdea}
                            onDelete={deleteIdea}
                            isNew={isNewIdea}
                        />

                        {isFormOpen && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A1A1A]/30 backdrop-blur-sm animate-fade-in">
                                <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden animate-scale-in relative">
                                    <button
                                        onClick={() => setIsFormOpen(false)}
                                        className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200 z-10"
                                    >
                                        <span className="sr-only">{t('common.close')}</span>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                    <div className="p-2">
                                        <SparkForm
                                            formData={formData}
                                            setFormData={setFormData}
                                            onSubmit={validateAndGenerate}
                                            isLoading={isGenerating}
                                            credits={credits}
                                            personas={allPersonas}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {showPersonaAlert && (
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
                                                    setShowPersonaAlert(false);
                                                    setView('profile');
                                                }}
                                                className="w-full bg-[#1A1A1A] text-white py-3 rounded-xl font-bold text-sm hover:bg-black transition-all shadow-lg shadow-black/5"
                                            >
                                                {t('alert.setup_profile')}
                                            </button>
                                            <button
                                                onClick={() => performGeneration()}
                                                className="w-full bg-white text-gray-500 py-3 rounded-xl font-bold text-sm hover:bg-gray-50 hover:text-gray-800 transition-all flex items-center justify-center gap-1"
                                            >
                                                {t('alert.continue_anyway')} <ArrowRight className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <SettingsModal
                            isOpen={isSettingsOpen}
                            onClose={() => setIsSettingsOpen(false)}
                            config={webhookConfig}
                            setConfig={setWebhookConfig}
                        />

                    </DndContext>
                </div>
            )}
        </>
    );
}
