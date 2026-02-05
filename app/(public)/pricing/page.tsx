"use client";

import { motion } from "framer-motion";
import { Check, Users } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const FEATURES = [
  "Map-based gym discovery in Delhi NCR",
  "Duo partner discount (stack with yearly & welcome)",
  "Welcome discount for first-time users",
  "Real payments via Razorpay",
  "Cancel anytime",
];

export default function PricingPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-2xl mx-auto mb-12"
      >
        <h1 className="text-3xl md:text-4xl font-bold">Simple pricing</h1>
        <p className="text-muted-foreground mt-2">
          Gym prices are set by each gym. We apply your eligible discounts at checkout.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="max-w-lg mx-auto"
      >
        <Card className="glass-card border-primary/30">
          <CardHeader className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 mb-4">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">Member + Duo</h2>
            <p className="text-sm text-muted-foreground">
              Join a gym. Invite a partner. Stack discounts (welcome + yearly + partner). Cap at 40%.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-3">
              {FEATURES.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button asChild className="w-full mt-4" size="lg">
              <Link href="/explore">Explore gyms</Link>
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
