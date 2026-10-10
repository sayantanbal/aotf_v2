"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Avatar } from "@heroui/avatar";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Tab, Tabs } from "@heroui/tabs";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { LuNotebookPen } from "react-icons/lu";
import { FcPrivacy } from "react-icons/fc";
import { FaLocationDot } from "react-icons/fa6";
import { Badge } from "@heroui/badge";
import { formatPhone } from "@/lib/utils/phone";
import { formatDisplayMonthYear } from "@/lib/utils/display-date";
import { reportClientError } from "@/lib/client-report-error";
import {
  FaBook,
  FaChalkboardTeacher,
  FaMailBulk,
  FaPhone,
} from "react-icons/fa";
import {
  ShieldCheck,
  IdCard as IdCardIcon,
  GlobeLock,
  ReceiptText,
  CameraIcon,
  CheckCircle,
  Camera,
} from "lucide-react";
import BackButton from "@/components/BackButton";
import ButtonGroup from "@/components/ButtonGroup";
import {
  IdCard,
  type IdCardData,
  UpgradeCandidateCard,
} from "@/components/teacher/profile/IdCardView";
import { RiRefund2Line } from "react-icons/ri";
import Stack from "@/components/reactbits/ui/Stack";
import { IoCameraOutline, IoNotificationsCircleOutline } from "react-icons/io5";
import EditProfileDetails, {
  type EditableProfileDetails,
} from "@/components/teacher/profile/EditProfileDetails";

// ── Types ───────────────────────────────────────────────────────────

interface ProfileData {
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  location: string | null;
  websiteUrl: string | null;
  subjects: string[];
  subjectKeys?: string[];
  experience: number | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  teachingExp: string | null;
  jobExp: string | null;
  qualification: string | null;
  board: string | null;
  gender: string | null;
}

interface UserData {
  role: string;
  plan: {
    current: string;
    hasTuitionAccess: boolean;
    hasCandidateAccess: boolean;
    activatedAt: string | null;
  };
  onboardingCompleted: boolean;
  memberSince: string;
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (
      typeof window !== "undefined" &&
      typeof (window as unknown as Record<string, unknown>).Razorpay !==
        "undefined"
    ) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
    document.body.appendChild(script);
  });
}

// ── Page ────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user: clerkUser } = useUser();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAvatarSaving, setIsAvatarSaving] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);
  const [isUpgradeLoading, setIsUpgradeLoading] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle"
  );

  const isOwnProfile =
    clerkUser?.username?.toLowerCase() === username?.toLowerCase();

  useEffect(() => {
    if (!username) return;

    fetch(`/api/v1/users/${encodeURIComponent(username)}`)
      .then(async (res) => {
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(
            (d as { error?: string }).error ?? "Failed to load profile"
          );
        }
        return res.json();
      })
      .then((data: { profile: ProfileData; user: UserData }) => {
        setProfile(data.profile);
        setUserData(data.user);
      })
      .catch((err) => {
        reportClientError(err, { feature: "public-profile-load" });
        setError(err instanceof Error ? err.message : "Something went wrong");
      })
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !profile || !userData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-2">
        <p className="text-lg font-semibold text-danger">
          {error ?? "User not found"}
        </p>
      </div>
    );
  }

  // ── Derived data ──────────────────────────────────────────────────

  const accountHolderName =
    profile.displayName?.trim() ||
    (isOwnProfile ? clerkUser?.fullName?.trim() : "") ||
    "Account Holder";
  const displayName = profile.displayName?.trim() || accountHolderName;
  const avatarUrl = isOwnProfile
    ? (clerkUser?.imageUrl ?? profile.avatarUrl ?? undefined)
    : (profile.avatarUrl ?? undefined);
  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? undefined;
  const phone = profile.phone ? formatPhone(`+91${profile.phone}`) : null;
  const memberSince = new Date(userData.memberSince);
  const joinMonth = formatDisplayMonthYear(memberSince);

  const isCandidate = userData.plan.hasCandidateAccess;
  const canUpgradeToCandidate =
    isOwnProfile &&
    !isCandidate &&
    userData.role === "teacher" &&
    userData.plan.current === "teacher";

  const handleCandidateUpgrade = async () => {
    if (!canUpgradeToCandidate) {
      setUpgradeError("Only teacher accounts can upgrade to candidate.");
      return;
    }

    setIsUpgradeLoading(true);
    setUpgradeError(null);

    try {
      const orderRes = await fetch("/api/v1/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "teacher_candidate" }),
      });

      if (!orderRes.ok) {
        const data = await orderRes.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ?? "Failed to create order"
        );
      }

      const { orderId, amount, currency, key } = (await orderRes.json()) as {
        orderId: string;
        amount: number;
        currency: string;
        key: string;
      };

      await loadRazorpayScript();

      await new Promise<void>((resolve, reject) => {
        const options = {
          key,
          amount,
          currency,
          name: "AOTF",
          description: "Teacher to Candidate Upgrade (INR 50)",
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
                }),
              });

              if (!verifyRes.ok) {
                const data = await verifyRes.json().catch(() => ({}));
                throw new Error(
                  (data as { error?: string }).error ??
                    "Payment verification failed"
                );
              }

              await clerkUser?.reload();
              window.location.href = `/u/${profile.username}`;
              resolve();
            } catch (upgradeErr) {
              reject(upgradeErr);
            }
          },
          prefill: {
            contact: profile.phone ?? undefined,
            email: email || "",
          },
          modal: {
            ondismiss: () => reject(new Error("Payment cancelled")),
          },
        };

        const RazorpayClass = (
          window as unknown as {
            Razorpay: new (opts: unknown) => { open: () => void };
          }
        ).Razorpay;

        new RazorpayClass(options).open();
      });
    } catch (upgradeErr) {
      reportClientError(upgradeErr, { feature: "profile-candidate-upgrade" });
      if (
        upgradeErr instanceof Error &&
        upgradeErr.message === "Payment cancelled"
      ) {
        setUpgradeError(null);
      } else {
        setUpgradeError(
          upgradeErr instanceof Error
            ? upgradeErr.message
            : "Upgrade failed. Please try again."
        );
      }
      setIsUpgradeLoading(false);
    }
  };

  const updateAvatar = async (file: File) => {
    if (!clerkUser) {
      setAvatarMessage("Unable to update avatar right now.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setAvatarMessage("Please choose a valid image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAvatarMessage("Avatar size must be 5MB or less.");
      return;
    }

    setIsAvatarSaving(true);
    setAvatarMessage(null);

    try {
      await clerkUser.setProfileImage({ file });
      await clerkUser.reload();
      setAvatarMessage("Avatar updated successfully.");
    } catch {
      setAvatarMessage("Failed to update avatar. Please try again.");
    } finally {
      setIsAvatarSaving(false);
    }
  };

  const handleAvatarInputChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await updateAvatar(file);
    event.target.value = "";
  };

  // Build a single canonical ID card based on account role.
  const canonicalIdRole: "teacher" | "candidate" =
    userData.role === "teacher_candidate" ? "candidate" : "teacher";
  const canonicalIdCode = canonicalIdRole === "candidate" ? "C" : "T";
  const canonicalId = `AOTF-${canonicalIdCode}-${profile.username.toUpperCase()}`;
  const canonicalVerifyUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/verify/${encodeURIComponent(canonicalId)}`
      : `/verify/${encodeURIComponent(canonicalId)}`;

  const primaryCardData: IdCardData = {
    role: canonicalIdRole,
    name: accountHolderName,
    photo: avatarUrl ?? "/AOTF.svg",
    designation:
      canonicalIdRole === "candidate"
        ? "Aspiring Educator"
        : profile.qualification
          ? `${profile.qualification} Educator`
          : "Educator",
    qualification: profile.qualification ?? undefined,
    subjects: profile.subjects,
    employeeId: canonicalId,
    phone: phone ?? "—",
    email: email ?? "—",
    address: profile.address ?? "—",
    joinDate: joinMonth,
    expiryDate: "—",
    isVerified: userData.onboardingCompleted,
    uniqId: canonicalId,
  };

  const copyCanonicalVerifyUrl = async () => {
    try {
      await navigator.clipboard.writeText(canonicalVerifyUrl);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 1800);
    } catch {
      setCopyStatus("failed");
      setTimeout(() => setCopyStatus("idle"), 2200);
    }
  };

  return (
    <div className="w-full">
      <BackButton title="Profile" />

      {/* ── Profile Header ─────────────────────────────────────── */}
      <div className="md:flex justify-between items-center max-w-3xl mx-auto">
        <div className="flex flex-row align-items-start justify-start gap-4 py-4">
          <label className="cursor-pointer">
            {isOwnProfile && (
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarInputChange}
                disabled={isAvatarSaving}
              />
            )}
            <Badge
              isOneChar
              color="success"
              content={<Camera size={15} color="white" />}
              placement="bottom-right"
              shape="circle"
              size="lg"
              isInvisible={!isOwnProfile}
            >
              <Avatar
                className="w-20 h-20 text-large"
                src={avatarUrl}
                name={accountHolderName}
              />
            </Badge>
          </label>
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-xl font-semibold">{accountHolderName}</h1>
              {userData.onboardingCompleted && (
                <ShieldCheck className="text-green-500" size={18} />
              )}
              <Chip
                size="sm"
                variant="flat"
                color={canonicalIdRole === "candidate" ? "success" : "primary"}
                className="text-[10px] uppercase font-semibold"
              >
                {canonicalIdRole === "candidate" ? "Candidate" : "Teacher"}
              </Chip>
            </div>
            <div className="flex gap-1">
              <p className="text-sm text-gray-500">
                {profile.bio ?? "A passionate educator and lifelong learner."}
              </p>
            </div>
            {profile.location && (
              <div className="flex items-center gap-1">
                <FaLocationDot />
                <p className="text-sm text-gray-500">{profile.location}</p>
              </div>
            )}
            {profile.address && !profile.location && (
              <div className="flex items-center gap-1">
                <FaLocationDot />
                <p className="text-sm text-gray-500">{profile.address}</p>
              </div>
            )}

            {isOwnProfile && (
              <div className="pt-1">
                {avatarMessage && (
                  <p className="mt-1 text-xs text-default-500">
                    {avatarMessage}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────── */}
      <div className="flex w-full flex-col items-center">
        <Tabs
          aria-label="Options"
          color="primary"
          variant="bordered"
          radius="full"
        >
          {/* ── Profile Tab ── */}
          <Tab
            key="profile"
            title={
              <div className="flex items-center space-x-2">
                <LuNotebookPen size={20} className="font-bold" />
                <span>Profile</span>
              </div>
            }
          >
            <div className="space-y-2">
              {/* Qualification */}
              {profile.qualification && (
                <Card className="p-4 max-w-lg mx-auto">
                  <CardHeader className="flex items-center gap-2 p-0">
                    <FaBook className="text-primary" />
                    <h3 className="text-lg font-bold">
                      Education &amp; Qualification
                    </h3>
                  </CardHeader>
                  <CardBody className="space-y-3 p-2">
                    <div className="flex gap-4">
                      <div className="shrink-0 w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <FaBook className="text-slate-500" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">
                          {profile.qualification}
                        </p>
                        {profile.board && (
                          <p className="text-xs text-[#4c6c9a] dark:text-slate-400">
                            Board: {profile.board}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardBody>
                </Card>
              )}

              {/* Contact */}
              {isOwnProfile && (phone || email) && (
                <Card className="p-4 max-w-lg mx-auto">
                  <CardHeader className="flex items-center gap-2 p-0">
                    <FaChalkboardTeacher className="text-primary" />
                    <h3 className="text-lg font-bold">Contact Details</h3>
                  </CardHeader>
                  <CardBody className="space-y-3 p-2">
                    {email && (
                      <div className="flex gap-4">
                        <div className="shrink-0 w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                          <FaMailBulk className="text-slate-500" />
                        </div>
                        <div>
                          <p className="text-xs text-[#4c6c9a] dark:text-slate-400">
                            Email Id:
                          </p>
                          <p className="font-bold text-sm">{email}</p>
                        </div>
                      </div>
                    )}
                    {phone && (
                      <div className="flex gap-4">
                        <div className="shrink-0 w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                          <FaPhone className="text-slate-500" />
                        </div>
                        <div>
                          <p className="text-xs text-[#4c6c9a] dark:text-slate-400">
                            Phone Number:
                          </p>
                          <p className="font-bold text-sm">{phone}</p>
                        </div>
                      </div>
                    )}
                  </CardBody>
                </Card>
              )}

              {isOwnProfile && (
                <Card className="p-4 max-w-lg mx-auto">
                  <CardHeader className="p-0">
                    <h3 className="text-lg font-bold">Account Details</h3>
                  </CardHeader>
                  <CardBody className="space-y-3 p-0 pt-3">
                    <div>
                      <p className="text-xs text-[#4c6c9a] dark:text-slate-400">
                        Name (Locked)
                      </p>
                      <p className="font-bold text-sm">{accountHolderName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#4c6c9a] dark:text-slate-400">
                        Username (Locked)
                      </p>
                      <p className="font-bold text-sm">{profile.username}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#4c6c9a] dark:text-slate-400">
                        Email (Locked)
                      </p>
                      <p className="font-bold text-sm">{email ?? "—"}</p>
                    </div>
                    <p className="text-xs text-default-500">
                      Name, username, and email are permanently locked. You can
                      still update avatar and other profile details.
                    </p>
                  </CardBody>
                </Card>
              )}

              {/* Professional Details */}
              {isOwnProfile && (
                <div className="flex justify-end max-w-lg mx-auto">
                  <EditProfileDetails
                    details={profile as EditableProfileDetails}
                    onSaved={(updated) =>
                      setProfile((current) =>
                        current ? { ...current, ...updated } : current,
                      )
                    }
                  />
                </div>
              )}
              <ProfessionalDetailsCard
                qualification={profile.qualification}
                schoolBoard={profile.board}
                subjects={profile.subjects}
                teachingExp={profile.teachingExp}
                jobExp={profile.jobExp}
              />
            </div>
          </Tab>

          {/* ── ID Card Tab ── */}
          <Tab
            key="idcard"
            title={
              <div className="flex items-center space-x-2">
                <IdCardIcon size={20} className="font-bold" />
                <span>Id Card</span>
              </div>
            }
          >
            <div className="max-w-sm mx-auto space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FaChalkboardTeacher className="text-indigo-500" />
                  <h3 className="text-lg font-bold text-default-900">
                    {isOwnProfile
                      ? "Your ID Card"
                      : `${accountHolderName}'s ID`}
                  </h3>
                </div>
              </div>

              <div className="mx-auto" style={{ width: 340 }}>
                <IdCard key="primary-2" data={primaryCardData} />
                {/* Upgrade option (Teacher → Candidate) */}
                {canUpgradeToCandidate && (
                  <div className="mt-3 max-w-lg">
                    <UpgradeCandidateCard
                      onUpgrade={handleCandidateUpgrade}
                      isLoading={isUpgradeLoading}
                      error={upgradeError}
                    />
                  </div>
                )}
              </div>
            </div>
          </Tab>
        </Tabs>
      </div>

      {/* ── Action Buttons ─────────────────────────────────────── */}
      {isOwnProfile && (
        <div className="w-full mb-8">
          <ButtonGroup className="px-auto mx-auto" />
        </div>
      )}
    </div>
  );
}

// ── Professional Details Card ──────────────────────────────────────

function ProfessionalDetailsCard({
  qualification,
  schoolBoard,
  subjects,
  teachingExp,
  jobExp,
}: {
  qualification: string | null;
  schoolBoard: string | null;
  subjects: string[];
  teachingExp: string | null;
  jobExp: string | null;
}) {
  const hasContent =
    qualification || schoolBoard || subjects.length > 0 || teachingExp;
  if (!hasContent) return null;

  return (
    <Card className="p-4 max-w-lg mx-auto">
      <CardBody className="p-0">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Professional Details</h3>
        </div>

        <div className="flex flex-col gap-3">
          {/* Qualification */}
          {qualification && (
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                🎓
              </div>
              <div>
                <p className="text-xs text-[#4c6c9a] dark:text-slate-400">
                  Qualifications
                </p>
                <p className="font-bold text-sm">{qualification}</p>
              </div>
            </div>
          )}

          {/* School Board */}
          {schoolBoard && (
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                📘
              </div>
              <div>
                <p className="text-xs text-[#4c6c9a] dark:text-slate-400">
                  School Board
                </p>
                <p className="font-bold text-sm">{schoolBoard}</p>
              </div>
            </div>
          )}

          {/* Teaching Experience */}
          {teachingExp && (
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                📡
              </div>
              <div>
                <p className="text-xs text-[#4c6c9a] dark:text-slate-400">
                  Teaching Experience
                </p>
                <p className="font-bold text-sm">{teachingExp} years</p>
              </div>
            </div>
          )}

          {/* Job Experience */}
          {jobExp && (
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                💼
              </div>
              <div>
                <p className="text-xs text-[#4c6c9a] dark:text-slate-400">
                  Job Experience
                </p>
                <p className="font-bold text-sm">{jobExp} years</p>
              </div>
            </div>
          )}

          {/* Subjects */}
          {subjects.length > 0 && (
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                🔬
              </div>
              <div>
                <p className="text-xs text-[#4c6c9a] dark:text-slate-400">
                  Skills
                </p>
                <div className="flex flex-wrap gap-2">
                  {subjects.map((s) => (
                    <Chip
                      size="sm"
                      key={s}
                      variant="shadow"
                      className="font-bold text-sm"
                    >
                      {s}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
