import React from 'react';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import { ContentIdea, IdeaStatus } from '../types';
import { GripVertical, Plus, Zap, Search, Filter, FileText, PlusCircle, Calendar, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import CustomSelect from './CustomSelect';

// Draggable Chip
interface DraggableChipProps {
    idea: ContentIdea;
    onClick: () => void;
}

const DraggableChip: React.FC<DraggableChipProps> = ({ idea, onClick }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: idea.id,
        data: { idea }
    });

    const { t } = useTranslation();

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 999,
    } : undefined;

    const platformDisplay = idea.platform && idea.platform.length > 0 ? idea.platform.join(', ') : t('sidebar.general');
    const hasContent = !!idea.caption && idea.caption.length > 10;
    const isScheduled = !!idea.date;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            onClick={onClick}
            className={`
          group flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm cursor-grab active:cursor-grabbing
          hover:shadow-md hover:border-[#FFDA47] transition-all
          ${isDragging ? 'opacity-40' : ''}
        `}
        >
            <GripVertical size={16} className="text-gray-300 group-hover:text-[#FFDA47]" />
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                    <h4 className="text-sm font-bold text-[#1A1A1A] truncate">{idea.title}</h4>
                    {hasContent && (
                        <div title={t('sidebar.draft_ready')} className="text-[#FFDA47] flex-shrink-0">
                            <FileText size={12} fill="#FFDA47" />
                        </div>
                    )}
                    {isScheduled && (
                        <div title={t('sidebar.scheduled')} className="text-blue-400 flex-shrink-0">
                            <Calendar size={12} />
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded-full uppercase tracking-wide font-bold truncate max-w-full">
                        {platformDisplay}
                    </span>
                    {isScheduled && (
                        <span className="text-[10px] text-gray-400">
                            {idea.date}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

interface SidebarProps {
    ideas: ContentIdea[];
    isLoading: boolean;
    onEventClick: (idea: ContentIdea) => void;
    onGenerateClick: () => void;
    onProfileClick: () => void;
    onManualCreate?: () => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    statusFilter: IdeaStatus | 'All';
    setStatusFilter: (status: IdeaStatus | 'All') => void;
}

const Sidebar: React.FC<SidebarProps> = ({
    ideas,
    isLoading,
    onEventClick,
    onGenerateClick,
    onProfileClick,
    onManualCreate,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter
}) => {
    const { user, profile } = useAuth();
    const { t } = useTranslation();

    const { setNodeRef, isOver } = useDroppable({
        id: 'backlog',
    });

    const safeLower = (s?: string) => (s || '').toLowerCase();
    const isFiltering = searchQuery.trim().length > 0 || statusFilter !== 'All';

    const filteredIdeas = ideas.filter(i => {
        const query = searchQuery.toLowerCase().trim();
        if (!isFiltering) return !i.date;

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

    const statusOptions = [
        { value: 'All', label: t('common.all_status') },
        { value: 'Pending', label: t('status.Pending') },
        { value: 'In Progress', label: t('status.In Progress') },
        { value: 'Blocked', label: t('status.Blocked') },
        { value: 'Completed', label: t('status.Completed') },
        { value: 'Posted', label: t('status.Posted') },
    ];

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearchQuery(val);
        if (val === '') {
            setStatusFilter('All');
        }
    };

    const handleClearSearch = () => {
        setSearchQuery('');
        setStatusFilter('All');
    };

    const displayName = profile?.first_name
        ? `${profile.first_name} ${profile.last_name || ''}`.trim()
        : user?.email || 'Strategy Team';

    const userInitial = profile?.first_name
        ? profile.first_name.charAt(0).toUpperCase()
        : user?.email
            ? user.email.charAt(0).toUpperCase()
            : 'AI';

    const credits = profile?.credits ?? 0;
    const hasCredits = credits > 0;

    // Capitalize Tier
    const tierKey = profile?.tier || 'unknown';
    // @ts-ignore
    const tierDisplay = t(`sidebar.plans.${tierKey}`, { defaultValue: 'Free Plan' });

    return (
        <div className="w-80 flex-shrink-0 flex flex-col h-full bg-[#F9F9F9] border-r border-gray-200">
            {/* Header */}
            <div className="p-6 pb-2">
                <div className="flex items-center gap-2 mb-6">
                    <div className="bg-[#1A1A1A] p-2 rounded-lg shadow-md">
                        <Zap className="w-4 h-4 text-[#FFE566] fill-[#FFE566]" />
                    </div>
                    <span className="text-lg font-bold tracking-tight text-[#1A1A1A]">
                        {t('auth.title')}
                    </span>
                </div>

                <button
                    onClick={hasCredits ? onGenerateClick : undefined}
                    disabled={!hasCredits}
                    className={`
                        w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg
                        ${hasCredits
                            ? 'bg-[#1A1A1A] text-white hover:bg-black shadow-black/5 hover:scale-[1.02]'
                            : 'bg-gray-200 text-gray-500 cursor-not-allowed shadow-none'}
                    `}
                    title={hasCredits ? t('sidebar.new_strategy') : t('sidebar.out_of_credits')}
                >
                    {hasCredits ? (
                        <>
                            <Plus size={16} /> {t('sidebar.new_strategy')}
                        </>
                    ) : (
                        <>
                            <Zap size={16} className="text-gray-500 fill-gray-500" /> {t('sidebar.out_of_credits')}
                        </>
                    )}
                </button>
            </div>

            {/* Backlog / List Area */}
            <div className="flex-1 flex flex-col min-h-0">
                <div className="px-6 py-3 space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                            {isFiltering ? t('sidebar.search_results') : t('sidebar.unscheduled_ideas')}
                        </h3>
                        <div className="flex items-center gap-2">
                            {onManualCreate && (
                                <button
                                    onClick={onManualCreate}
                                    className="text-gray-400 hover:text-[#1A1A1A] p-1 rounded hover:bg-gray-200 transition-colors"
                                    title={t('sidebar.add_manual')}
                                >
                                    <PlusCircle size={16} />
                                </button>
                            )}
                            <span className="bg-gray-200 text-gray-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                {isLoading ? '...' : filteredIdeas.length}
                            </span>
                        </div>
                    </div>

                    {/* Search Input */}
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#1A1A1A] transition-colors" />
                        <input
                            type="text"
                            placeholder={t('sidebar.search_placeholder')}
                            value={searchQuery}
                            onChange={handleSearchChange}
                            className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-8 py-2 text-xs font-medium placeholder-gray-400 outline-none focus:border-[#FFDA47] focus:ring-1 focus:ring-[#FFDA47] transition-all"
                        />
                        {searchQuery && (
                            <button
                                onClick={handleClearSearch}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                                title={t('common.close')}
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>

                    {/* Status Filter */}
                    <div className="relative group">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 group-focus-within:text-[#1A1A1A] transition-colors pointer-events-none z-10" />
                        <CustomSelect
                            value={statusFilter}
                            onChange={(val) => setStatusFilter(val as IdeaStatus | 'All')}
                            options={statusOptions}
                            className="bg-white border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-xs font-medium text-gray-600 focus:border-[#FFDA47] focus:ring-1 focus:ring-[#FFDA47]"
                        />
                    </div>
                </div>

                <div
                    ref={setNodeRef}
                    className={`
                        flex-1 overflow-y-auto px-4 pb-4 space-y-2 custom-scrollbar
                        ${isOver ? 'bg-yellow-50/50' : ''}
                    `}
                >
                    {isLoading ? (
                        // Loading Skeleton
                        <div className="space-y-3 mt-1 animate-pulse">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="bg-white rounded-xl border border-gray-100 p-3 h-16 flex items-center gap-3">
                                    <div className="w-1 h-6 bg-gray-100 rounded-full"></div>
                                    <div className="flex-1 space-y-2">
                                        <div className="h-3 bg-gray-100 rounded w-3/4"></div>
                                        <div className="h-2 bg-gray-100 rounded w-1/3"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : filteredIdeas.length === 0 ? (
                        <div className="h-32 flex flex-col items-center justify-center text-center p-4 border-2 border-dashed border-gray-200 rounded-xl mt-2">
                            <span className="text-xs text-gray-400 font-medium">
                                {isFiltering ? t('sidebar.no_results') : t('sidebar.no_ideas')}
                            </span>
                        </div>
                    ) : (
                        filteredIdeas.map(idea => (
                            <DraggableChip key={idea.id} idea={idea} onClick={() => onEventClick(idea)} />
                        ))
                    )}
                </div>
            </div>

            {/* User Profile */}
            <div className="p-4 border-t border-gray-200">
                <button
                    onClick={onProfileClick}
                    className="flex items-center gap-3 w-full p-2 rounded-xl hover:bg-gray-100 transition-colors text-left group"
                >
                    <div className="w-8 h-8 rounded-full bg-[#FFDA47] flex items-center justify-center font-bold text-xs text-[#1A1A1A] ring-2 ring-white group-hover:ring-[#FFDA47] transition-all overflow-hidden">
                        {profile?.avatar_url ? (
                            <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            userInitial
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-[#1A1A1A] text-xs truncate group-hover:text-[#000]">
                            {displayName}
                        </p>
                        <p className="text-gray-400 text-[10px] truncate group-hover:text-gray-600">{tierDisplay} • {t('common.settings')}</p>
                    </div>
                </button>
            </div>
        </div>
    );
};

export default Sidebar;