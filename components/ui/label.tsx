
"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Label — accessible label for form fields.
 *
 * Usage: <Label htmlFor="inputId">Label</Label>
 */
const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
);

const LabelBase = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(
  ({ className, ...props }, ref) => (
    <LabelPrimitive.Root
      ref={ref}
      className={cn(labelVariants(), className)}
      aria-label={props['aria-label'] || (typeof props.children === 'string' ? props.children : 'Label')}
      tabIndex={0}
      {...props}
    />
  )
);
LabelBase.displayName = LabelPrimitive.Root.displayName;

const Label = React.memo(LabelBase);
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
