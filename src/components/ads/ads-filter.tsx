"use client";

import { useState, useEffect } from "react";
import { Search, X, Plus, FilterX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface AdsFilterProps {
    onSearchChange: (search: string) => void;
    onExcludeChange: (exclude: string[]) => void;
    className?: string; // Add className prop
}

export function AdsFilter({ onSearchChange, onExcludeChange, className }: AdsFilterProps) {
    const [searchValue, setSearchValue] = useState("");
    const [excludeInputValue, setExcludeInputValue] = useState("");
    const [excludedTerms, setExcludedTerms] = useState<string[]>([]);
    const [isExcludeOpen, setIsExcludeOpen] = useState(false);

    // Debounce search update
    useEffect(() => {
        const timer = setTimeout(() => {
            onSearchChange(searchValue);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchValue, onSearchChange]);

    // Update excluded terms immediately (no debounce needed for array changes, usually)
    useEffect(() => {
        onExcludeChange(excludedTerms);
    }, [excludedTerms, onExcludeChange]);

    const handleAddExclude = () => {
        if (!excludeInputValue.trim()) return;

        // Split by comma if user pasted multiple terms
        const newTerms = excludeInputValue
            .split(",")
            .map(t => t.trim())
            .filter(t => t.length > 0 && !excludedTerms.includes(t));

        if (newTerms.length > 0) {
            setExcludedTerms([...excludedTerms, ...newTerms]);
        }
        setExcludeInputValue("");
        setIsExcludeOpen(false);
    };

    const handleRemoveExclude = (term: string) => {
        setExcludedTerms(excludedTerms.filter((t) => t !== term));
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleAddExclude();
        }
    };

    return (
        <div className={`space-y-3 ${className || ""}`}>
            <div className="flex flex-col sm:flex-row gap-3">
                {/* Search Field */}
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por titulo do anuncio..."
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        className="pl-9 bg-card/50"
                    />
                </div>

                {/* Exclude Field / Popover */}
                <div className="w-full sm:w-[350px]">
                    <div className="relative">
                        <FilterX className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Excluir por titulo (ex: Catalog)..."
                            value={excludeInputValue}
                            onChange={(e) => setExcludeInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={() => {
                                // Optional: Auto-add on blur if there's content? 
                                // Better to require Enter or explicit action to avoid accidental filters
                            }}
                            className="pl-9 bg-card/50 pr-12"
                        />
                        <Button
                            size="icon"
                            variant="ghost"
                            className="absolute right-1 top-1 h-7 w-7"
                            onClick={handleAddExclude}
                            disabled={!excludeInputValue.trim()}
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Active Exclusion Tags */}
            {excludedTerms.length > 0 && (
                <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-xs text-muted-foreground mr-1">Excluindo:</span>
                    {excludedTerms.map((term) => (
                        <Badge key={term} variant="outline" className="border-primary/30 bg-primary/5 text-primary-foreground hover:bg-primary/10 flex items-center gap-1 pl-2 pr-1 py-0.5">
                            <span className="text-[#aaff00]">{term}</span>
                            <button
                                onClick={() => handleRemoveExclude(term)}
                                className="ml-1 hover:bg-background/20 rounded-full p-0.5"
                            >
                                <X className="h-3 w-3 text-[#aaff00]" />
                            </button>
                        </Badge>
                    ))}
                    {excludedTerms.length > 2 && (
                        <Button variant="link" size="sm" className="h-auto p-0 text-xs text-muted-foreground" onClick={() => setExcludedTerms([])}>
                            Limpar todos
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}
