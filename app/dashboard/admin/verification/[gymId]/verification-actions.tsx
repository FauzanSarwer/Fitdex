"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { fetchJson } from "@/lib/client-fetch";

type VerificationAction = "APPROVE" | "REJECT" | "REQUEST_REUPLOAD";

type Props = {
  gymId: string;
  initialStatus: string;
  initialNotes: string | null;
};

export function VerificationActions({ gymId, initialStatus, initialNotes }: Props) {
  const { toast } = useToast();
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [status, setStatus] = useState(initialStatus);
  const [submitting, setSubmitting] = useState<VerificationAction | null>(null);

  const handleAction = async (action: VerificationAction) => {
    setSubmitting(action);
    const result = await fetchJson<{ verificationStatus?: string; error?: string }>(
      "/api/admin/gym/verification",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymId,
          action,
          notes: notes.trim() || undefined,
        }),
        retries: 1,
      }
    );

    if (result.ok) {
      setStatus(result.data?.verificationStatus ?? status);
      toast({
        title: "Updated",
        description: `Verification marked as ${result.data?.verificationStatus ?? status}.`,
      });
    } else {
      toast({
        title: "Update failed",
        description: result.error ?? "Request failed",
        variant: "destructive",
      });
    }

    setSubmitting(null);
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Current status: <span className="text-foreground font-medium">{status}</span>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="admin-notes">
          Notes (optional)
        </label>
        <textarea
          id="admin-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={4}
          className="w-full rounded-lg border border-white/10 bg-background px-3 py-2 text-sm text-foreground"
          placeholder="Add review notes or re-upload instructions"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={submitting !== null}
          onClick={() => handleAction("APPROVE")}
        >
          {submitting === "APPROVE" ? "Approving..." : "Approve"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={submitting !== null}
          onClick={() => handleAction("REQUEST_REUPLOAD")}
        >
          {submitting === "REQUEST_REUPLOAD" ? "Requesting..." : "Request re-upload"}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={submitting !== null}
          onClick={() => handleAction("REJECT")}
        >
          {submitting === "REJECT" ? "Rejecting..." : "Reject"}
        </Button>
      </div>
    </div>
  );
}
