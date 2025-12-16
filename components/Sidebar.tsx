import React from 'react';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import { ContentIdea, IdeaStatus } from '../types';
import { GripVertical, Plus, Zap, Search, Filter, FileText, PlusCircle, Calendar, X, Users, ChevronDown, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTeam } from '../context/TeamContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import CreateTeamModal from './CreateTeamModal';
import InviteMemberModal from './InviteMemberModal';
import { cn } from '../utils';

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
    const { teams, currentTeam, switchTeam } = useTeam();
    const [isCreateTeamOpen, setIsCreateTeamOpen] = React.useState(false);
    const [isInviteOpen, setIsInviteOpen] = React.useState(false);

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
                    <div>
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-0.5">
                            {t('auth.title')}
                        </span>
                        {/* Team Switcher */}
                        <div id="tour-team-switcher">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-auto p-0 hover:bg-transparent font-bold text-lg text-[#1A1A1A] gap-2 flex items-center">
                                        {currentTeam ? currentTeam.name : t('sidebar.personal_workspace')}
                                        <ChevronDown size={16} className="text-gray-400" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-56">
                                    <DropdownMenuLabel>{t('sidebar.switch_workspace')}</DropdownMenuLabel>

                                    <DropdownMenuLabel>{t('sidebar.teams')}</DropdownMenuLabel>
                                    {teams.map(team => (
                                        <DropdownMenuItem key={team.id} onClick={() => switchTeam(team.id)} className="gap-2">
                                            <Avatar className="h-6 w-6">
                                                <AvatarFallback className="bg-blue-100 text-blue-600">{team.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            {team.name}
                                            {currentTeam?.id === team.id && <Check size={14} className="ml-auto" />}
                                        </DropdownMenuItem>
                                    ))}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => setIsCreateTeamOpen(true)} className="gap-2 text-blue-600 font-medium">
                                        <PlusCircle size={14} />
                                        {t('sidebar.create_team')}
                                    </DropdownMenuItem>

                                    {currentTeam && (
                                        <>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={() => setIsInviteOpen(true)} className="gap-2 text-[#1A1A1A] font-medium">
                                                <Users size={14} />
                                                {t('sidebar.invite_members') || "Invite Members"}
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>


                </div>
            </div>

            <div className="px-6">
                <Button
                    onClick={hasCredits ? onGenerateClick : undefined}
                    disabled={!hasCredits}
                    className={cn(
                        "w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg mb-6",
                        hasCredits
                            ? "bg-[#1A1A1A] text-white hover:bg-black shadow-black/5 hover:scale-[1.02]"
                            : "bg-gray-200 text-gray-500 cursor-not-allowed shadow-none"
                    )}
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
                </Button>
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
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onManualCreate}
                                    className="h-6 w-6 text-gray-400 hover:text-[#1A1A1A] hover:bg-gray-200"
                                    title={t('sidebar.add_manual')}
                                >
                                    <PlusCircle size={16} />
                                </Button>
                            )}
                            <span className="bg-gray-200 text-gray-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                {isLoading ? '...' : filteredIdeas.length}
                            </span>
                        </div>
                    </div>

                    {/* Search Input */}
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-[#1A1A1A] transition-colors" />
                        <Input
                            type="text"
                            placeholder={t('sidebar.search_placeholder')}
                            value={searchQuery}
                            onChange={handleSearchChange}
                            className="w-full bg-white border-gray-200 rounded-lg pl-9 pr-8 h-9 text-xs font-medium placeholder:text-gray-400 focus-visible:ring-[#FFDA47] transition-all"
                        />
                        {searchQuery && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleClearSearch}
                                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                                title={t('common.close')}
                            >
                                <X size={12} />
                            </Button>
                        )}
                    </div>

                    {/* Status Filter */}
                    <div className="relative group">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 group-focus-within:text-[#1A1A1A] transition-colors pointer-events-none z-10" />
                        <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as IdeaStatus | 'All')}>
                            <SelectTrigger className="w-full bg-white border-gray-200 rounded-lg pl-9 pr-3 h-9 text-xs font-medium text-gray-600 focus:ring-[#FFDA47]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {statusOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value} className="text-xs">
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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
                <Button
                    variant="ghost"
                    onClick={onProfileClick}
                    className="flex items-center gap-3 w-full h-auto p-2 rounded-xl hover:bg-gray-100 transition-colors text-left justify-start"
                >
                    <Avatar className="h-8 w-8 ring-2 ring-white group-hover:ring-[#FFDA47] transition-all">
                        <AvatarImage src={profile?.avatar_url} className="object-cover" />
                        <AvatarFallback className="bg-[#FFDA47] text-[#1A1A1A] text-xs font-bold">
                            {userInitial}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 flex flex-col items-start">
                        <p className="font-bold text-[#1A1A1A] text-xs truncate group-hover:text-[#000]">
                            {displayName}
                        </p>
                        <p className="text-gray-400 text-[10px] truncate group-hover:text-gray-600">{tierDisplay} • {t('common.settings')}</p>
                    </div>
                </Button>
            </div>
            {/* Create Team Modal */}
            <CreateTeamModal
                isOpen={isCreateTeamOpen}
                onClose={() => setIsCreateTeamOpen(false)}
            />
            {
                currentTeam && (
                    <InviteMemberModal
                        isOpen={isInviteOpen}
                        onClose={() => setIsInviteOpen(false)}
                        team={currentTeam}
                    />
                )
            }
        </div>
    );
};

export default Sidebar;