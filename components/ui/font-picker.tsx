import React, { useState, useEffect, useMemo } from 'react';
import { ChevronsUpDown, Check, Search, Loader2 } from 'lucide-react';
import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { cn } from '../../utils';
import { Input } from './input';
import { ScrollArea } from './scroll-area';

// Fallback list of popular Google Fonts
const POPULAR_FONTS = [
    "Roboto", "Open Sans", "Montserrat", "Lato", "Poppins",
    "Source Sans Pro", "Roboto Condensed", "Oswald", "Raleway", "Inter",
    "Merriweather", "Noto Sans", "Playfair Display", "Nunito", "PT Sans",
    "Ubuntu", "Roboto Slab", "Rubik", "Mukta", "Lora",
    "Work Sans", "Nunito Sans", "Fira Sans", "Quicksand", "Barlow",
    "Inconsolata", "Josefin Sans", "Libre Baskerville", "Anton", "Bebas Neue",
    "Pacifico", "Dancing Script", "Abril Fatface", "Satisfy", "Great Vibes"
];

interface FontPickerProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

interface WebFont {
    family: string;
    category: string;
}

export const FontPicker: React.FC<FontPickerProps> = ({ value, onChange, placeholder = "Select font...", className }) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [fonts, setFonts] = useState<string[]>(POPULAR_FONTS);
    const [loading, setLoading] = useState(false);
    const [usingFallback, setUsingFallback] = useState(false);

    useEffect(() => {
        const fetchFonts = async () => {
            // Check local storage cache first
            const cached = localStorage.getItem('CS_FONT_CACHE');
            if (cached) {
                try {
                    const { timestamp, data } = JSON.parse(cached);
                    // Cache valid for 24 hours
                    if (Date.now() - timestamp < 86400000) {
                        setFonts(data);
                        return;
                    }
                } catch (e) {
                    // invalid cache
                }
            }

            setLoading(true);
            try {
                const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
                if (!apiKey) throw new Error("No API Key");

                const response = await fetch(`https://www.googleapis.com/webfonts/v1/webfonts?key=${apiKey}&sort=popularity`);

                if (!response.ok) throw new Error("API Request Failed");

                const data = await response.json();
                const fontList = (data.items as WebFont[]).map(f => f.family);

                // Take top 200 to keep it manageable
                const topFonts = fontList.slice(0, 200);

                setFonts(topFonts);
                localStorage.setItem('CS_FONT_CACHE', JSON.stringify({
                    timestamp: Date.now(),
                    data: topFonts
                }));
            } catch (err) {
                console.warn("Using fallback fonts:", err);
                setUsingFallback(true);
                setFonts(POPULAR_FONTS);
            } finally {
                setLoading(false);
            }
        };

        fetchFonts();
    }, []);

    const filteredFonts = useMemo(() => {
        return fonts.filter(font =>
            font.toLowerCase().includes(search.toLowerCase())
        );
    }, [fonts, search]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between font-normal bg-white", !value && "text-muted-foreground", className)}
                >
                    <span className="truncate">{value || placeholder}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
                <div className="flex items-center border-b px-3">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <Input
                        placeholder="Search fonts..."
                        className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 border-none focus-visible:ring-0 px-0 shadow-none"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <ScrollArea className="h-64">
                    <div className="p-1">
                        {loading && fonts.length === 0 && (
                            <div className="flex items-center justify-center py-6 text-sm text-gray-400">
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading fonts...
                            </div>
                        )}
                        {!loading && filteredFonts.length === 0 && (
                            <div className="py-6 text-center text-sm text-gray-500">No font found.</div>
                        )}
                        {filteredFonts.map((font) => (
                            <div
                                key={font}
                                className={cn(
                                    "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-zinc-100 hover:text-zinc-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                                    value === font ? "bg-zinc-100 text-zinc-900" : ""
                                )}
                                onClick={() => {
                                    onChange(font);
                                    setOpen(false);
                                    // Optional: Dynamically load the font for preview
                                    // const link = document.createElement('link');
                                    // link.href = `https://fonts.googleapis.com/css?family=${font.replace(' ', '+')}`;
                                    // link.rel = 'stylesheet';
                                    // document.head.appendChild(link);
                                }}
                            >
                                <Check
                                    className={cn(
                                        "mr-2 h-4 w-4",
                                        value === font ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                <span style={{ fontFamily: font, fontSize: '1.05em' }}>{font}</span>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
                {usingFallback && (
                    <div className="bg-amber-50 p-2 text-[10px] text-amber-600 border-t border-amber-100 text-center">
                        Using top 50 web fonts (API Key limited)
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
};
