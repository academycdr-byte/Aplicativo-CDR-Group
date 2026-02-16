import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-[44px] w-full rounded-xl border border-input bg-transparent px-4 py-2 text-base shadow-xs transition-all duration-300 ease-apple file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/15 focus-visible:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-surface-glass dark:backdrop-blur-sm dark:border-border dark:focus-visible:border-primary/30",
        className
      )}
      {...props}
    />
  )
}

export { Input }
