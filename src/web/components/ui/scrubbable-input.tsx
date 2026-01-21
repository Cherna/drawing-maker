import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from './input';
import { Label } from './label';
import { Button } from './button';
import { cn } from '../../lib/utils';
import { GripHorizontal, Minus, Plus } from 'lucide-react';

interface ScrubbableInputProps {
    id?: string;
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
    label?: string;
    className?: string;
}

export default function ScrubbableInput({
    id,
    value,
    onChange,
    min = -Infinity,
    max = Infinity,
    step = 1,
    label,
    className,
}: ScrubbableInputProps) {
    const [isDragging, setIsDragging] = useState(false);
    const startXRef = useRef<number>(0);
    const startValueRef = useRef<number>(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleMouseDown = (e: React.MouseEvent) => {
        // Only drag on left click
        if (e.button !== 0) return;

        setIsDragging(true);
        startXRef.current = e.clientX;
        startValueRef.current = value;

        // Add global cursor style
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging) return;

        const deltaX = e.clientX - startXRef.current;
        const isPrecision = e.shiftKey;

        // Determine multiplier (shift = slower)
        const sensitivity = isPrecision ? 0.1 : 1.0;

        // Calculate new value
        const change = deltaX * (step || 1) * sensitivity;
        let newValue = startValueRef.current + change;

        // Clamp
        newValue = Math.max(min, Math.min(max, newValue));

        // Round to step precision
        if (step) {
            const precision = step.toString().split('.')[1]?.length || 0;
            newValue = Number(newValue.toFixed(precision));
        }

        onChange(newValue);
        setLocalValue(String(newValue)); // FIX: Update local value while dragging
    }, [isDragging, min, max, step, onChange]);

    const handleMouseUp = useCallback(() => {
        if (isDragging) {
            setIsDragging(false);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    }, [isDragging]);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);


    // Local state to handle typing (including temporary invalid states like "-")
    const [localValue, setLocalValue] = useState(String(value));

    // Sync local state when prop changes (unless dragging/editing)
    useEffect(() => {
        if (!isDragging && document.activeElement !== inputRef.current) {
            setLocalValue(String(value));
        }
    }, [value, isDragging]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVal = e.target.value;
        setLocalValue(newVal);

        if (newVal === '' || newVal === '-') return;

        const num = parseFloat(newVal);
        if (!isNaN(num)) {
            onChange(num);
        }
    };

    const handleBlur = () => {
        setLocalValue(String(value));
    };

    const stepValue = step || 1;

    const handleIncrement = () => {
        const newVal = Math.min(max, value + stepValue);
        // Fix precision issues (e.g. 0.1 + 0.2 = 0.300000000004)
        const precision = stepValue.toString().split('.')[1]?.length || 0;
        const rounded = Number(newVal.toFixed(precision));
        onChange(rounded);
    };

    const handleDecrement = () => {
        const newVal = Math.max(min, value - stepValue);
        const precision = stepValue.toString().split('.')[1]?.length || 0;
        const rounded = Number(newVal.toFixed(precision));
        onChange(rounded);
    };

    return (
        <div className={cn("space-y-2", className)}>
            {label && (
                <div className="flex items-center justify-between group">
                    <Label
                        htmlFor={id}
                        className="cursor-ew-resize select-none flex items-center gap-2 hover:text-primary transition-colors"
                        onMouseDown={handleMouseDown}
                    >
                        {label}
                        <GripHorizontal className="h-3 w-3 text-muted-foreground opacity-50 bg-inherit" />
                    </Label>
                </div>
            )}
            <div className="flex items-center gap-1">
                <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={handleDecrement}
                    disabled={value <= min}
                    aria-label="Decrease value"
                >
                    <Minus className="h-3 w-3" />
                </Button>

                <div className="relative flex-1">
                    <Input
                        id={id}
                        ref={inputRef}
                        type="text"
                        inputMode="decimal"
                        value={localValue}
                        onChange={handleInputChange}
                        onBlur={handleBlur}
                        className={cn(
                            isDragging && "cursor-ew-resize text-primary border-primary",
                            "transition-colors text-center"
                        )}
                    />
                </div>

                <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={handleIncrement}
                    disabled={value >= max}
                    aria-label="Increase value"
                >
                    <Plus className="h-3 w-3" />
                </Button>
            </div>
        </div>
    );
}
