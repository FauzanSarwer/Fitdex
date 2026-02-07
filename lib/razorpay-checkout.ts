"use client";

type RazorpayResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type CheckoutOptions = {
  orderId: string;
  amount: number;
  currency?: string;
  name?: string;
  onSuccess: (res: RazorpayResponse) => Promise<void> | void;
  onDismiss?: () => void;
};

export function isPaymentsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === "true";
}

async function loadRazorpayScript(): Promise<void> {
  if (typeof (window as any).Razorpay !== "undefined") return;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay"));
    document.body.appendChild(script);
  });
}

export async function openRazorpayCheckout(options: CheckoutOptions): Promise<{ ok: boolean; error?: string }> {
  if (!isPaymentsEnabled()) {
    return { ok: false, error: "PAYMENTS_DISABLED" };
  }
  const key = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  if (!key || key === "XXXXX") {
    return { ok: false, error: "Missing Razorpay key" };
  }
  try {
    await loadRazorpayScript();
    return await new Promise((resolve) => {
      const RazorpayCtor = (window as any).Razorpay as
        | (new (options: {
            key: string;
            amount: number;
            currency: string;
            name: string;
            order_id: string;
            handler: (res: RazorpayResponse) => void;
            modal?: { ondismiss?: () => void };
          }) => { open: () => void })
        | undefined;
      if (!RazorpayCtor) {
        resolve({ ok: false, error: "Razorpay unavailable" });
        return;
      }
      const rzp = new RazorpayCtor({
        key,
        amount: options.amount,
        currency: options.currency ?? "INR",
        name: options.name ?? "FITDEX",
        order_id: options.orderId,
        handler: async (res) => {
          await options.onSuccess(res);
          resolve({ ok: true });
        },
        modal: {
          ondismiss: () => {
            options.onDismiss?.();
            resolve({ ok: false, error: "DISMISSED" });
          },
        },
      });
      rzp.open();
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Payment failed" };
  }
}
