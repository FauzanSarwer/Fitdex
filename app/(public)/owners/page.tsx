"use client";

import { motion } from "framer-motion";
import {
  BarChart3,
  Headphones,
  MapPin,
  Star,
  Users,
  Zap,
  Check,
  Dumbbell,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import { isOwner } from "@/lib/permissions";

const BENEFITS = [
  {
    icon: MapPin,
    title: "Reach more members",
    desc: "Get discovered by thousands of fitness seekers in Delhi NCR through our map-based discovery.",
  },
  {
    icon: Users,
    title: "Duo-driven signups",
    desc: "The duo partner discount brings pairs through your doors—more members, higher retention.",
  },
  {
    icon: BarChart3,
    title: "Analytics & insights",
    desc: "Track memberships, duos, revenue, and trends—all in one dashboard.",
  },
  {
    icon: Zap,
    title: "Real payments",
    desc: "Integrated Razorpay. Members pay online, you get paid. No manual tracking.",
  },
];

const PLANS = [
  {
    name: "Starter",
    price: 1499,
    period: "month",
    features: ["Analytics dashboard", "Priority support", "Gym listing on map", "Membership management"],
    cta: "Get started",
  },
  {
    name: "Pro",
    price: 1999,
    period: "month",
    features: [
      "Everything in Starter",
      "Featured gym placement",
      "Discount & promo management",
      "Member insights & reports",
      "Dedicated account manager",
    ],
    popular: true,
    cta: "Go Pro",
  },
];

export default function OwnersPage() {
  const { data: session, status } = useSession();
  const owner = status === "authenticated" && isOwner(session);

  return (
    <div className="container mx-auto px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-3xl mx-auto mb-16"
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary mb-6">
          <Dumbbell className="h-4 w-4" />
          For Gym Owners
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          List your gym on GymDuo
        </h1>
        <p className="text-muted-foreground mt-4 text-lg">
          Reach more members, get analytics, and manage everything in one place. Join hundreds of gyms already on the platform.
        </p>
      </motion.div>

      {/* Benefits */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-20"
      >
        <h2 className="text-2xl font-bold text-center mb-10">Why list on GymDuo?</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {BENEFITS.map((b, i) => (
            <Card key={i} className="glass-card border-white/10">
              <CardHeader>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 mb-2">
                  <b.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">{b.title}</h3>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{b.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.section>

      {/* Pricing */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-20"
      >
        <h2 className="text-2xl font-bold text-center mb-2">Simple pricing</h2>
        <p className="text-muted-foreground text-center mb-10">
          Choose the plan that fits your gym. No hidden fees.
        </p>
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {PLANS.map((plan, i) => (
            <Card
              key={i}
              className={`glass-card relative overflow-hidden ${
                plan.popular ? "border-primary/50 ring-2 ring-primary/20" : "border-white/10"
              }`}
            >
              {plan.popular && (
                <div className="absolute top-0 right-0 flex items-center gap-1 bg-primary/20 text-primary px-3 py-1 text-xs font-medium rounded-bl-lg">
                  <Star className="h-3 w-3" />
                  Popular
                </div>
              )}
              <CardHeader>
                <h3 className="text-xl font-semibold">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl font-bold">₹{plan.price.toLocaleString()}</span>
                  <span className="text-muted-foreground">/{plan.period}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                {owner ? (
                  <Button asChild className="w-full mt-4" size="lg" variant={plan.popular ? "default" : "outline"}>
                    <Link href="/dashboard/owner">Open dashboard</Link>
                  </Button>
                ) : (
                  <Button asChild className="w-full mt-4" size="lg" variant={plan.popular ? "default" : "outline"}>
                    <Link href={`/auth/login?callbackUrl=${encodeURIComponent("/dashboard/owner")}`}>
                      Log in to get started
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{" "}
          <Link href="/auth/register" className="text-primary hover:underline">
            Sign up as owner
          </Link>{" "}
          to create one.
        </p>
      </motion.section>

      {/* CTA - Login to owner dashboard */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-center"
      >
        <Card className="glass-card border-primary/30 max-w-xl mx-auto p-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20 mx-auto mb-4">
            <Headphones className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Ready to grow your gym?</h2>
          <p className="text-muted-foreground mb-6">
            {status === "loading" ? (
              <span className="inline-block h-5 w-48 bg-white/10 rounded animate-pulse" />
            ) : owner ? (
              "Head to your dashboard to manage your gyms."
            ) : (
              "Log in to your owner account or create one to list your gym."
            )}
          </p>
          {status !== "loading" && (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {owner ? (
                <Button asChild size="lg">
                  <Link href="/dashboard/owner">Go to Owner Dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button asChild size="lg">
                    <Link href={`/auth/login?callbackUrl=${encodeURIComponent("/dashboard/owner")}`}>
                      Log in to Owner Dashboard
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link href="/auth/register?role=owner">Create owner account</Link>
                  </Button>
                </>
              )}
            </div>
          )}
        </Card>
      </motion.section>
    </div>
  );
}
