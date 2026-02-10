
"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Button — production-grade, accessible, and themeable button.
 *
 * Usage: <Button variant="primary" size="lg">Click</Button>
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-glow-sm hover:shadow-glow hover:-translate-y-0.5",
        destructive:
          "bg-destructive text-destructive-foreground hover:opacity-90 hover:-translate-y-0.5",
        outline:
          "border border-white/20 bg-transparent hover:bg-white/10 hover:-translate-y-0.5",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:-translate-y-0.5",
        ghost: "hover:bg-white/10",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-12 rounded-xl px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const ButtonBase = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  // Accessibility: Add role, aria-label, tabIndex, and aria-disabled
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      role="button"
      tabIndex={0}
      aria-label={typeof props.children === "string" ? props.children : "Button"}
      aria-disabled={props.disabled ? "true" : undefined}
      {...props}
    />
  );
});
ButtonBase.displayName = "Button";

const Button = React.memo(ButtonBase);
Button.displayName = "Button";

export { Button, buttonVariants };
