import React, { useState, useEffect } from 'react';
import { DndContext, DragOverlay, DragEndEvent, useSensor, useSensors, MouseSensor, TouchSensor } from '@dnd-kit/core';
import { format, addMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Settings, LogOut, Loader2, AlertCircle, CheckCircle2, UserCircle2, ArrowRight, Zap } from 'lucide-react';
import { FormData, Tone, ContentIdea, WebhookConfig, PersonaData } from './types';
import Sidebar from './components/Sidebar';
import CalendarGrid from './components/IdeaGrid'; 
import EventModal from './components/EventModal';
import SparkForm from './components/SparkForm';
import SettingsModal from './components/SettingsModal';
import AuthPage from './components/AuthPage';
import ProfilePage from './components/ProfilePage';
import { generateContent, updateContent, fetchUserIdeas, deleteContent, fetchUserPersona, generateId } from './services/genai';
import { useAuth } from './context/AuthContext';

// Default Webhook URL
const DEFAULT_WEBHOOK = "https://n8n.bacelardigital.tech/webhook/f7465ddb-c12a-4f30-9917-7720c62876bc";

type ViewState = 'calendar' | 'profile';

export default function App() {
  const { user, loading, signOut, profile, refreshProfile, updateCredits } = useAuth();

  // --- State ---
  const [view, setView] = useState<ViewState>('calendar');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  
  // Persona State
  const [userPersona, setUserPersona] = useState<PersonaData | null>(null);
  const [showPersonaAlert, setShowPersonaAlert] = useState(false);
  
  // Toast State
  const [toast, setToast] = useState<{ message: string; isError: boolean } | null>(null);
  
  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingIdea, setEditingIdea] = useState<ContentIdea | null>(null);

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
            const [ideasData, personaData] = await Promise.all([
                fetchUserIdeas(user.id),
                fetchUserPersona(user.id)
            ]);
            setIdeas(ideasData);
            setUserPersona(personaData);
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

  const validateAndGenerate = async () => {
      // Check Credits First
      if (profile && profile.credits <= 0) {
          triggerToast("You are out of credits!", true);
          return;
      }

      // Check if persona is essentially empty
      const isPersonaEmpty = !userPersona || (
          !userPersona.occupation && 
          !userPersona.pain_points && 
          !userPersona.goals &&
          !userPersona.age_range
      );

      if (isPersonaEmpty) {
          setShowPersonaAlert(true);
          // Close form modal so the alert is visible/focused
          setIsFormOpen(false); 
      } else {
          await performGeneration();
      }
  };

  const performGeneration = async () => {
    if (!user || !profile) return;
    setIsGenerating(true);
    // Ensure form modal is visible if we proceeded from "Continue Anyway"
    setIsFormOpen(true);
    setShowPersonaAlert(false);

    try {
      const newIdeas = await generateContent(
        formData, 
        webhookConfig.useWebhook ? webhookConfig.url : undefined,
        user.id,
        userPersona
      );
      
      setIdeas(prev => [...prev, ...newIdeas]);
      setIsFormOpen(false); // Close modal on success
      triggerToast("Strategy generated successfully!", false);
      
      // Optimistically decrement credits
      updateCredits(Math.max(0, profile.credits - 1));

    } catch (err: any) {
      console.error(err);
      
      const errorMessage = err.message || "";
      if (errorMessage.includes("402") || errorMessage.toLowerCase().includes("credits")) {
          triggerToast("You have run out of magic credits! Upgrade to keep creating.", true);
          // Sync with server to ensure correct credit state
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

      // Dropped on Backlog
      if (overId === 'backlog' && idea.date !== null) {
        updatedIdea = { ...idea, date: null, time: null, status: 'Pending' };
        changed = true;
      }
      
      // Dropped on Calendar Day
      else if (overId.match(/^\d{4}-\d{2}-\d{2}$/)) {
        if (idea.date !== overId) {
            updatedIdea = { 
                ...idea, 
                date: overId,
                // Default to 09:00 if no time is set when moving to calendar
                time: idea.time || '09:00'
            };
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

  const updateIdea = (updated: ContentIdea) => {
    setIdeas(prev => {
        const exists = prev.some(i => i.id === updated.id);
        if (exists) {
            return prev.map(i => i.id === updated.id ? updated : i);
        } else {
            return [...prev, updated];
        }
    });

    if (user) {
        updateContent({ 
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
        }, user.id).catch(err => {
            console.error("Update idea failed", err);
            triggerToast(err.message || "Failed to save changes", true);
        });
    }
  };

  const deleteIdea = (id: string) => {
    setIdeas(prev => prev.filter(i => i.id !== id));
    if (user) {
      deleteContent(id, user.id);
    }
  };

  const activeIdea = activeId ? ideas.find(i => i.id === activeId) : null;
  const isNewIdea = editingIdea ? !ideas.some(i => i.id === editingIdea.id) : false;

  // --- Auth Guards ---
  if (loading) {
    return (
        <div className="flex h-screen w-screen items-center justify-center bg-[#F2F2F2]">
            <Loader2 className="w-8 h-8 animate-spin text-[#FFDA47]" />
        </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  // View Switching
  if (view === 'profile') {
      return <ProfilePage onBack={() => {
          setView('calendar');
          refreshData();
      }} />;
  }

  // Credit Badge Logic
  const credits = profile?.credits ?? 0;
  const isLowCredits = credits <= 3;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F2F2F2] relative">
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        
        {/* Toast Notification */}
        {toast && (
            <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl shadow-2xl z-[100] animate-fade-in flex items-center gap-3 font-bold text-sm border ${toast.isError ? 'bg-red-500 text-white border-red-600' : 'bg-[#1A1A1A] text-white border-black'}`}>
                {toast.isError ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                {toast.message}
            </div>
        )}

        {/* Left Sidebar */}
        <Sidebar 
            ideas={ideas} 
            isLoading={isFetching}
            onEventClick={setEditingIdea}
            onGenerateClick={() => setIsFormOpen(true)}
            onProfileClick={() => setView('profile')}
            onManualCreate={handleManualCreate}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-full min-w-0">
            {/* Top Navigation Bar */}
            <header className="flex items-center justify-between px-8 py-5 bg-[#F2F2F2] border-b border-gray-200/50">
                <div className="flex items-center gap-6">
                    <h2 className="text-2xl font-bold text-[#1A1A1A] tracking-tight">
                        {format(currentDate, 'MMMM yyyy')}
                    </h2>
                    <div className="flex items-center gap-1 bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
                        <button onClick={() => setCurrentDate(addMonths(currentDate, -1))} className="p-1.5 hover:bg-gray-100 rounded-md text-gray-600">
                            <ChevronLeft size={18} />
                        </button>
                        <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-gray-600 hover:bg-gray-100 rounded-md">
                            Today
                        </button>
                        <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-1.5 hover:bg-gray-100 rounded-md text-gray-600">
                            <ChevronRight size={18} />
                        </button>
                    </div>
                    {isFetching && <span className="text-xs text-gray-400 font-medium animate-pulse">Syncing...</span>}
                </div>

                <div className="flex items-center gap-3">
                    {/* Credit Badge */}
                    <div className={`
                        flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors
                        ${isLowCredits ? 'bg-red-50 text-red-600 border-red-100' : 'bg-gray-100 text-gray-700 border-gray-200'}
                    `}>
                        <Zap size={14} className={isLowCredits ? 'fill-red-600' : 'fill-gray-400 text-gray-400'} />
                        {credits} Credits
                    </div>

                    <button 
                        onClick={() => setIsSettingsOpen(true)}
                        className="p-2.5 bg-white text-gray-500 hover:text-[#1A1A1A] border border-gray-200 rounded-xl hover:shadow-md transition-all"
                    >
                        <Settings size={20} />
                    </button>
                    <button 
                        onClick={signOut}
                        className="p-2.5 bg-[#1A1A1A] text-white border border-[#1A1A1A] rounded-xl hover:shadow-md hover:scale-105 transition-all"
                        title="Sign Out"
                    >
                        <LogOut size={20} />
                    </button>
                </div>
            </header>

            {/* Calendar Grid */}
            <div className="flex-1 min-h-0 p-6 pt-2">
                <CalendarGrid 
                    currentDate={currentDate} 
                    ideas={ideas} 
                    onEventClick={setEditingIdea}
                />
            </div>
        </div>

        {/* --- Overlays & Modals --- */}
        
        {/* Drag Overlay */}
        <DragOverlay>
            {activeIdea ? (
                <div className="bg-white border border-[#FFDA47] shadow-xl p-3 rounded-lg w-48 rotate-3 cursor-grabbing z-50">
                    <p className="font-bold text-sm text-[#1A1A1A] truncate">{activeIdea.title}</p>
                </div>
            ) : null}
        </DragOverlay>

        {/* Edit Modal */}
        <EventModal 
            isOpen={!!editingIdea} 
            idea={editingIdea} 
            onClose={() => setEditingIdea(null)}
            onSave={updateIdea}
            onDelete={deleteIdea}
            isNew={isNewIdea}
        />

        {/* Generation Modal */}
        {isFormOpen && (
             <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A1A1A]/30 backdrop-blur-sm animate-fade-in">
                <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden animate-scale-in relative">
                    <button 
                        onClick={() => setIsFormOpen(false)}
                        className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200 z-10"
                    >
                        <span className="sr-only">Close</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    <div className="p-2">
                        <SparkForm 
                            formData={formData}
                            setFormData={setFormData}
                            onSubmit={validateAndGenerate}
                            isLoading={isGenerating}
                            credits={credits}
                        />
                    </div>
                </div>
             </div>
        )}

        {/* Missing Persona Alert Modal */}
        {showPersonaAlert && (
             <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A1A1A]/50 backdrop-blur-sm animate-fade-in">
                <div className="bg-white rounded-[24px] w-full max-w-sm shadow-2xl overflow-hidden animate-scale-in p-6">
                    <div className="flex flex-col items-center text-center space-y-4">
                        <div className="w-12 h-12 bg-yellow-50 rounded-full flex items-center justify-center">
                            <UserCircle2 className="w-6 h-6 text-[#E6C200]" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-[#1A1A1A]">Target Persona Missing</h3>
                            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                                You haven't defined your Target Persona yet. The results might be generic. Do you want to continue or set up your profile first?
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
                                Set Up Profile
                            </button>
                            <button 
                                onClick={performGeneration}
                                className="w-full bg-white text-gray-500 py-3 rounded-xl font-bold text-sm hover:bg-gray-50 hover:text-gray-800 transition-all flex items-center justify-center gap-1"
                            >
                                Continue Anyway <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                </div>
             </div>
        )}

        {/* Settings Modal */}
        <SettingsModal 
            isOpen={isSettingsOpen} 
            onClose={() => setIsSettingsOpen(false)}
            config={webhookConfig}
            setConfig={setWebhookConfig}
        />

      </DndContext>
    </div>
  );
}