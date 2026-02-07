import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CollapsibleMenuSectionProps {
    title: string;
    children: React.ReactNode;
    defaultExpanded?: boolean;
    className?: string;
}

export default function CollapsibleMenuSection({
    title,
    children,
    defaultExpanded = true,
    className,
}: CollapsibleMenuSectionProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    return (
        <div className={cn("px-1 py-1", className)}>
            <div
                className="flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-muted-foreground cursor-pointer hover:bg-accent hover:text-accent-foreground rounded-sm select-none"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation(); // Prevent closing dropdown
                    setIsExpanded(!isExpanded);
                }}
            >
                <span>{title}</span>
                {isExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                ) : (
                    <ChevronRight className="h-3 w-3" />
                )}
            </div>

            {isExpanded && (
                <div className="pl-2 animate-in slide-in-from-top-1 duration-200 fade-in-0 zoom-in-95">
                    {children}
                </div>
            )}
        </div>
    );
}
