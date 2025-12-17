
import React, { useState } from 'react';
import { DndContext } from '@dnd-kit/core';
import Joyride from 'react-joyride';
import { useTranslation } from 'react-i18next';

// Components
import Sidebar from './Sidebar';
import CalendarGrid from './IdeaGrid';
import EventModal from './EventModal';
import SparkForm from './SparkForm';
import SettingsModal from './SettingsModal';
import ProfilePage from './ProfilePage';
import NotificationList from './NotificationList'; // Keep for now if needed by direct import or remove if handled by Header
import { DashboardHeader } from './dashboard/DashboardHeader';
import { PersonaMissingAlert } from './dashboard/PersonaMissingAlert';
import { IdeaDragOverlay } from './dashboard/IdeaDragOverlay';

// Hooks
import { useAuth } from '../context/AuthContext';
import { useDashboardData } from '../hooks/useDashboardData';
import { useIdeaManagement } from '../hooks/useIdeaManagement';
import { useDragAndDrop } from '../hooks/useDragAndDrop';
import { useTour } from '../hooks/useTour';
import { fetchNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../services/notifications';


// Types
import { WebhookConfig } from '../types';

// Default Webhook URL
const DEFAULT_WEBHOOK = import.meta.env.VITE_GENERATE_IDEAS_URL

export default function Dashboard() {
    const { user, profile, refreshProfile, updateCredits, signOut } = useAuth();
    const { t, i18n } = useTranslation();

    // 1. Dashboard Data & Filter State
    const {
        ideas,
        setIdeas,
        allPersonas,
        isFetching,
        refreshData,
        searchQuery,
        setSearchQuery,
        statusFilter,
        setStatusFilter,
        filteredIdeas
    } = useDashboardData();

    // 2. View State
    const [view, setView] = useState<'calendar' | 'profile'>('calendar');
    const [currentDate, setCurrentDate] = useState(new Date());

    // 3. UI Toggles/Modals
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [webhookConfig, setWebhookConfig] = useState<WebhookConfig>({
        useWebhook: true,
        url: DEFAULT_WEBHOOK
    });

    // 4. Notifications (Can be extracted to hook too, but small enough here for now or separate hook)
    // Let's implement simple state here for now to match exactly what Header expects
    const [notifications, setNotifications] = useState<any[]>([]);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

    React.useEffect(() => {
        if (user) fetchNotifications(user.id).then(setNotifications);
    }, [user]);

    // 5. Toast System (Local)
    const [toast, setToast] = useState<{ message: string; isError: boolean } | null>(null);
    const triggerToast = (message: string, isError: boolean = false) => {
        setToast({ message, isError });
        setTimeout(() => setToast(null), 4000);
    };

    // 6. Logic Hooks
    const {
        isFormOpen,
        setIsFormOpen,
        editingIdea,
        setEditingIdea, // Used for EventModal
        isGenerating,
        showPersonaAlert,
        setShowPersonaAlert,
        formData,
        setFormData,
        handleManualCreate,
        deleteIdeaWrapper,
        updateIdeaWrapper,
        validateAndGenerate,
        performGeneration
    } = useIdeaManagement({
        refreshProfile,
        updateCredits,
        triggerToast,
        setIdeas
    });

    const {
        sensors,
        activeIdea,
        handleDragStart,
        handleDragEnd
    } = useDragAndDrop({ ideas, setIdeas, triggerToast });

    const {
        runTour,
        stepIndex,
        handleJoyrideCallback,
        TOUR_STEPS
    } = useTour({ setIsFormOpen, setView });



    // Helpers
    const credits = profile?.credits ?? 0;
    const isLowCredits = credits <= 3;
    const isPt = (i18n.resolvedLanguage || i18n.language || 'en').startsWith('pt');

    // Render Actions
    const handleGenerateSubmit = () => validateAndGenerate(
        webhookConfig.useWebhook ? webhookConfig.url : undefined,
        null, // userPersona is derived in logic or we pass it? 
        // Original code derived it from `allPersonas` or `userPersona` state.
        // useIdeaManagement needs to know about personas.
        // We should pass allPersonas to validateAndGenerate
        allPersonas
    );

    return (
        <>
            {/* Joyride Tour - Always rendered to persist across views */}
            <Joyride
                steps={TOUR_STEPS}
                run={runTour}
                stepIndex={stepIndex}
                debug={true}
                continuous
                showSkipButton
                callback={handleJoyrideCallback}
                disableOverlayClose={true}
                spotlightClicks={true}
                floaterProps={{ disableAnimation: true }}
                styles={{
                    options: {
                        primaryColor: '#FFDA47',
                        textColor: '#1A1A1A',
                        zIndex: 10000,
                    },
                    tooltip: { borderRadius: '16px', padding: '20px' },
                    buttonNext: { backgroundColor: '#FFDA47', color: '#1A1A1A', fontWeight: 'bold', borderRadius: '8px', outline: 'none' }
                }}
            />

            {view === 'profile' ? (
                <ProfilePage onBack={() => {
                    setView('calendar');
                    refreshData();
                }} />
            ) : (
                <div className="flex h-screen w-screen overflow-hidden bg-[#F2F2F2] relative">


                    {/* Context Providers Setup via DnD */}
                    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>

                        {/* Global Toast */}
                        {toast && (
                            <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl shadow-2xl z-[100] animate-fade-in flex items-center gap-3 font-bold text-sm border ${toast.isError ? 'bg-red-500 text-white border-red-600' : 'bg-[#1A1A1A] text-white border-black'}`}>
                                {toast.message}
                            </div>
                        )}

                        {/* Sidebar */}
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

                        {/* Main Content Area */}
                        <div className="flex-1 flex flex-col h-full min-w-0">
                            <DashboardHeader
                                currentDate={currentDate}
                                setCurrentDate={setCurrentDate}
                                isFetching={isFetching}
                                isPt={isPt}
                                toggleLanguage={() => i18n.changeLanguage(isPt ? 'en' : 'pt')}
                                credits={credits}
                                isLowCredits={isLowCredits}
                                notifications={notifications}
                                isNotificationsOpen={isNotificationsOpen}
                                setIsNotificationsOpen={setIsNotificationsOpen}
                                onMarkAsRead={async (id) => {
                                    await markNotificationAsRead(id);
                                    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
                                }}
                                onMarkAllRead={async () => {
                                    if (user) await markAllNotificationsAsRead(user.id);
                                    setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })));
                                }}
                                onOpenSettings={() => setIsSettingsOpen(true)}
                                onSignOut={signOut}
                            />

                            <div className="flex-1 min-h-0 p-6 pt-2">
                                <CalendarGrid
                                    currentDate={currentDate}
                                    ideas={filteredIdeas}
                                    onEventClick={setEditingIdea}
                                />
                            </div>
                        </div>

                        {/* Drag Overlay */}
                        <IdeaDragOverlay activeIdea={activeIdea} />

                        {/* Modals */}
                        <EventModal
                            isOpen={!!editingIdea}
                            idea={editingIdea}
                            onClose={() => setEditingIdea(null)}
                            onSave={updateIdeaWrapper}
                            onDelete={(id) => {
                                deleteIdeaWrapper(id);
                                setEditingIdea(null);
                            }}
                            isNew={editingIdea ? !ideas.some(i => i.id === editingIdea.id) : false}
                            triggerToast={triggerToast}
                            profile={profile}
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
                                            onSubmit={handleGenerateSubmit}
                                            isLoading={isGenerating}
                                            credits={credits}
                                            personas={allPersonas}
                                        />
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

                        {showPersonaAlert && (
                            <PersonaMissingAlert
                                onClose={() => setShowPersonaAlert(false)}
                                onGoToProfile={() => setView('profile')}
                                onContinue={() => {
                                    const fallbackPersona = allPersonas.find(p => p.id === formData.persona_id) || allPersonas[0];
                                    // We need to use the method provided by useIdeaManagement to bypass validation
                                    // However, validateAndGenerate is the only exposed method that calls performGeneration AND checks validation.
                                    // performGeneration is internal to the hook in the previous step?
                                    // WAIT: I exposed performGeneration in useIdeaManagement in Step 5512.
                                    // So I can call it directly here.
                                    // It expects (webhookUrl, specificPersona).
                                    // We must ensure 'performGeneration' is destructured from the hook result.
                                    // I checked line 118 of Dashboard.tsx and it IS destructured.
                                    performGeneration(
                                        webhookConfig.useWebhook ? webhookConfig.url : undefined,
                                        fallbackPersona
                                    );
                                }}
                            />
                        )}

                    </DndContext>
                </div>
            )}
        </>
    );
}
