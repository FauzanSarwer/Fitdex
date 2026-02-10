
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * FitDex UI Primitives — Card
 *
 * All card subcomponents are:
 * - Strictly typed (TypeScript)
 * - Memoized for perf
 * - Consistently named and documented
 * - Designed for production-grade UI polish
 *
 * Usage:
 * <Card>
 *   <CardHeader>...</CardHeader>
 *   <CardContent>...</CardContent>
 *   <CardFooter>...</CardFooter>
 * </Card>
 */

/**
 * Root card container. Applies glass effect and foreground color.
 */
const CardBase = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("glass-card text-card-foreground", className)}
      role="region"
      aria-label={typeof props.children === "string" ? props.children : "Card"}
      tabIndex={0}
      {...props}
    />
  )
);
CardBase.displayName = "Card";
/**
 * Memoized Card for optimal re-renders.
 */
const Card = React.memo(CardBase);
Card.displayName = "Card";

/**
 * Card header section. Use for titles, actions, etc.
 */
const CardHeaderBase = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  )
);
CardHeaderBase.displayName = "CardHeader";
const CardHeader = React.memo(CardHeaderBase);
CardHeader.displayName = "CardHeader";

/**
 * Card title. Use inside CardHeader.
 */
const CardTitleBase = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-xl font-semibold leading-none tracking-tight", className)} {...props} />
  )
);
CardTitleBase.displayName = "CardTitle";
const CardTitle = React.memo(CardTitleBase);
CardTitle.displayName = "CardTitle";

/**
 * Card description. Use for supporting text.
 */
const CardDescriptionBase = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  )
);
CardDescriptionBase.displayName = "CardDescription";
const CardDescription = React.memo(CardDescriptionBase);
CardDescription.displayName = "CardDescription";

/**
 * Card content area. Main body of the card.
 */
const CardContentBase = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
);
CardContentBase.displayName = "CardContent";
const CardContent = React.memo(CardContentBase);
CardContent.displayName = "CardContent";

/**
 * Card footer. Use for actions, totals, etc.
 */
const CardFooterBase = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  )
);
CardFooterBase.displayName = "CardFooter";
const CardFooter = React.memo(CardFooterBase);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
