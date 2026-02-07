import { getRequiredEnv } from "./env";

export type BankVerificationResult = {
  verified: boolean;
  accountHolderName?: string;
  providerReference?: string;
  raw?: unknown;
};

export async function verifyBankAccount(params: {
  accountNumber: string;
  ifsc: string;
  accountHolderName?: string;
}): Promise<BankVerificationResult> {
  const url = getRequiredEnv("BANK_VERIFICATION_URL");
  const apiKey = getRequiredEnv("BANK_VERIFICATION_API_KEY");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      accountNumber: params.accountNumber,
      ifsc: params.ifsc,
      accountHolderName: params.accountHolderName,
    }),
  });
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Bank verification failed: ${raw}`);
  }
  let data: any = {};
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Bank verification returned invalid JSON");
  }
  return {
    verified: Boolean(data?.verified ?? data?.success),
    accountHolderName: data?.accountHolderName ?? data?.name,
    providerReference: data?.reference ?? data?.id,
    raw: data,
  };
}
