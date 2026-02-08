import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "@radix-ui/react-slot"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive active:scale-[0.98] duration-200 ease-out",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg border border-transparent",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/80 shadow-sm",
        outline:
          "border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-zinc-900/50 dark:border-white/10 dark:hover:bg-white/10 backdrop-blur-sm",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-transparent",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-white/10",
        link: "text-primary underline-offset-4 hover:underline",
        // Apple specific variants
        glass: "bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 shadow-sm",
      },
      size: {
        default: "h-[44px] px-5 py-2 has-[>svg]:px-4 text-[15px]", // Apple minimum touch target 44px
        xs: "h-7 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 rounded-lg gap-1.5 px-3 has-[>svg]:px-2.5 text-xs",
        lg: "h-12 rounded-xl px-8 has-[>svg]:px-6 text-base",
        icon: "size-[44px] rounded-full",
        "icon-xs": "size-7 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9 rounded-lg",
        "icon-lg": "size-12 rounded-xl",
      },
      radius: {
        default: "rounded-xl",
        full: "rounded-full",
        sm: "rounded-lg",
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      radius: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, radius, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"

    return (
      <Comp
        data-slot="button"
        className={cn(buttonVariants({ variant, size, radius, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
