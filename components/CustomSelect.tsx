import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

export interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string; // Styles for the trigger button
  icon?: React.ReactNode;
  disabled?: boolean;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ 
  value, 
  onChange, 
  options, 
  className = "", 
  icon,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is on the trigger
      if (containerRef.current && containerRef.current.contains(event.target as Node)) {
        return; 
      }
      // Check if click is on the dropdown menu (which is in a portal)
      const dropdownMenu = document.getElementById(`dropdown-${options[0]?.value}`);
      if (dropdownMenu && dropdownMenu.contains(event.target as Node)) {
        return;
      }
      
      setIsOpen(false);
    };

    // Close on scroll to prevent floating menu
    const handleScroll = () => {
        if(isOpen) setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true); // true for capture to catch all scrolls
    window.addEventListener('resize', handleScroll);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [isOpen, options]);

  const handleToggle = () => {
      if (disabled) return;
      
      if (!isOpen && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          setCoords({
              top: rect.bottom + window.scrollY + 8,
              left: rect.left + window.scrollX,
              width: rect.width
          });
      }
      setIsOpen(!isOpen);
  };

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        onClick={handleToggle}
        className={`
          flex items-center justify-between w-full text-left transition-all outline-none select-none
          ${className}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <div className="flex items-center gap-2 truncate flex-1">
            {icon && <span className="flex-shrink-0">{icon}</span>}
            <span className="truncate">{selectedOption ? selectedOption.label : value}</span>
        </div>
        <ChevronDown 
            size={16} 
            className={`transition-transform duration-200 text-gray-400 flex-shrink-0 ml-2 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {isOpen && createPortal(
        <div 
            id={`dropdown-${options[0]?.value}`}
            style={{ 
                top: coords.top, 
                left: coords.left, 
                width: coords.width,
                zIndex: 99999 
            }}
            className="absolute bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden animate-fade-in max-h-60 overflow-y-auto custom-scrollbar"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`
                w-full px-4 py-3 text-xs font-medium text-left transition-colors flex items-center justify-between
                ${value === option.value ? 'bg-yellow-50 text-[#1A1A1A]' : 'text-gray-600 hover:bg-gray-50 hover:text-[#1A1A1A]'}
              `}
            >
              <span className="truncate">{option.label}</span>
              {value === option.value && <Check size={14} className="text-[#FFDA47] flex-shrink-0" />}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};

export default CustomSelect;
