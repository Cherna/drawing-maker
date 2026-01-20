import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CollapsibleSectionProps {
    title: string;
    children: React.ReactNode;
    defaultExpanded?: boolean;
    className?: string;
    rightElement?: React.ReactNode;
}

export default function CollapsibleSection({
    title,
    children,
    defaultExpanded = true,
    className,
    rightElement
}: CollapsibleSectionProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    return (
        <div className={cn("border-b border-border last:border-0", className)}>
            <div className="flex items-center justify-between p-4 py-3 hover:bg-muted/50 transition-colors">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center flex-1 text-sm font-medium"
                >
                    {isExpanded ? (
                        <ChevronDown className="h-4 w-4 mr-2 text-muted-foreground" />
                    ) : (
                        <ChevronRight className="h-4 w-4 mr-2 text-muted-foreground" />
                    )}
                    {title}
                </button>
                {rightElement}
            </div>

            {isExpanded && (
                <div className="p-4 pt-0 animate-in slide-in-from-top-1 duration-200">
                    {children}
                </div>
            )}
        </div>
    );
}
