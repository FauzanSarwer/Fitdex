"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const CardBase = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "glass-card text-card-foreground",
      className
    )}
    {...props}
  />
));
CardBase.displayName = "Card";

const Card = React.memo(CardBase);
Card.displayName = "Card";

const CardHeaderBase = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeaderBase.displayName = "CardHeader";

const CardHeader = React.memo(CardHeaderBase);
CardHeader.displayName = "CardHeader";

const CardTitleBase = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-xl font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
CardTitleBase.displayName = "CardTitle";

const CardTitle = React.memo(CardTitleBase);
CardTitle.displayName = "CardTitle";

const CardDescriptionBase = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescriptionBase.displayName = "CardDescription";

const CardDescription = React.memo(CardDescriptionBase);
CardDescription.displayName = "CardDescription";

const CardContentBase = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContentBase.displayName = "CardContent";

const CardContent = React.memo(CardContentBase);
CardContent.displayName = "CardContent";

const CardFooterBase = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
CardFooterBase.displayName = "CardFooter";

const CardFooter = React.memo(CardFooterBase);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
