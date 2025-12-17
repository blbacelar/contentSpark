
import React from 'react';
import { DragOverlay } from '@dnd-kit/core';
import { ContentIdea } from '../../types';

interface IdeaDragOverlayProps {
    activeIdea: ContentIdea | null;
}

export function IdeaDragOverlay({ activeIdea }: IdeaDragOverlayProps) {
    return (
        <DragOverlay>
            {activeIdea ? (
                <div className="bg-white border border-[#FFDA47] shadow-xl p-3 rounded-lg w-48 rotate-3 cursor-grabbing z-50">
                    <p className="font-bold text-sm text-[#1A1A1A] truncate">{activeIdea.title}</p>
                </div>
            ) : null}
        </DragOverlay>
    );
}
