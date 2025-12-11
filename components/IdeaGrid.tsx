import React from 'react';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import { 
  format, 
  endOfMonth, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isToday, 
  isBefore,
} from 'date-fns';
import { ContentIdea, STATUS_COLORS } from '../types';
import { FileText } from 'lucide-react';

interface CalendarGridProps {
  currentDate: Date;
  ideas: ContentIdea[];
  onEventClick: (idea: ContentIdea) => void;
}

const formatTime12h = (time24: string) => {
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
};

// Draggable Event Pill
interface DraggableEventProps {
  idea: ContentIdea;
  onClick: () => void;
}

const DraggableEvent: React.FC<DraggableEventProps> = ({ idea, onClick }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: idea.id,
    data: { idea }
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 999,
  } : undefined;

  const hasContent = !!idea.caption && idea.caption.length > 10;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        // Prevent click when dragging, but allow standard click
        if (!isDragging) {
            e.stopPropagation();
            onClick();
        }
      }}
      className={`
        group relative text-xs font-medium px-2 py-1.5 rounded-md mb-1 cursor-pointer border select-none
        transition-all duration-200 shadow-sm
        ${STATUS_COLORS[idea.status]}
        ${isDragging ? 'opacity-50 scale-105 rotate-2' : 'hover:scale-[1.02]'}
      `}
    >
      <div className="truncate flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
             idea.status === 'Pending' ? 'bg-gray-400' : 
             idea.status === 'In Progress' ? 'bg-blue-400' :
             idea.status === 'Completed' ? 'bg-green-400' : 
             idea.status === 'Blocked' ? 'bg-red-400' : 'bg-purple-400'
        }`} />
        {idea.time && (
            <span className="text-[10px] font-bold opacity-70 flex-shrink-0 min-w-[48px]">
                {formatTime12h(idea.time)}
            </span>
        )}
        <span className="truncate flex-1">{idea.title}</span>
        {hasContent && <FileText size={10} className="flex-shrink-0 opacity-70" />}
      </div>
    </div>
  );
};

// Droppable Day Cell
interface DayCellProps {
  day: Date;
  currentMonth: Date;
  ideas: ContentIdea[];
  onEventClick: (i: ContentIdea) => void;
}

const DayCell: React.FC<DayCellProps> = ({ day, currentMonth, ideas, onEventClick }) => {
  const dateStr = format(day, 'yyyy-MM-dd');
  
  // Create 'today' date object set to midnight
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if day is strictly before today (ignoring time)
  const isPast = isBefore(day, today);

  const { setNodeRef, isOver } = useDroppable({
    id: dateStr,
    disabled: isPast, // Disable dropping on past dates
  });

  const isCurrentMonth = isSameMonth(day, currentMonth);
  const isDayToday = isToday(day);

  return (
    <div
      ref={setNodeRef}
      className={`
        min-h-[120px] p-2 border-r border-b border-gray-100 transition-colors
        ${isPast ? 'bg-gray-100/50 cursor-not-allowed' : !isCurrentMonth ? 'bg-gray-50/50' : 'bg-white'}
        ${isOver && !isPast ? 'bg-yellow-50 shadow-inner' : ''}
      `}
    >
      {/* Date Header */}
      <div className="flex justify-center mb-2">
        <span className={`
          text-xs font-bold w-7 h-7 flex items-center justify-center rounded-full
          ${isDayToday 
            ? 'bg-[#FFDA47] text-[#1A1A1A]' 
            : isPast ? 'text-gray-300' : !isCurrentMonth ? 'text-gray-300' : 'text-gray-500'}
        `}>
          {format(day, 'd')}
        </span>
      </div>

      {/* Events Stack */}
      <div className={`flex flex-col gap-0.5 ${isPast ? 'opacity-60 grayscale-[0.5]' : ''}`}>
        {ideas.map(idea => (
          <DraggableEvent key={idea.id} idea={idea} onClick={() => onEventClick(idea)} />
        ))}
      </div>
    </div>
  );
};

const CalendarGrid: React.FC<CalendarGridProps> = ({ currentDate, ideas, onEventClick }) => {
  const { t } = useTranslation();

  // Native date manipulation to replace missing startOfMonth
  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  monthStart.setHours(0, 0, 0, 0);

  const monthEnd = endOfMonth(monthStart);
  
  // Native date manipulation to replace missing startOfWeek (defaults to Sunday)
  const startDate = new Date(monthStart);
  startDate.setDate(monthStart.getDate() - monthStart.getDay());
  
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const weekDays = [
      t('calendar.sun'), 
      t('calendar.mon'), 
      t('calendar.tue'), 
      t('calendar.wed'), 
      t('calendar.thu'), 
      t('calendar.fri'), 
      t('calendar.sat')
  ];

  return (
    <div className="flex flex-col h-full bg-white rounded-tr-[32px] rounded-br-[32px] shadow-sm overflow-hidden border-l border-gray-200">
      
      {/* Weekday Headers */}
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
        {weekDays.map(day => (
          <div key={day} className="py-3 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 flex-1 overflow-y-auto custom-scrollbar bg-white">
        {calendarDays.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            // Sort ideas by time (ascending), put items without time at the bottom
            const dayIdeas = ideas
                .filter(i => i.date === dateStr)
                .sort((a, b) => {
                    if (!a.time && !b.time) return 0;
                    if (!a.time) return 1;
                    if (!b.time) return -1;
                    return a.time!.localeCompare(b.time!);
                });

            return (
                <DayCell 
                    key={day.toISOString()} 
                    day={day} 
                    currentMonth={currentDate} 
                    ideas={dayIdeas}
                    onEventClick={onEventClick}
                />
            );
        })}
      </div>
    </div>
  );
};

export default CalendarGrid;