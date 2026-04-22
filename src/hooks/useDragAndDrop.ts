
import { useState } from 'react';
import {
    useSensor,
    useSensors,
    MouseSensor,
    TouchSensor,
    DragEndEvent
} from '@dnd-kit/core';
import { ContentIdea } from '../types';
import { updateContent } from '../services/genai';
import { useAuth } from '../context/AuthContext';
import { useTeam } from '../context/TeamContext';

interface UseDragAndDropProps {
    ideas: ContentIdea[];
    setIdeas: React.Dispatch<React.SetStateAction<ContentIdea[]>>;
    triggerToast: (message: string, isError?: boolean) => void;
}

export function useDragAndDrop({ ideas, setIdeas, triggerToast }: UseDragAndDropProps) {
    const { user, session } = useAuth();
    const { currentTeam } = useTeam();
    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
    );

    const handleDragStart = (event: any) => {
        setActiveId(event.active.id);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        if (!over) return;

        const ideaId = active.id as string;
        const overId = over.id as string;

        const existingIdea = ideas.find(idea => idea.id === ideaId);
        if (!existingIdea) return;

        let updatedIdea = {
            ...existingIdea,
            team_id: existingIdea.team_id || currentTeam?.id
        };
        let changed = false;

        if (overId === 'backlog' && existingIdea.date !== null) {
            updatedIdea = { ...updatedIdea, date: null, time: null, status: 'Pending' };
            changed = true;
        } else if (overId.match(/^\d{4}-\d{2}-\d{2}$/)) {
            if (existingIdea.date !== overId) {
                updatedIdea = { ...updatedIdea, date: overId, time: existingIdea.time || '09:00' };
                changed = true;
            }
        }

        if (!changed) return;

        setIdeas(prev => prev.map(idea => idea.id === ideaId ? updatedIdea : idea));

        if (user) {
            updateContent({
                ...updatedIdea,
                id: updatedIdea.id,
                date: updatedIdea.date,
                time: updatedIdea.time,
                status: updatedIdea.status,
                team_id: updatedIdea.team_id,
                persona_id: updatedIdea.persona_id,
                title: updatedIdea.title,
                description: updatedIdea.description,
                hook: updatedIdea.hook,
                caption: updatedIdea.caption,
                cta: updatedIdea.cta,
                hashtags: updatedIdea.hashtags,
                platform: updatedIdea.platform
            }, user.id, session?.access_token).then(savedIdea => {
                if (savedIdea?.id && savedIdea.id !== updatedIdea.id) {
                    setIdeas(prev => prev.map(idea => {
                        if (idea.id !== updatedIdea.id) return idea;
                        return {
                            ...idea,
                            ...savedIdea,
                            id: savedIdea.id,
                            date: updatedIdea.date,
                            time: updatedIdea.time,
                            title: updatedIdea.title,
                            description: updatedIdea.description,
                            hook: updatedIdea.hook,
                            caption: updatedIdea.caption,
                            cta: updatedIdea.cta,
                            hashtags: updatedIdea.hashtags,
                            platform: updatedIdea.platform,
                            status: updatedIdea.status,
                            team_id: updatedIdea.team_id,
                            persona_id: updatedIdea.persona_id,
                            persona_name: updatedIdea.persona_name
                        } as ContentIdea;
                    }));
                }
            }).catch(err => {
                console.error("Drag update failed", err);
                triggerToast(err.message || "Failed to update idea", true);
                setIdeas(prev => prev.map(idea => idea.id === updatedIdea.id ? existingIdea : idea));
            });
        }
    };

    const activeIdea = activeId ? ideas.find(i => i.id === activeId) : null;

    return {
        sensors,
        activeId,
        activeIdea,
        handleDragStart,
        handleDragEnd
    };
}
