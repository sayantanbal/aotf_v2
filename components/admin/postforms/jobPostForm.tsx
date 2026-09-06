"use client";

import { reportClientError } from "@/lib/client-report-error";
import { formatPhone, normalizePhone } from "@/lib/utils/phone";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Input, Textarea } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { RadioGroup, Radio } from "@heroui/radio";
import { addToast } from "@heroui/toast";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import {
  User,
  Phone,
  Building2,
  MapPin,
  Clock,
  Briefcase,
  GraduationCap,
  CheckCircle,
} from "lucide-react";
import { z } from "zod";
import Stepper, { Step } from "@/components/reactbits/ui/Stepper";
import { FaRupeeSign } from "react-icons/fa";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { Enquiry } from "@/components/admin/enquiries/EnquiryCard";
import {
  ReferralPicker,
  type ReferralOption,
} from "@/components/admin/referral-picker";
import {
  jobFormSchema,
  companyTypes,
  workTypes,
  commissionBasisTypes,
  projectTypes,
  experienceLevels,
  locationTypes,
  locationTypeToApi,
  locationTypeFromApi,
  genderPreferences,
  genderToApi,
  jobStatuses,
  jobFormDefaults,
  jobNotesSuggestions,
  sourceLists,
} from "@/lib/validations/forms";

type WorkType = "job" | "project";
type LocationType = "on-site" | "remote" | "hybrid";
type OptionItem = {
  _id: string;
  key: string;
  label: string;
};

const ADD_NEW_VALUE = "__add_new__";

function singularizeTitle(title: string) {
  return title.endsWith("s") ? title.slice(0, -1) : title;
}

function makeKeyFromLabel(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

function OptionManagerModal({
  title,
  endpoint,
  items,
  isOpen,
  onClose,
  onRefresh,
}: {
  title: string;
  endpoint: string;
  items: OptionItem[];
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [form, setForm] = useState({ key: "", label: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setForm({ key: "", label: "" });
      setEditingId(null);
    }
  }, [isOpen]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ key: "", label: "" });
  };

  const openEdit = (item: OptionItem) => {
    setEditingId(item._id);
    setForm({ key: item.key, label: item.label });
  };

  const saveItem = async () => {
    if (!form.key.trim() || !form.label.trim()) {
      addToast({ description: "Key and label are required", color: "danger" });
      return;
    }

    setIsSaving(true);
    try {
      const method = editingId ? "PATCH" : "POST";
      const url = editingId ? `${endpoint}/${editingId}` : endpoint;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: form.key.trim(),
          label: form.label.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.error || `Failed to ${editingId ? "update" : "create"} item`,
        );
      }

      await onRefresh();
      setForm({ key: "", label: "" });
      setEditingId(null);
      addToast({
        description: `${singularizeTitle(title)} ${editingId ? "updated" : "added"}`,
        color: "success",
      });
    } catch (error) {
      reportClientError(error, { feature: "admin-job-form" });
      addToast({
        description:
          error instanceof Error
            ? error.message
            : `Failed to save ${title.toLowerCase()}`,
        color: "danger",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteItem = async (id: string) => {
    if (!confirm(`Delete this ${singularizeTitle(title).toLowerCase()}?`))
      return;
    setIsSaving(true);
    try {
      const res = await fetch(`${endpoint}/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.error || `Failed to delete ${title.toLowerCase()}`,
        );
      }
      await onRefresh();
      if (editingId === id) {
        setForm({ key: "", label: "" });
        setEditingId(null);
      }
      addToast({
        description: `${singularizeTitle(title)} deleted`,
        color: "success",
      });
    } catch (error) {
      reportClientError(error, { feature: "admin-job-form" });
      addToast({
        description:
          error instanceof Error
            ? error.message
            : `Failed to delete ${title.toLowerCase()}`,
        color: "danger",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          {editingId
            ? `Edit ${singularizeTitle(title)}`
            : `Add ${singularizeTitle(title)}`}
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="Key"
                placeholder="e.g. mathematics"
                value={form.key}
                isReadOnly
                variant="bordered"
              />
              <Input
                label="Label"
                placeholder="e.g. Mathematics"
                value={form.label}
                onChange={(e) => {
                  const label = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    label,
                    key: makeKeyFromLabel(label),
                  }));
                }}
                variant="bordered"
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-default-700">
                Existing options
              </p>
              <div className="space-y-2 max-h-72 overflow-auto pr-1">
                {items.length === 0 ? (
                  <p className="text-sm text-default-500">
                    No options available.
                  </p>
                ) : (
                  items.map((item) => (
                    <div
                      key={item._id}
                      className="flex flex-col gap-3 rounded-lg border border-default-200 bg-default-50 p-3 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <p className="font-medium text-default-800">
                          {item.label}
                        </p>
                        <p className="text-xs text-default-400">{item.key}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="flat"
                          onPress={() => openEdit(item)}
                          startContent={<CheckCircle size={14} />}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          color="danger"
                          variant="flat"
                          onPress={() => deleteItem(item._id)}
                          startContent={<CheckCircle size={14} />}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>
            Cancel
          </Button>
          <Button color="primary" onPress={saveItem} isLoading={isSaving}>
            {editingId ? "Update" : "Add"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
type GenderPreference = "male" | "female" | "both" | "all" | "others";
type CommissionBasis = "first_month" | "project_value";
type ProjectType = "one-time" | "ongoing";

interface JobPostFormProps {
  mode?: "create" | "edit";
  postId?: string;
  enquiry?: Enquiry | null;
}

export default function JobPostForm({
  mode = "create",
  postId,
  enquiry,
}: JobPostFormProps) {
  const router = useRouter();
  const isEditMode = mode === "edit";
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [notFound, setNotFound] = useState(false);
  const [formData, setFormData] = useState({ ...jobFormDefaults });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [extraSources, setExtraSources] = useState<
    { _id: string; key: string; label: string }[]
  >([]);
  const [referralOptions, setReferralOptions] = useState<ReferralOption[]>([]);
  const [isSourceManagerOpen, setIsSourceManagerOpen] = useState(false);

  const combinedSources = useMemo(() => {
    const map = new Map<string, string>();
    sourceLists.forEach((s) => map.set(s.key, s.label));
    extraSources.forEach((s) => {
      if (!map.has(s.key)) map.set(s.key, s.label);
    });
    return Array.from(map.entries()).map(([key, label]) => ({ key, label }));
  }, [extraSources]);

  const loadSources = async () => {
    try {
      const res = await fetch(`/api/v1/admin/sources`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.sources)) {
        setExtraSources(
          data.sources.map((s: any) => ({
            _id: s._id,
            key: s.key,
            label: s.label,
          })),
        );
      }
    } catch {
      // ignore
    }
  };

  const loadReferrals = async () => {
    try {
      const res = await fetch(`/api/v1/admin/referrals`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.referrals)) {
        setReferralOptions(
          data.referrals.map((referral: any) => ({
            key: referral.key,
            label: referral.label,
            phone: referral.phone,
          })),
        );
      }
    } catch {
      // ignore
    }
  };

  // Fetch job data for edit mode
  useEffect(() => {
    if (!isEditMode || !postId) return;
    const fetchJob = async () => {
      try {
        const res = await fetch(`/api/v1/jobs/${postId}`);
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const { job } = await res.json();
        const locationTypeReverseMap: Record<string, LocationType> = {
          onsite: "on-site",
          remote: "remote",
          hybrid: "hybrid",
        };
        const genderReverseMap: Record<string, GenderPreference> = {
          male: "male",
          female: "female",
          both: "both",
          all: "all",
        };
        setFormData({
          workType: (job.workType || "job") as WorkType,
          clientName: job.clientName || "",
          clientPhone: job.phoneNumber || "",
          source: job.source || jobFormDefaults.source,
          referralUserName: job.referralUserName || "",
          referralPhoneNumber: job.referralPhoneNumber || "",
          companyName: job.companyName || "",
          companyType: job.companyType || "",
          designation: job.title || "",
          experience: job.experience || "",
          locationType: locationTypeReverseMap[job.locationType] || "on-site",
          location: job.location || "",
          genderPreference: genderReverseMap[job.gender] || "all",
          timing: job.timing || "",
          salary: job.salary || "",
          travelRequirements: job.travelRequirements || "",
          requiredQualifications: job.requiredQualification || "",
          skillsRequired: job.skillsRequired || "",
          notes: job.brief || "",
          commissionBasis: (job.commissionBasis ||
            "first_month") as CommissionBasis,
          academyCommissionPercentage:
            job.academyCommissionPercentage?.toString() || "",
          settledAmount: job.settledAmount?.toString() || "",
          projectType: job.projectType || "",
          budget: job.budget || "",
          duration: job.duration || "",
          status: job.status || "open",
        });
      } catch {
        setNotFound(true);
      } finally {
        setIsLoading(false);
      }
    };
    fetchJob();
  }, [isEditMode, postId]);

  useEffect(() => {
    loadSources();
    loadReferrals();
  }, []);

  // Pre-fill form data from enquiry if available (create mode only)
  useEffect(() => {
    if (isEditMode || !enquiry) return;
    setFormData((prev) => ({
      ...prev,
      clientName: enquiry.name || "",
      clientPhone: normalizePhone(enquiry.phoneNumber || ""),
      notes: enquiry.query ? `From enquiry: ${enquiry.query}` : "",
    }));
  }, [enquiry, isEditMode]);

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleClientPhoneChange = (value: string) =>
    handleChange("clientPhone", normalizePhone(value));

  const validate = () => {
    try {
      // Convert empty strings to undefined for optional enum fields
      const dataToValidate = {
        ...formData,
        companyType: formData.companyType || undefined,
        projectType: formData.projectType || undefined,
        experience: formData.experience || undefined,
      };
      jobFormSchema.parse(dataToValidate);
      if (
        formData.source === "referral" &&
        (!formData.referralUserName.trim() ||
          !formData.referralPhoneNumber.trim())
      ) {
        setErrors({
          referralUserName: formData.referralUserName.trim()
            ? ""
            : "Referral user name is required",
          referralPhoneNumber: formData.referralPhoneNumber.trim()
            ? ""
            : "Referral phone number is required",
        });
        return false;
      }
      setErrors({});
      return true;
    } catch (error) {
      reportClientError(error, { feature: "admin-job-form" });
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.issues.forEach((issue) => {
          const path = issue.path.join(".");
          newErrors[path] = issue.message;
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  // Step-by-step validation
  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    try {
      switch (step) {
        case 1: // Client Details
          const step1Schema = z.object({
            clientName: jobFormSchema.shape.clientName,
            clientPhone: jobFormSchema.shape.clientPhone,
            source: jobFormSchema.shape.source,
            referralUserName: jobFormSchema.shape.referralUserName,
            referralPhoneNumber: jobFormSchema.shape.referralPhoneNumber,
          });
          step1Schema.parse({
            clientName: formData.clientName,
            clientPhone: formData.clientPhone,
            source: formData.source,
            referralUserName: formData.referralUserName,
            referralPhoneNumber: formData.referralPhoneNumber,
          });
          if (
            formData.source === "referral" &&
            (!formData.referralUserName.trim() ||
              !formData.referralPhoneNumber.trim())
          ) {
            if (!formData.referralUserName.trim()) {
              newErrors.referralUserName = "Referral user name is required";
            }
            if (!formData.referralPhoneNumber.trim()) {
              newErrors.referralPhoneNumber =
                "Referral phone number is required";
            }
            setErrors(newErrors);
            addToast({
              description: "Please fill in all required fields correctly",
              color: "danger",
            });
            return false;
          }
          break;

        case 2: // Job Details
          const step2Schema = z.object({
            designation: jobFormSchema.shape.designation,
            locationType: jobFormSchema.shape.locationType,
            location: jobFormSchema.shape.location,
          });
          step2Schema.parse({
            designation: formData.designation,
            locationType: formData.locationType,
            location: formData.location,
          });
          break;
        case 3: // Requirements & Preferences
          const step3Schema = z.object({
            genderPreference: jobFormSchema.shape.genderPreference,
          });
          step3Schema.parse({
            genderPreference: formData.genderPreference,
          });
          break;

        case 4: // Work & Commission Details
          const step4Schema = z.object({
            workType: jobFormSchema.shape.workType,
            commissionBasis: jobFormSchema.shape.commissionBasis,
            academyCommissionPercentage:
              jobFormSchema.shape.academyCommissionPercentage,
          });
          step4Schema.parse({
            workType: formData.workType,
            commissionBasis: formData.commissionBasis,
            academyCommissionPercentage:
              formData.academyCommissionPercentage || "0",
          });
          // Check projectType if workType is project
          if (formData.workType === "project" && !formData.projectType) {
            newErrors.projectType =
              "Project type is required for project work type";
            setErrors(newErrors);
            addToast({
              description: "Please fill in all required fields correctly",
              color: "danger",
            });
            return false;
          }
          break;

        case 5: // Review step (no validation needed)
          return true;

        default:
          return true;
      }

      // Clear errors for this step if validation passes
      setErrors({});
      return true;
    } catch (error) {
      reportClientError(error, { feature: "admin-job-form" });
      if (error instanceof z.ZodError) {
        error.issues.forEach((issue) => {
          const path = issue.path.join(".");
          newErrors[path] = issue.message;
        });
        setErrors(newErrors);
        isValid = false;
      }

      // Show toast message
      addToast({
        description: "Please fill in all required fields correctly",
        color: "danger",
      });
      return isValid;
    }
  };

  // Silent check — no toasts or error state updates, used only for button colour
  const checkStep = (step: number): boolean => {
    try {
      switch (step) {
        case 1:
          z.object({
            clientName: jobFormSchema.shape.clientName,
            clientPhone: jobFormSchema.shape.clientPhone,
            source: jobFormSchema.shape.source,
            referralUserName: jobFormSchema.shape.referralUserName,
            referralPhoneNumber: jobFormSchema.shape.referralPhoneNumber,
          }).parse({
            clientName: formData.clientName,
            clientPhone: formData.clientPhone,
            source: formData.source,
            referralUserName: formData.referralUserName,
            referralPhoneNumber: formData.referralPhoneNumber,
          });
          if (
            formData.source === "referral" &&
            (!formData.referralUserName.trim() ||
              !formData.referralPhoneNumber.trim())
          ) {
            return false;
          }
          break;
        case 2:
          z.object({
            designation: jobFormSchema.shape.designation,
            locationType: jobFormSchema.shape.locationType,
            location: jobFormSchema.shape.location,
          }).parse({
            designation: formData.designation,
            locationType: formData.locationType,
            location: formData.location,
          });
          break;
        case 3:
          z.object({
            genderPreference: jobFormSchema.shape.genderPreference,
          }).parse({ genderPreference: formData.genderPreference });
          break;
        case 4:
          z.object({
            workType: jobFormSchema.shape.workType,
            commissionBasis: jobFormSchema.shape.commissionBasis,
            academyCommissionPercentage:
              jobFormSchema.shape.academyCommissionPercentage,
          }).parse({
            workType: formData.workType,
            commissionBasis: formData.commissionBasis,
            academyCommissionPercentage:
              formData.academyCommissionPercentage || "0",
          });
          if (formData.workType === "project" && !formData.projectType)
            return false;
          break;
        default:
          return true;
      }
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    if (!validate()) {
      addToast({ description: "Please fix the errors", color: "danger" });
      setIsSubmitting(false);
      return;
    }

    try {
      // Map form fields to API payload
      const locationTypeMap: Record<string, string> = {
        "on-site": "onsite",
        remote: "remote",
        hybrid: "hybrid",
      };

      const genderMap: Record<string, string> = {
        male: "male",
        female: "female",
        both: "both",
        all: "all",
        others: "all",
      };

      const payload: Record<string, unknown> = {
        workType: formData.workType,
        title: formData.designation.trim(),
        clientName: formData.clientName.trim(),
        phoneNumber: formData.clientPhone.trim(),
        source: formData.source,
        ...(formData.source === "referral" && formData.referralUserName.trim()
          ? {
              referralUserName: formData.referralUserName.trim(),
              referralPhoneNumber: formData.referralPhoneNumber.trim(),
            }
          : {}),
        companyType: formData.companyType || "company",
        locationType: locationTypeMap[formData.locationType] || "onsite",
        location: formData.location.trim(),
        gender: genderMap[formData.genderPreference] || "all",
        commissionBasis: formData.commissionBasis,
        academyCommissionPercentage: parseInt(
          formData.academyCommissionPercentage || "0",
          10,
        ),
        settledAmount: formData.settledAmount
          ? Number(formData.settledAmount)
          : undefined,
        status: "open" as const,
      };

      // Optional fields
      if (formData.timing?.trim()) payload.timing = formData.timing.trim();
      if (formData.experience?.trim())
        payload.experience = formData.experience.trim();
      if (formData.salary?.trim()) payload.salary = formData.salary.trim();
      if (formData.requiredQualifications?.trim())
        payload.requiredQualification = formData.requiredQualifications.trim();
      if (formData.companyName?.trim())
        payload.companyName = formData.companyName.trim();
      if (formData.skillsRequired?.trim())
        payload.skillsRequired = formData.skillsRequired.trim();
      if (formData.travelRequirements?.trim())
        payload.travelRequirements = formData.travelRequirements.trim();
      if (formData.notes?.trim()) payload.brief = formData.notes.trim();

      // Project-specific fields
      if (formData.workType === "project") {
        if (formData.projectType) payload.projectType = formData.projectType;
        if (formData.budget?.trim()) payload.budget = formData.budget.trim();
        if (formData.duration?.trim())
          payload.duration = formData.duration.trim();
      }

      // Include enquiryId if available (create mode only)
      if (!isEditMode && enquiry?._id) payload.enquiryId = enquiry._id;

      // Include status for edit mode
      if (isEditMode) payload.status = formData.status;

      const url = isEditMode ? `/api/v1/jobs/${postId}` : "/api/v1/jobs";
      const res = await fetch(url, {
        method: isEditMode ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.fieldErrors) {
          const messages = Object.entries(data.fieldErrors)
            .map(
              ([field, errors]) =>
                `${field}: ${(errors as string[]).join(", ")}`,
            )
            .join("; ");
          throw new Error(messages || data.error || "Validation failed");
        }
        throw new Error(
          data.error ||
            (isEditMode ? "Failed to update job" : "Failed to create job"),
        );
      }

      const data = await res.json();

      // Show success animation
      setShowSuccess(true);
      addToast({
        description: isEditMode
          ? "Job post updated successfully!"
          : `Job ${data.job.jobId} created successfully!`,
        color: "success",
      });

      // Navigate after showing success
      setTimeout(() => {
        router.push(isEditMode ? `/admin/jobs/${postId}` : "/admin/jobs");
        router.refresh();
      }, 2000);
    } catch (error) {
      reportClientError(error, { feature: "admin-job-form" });
      addToast({
        description:
          error instanceof Error
            ? error.message
            : isEditMode
              ? "Failed to update job"
              : "Failed to create job",
        color: "danger",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit mode: loading state
  if (isEditMode && isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  // Edit mode: not found state
  if (isEditMode && notFound) {
    return (
      <div className="w-full max-w-3xl mx-auto p-3 text-center">
        <p className="text-danger text-lg">Job post not found</p>
        <Button
          variant="light"
          className="mt-4"
          onPress={() => router.push("/admin/jobs")}
        >
          Back to Jobs
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto p-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 justify-center">
          <h3 className="text-xl font-bold">
            {isEditMode ? "Edit Job Post" : "Create Job Post"}
          </h3>
        </div>
        <p className="text-sm text-default-500 text-center">
          {isEditMode ? "Update the details below" : "Fill in the job details"}
        </p>
      </div>
      {showSuccess ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-success/20 flex items-center justify-center animate-in zoom-in duration-500">
              <CheckCircle
                size={64}
                className="text-success animate-in zoom-in duration-700 delay-200"
              />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-success animate-in fade-in duration-500 delay-300">
            {isEditMode ? "Job Post Updated!" : "Job Post Created!"}
          </h3>
          <p className="text-default-500 animate-in fade-in duration-500 delay-400">
            {isEditMode
              ? "Your job post has been successfully updated."
              : "Your job post has been successfully created."}
          </p>
        </div>
      ) : isSubmitting ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Spinner size="lg" color="primary" />
          <p className="text-default-500">
            {isEditMode ? "Updating job post..." : "Creating job post..."}
          </p>
        </div>
      ) : (
        <div className="flex justify-center">
          {" "}
          <Stepper
            onFinalStepCompleted={handleSubmit}
            validateStep={validateStep}
            checkStep={checkStep}
            nextButtonText="Next"
            backButtonText="Back"
          >
            {/* Step 1: Client Details */}
            <Step>
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-default-700">
                  Client Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Client Name"
                    placeholder="Enter client name"
                    value={formData.clientName}
                    onChange={(e) => handleChange("clientName", e.target.value)}
                    isRequired
                    isInvalid={!!errors.clientName}
                    errorMessage={errors.clientName}
                    variant="bordered"
                    startContent={
                      <User size={18} className="text-default-400" />
                    }
                  />
                  <Input
                    label="Client Phone"
                    placeholder="Enter phone number"
                    type="tel"
                    value={formatPhone(formData.clientPhone)}
                    onChange={(e) => handleClientPhoneChange(e.target.value)}
                    isRequired
                    isInvalid={!!errors.clientPhone}
                    errorMessage={errors.clientPhone}
                    variant="bordered"
                    startContent={
                      <Phone size={18} className="text-default-400" />
                    }
                  />
                  <Select
                    label="Source"
                    placeholder="Select source"
                    selectedKeys={
                      formData.source
                        ? new Set([formData.source])
                        : new Set<string>()
                    }
                    onSelectionChange={(keys) => {
                      const value = Array.from(keys)[0] as string | undefined;
                      if (!value) return;
                      if (value === ADD_NEW_VALUE) {
                        setIsSourceManagerOpen(true);
                        return;
                      }
                      handleChange("source", value);
                    }}
                    isRequired
                    isInvalid={!!errors.source}
                    errorMessage={errors.source}
                    variant="bordered"
                  >
                    {[
                      { key: ADD_NEW_VALUE, label: "➕ Add new options" },
                      ...combinedSources,
                    ].map((source) => (
                      <SelectItem key={source.key}>{source.label}</SelectItem>
                    ))}
                  </Select>
                  {formData.source === "referral" && (
                    <ReferralPicker
                      nameValue={formData.referralUserName}
                      phoneValue={formData.referralPhoneNumber}
                      options={referralOptions}
                      onNameChange={(value) =>
                        handleChange("referralUserName", value)
                      }
                      onPhoneChange={(value) =>
                        handleChange("referralPhoneNumber", value)
                      }
                      isRequired
                      isInvalid={
                        !!errors.referralUserName ||
                        !!errors.referralPhoneNumber
                      }
                      errorMessage={errors.referralUserName}
                      phoneErrorMessage={errors.referralPhoneNumber}
                      className="md:col-span-2"
                    />
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Company Name"
                    placeholder="Enter company name"
                    value={formData.companyName}
                    onChange={(e) =>
                      handleChange("companyName", e.target.value)
                    }
                    variant="bordered"
                    startContent={
                      <Building2 size={18} className="text-default-400" />
                    }
                  />
                  <Select
                    label="Company Type"
                    placeholder="Select company type"
                    selectedKeys={
                      formData.companyType ? [formData.companyType] : []
                    }
                    onChange={(e: any) =>
                      handleChange("companyType", e.target.value)
                    }
                    variant="bordered"
                    startContent={
                      <Building2 size={18} className="text-default-400" />
                    }
                  >
                    {companyTypes.map((type) => (
                      <SelectItem key={type.key}>{type.label}</SelectItem>
                    ))}
                  </Select>
                </div>
              </div>
            </Step>

            {/* Step 2: Job Details */}
            <Step>
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-default-700">
                  Job Details
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Designation"
                    placeholder="e.g., Software Engineer"
                    value={formData.designation}
                    onChange={(e) =>
                      handleChange("designation", e.target.value)
                    }
                    isRequired
                    isInvalid={!!errors.designation}
                    errorMessage={errors.designation}
                    variant="bordered"
                    startContent={
                      <Briefcase size={18} className="text-default-400" />
                    }
                  />
                  <Select
                    label="Experience Required"
                    placeholder="Select experience level"
                    selectedKeys={
                      formData.experience ? [formData.experience] : []
                    }
                    onChange={(e: any) =>
                      handleChange("experience", e.target.value)
                    }
                    variant="bordered"
                    startContent={
                      <GraduationCap size={18} className="text-default-400" />
                    }
                  >
                    {experienceLevels.map((exp) => (
                      <SelectItem key={exp.key}>{exp.label}</SelectItem>
                    ))}
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-default-700">
                    Location Type <span className="text-danger">*</span>
                  </label>
                  <RadioGroup
                    value={formData.locationType}
                    onValueChange={(value) =>
                      handleChange("locationType", value)
                    }
                    orientation="horizontal"
                  >
                    <Radio value="on-site">On-Site</Radio>
                    <Radio value="remote">Remote</Radio>
                    <Radio value="hybrid">Hybrid</Radio>
                  </RadioGroup>
                </div>

                <Input
                  label="Location"
                  placeholder="Enter job location"
                  value={formData.location}
                  onChange={(e) => handleChange("location", e.target.value)}
                  isRequired
                  isInvalid={!!errors.location}
                  errorMessage={errors.location}
                  variant="bordered"
                  startContent={
                    <MapPin size={18} className="text-default-400" />
                  }
                  description={
                    formData.locationType === "remote"
                      ? "Can be 'Work from Home' or specify region"
                      : "Enter specific location or city"
                  }
                />
              </div>
            </Step>

            {/* Step 3: Requirements & Preferences */}
            <Step>
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-default-700">
                  Requirements & Preferences
                </h4>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-default-700">
                    Gender Preference <span className="text-danger">*</span>
                  </label>
                  <RadioGroup
                    value={formData.genderPreference}
                    onValueChange={(value) =>
                      handleChange("genderPreference", value)
                    }
                    orientation="horizontal"
                  >
                    <Radio value="male">Male</Radio>
                    <Radio value="female">Female</Radio>
                    <Radio value="both">Both</Radio>
                    <Radio value="all">All</Radio>
                    <Radio value="others">Others</Radio>
                  </RadioGroup>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Working Hours/Timing"
                    placeholder="e.g., 9 AM - 6 PM"
                    value={formData.timing}
                    onValueChange={(value) => handleChange("timing", value)}
                    variant="bordered"
                    startContent={
                      <Clock size={18} className="text-default-400 shrink-0" />
                    }
                    description={
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {[
                          "8 AM - 10 AM",
                          "12 PM - 2 PM",
                          "2 PM - 4 PM",
                          "4 PM - 6 PM",
                          "6 PM - 8 PM",
                          "8 PM - 10 PM",
                        ].map((time) => (
                          <button
                            key={time}
                            type="button"
                            onClick={() =>
                              setFormData((prev) => ({
                                ...prev,
                                timing: prev.timing
                                  ? `${prev.timing}, ${time}`
                                  : time,
                              }))
                            }
                            className="px-2 py-0.5 text-xs rounded-full border border-default-300 bg-default-100 hover:bg-primary hover:text-white hover:border-primary text-default-600 transition-colors cursor-pointer"
                          >
                            {time}
                          </button>
                        ))}
                      </div>
                    }
                  />
                  <Input
                    label="Salary Range"
                    placeholder="e.g., 50k-80k/month or 6-8L/year"
                    type="text"
                    value={formData.salary}
                    onChange={(e) => handleChange("salary", e.target.value)}
                    variant="bordered"
                    startContent={
                      <FaRupeeSign size={18} className="text-default-400" />
                    }
                    description="Enter salary range or amount per month"
                  />
                </div>

                <Textarea
                  label="Required Qualifications"
                  placeholder="e.g., Bachelor's degree in Computer Science, MBA..."
                  value={formData.requiredQualifications}
                  onChange={(e: any) =>
                    handleChange("requiredQualifications", e.target.value)
                  }
                  variant="bordered"
                  minRows={3}
                />

                <Textarea
                  label="Skills Required"
                  placeholder="e.g., JavaScript, React, Node.js, Communication skills..."
                  value={formData.skillsRequired}
                  onChange={(e: any) =>
                    handleChange("skillsRequired", e.target.value)
                  }
                  variant="bordered"
                  minRows={3}
                />
              </div>
            </Step>

            {/* Step 4: Work & Commission Details */}
            <Step>
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-default-700">
                  Work & Commission Details
                </h4>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-default-700">
                    Work Type <span className="text-danger">*</span>
                  </label>
                  <RadioGroup
                    value={formData.workType}
                    onValueChange={(value) => handleChange("workType", value)}
                    orientation="horizontal"
                  >
                    <Radio value="job">Job</Radio>
                    <Radio value="project">Project</Radio>
                  </RadioGroup>
                </div>
                {formData.workType === "project" && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Select
                      label="Project Type"
                      placeholder="Select type"
                      selectedKeys={
                        formData.projectType ? [formData.projectType] : []
                      }
                      onChange={(e: any) =>
                        handleChange("projectType", e.target.value)
                      }
                      variant="bordered"
                      isRequired
                    >
                      {projectTypes.map((type) => (
                        <SelectItem key={type.key}>{type.label}</SelectItem>
                      ))}
                    </Select>
                    <Input
                      label="Budget"
                      placeholder="e.g., 50000"
                      value={formData.budget}
                      onChange={(e) => handleChange("budget", e.target.value)}
                      variant="bordered"
                      startContent={
                        <FaRupeeSign size={18} className="text-default-400" />
                      }
                    />
                    <Input
                      label="Duration"
                      placeholder="e.g., 3 months"
                      value={formData.duration}
                      onChange={(e) => handleChange("duration", e.target.value)}
                      variant="bordered"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-default-700">
                    Commission Basis <span className="text-danger">*</span>
                  </label>
                  <RadioGroup
                    value={formData.commissionBasis}
                    onValueChange={(value) =>
                      handleChange("commissionBasis", value)
                    }
                    orientation="horizontal"
                  >
                    <Radio value="first_month">First Month Salary</Radio>
                    <Radio value="project_value">Project Value</Radio>
                  </RadioGroup>
                </div>
                <Input
                  label="Academy Commission Percentage"
                  placeholder="e.g., 10"
                  type="tel"
                  // by default its value set to 25
                  value={formData.academyCommissionPercentage}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "");
                    if (parseInt(value || "0", 10) <= 100) {
                      handleChange("academyCommissionPercentage", value);
                    }
                  }}
                  isRequired
                  isInvalid={!!errors.academyCommissionPercentage}
                  errorMessage={errors.academyCommissionPercentage}
                  variant="bordered"
                  endContent={
                    <span className="text-default-400 text-sm">%</span>
                  }
                  description="Enter a value between 0 and 100"
                />
                <Input
                  isRequired
                  label="Client Settled Amount"
                  placeholder="e.g., 50000"
                  type="number"
                  min={0}
                  value={formData.settledAmount}
                  onChange={(e) =>
                    handleChange("settledAmount", e.target.value)
                  }
                  variant="bordered"
                  startContent={
                    <FaRupeeSign size={18} className="text-default-400" />
                  }
                  description="The final amount agreed with the client."
                />
                <Textarea
                  label="Travel Requirements"
                  placeholder="Specify if the job requires any travel..."
                  value={formData.travelRequirements}
                  onChange={(e: any) =>
                    handleChange("travelRequirements", e.target.value)
                  }
                  variant="bordered"
                  minRows={3}
                />{" "}
                <Textarea
                  label="Additional Notes"
                  placeholder="Any other job details, benefits, perks, responsibilities..."
                  value={formData.notes}
                  onChange={(e: any) => handleChange("notes", e.target.value)}
                  variant="bordered"
                  minRows={4}
                  description={
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {jobNotesSuggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() =>
                            handleChange(
                              "notes",
                              formData.notes ? `${formData.notes}\n${s}` : s,
                            )
                          }
                          className="px-2 py-0.5 text-xs rounded-full border border-default-300
                            bg-default-100 hover:bg-primary hover:text-white hover:border-primary
                            text-default-600 transition-colors cursor-pointer"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  }
                />
                {isEditMode && (
                  <Select
                    label="Post Status"
                    placeholder="Select status"
                    selectedKeys={formData.status ? [formData.status] : []}
                    onChange={(e: any) =>
                      handleChange("status", e.target.value)
                    }
                    variant="bordered"
                    isRequired
                  >
                    <SelectItem key="open">Open</SelectItem>
                    <SelectItem key="closed">Closed</SelectItem>
                    <SelectItem key="hold">Hold</SelectItem>
                    <SelectItem key="cancelled">Cancelled</SelectItem>
                  </Select>
                )}
              </div>
            </Step>

            {/* Step 5: Review & Confirm */}
            <Step>
              <div className="space-y-4">
                <>
                  <h4 className="text-lg text-ce font-semibold text-default-700">
                    Review Your Job Post
                  </h4>

                  <Card>
                    <CardBody className="gap-2">
                      {/* Client Information */}
                      <div>
                        <p className="text-sm font-semibold text-default-700 mb-2">
                          Client Information
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-default-500">Name:</span>{" "}
                            <span className="font-medium">
                              {formData.clientName}
                            </span>
                          </div>
                          <div>
                            <span className="text-default-500">Phone:</span>{" "}
                            <span className="font-medium">
                              {formatPhone(formData.clientPhone)}
                            </span>
                          </div>
                          {formData.companyName && (
                            <div>
                              <span className="text-default-500">Company:</span>{" "}
                              <span className="font-medium">
                                {formData.companyName}
                              </span>
                            </div>
                          )}
                          {formData.companyType && (
                            <div>
                              <span className="text-default-500">Type:</span>{" "}
                              <Chip size="sm" variant="flat" color="primary">
                                {companyTypes.find(
                                  (t) => t.key === formData.companyType,
                                )?.label || formData.companyType}
                              </Chip>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="border-t border-divider" />

                      {/* Job Details */}
                      <div>
                        <p className="text-sm font-semibold text-default-700 mb-2">
                          Job Details
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-default-500">
                              Designation:
                            </span>{" "}
                            <span className="font-medium">
                              {formData.designation}
                            </span>
                          </div>
                          {formData.experience && (
                            <div>
                              <span className="text-default-500">
                                Experience:
                              </span>{" "}
                              <span className="font-medium">
                                {experienceLevels.find(
                                  (e) => e.key === formData.experience,
                                )?.label || formData.experience}
                              </span>
                            </div>
                          )}
                          <div>
                            <span className="text-default-500">Location:</span>{" "}
                            <span className="font-medium">
                              {formData.location}
                            </span>
                          </div>
                          <div>
                            <span className="text-default-500">Type:</span>{" "}
                            <Chip
                              size="sm"
                              variant="flat"
                              color="secondary"
                              className="capitalize"
                            >
                              {formData.locationType}
                            </Chip>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-divider" />

                      {/* Requirements */}
                      <div>
                        <p className="text-sm font-semibold text-default-700 mb-2">
                          Requirements & Preferences
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-default-500">
                              Gender Preference:
                            </span>{" "}
                            <Chip
                              size="sm"
                              variant="flat"
                              className="capitalize"
                            >
                              {formData.genderPreference}
                            </Chip>
                          </div>
                          {formData.timing && (
                            <div>
                              <span className="text-default-500">Timing:</span>{" "}
                              <span className="font-medium">
                                {formData.timing}
                              </span>
                            </div>
                          )}
                          {formData.salary && (
                            <div>
                              <span className="text-default-500">Salary:</span>{" "}
                              <span className="font-medium text-success">
                                ₹{formData.salary}
                              </span>
                            </div>
                          )}
                        </div>
                        {formData.requiredQualifications && (
                          <div className="mt-2">
                            <span className="text-default-500">
                              Qualifications:
                            </span>
                            <p className="text-default-700 text-xs mt-1">
                              {formData.requiredQualifications}
                            </p>
                          </div>
                        )}
                        {formData.skillsRequired && (
                          <div className="mt-2">
                            <span className="text-default-500">Skills:</span>
                            <p className="text-default-700 text-xs mt-1">
                              {formData.skillsRequired}
                            </p>
                          </div>
                        )}
                      </div>

                      {(formData.travelRequirements || formData.notes) && (
                        <>
                          <div className="border-t border-divider" />
                          <div>
                            <p className="text-sm font-semibold text-default-700 mb-2">
                              Additional Information
                            </p>
                            {formData.travelRequirements && (
                              <div className="mb-2">
                                <span className="text-default-500 text-sm">
                                  Travel Requirements:
                                </span>
                                <p className="text-default-700 text-xs mt-1">
                                  {formData.travelRequirements}
                                </p>
                              </div>
                            )}
                            {formData.notes && (
                              <div>
                                <span className="text-default-500 text-sm">
                                  Notes:
                                </span>
                                <p className="text-default-700 text-xs mt-1">
                                  {formData.notes}
                                </p>
                              </div>
                            )}
                          </div>
                        </>
                      )}

                      <div className="border-t border-divider" />

                      {/* Work & Commission */}
                      <div>
                        <p className="text-sm font-semibold text-default-700 mb-2">
                          Work & Commission
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-default-500">Work Type:</span>{" "}
                            <Chip
                              size="sm"
                              variant="flat"
                              color="primary"
                              className="capitalize"
                            >
                              {formData.workType}
                            </Chip>
                          </div>
                          <div>
                            <span className="text-default-500">
                              Commission Basis:
                            </span>{" "}
                            <Chip size="sm" variant="flat">
                              {commissionBasisTypes.find(
                                (c) => c.key === formData.commissionBasis,
                              )?.label || formData.commissionBasis}
                            </Chip>
                          </div>
                          <div>
                            <span className="text-default-500">
                              Commission:
                            </span>{" "}
                            <span className="font-medium text-success">
                              {formData.academyCommissionPercentage || "0"}%
                            </span>
                          </div>
                          {formData.workType === "project" &&
                            formData.projectType && (
                              <div>
                                <span className="text-default-500">
                                  Project Type:
                                </span>{" "}
                                <Chip
                                  size="sm"
                                  variant="flat"
                                  className="capitalize"
                                >
                                  {projectTypes.find(
                                    (p) => p.key === formData.projectType,
                                  )?.label || formData.projectType}
                                </Chip>
                              </div>
                            )}
                          {formData.budget && (
                            <div>
                              <span className="text-default-500">Budget:</span>{" "}
                              <span className="font-medium">
                                ₹{formData.budget}
                              </span>
                            </div>
                          )}
                          {formData.duration && (
                            <div>
                              <span className="text-default-500">
                                Duration:
                              </span>{" "}
                              <span className="font-medium">
                                {formData.duration}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardBody>
                  </Card>

                  <div className="bg-warning/10 p-4 rounded-lg border border-warning/20">
                    <p className="text-sm text-warning-700">
                      <strong>Note:</strong> Please review all information
                      carefully before confirming. Once submitted, the job post
                      will be {isEditMode ? "updated" : "created"}.
                    </p>
                  </div>
                </>
              </div>
            </Step>
          </Stepper>
          <OptionManagerModal
            title="Sources"
            endpoint="/api/v1/admin/sources"
            items={extraSources}
            isOpen={isSourceManagerOpen}
            onClose={() => setIsSourceManagerOpen(false)}
            onRefresh={loadSources}
          />
        </div>
      )}
    </div>
  );
}
