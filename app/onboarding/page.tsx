"use client";
import Stepper, { Step } from "@/components/reactbits/ui/Stepper";
import { useState, useEffect, useRef } from "react";
import { useUser, useSession } from "@clerk/nextjs";
import { reportClientError } from "@/lib/client-report-error";
import {
  PhoneFields,
  AddressField,
  ExperienceField,
  QualificationField,
  BoardField,
  GenderField,
  PlanSelection,
  PaymentStep,
  PLANS,
  onboardingStep1Schema,
} from "@/components/reactbits/onboarding/index";
import type {
  OnboardingFormData,
  PlanValue,
} from "@/components/reactbits/onboarding/index";

// ─── WhatsApp link type ───────────────────────────────────────────────────────
type WhatsAppGroup = {
  _id: string;
  label: string;
  url: string;
  capacity: number;
  memberCount: number;
};

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (
      typeof (window as unknown as Record<string, unknown>).Razorpay !==
      "undefined"
    ) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
    document.body.appendChild(script);
  });
}

export default function Onboarding() {
  const { user } = useUser();
  const { session } = useSession();

  // ── Legacy-migration detection ─────────────────────────────────────────────
  const publicMeta = (user?.publicMetadata ?? {}) as Record<string, unknown>;
  const isLegacyMigrated =
    publicMeta.migratedFromLegacy === true &&
    publicMeta.registrationFeeStatus === "paid";
  // ──────────────────────────────────────────────────────────────────────────

  const [formData, setFormData] = useState<OnboardingFormData>({
    phone: "",
    whatsapp: "",
    sameAsPhone: false,
    address: "",
    teachingExp: "",
    jobExp: "",
    qualification: "",
    board: "",
    gender: "",
    plan: "",
  });

  // Tracks which outer step the stepper is on
  const [currentStep, setCurrentStep] = useState(1);
  // Initial step to resume at (computed from server flags)
  const [initialStep, setInitialStep] = useState(1);
  const [stepperReady, setStepperReady] = useState(false);
  const [onboardingFlags, setOnboardingFlags] = useState({
    detailsCompleted: false,
    paymentCompleted: false,
    whatsappGroupCompleted: false,
    createdByAdmin: false,
  });

  // Auto-deletion countdown
  const [deletionDeadline, setDeletionDeadline] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState("");
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // WhatsApp step state
  const [whatsappGroups, setWhatsappGroups] = useState<WhatsAppGroup[]>([]);
  const [whatsappGroupsLoading, setWhatsappGroupsLoading] = useState(false);
  const [whatsappGroupsError, setWhatsappGroupsError] = useState<string | null>(
    null,
  );
  const [whatsappCompleting, setWhatsappCompleting] = useState<string | null>(
    null,
  );
  const [whatsappDone, setWhatsappDone] = useState(false);

  // Pre-fill form from DB on mount; also determine initial step
  useEffect(() => {
    const meta = (user as any)?.publicMetadata as
      | Record<string, unknown>
      | undefined;
    const isAdmin =
      meta?.isAdmin === true ||
      meta?.role === "super_admin" ||
      meta?.aotfRole === "SUPER_ADMIN";

    if (isAdmin) {
      setStepperReady(true);
      return;
    }

    fetch("/api/v1/onboarding")
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          data: {
            onboardingDetails?: Record<string, string | null>;
            createdAt?: string | null;
            onboardingCompleted?: boolean;
            detailsCompleted?: boolean;
            paymentCompleted?: boolean;
            whatsappGroupCompleted?: boolean;
            paymentPaidButNotOnboarded?: boolean;
            createdByAdmin?: boolean;
          } | null,
        ) => {
          if (data?.paymentPaidButNotOnboarded) {
            setPaymentPaidButNotOnboarded(true);
          }

          const flags = {
            detailsCompleted: data?.detailsCompleted ?? false,
            paymentCompleted: data?.paymentCompleted ?? false,
            whatsappGroupCompleted: data?.whatsappGroupCompleted ?? false,
            createdByAdmin: data?.createdByAdmin ?? false,
          };
          setOnboardingFlags(flags);

          // Step 1 and 2 are both covered by detailsCompleted.
          const nextStep = !flags.detailsCompleted
            ? 1
            : !flags.paymentCompleted
              ? 3
              : !flags.whatsappGroupCompleted
                ? 4
                : 5;
          setInitialStep(nextStep);
          setCurrentStep(nextStep);

          if (data?.whatsappGroupCompleted) {
            setWhatsappDone(true);
          }

          const d = data?.onboardingDetails;
          if (d) {
            setFormData((prev) => {
              const phone = d.phone ?? prev.phone;
              const whatsapp = d.whatsapp ?? prev.whatsapp;
              return {
                phone,
                whatsapp,
                sameAsPhone: !!phone && phone === whatsapp,
                address: d.address ?? prev.address,
                teachingExp: d.teachingExp ?? prev.teachingExp,
                jobExp: d.jobExp ?? prev.jobExp,
                qualification: d.qualification ?? prev.qualification,
                board: d.board ?? prev.board,
                gender: d.gender ?? prev.gender,
                plan: (d.plan as PlanValue) ?? prev.plan,
              };
            });
            setProfileSaved(true);
            if (d.plan) setOnboardingDetailsSaved(true);
          }
          if (data?.createdAt && !flags.paymentCompleted) {
            const deadline = new Date(
              new Date(data.createdAt).getTime() + 30 * 24 * 60 * 60 * 1000,
            );
            setDeletionDeadline(deadline);
          }
        },
      )
      .catch(() => {
        /* silently ignore — form stays empty */
      })
      .finally(() => {
        setStepperReady(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load WhatsApp groups when reaching step 4
  useEffect(() => {
    if (currentStep !== 4 || whatsappGroups.length > 0 || whatsappGroupsLoading)
      return;
    setWhatsappGroupsLoading(true);
    setWhatsappGroupsError(null);
    fetch("/api/v1/onboarding/whatsapp")
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error("Failed to load groups")),
      )
      .then((data: { groups: WhatsAppGroup[] }) => {
        setWhatsappGroups(data.groups ?? []);
      })
      .catch((err) => {
        setWhatsappGroupsError(
          err instanceof Error ? err.message : "Failed to load groups",
        );
      })
      .finally(() => {
        setWhatsappGroupsLoading(false);
      });
  }, [currentStep, whatsappGroups.length, whatsappGroupsLoading]);

  // Live countdown ticker
  useEffect(() => {
    if (!deletionDeadline) return;
    const tick = () => {
      const diff = deletionDeadline.getTime() - Date.now();
      if (diff <= 0) {
        setCountdown("Account will be deleted shortly.");
        if (countdownRef.current) clearInterval(countdownRef.current);
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hrs = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdown(
        `${days}d ${hrs.toString().padStart(2, "0")}h ${mins.toString().padStart(2, "0")}m ${secs.toString().padStart(2, "0")}s`,
      );
    };
    tick();
    countdownRef.current = setInterval(tick, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [deletionDeadline]);

  // Profile save state
  const [profileSaved, setProfileSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Onboarding details save state
  const [onboardingDetailsSaved, setOnboardingDetailsSaved] = useState(false);
  const [isSavingOnboarding, setIsSavingOnboarding] = useState(false);
  const [onboardingDetailsError, setOnboardingDetailsError] = useState<
    string | null
  >(null);

  // Payment state
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Mismatch state
  const [paymentPaidButNotOnboarded, setPaymentPaidButNotOnboarded] =
    useState(false);

  // ─── Handlers ─────────────────────────────────────────────────────

  const handleChange = (
    key: keyof OnboardingFormData,
    value: string | boolean,
  ) => {
    setFormData((prev) => {
      const next: OnboardingFormData = {
        ...prev,
        [key]: value,
        ...(key === "sameAsPhone" && value === true
          ? { whatsapp: prev.phone }
          : {}),
      };
      return next;
    });
    const step1Fields: (keyof OnboardingFormData)[] = [
      "phone",
      "whatsapp",
      "sameAsPhone",
      "address",
      "teachingExp",
      "jobExp",
      "qualification",
      "board",
      "gender",
    ];
    if (step1Fields.includes(key)) {
      setProfileSaved(false);
      setOnboardingDetailsSaved(false);
    }
    if (key === "plan" && typeof value === "string" && value) {
      setOnboardingDetailsSaved(false);
      saveOnboardingDetails(value);
    }
  };

  const saveProfile = async () => {
    setIsSaving(true);
    setSaveError(null);
    const meta = (user as any)?.publicMetadata as
      | Record<string, unknown>
      | undefined;
    const isAdmin =
      meta?.isAdmin === true ||
      meta?.role === "super_admin" ||
      meta?.aotfRole === "SUPER_ADMIN";
    if (isAdmin) {
      setIsSaving(false);
      setProfileSaved(true);
      return;
    }
    try {
      const res = await fetch("/api/v1/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: formData.phone,
          whatsapp: formData.whatsapp,
          address: formData.address,
          teachingExp: formData.teachingExp,
          ...(formData.jobExp ? { jobExp: formData.jobExp } : {}),
          qualification: formData.qualification,
          board: formData.board,
          gender: formData.gender,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ??
            (res.status === 404
              ? "Your account is still being set up. Please wait a moment and try again."
              : "Failed to save details. Please try again."),
        );
      }
      setProfileSaved(true);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to save your details.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const saveOnboardingDetails = async (planOverride?: string) => {
    setIsSavingOnboarding(true);
    setOnboardingDetailsError(null);
    const meta = (user as any)?.publicMetadata as
      | Record<string, unknown>
      | undefined;
    const isAdmin =
      meta?.isAdmin === true ||
      meta?.role === "super_admin" ||
      meta?.aotfRole === "SUPER_ADMIN";
    if (isAdmin) {
      setIsSavingOnboarding(false);
      setOnboardingDetailsSaved(true);
      return;
    }
    const planValue =
      planOverride !== undefined ? planOverride : formData.plan || undefined;
    try {
      const res = await fetch("/api/v1/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: formData.phone,
          whatsapp: formData.whatsapp,
          address: formData.address,
          teachingExp: formData.teachingExp,
          ...(formData.jobExp ? { jobExp: formData.jobExp } : {}),
          qualification: formData.qualification,
          board: formData.board,
          gender: formData.gender,
          ...(planValue ? { plan: planValue } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ??
            (res.status === 404
              ? "Your account is still being set up. Please wait a moment and try again."
              : "Failed to save details. Please try again."),
        );
      }
      const savedData = (await res.json()) as {
        detailsCompleted?: boolean;
        paymentCompleted?: boolean;
        whatsappGroupCompleted?: boolean;
      };
      setOnboardingDetailsSaved(true);
      setOnboardingFlags((prev) => ({
        ...prev,
        detailsCompleted: savedData.detailsCompleted ?? prev.detailsCompleted,
        paymentCompleted: savedData.paymentCompleted ?? prev.paymentCompleted,
        whatsappGroupCompleted:
          savedData.whatsappGroupCompleted ?? prev.whatsappGroupCompleted,
      }));
    } catch (err) {
      setOnboardingDetailsError(
        err instanceof Error ? err.message : "Failed to save your details.",
      );
    } finally {
      setIsSavingOnboarding(false);
    }
  };

  const handleStepChange = (step: number) => {
    setCurrentStep(step);
    if (step !== 1 && !profileSaved && !isSaving) saveProfile();
    if (step !== 1 && !onboardingDetailsSaved && !isSavingOnboarding)
      saveOnboardingDetails(formData.plan || undefined);
  };

  const validateStep = (step: number): boolean => {
    if (step === 1) {
      const result = onboardingStep1Schema.safeParse({
        phone: formData.phone,
        whatsapp: formData.whatsapp,
        address: formData.address,
        teachingExp: formData.teachingExp,
        jobExp: formData.jobExp || undefined,
        qualification: formData.qualification,
        board: formData.board,
        gender: formData.gender,
      });
      return result.success;
    }
    if (step === 2) {
      return (
        !!formData.plan &&
        (profileSaved || isSaving) &&
        (onboardingDetailsSaved || isSavingOnboarding)
      );
    }
    // Step 3: block "Complete" — payment is the gate
    if (step === 3) return false;
    // Step 4: whatsapp step — allow Next only after done (but we hide Next anyway)
    return false;
  };

  // ─── Payment flow ─────────────────────────────────────────────────
  const handlePayment = async () => {
    if (!formData.plan) {
      setPaymentError("Please select a plan first.");
      return;
    }
    if (!user) {
      setPaymentError(
        "Session expired. Please refresh the page and try again.",
      );
      return;
    }
    setIsPaymentLoading(true);
    setPaymentError(null);
    try {
      const orderRes = await fetch("/api/v1/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: formData.plan }),
      });
      if (!orderRes.ok) {
        const d = await orderRes.json().catch(() => ({}));
        throw new Error(
          (d as { error?: string }).error ?? "Failed to create order",
        );
      }
      const orderData = (await orderRes.json()) as
        | { alreadyPaid: true }
        | { orderId: string; amount: number; currency: string; key: string };

      if ("alreadyPaid" in orderData && orderData.alreadyPaid) {
        const activateRes = await fetch("/api/v1/payments/activate-legacy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: formData.plan }),
        });
        if (!activateRes.ok) {
          const d = await activateRes.json().catch(() => ({}));
          throw new Error(
            (d as { error?: string }).error ?? "Account activation failed",
          );
        }
        await user.reload();
        await session?.reload();
        // After payment, proceed to WhatsApp step instead of redirecting
        setOnboardingFlags((prev) => ({ ...prev, paymentCompleted: true }));
        setCurrentStep(4);
        return;
      }

      const { orderId, amount, currency, key } = orderData as {
        orderId: string;
        amount: number;
        currency: string;
        key: string;
      };
      await loadRazorpayScript();
      const selectedPlan = PLANS.find((p) => p.value === formData.plan)!;

      await new Promise<void>((resolve, reject) => {
        const options = {
          key,
          amount,
          currency,
          name: "AOTF",
          description: selectedPlan.label,
          order_id: orderId,
          handler: async (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            try {
              const verifyRes = await fetch("/api/v1/payments/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  toPlan: formData.plan,
                }),
              });
              if (!verifyRes.ok) {
                const d = await verifyRes.json().catch(() => ({}));
                throw new Error(
                  (d as { error?: string }).error ??
                    "Payment verification failed",
                );
              }
              await user.reload();
              await session?.reload();
              // Move to WhatsApp step instead of redirecting
              setOnboardingFlags((prev) => ({
                ...prev,
                paymentCompleted: true,
              }));
              setCurrentStep(4);
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          prefill: { contact: formData.phone },
          modal: { ondismiss: () => reject(new Error("Payment cancelled")) },
        };
        const RazorpayClass = (
          window as unknown as {
            Razorpay: new (opts: unknown) => { open: () => void };
          }
        ).Razorpay;
        new RazorpayClass(options).open();
      });
    } catch (err) {
      if (!(err instanceof Error && err.message === "Payment cancelled")) {
        setPaymentError(
          err instanceof Error
            ? err.message
            : "Payment failed. Please try again.",
        );
        reportClientError(err, {
          feature: "onboarding",
          extra: { step: "payment" },
        });
      }
    } finally {
      setIsPaymentLoading(false);
    }
  };

  // ─── WhatsApp group join ────────────────────────────────────────────
  const handleJoinGroup = async (group: WhatsAppGroup) => {
    setWhatsappCompleting(group._id);
    try {
      // Open the group link first
      window.open(group.url, "_blank", "noopener,noreferrer");

      // Mark completion server-side
      const res = await fetch("/api/v1/onboarding/whatsapp", {
        method: "POST",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(
          (d as { error?: string }).error ?? "Failed to mark WhatsApp step",
        );
      }

      setWhatsappDone(true);
      setOnboardingFlags((prev) => ({ ...prev, whatsappGroupCompleted: true }));

      // Reload session then redirect to profile
      if (user) {
        await user.reload();
        await session?.reload();
        window.location.href = `/u/${user.username}`;
      }
    } catch (err) {
      reportClientError(err, {
        feature: "onboarding",
        extra: { step: "whatsapp" },
      });
      // Non-blocking — user can still navigate away
    } finally {
      setWhatsappCompleting(null);
    }
  };

  const selectedPlan = PLANS.find((p) => p.value === formData.plan);
  const isStepAvailable = (step: number) =>
    step === 1
      ? !onboardingFlags.detailsCompleted
      : step === 2
        ? !onboardingFlags.detailsCompleted && !onboardingFlags.paymentCompleted
        : step === 3
          ? !onboardingFlags.paymentCompleted
          : !onboardingFlags.whatsappGroupCompleted;

  // Don't render Stepper until we know the resume step
  if (!stepperReady) {
    return (
      <section className="flex flex-col items-center justify-center px-4 py-16">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </section>
    );
  }

  return (
    <section className="flex flex-col items-center justify-center px-4 pb-16">
      <div className="w-full max-w-md mx-auto">
        {/* ── Payment received but onboarding not completed ────── */}
        {paymentPaidButNotOnboarded && (
          <div className="my-10 p-6 rounded-2xl bg-danger-50 border border-danger-200 text-center space-y-4">
            <div className="text-4xl">⚠️</div>
            <h2 className="text-xl font-bold text-danger-700">
              Payment Received — Account Pending
            </h2>
            <p className="text-sm text-danger-600">
              We have received your payment, but your account activation is
              still pending. This can happen due to a processing delay.
            </p>
            <p className="text-sm text-danger-600">
              Please contact the admin to get your account activated:
            </p>
            <div className="flex flex-col items-center gap-2 pt-2">
              <a
                href="mailto:support@aotf.in"
                className="text-primary font-semibold underline"
              >
                support@aotf.in
              </a>
              <a
                href="https://wa.me/919876543210"
                target="_blank"
                rel="noopener noreferrer"
                className="text-success font-semibold underline"
              >
                WhatsApp Support
              </a>
            </div>
            <p className="text-xs text-default-400 pt-2">
              Please keep your registered phone number and email handy when
              contacting support.
            </p>
          </div>
        )}

        {/* ── Normal onboarding flow ─────────────────────────────── */}
        {!paymentPaidButNotOnboarded && (
          <>
            {/* ── Auto-deletion warning ────────────────────────── */}
            {deletionDeadline && countdown && (
              <div className="mb-2 p-4 rounded-xl bg-warning-50 border border-warning-300 text-warning-800 text-sm space-y-1">
                <p className="font-semibold">
                  ⚠️ Account scheduled for deletion
                </p>
                <p>
                  Your account will be automatically deleted if payment is not
                  completed.
                </p>
                <p className="font-mono font-bold tracking-wide">{countdown}</p>
              </div>
            )}
            {onboardingFlags.createdByAdmin &&
              onboardingFlags.paymentCompleted && (
                <div className="mb-4 rounded-xl border border-success-200 bg-success-50 p-4 text-center text-sm text-success-700">
                  <p className="font-semibold">
                    Your payment has already been collected.
                  </p>
                  <p>
                    You do not need to pay again. Complete the remaining
                    onboarding steps below.
                  </p>
                </div>
              )}
            <Stepper
              className="mb-10"
              initialStep={initialStep}
              isStepAvailable={isStepAvailable}
              onStepChange={handleStepChange}
              validateStep={validateStep}
              checkStep={validateStep}
              nextButtonProps={
                currentStep === 3 || currentStep === 4
                  ? { style: { display: "none" } }
                  : {}
              }
            >
              {/* ── STEP 1: Personal & Professional Details ─── */}
              <Step>
                <div className="space-y-3">
                  <PhoneFields
                    phone={formData.phone}
                    whatsapp={formData.whatsapp}
                    sameAsPhone={formData.sameAsPhone}
                    onChange={handleChange}
                  />
                  <AddressField
                    value={formData.address}
                    onChange={(v) => handleChange("address", v)}
                  />
                  <ExperienceField
                    label="Teaching Experience"
                    value={formData.teachingExp}
                    isRequired
                    onChange={(v) => handleChange("teachingExp", v)}
                  />
                  <ExperienceField
                    label="Job Experience (optional)"
                    value={formData.jobExp}
                    onChange={(v) => handleChange("jobExp", v)}
                  />
                  <QualificationField
                    value={formData.qualification}
                    onChange={(v) => handleChange("qualification", v)}
                  />
                  <BoardField
                    value={formData.board}
                    onChange={(v) => handleChange("board", v)}
                  />
                  <GenderField
                    value={formData.gender}
                    onChange={(v) => handleChange("gender", v)}
                  />
                </div>
              </Step>

              {/* ── STEP 2: Plan Selection ─────────────────────── */}
              <Step>
                <PlanSelection
                  selectedPlan={formData.plan}
                  onPlanChange={(plan) => handleChange("plan", plan)}
                  isSaving={isSaving}
                  isSavingOnboarding={isSavingOnboarding}
                  saveError={saveError}
                  onRetryProfile={saveProfile}
                  onboardingDetailsError={onboardingDetailsError}
                  onRetryOnboarding={() =>
                    saveOnboardingDetails(formData.plan || undefined)
                  }
                />
              </Step>

              {/* ── STEP 3: Payment ────────────────────────────── */}
              <Step>
                <PaymentStep
                  plan={formData.plan}
                  isPaymentLoading={isPaymentLoading}
                  paymentError={paymentError}
                  onPay={handlePayment}
                  isSavingDetails={isSaving || isSavingOnboarding}
                  isLegacyMigrated={isLegacyMigrated}
                />
              </Step>

              {/* ── STEP 4: Join WhatsApp Group ────────────────── */}
              <Step>
                <div className="space-y-4 py-2">
                  <div className="text-center space-y-1">
                    <div className="text-4xl">💬</div>
                    <h3 className="text-lg font-bold">Join a WhatsApp Group</h3>
                    <p className="text-sm text-default-500">
                      Join a teacher WhatsApp group to connect with the AOTF
                      community. Tap any link below to join — your onboarding
                      will complete automatically.
                    </p>
                  </div>

                  {whatsappGroupsLoading && (
                    <div className="flex justify-center py-6">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}

                  {whatsappGroupsError && (
                    <div className="p-3 rounded-xl bg-danger-50 border border-danger-200 text-danger-700 text-sm text-center">
                      {whatsappGroupsError}
                      <button
                        className="block mx-auto mt-2 text-xs underline"
                        onClick={() => {
                          setWhatsappGroupsError(null);
                          setWhatsappGroupsLoading(false);
                          setWhatsappGroups([]);
                        }}
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {!whatsappGroupsLoading &&
                    !whatsappGroupsError &&
                    whatsappGroups.length === 0 && (
                      <div className="p-4 rounded-xl bg-warning-50 border border-warning-200 text-warning-800 text-sm text-center">
                        No WhatsApp groups are available right now. Please check
                        back soon or contact support.
                      </div>
                    )}

                  {whatsappGroups.map((group) => (
                    <button
                      key={group._id}
                      className="w-full flex items-center justify-between gap-3 p-4 rounded-xl border border-success-200 bg-success-50 hover:bg-success-100 active:scale-[0.98] transition-all text-left disabled:opacity-60"
                      disabled={!!whatsappCompleting || whatsappDone}
                      onClick={() => void handleJoinGroup(group)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">💬</span>
                        <div>
                          <p className="font-semibold text-success-800">
                            {group.label}
                          </p>
                          <p className="text-xs text-success-600">
                            {group.memberCount}/{group.capacity} members
                          </p>
                        </div>
                      </div>
                      {whatsappCompleting === group._id ? (
                        <div className="w-5 h-5 border-2 border-success border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span className="text-success-600 text-sm font-medium">
                          Join →
                        </span>
                      )}
                    </button>
                  ))}

                  {whatsappDone && (
                    <div className="p-4 rounded-xl bg-success-50 border border-success-200 text-success-800 text-sm text-center font-semibold">
                      ✅ You've joined! Onboarding complete. Redirecting…
                    </div>
                  )}

                  <p className="text-xs text-default-400 text-center pt-2">
                    You can always rejoin or switch groups later from your
                    profile.
                  </p>
                </div>
              </Step>
            </Stepper>
          </>
        )}
      </div>
    </section>
  );
}
