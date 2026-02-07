"use client"

import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export interface CheckboxProps
    extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
    onCheckedChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
    ({ className, checked, onCheckedChange, ...props }, ref) => {
        return (
            <div className="relative">
                <input
                    type="checkbox"
                    ref={ref}
                    checked={checked}
                    onChange={(e) => onCheckedChange?.(e.target.checked)}
                    className="sr-only peer"
                    {...props}
                />
                <div
                    className={cn(
                        "h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background transition-colors",
                        "peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2",
                        "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
                        checked
                            ? "bg-primary text-primary-foreground"
                            : "bg-background",
                        className
                    )}
                    onClick={() => onCheckedChange?.(!checked)}
                >
                    {checked && (
                        <Check className="h-4 w-4 text-current" />
                    )}
                </div>
            </div>
        )
    }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
