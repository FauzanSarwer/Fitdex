"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, UploadCloud } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchJson } from "@/lib/client-fetch";
import { useToast } from "@/hooks/use-toast";

export default function OwnerVerificationPage() {
  const { toast } = useToast();
  const MAX_UPLOAD_BYTES = 500 * 1024;
  const [gyms, setGyms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gstGym, setGstGym] = useState<any | null>(null);
  const [gstForm, setGstForm] = useState({
    gstNumber: "",
    gstLegalName: "",
    gstCity: "",
    gstCertificateUrl: "",
  });
  const [bankGym, setBankGym] = useState<any | null>(null);
  const [bankForm, setBankForm] = useState({
    accountNumber: "",
    ifsc: "",
    accountHolderName: "",
  });
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchJson<{ gyms?: any[]; error?: string }>("/api/owner/gym", { retries: 1 })
      .then((result) => {
        if (!active) return;
        if (!result.ok) {
          setError(result.error ?? "Failed to load gyms");
          setGyms([]);
          return;
        }
        setGyms(result.data?.gyms ?? []);
      })
      .catch(() => {
        if (!active) return;
        setError("Failed to load gyms");
        setGyms([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const openGstDialog = (gym: any) => {
    setGstGym(gym);
    setGstForm({
      gstNumber: gym.gstNumber ?? "",
      gstLegalName: "",
      gstCity: "",
      gstCertificateUrl: gym.gstCertificateUrl ?? "",
    });
  };

  const submitGst = async () => {
    if (!gstGym?.id) return;
    if (!gstForm.gstNumber.trim() || !gstForm.gstCertificateUrl) {
      toast({
        title: "Missing info",
        description: "GST number and certificate are required.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const result = await fetchJson<{ ok?: boolean; error?: string; verificationNotes?: string }>(
        "/api/owner/gym/verification/gst",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gymId: gstGym.id,
            gstNumber: gstForm.gstNumber.trim(),
            gstCertificateUrl: gstForm.gstCertificateUrl,
            gstLegalName: gstForm.gstLegalName.trim() || undefined,
            gstCity: gstForm.gstCity.trim() || undefined,
          }),
          retries: 1,
        }
      );
      if (!result.ok) {
        toast({ title: "Submission failed", description: result.error ?? "Please try again.", variant: "destructive" });
        setSubmitting(false);
        return;
      }
      toast({ title: "GST submitted", description: result.data?.verificationNotes ?? "Verification is pending." });
      setGstGym(null);
    } catch {
      toast({ title: "Submission failed", variant: "destructive" });
    }
    setSubmitting(false);
  };

  const openBankDialog = (gym: any) => {
    setBankGym(gym);
    setBankForm({
      accountNumber: "",
      ifsc: "",
      accountHolderName: "",
    });
  };

  const submitBank = async () => {
    if (!bankGym?.id) return;
    if (!bankForm.accountNumber.trim() || !bankForm.ifsc.trim()) {
      toast({ title: "Missing info", description: "Account number and IFSC are required.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const result = await fetchJson<{ ok?: boolean; error?: string; verificationStatus?: string }>(
        "/api/owner/gym/verification/bank",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gymId: bankGym.id,
            accountNumber: bankForm.accountNumber.trim(),
            ifsc: bankForm.ifsc.trim().toUpperCase(),
            accountHolderName: bankForm.accountHolderName.trim() || undefined,
          }),
          retries: 1,
        }
      );
      if (!result.ok) {
        toast({ title: "Verification failed", description: result.error ?? "Please try again.", variant: "destructive" });
        setSubmitting(false);
        return;
      }
      toast({ title: "Bank details submitted", description: "Bank verification submitted." });
      setBankGym(null);
    } catch {
      toast({ title: "Verification failed", variant: "destructive" });
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-60" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="glass-card p-10 text-center">
          <CardHeader>
            <CardTitle>Could not load verification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6" />
          Verification
        </h1>
        <p className="text-sm text-muted-foreground">
          Complete verification for each gym to unlock payments and member joins.
        </p>
      </motion.div>

      {gyms.length === 0 ? (
        <Card className="glass-card p-10 text-center">
          <CardHeader>
            <CardTitle>No gyms yet</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Add a gym first to start verification.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {gyms.map((gym) => {
            const isVerified = gym.verificationStatus === "VERIFIED";
            return (
              <Card key={gym.id} className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{gym.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        isVerified ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
                      }`}
                    >
                      {isVerified ? "Verified" : "Pending"}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {isVerified
                      ? "Verification is complete. This gym can accept members."
                      : "Upload GST certificate and bank details for review."}
                  </p>
                  {!isVerified && (
                    <div className="flex flex-wrap gap-2">
                      <Dialog open={gstGym?.id === gym.id} onOpenChange={(open) => !open && setGstGym(null)}>
                        <DialogTrigger asChild>
                          <Button onClick={() => openGstDialog(gym)}>
                            <UploadCloud className="mr-2 h-4 w-4" />
                            Submit GST certificate
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                          <DialogHeader>
                            <DialogTitle>Submit GST verification</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>GST number</Label>
                              <Input
                                value={gstForm.gstNumber}
                                onChange={(e) => setGstForm((p) => ({ ...p, gstNumber: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Legal business name (optional)</Label>
                              <Input
                                value={gstForm.gstLegalName}
                                onChange={(e) => setGstForm((p) => ({ ...p, gstLegalName: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>City (optional)</Label>
                              <Input
                                value={gstForm.gstCity}
                                onChange={(e) => setGstForm((p) => ({ ...p, gstCity: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>GST certificate (image only, max 500KB)</Label>
                              <Input
                                type="file"
                                accept="image/*"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  if (!file.type.startsWith("image/")) {
                                    toast({ title: "Invalid file", description: "Only image files are allowed.", variant: "destructive" });
                                    return;
                                  }
                                  if (file.size > MAX_UPLOAD_BYTES) {
                                    toast({ title: "File too large", description: "Image must be 500KB or less.", variant: "destructive" });
                                    return;
                                  }
                                  setUploading(true);
                                  try {
                                    const sigResult = await fetchJson<{
                                      signature?: string;
                                      timestamp?: number;
                                      cloudName?: string;
                                      apiKey?: string;
                                      folder?: string;
                                      error?: string;
                                    }>("/api/uploads/signature", { retries: 1 });
                                    if (!sigResult.ok || !sigResult.data?.signature || !sigResult.data.cloudName) {
                                      toast({ title: "Upload failed", description: sigResult.error ?? "Missing upload config", variant: "destructive" });
                                      setUploading(false);
                                      return;
                                    }
                                    if (!sigResult.data.apiKey || !sigResult.data.timestamp) {
                                      toast({ title: "Upload failed", description: "Upload configuration incomplete.", variant: "destructive" });
                                      setUploading(false);
                                      return;
                                    }
                                    const formData = new FormData();
                                    formData.append("file", file);
                                    formData.append("api_key", sigResult.data.apiKey ?? "");
                                    formData.append("timestamp", String(sigResult.data.timestamp));
                                    formData.append("signature", sigResult.data.signature);
                                    if (sigResult.data.folder) formData.append("folder", sigResult.data.folder);
                                    const uploadRes = await fetch(
                                      `https://api.cloudinary.com/v1_1/${sigResult.data.cloudName}/image/upload`,
                                      { method: "POST", body: formData }
                                    );
                                    const uploadJson = await uploadRes.json();
                                    if (!uploadRes.ok || !uploadJson.secure_url) {
                                      toast({ title: "Upload failed", description: "Could not upload image", variant: "destructive" });
                                      setUploading(false);
                                      return;
                                    }
                                    setGstForm((p) => ({ ...p, gstCertificateUrl: uploadJson.secure_url }));
                                  } catch {
                                    toast({ title: "Upload failed", variant: "destructive" });
                                  }
                                  setUploading(false);
                                }}
                              />
                              {gstForm.gstCertificateUrl && (
                                <img src={gstForm.gstCertificateUrl} alt="GST" className="h-24 rounded-xl object-cover" />
                              )}
                            </div>
                            <Button onClick={submitGst} disabled={submitting || uploading}>
                              {submitting ? "Submitting..." : "Submit for verification"}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Dialog open={bankGym?.id === gym.id} onOpenChange={(open) => !open && setBankGym(null)}>
                        <DialogTrigger asChild>
                          <Button variant="outline" onClick={() => openBankDialog(gym)}>
                            Add bank account
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                          <DialogHeader>
                            <DialogTitle>Bank account details</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Account holder name (optional)</Label>
                              <Input
                                value={bankForm.accountHolderName}
                                onChange={(e) => setBankForm((p) => ({ ...p, accountHolderName: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Account number</Label>
                              <Input
                                value={bankForm.accountNumber}
                                onChange={(e) => setBankForm((p) => ({ ...p, accountNumber: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>IFSC code</Label>
                              <Input
                                value={bankForm.ifsc}
                                onChange={(e) => setBankForm((p) => ({ ...p, ifsc: e.target.value }))}
                              />
                            </div>
                            <Button onClick={submitBank} disabled={submitting}>
                              {submitting ? "Submitting..." : "Submit bank details"}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
