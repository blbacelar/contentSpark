
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

interface UseDragAndDropProps {
    ideas: ContentIdea[];
    setIdeas: React.Dispatch<React.SetStateAction<ContentIdea[]>>;
    triggerToast: (message: string, isError?: boolean) => void;
}

export function useDragAndDrop({ ideas, setIdeas, triggerToast }: UseDragAndDropProps) {
    const { user, session } = useAuth();
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
                }, user.id, session?.access_token).catch(err => {
                    console.error("Drag update failed", err);
                    triggerToast(err.message || "Failed to update idea", true);
                });
                return updatedIdea;
            }
            return idea;
        }));
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
