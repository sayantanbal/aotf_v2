"use client";

import { reportClientError } from "@/lib/client-report-error";
import { formatPhone, normalizePhone } from "@/lib/utils/phone";
import { useAuth, useUser } from "@clerk/nextjs";
import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardBody, CardFooter } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Input, Textarea } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { RadioGroup, Radio } from "@heroui/radio";
import { Checkbox, CheckboxGroup } from "@heroui/checkbox";
import { Button } from "@heroui/button";
import { addToast } from "@heroui/toast";
import { Spinner } from "@heroui/spinner";
import { NumberInput } from "@heroui/number-input";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import {
  BookOpen,
  User,
  Phone,
  DollarSign,
  Clock,
  MapPin,
  CheckCircle,
} from "lucide-react";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import { z } from "zod";
import Stepper, { Step } from "@/components/reactbits/ui/Stepper";
import { ReferralPicker, type ReferralOption } from "@/components/admin/referral-picker";
import {
  tuitionFormSchema,
  studentFormSchema,
  subjects,
  boards,
  classes,
  frequencies,
  days,
  classTypes,
  classTypeToApi,
  classTypeFromApi,
  tuitionStatuses,
  tuitionFormDefaults,
  tuitionNotesSuggestions,
  sourceLists,
} from "@/lib/validations/forms";
import { FaRupeeSign } from "react-icons/fa";
import { CustomCheckbox } from "@/components/ui/CustomCheckbox";
import { Enquiry } from "@/components/admin/enquiries/EnquiryCard";

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
      reportClientError(error, { feature: "admin-tuition-form" });
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
      addToast({
        description: `${singularizeTitle(title)} deleted`,
        color: "success",
      });
    } catch (error) {
      reportClientError(error, { feature: "admin-tuition-form" });
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
                label=""
                placeholder={title==="Subjects" ? "e.g. Bengali" : "e.g. Sulekha"}
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
                          onPress={() => {
                            setEditingId(item._id);
                            setForm({ key: item.key, label: item.label });
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          color="danger"
                          variant="flat"
                          onPress={() => deleteItem(item._id)}
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

type ClassType = "in-person" | "online" | "both";

const PREFERRED_TIME_SUGGESTIONS = [
  "8 AM - 10 AM",
  "12 PM - 2 PM",
  "2 PM - 4 PM",
  "4 PM - 6 PM",
  "6 PM - 8 PM",
  "8 PM - 10 PM",
  "Late Night",
] as const;

interface TuitionPostFormProps {
  mode?: "create" | "edit";
  postId?: string;
  enquiry?: Enquiry | null;
}

export default function TuitionPostForm({
  mode = "create",
  postId,
  enquiry,
}: TuitionPostFormProps) {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const isEditMode = mode === "edit";
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [notFound, setNotFound] = useState(false);
  const [formData, setFormData] = useState({ ...tuitionFormDefaults });
  const [missingSubjectInput, setMissingSubjectInput] = useState("");
  const {
    isOpen: isAddStudentOpen,
    onOpen: openAddStudent,
    onClose: closeAddStudent,
  } = useDisclosure();

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [extraSources, setExtraSources] = useState<
    { _id: string; key: string; label: string }[]
  >([]);
  const [extraSubjects, setExtraSubjects] = useState<
    { _id: string; key: string; label: string }[]
  >([]);
  const [referralOptions, setReferralOptions] = useState<ReferralOption[]>([]);
  const [isSourceManagerOpen, setIsSourceManagerOpen] = useState(false);
  const [isSubjectManagerOpen, setIsSubjectManagerOpen] = useState(false);

  const combinedSources = useMemo(() => {
    const map = new Map<string, string>();
    sourceLists.forEach((s) => map.set(s.key, s.label));
    extraSources.forEach((s) => {
      if (!map.has(s.key)) map.set(s.key, s.label);
    });
    return Array.from(map.entries()).map(([key, label]) => ({ key, label }));
  }, [extraSources]);

  const combinedSubjects = useMemo(() => {
    const map = new Map<string, string>();
    subjects.forEach((s) => map.set(s.key, s.label));
    extraSubjects.forEach((s) => {
      if (!map.has(s.key)) map.set(s.key, s.label);
    });
    return Array.from(map.entries()).map(([key, label]) => ({ key, label }));
  }, [extraSubjects]);

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

  const loadSubjects = async () => {
    try {
      const res = await fetch(`/api/v1/admin/subjects`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.subjects)) {
        setExtraSubjects(
          data.subjects.map((s: any) => ({
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

  useEffect(() => {
    if (!isEditMode || !postId) return;
    const fetchPost = async () => {
      try {
        const res = await fetch(`/api/v1/posts/${postId}`);
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const { post } = await res.json();
        setFormData({
          ...tuitionFormDefaults,
          guardianName: post.guardianName || "",
          guardianPhone: post.guardianPhone || "",
          source: post.source || tuitionFormDefaults.source,
          referralUserName: post.referralUserName || "",
          referralPhoneNumber: post.referralPhoneNumber || "",
          students: post.students?.length
            ? post.students.map((s: any) => ({
                class: s.className || "",
                subject: s.subjects?.[0] || "",
                board: s.board || "",
              }))
            : [{ class: "", subject: "", board: "" }],
          remuneration: post.monthlyBudget?.toString() || "",
          classType: (classTypeFromApi[post.classType] ||
            "in-person") as ClassType,
          frequency: post.frequencyPerWeek?.toString() || "",
          preferredTime: post.preferredTime || "",
          preferredDays: post.preferredDays || [],
          preferredLocation: post.location || "",
          notes: post.notes || "",
          status: post.status || "open",
        });
      } catch {
        setNotFound(true);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPost();
  }, [isEditMode, postId]);

  useEffect(() => {
    loadSources();
    loadSubjects();
    loadReferrals();
  }, []);

  // Pre-fill form data from enquiry if available (create mode only)
  useEffect(() => {
    if (isEditMode || !enquiry) return;
    setFormData((prev) => ({
      ...prev,
      guardianName: enquiry.name || "",
      guardianPhone: normalizePhone(enquiry.phoneNumber || ""),
      notes: "",
    }));
  }, [enquiry, isEditMode]);
  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
    if (field === "source" && value !== "referral" && (errors.referralUserName || errors.referralPhoneNumber)) {
      setErrors((prev) => ({
        ...prev,
        referralUserName: "",
        referralPhoneNumber: "",
      }));
    }
  };
  const handleGuardianPhoneChange = (value: string) =>
    handleChange("guardianPhone", normalizePhone(value));

  const handleStudentChange = (index: number, field: string, value: string) => {
    const newStudents = [...formData.students];
    newStudents[index] = { ...newStudents[index], [field]: value };
    setFormData((prev) => ({ ...prev, students: newStudents }));

    // Clear error for this student field
    const errorKey = `students.${index}.${field}`;
    if (errors[errorKey]) {
      setErrors((prev) => ({ ...prev, [errorKey]: "" }));
    }
  };
  const addStudent = () => {
    // If there's already at least one student, ask whether to copy the last one
    if (formData.students.length > 0) {
      openAddStudent();
    } else {
      setFormData((prev) => ({
        ...prev,
        students: [...prev.students, { class: "", subject: "", board: "" }],
      }));
    }
  };

  const confirmAddStudent = (copyPrevious: boolean) => {
    closeAddStudent();
    const last = formData.students[formData.students.length - 1];
    setFormData((prev) => ({
      ...prev,
      students: [
        ...prev.students,
        copyPrevious
          ? { class: last.class, subject: last.subject, board: last.board }
          : { class: "", subject: "", board: "" },
      ],
    }));
  };

  const removeStudent = (index: number) => {
    if (formData.students.length > 1) {
      const newStudents = formData.students.filter((_, i) => i !== index);
      setFormData((prev) => ({ ...prev, students: newStudents }));
    }
  };

  const addMissingSubject = () => {
    if (missingSubjectInput.trim()) {
      setFormData((prev) => ({
        ...prev,
        missingSubjects: [...prev.missingSubjects, missingSubjectInput.trim()],
      }));
      setMissingSubjectInput("");
    }
  };

  const removeMissingSubject = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      missingSubjects: prev.missingSubjects.filter((_, i) => i !== index),
    }));
  };

  const validate = () => {
    try {
      tuitionFormSchema.parse(formData);
      if (
        formData.source === "referral" &&
        (!formData.referralUserName.trim() || !formData.referralPhoneNumber.trim())
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
      reportClientError(error, { feature: "admin-tuition-form" });
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
        case 1: // Guardian Details
          const step1Schema = z.object({
            guardianName: tuitionFormSchema.shape.guardianName,
            guardianPhone: tuitionFormSchema.shape.guardianPhone,
            source: tuitionFormSchema.shape.source,
            referralUserName: tuitionFormSchema.shape.referralUserName,
            referralPhoneNumber: tuitionFormSchema.shape.referralPhoneNumber,
          });
          step1Schema.parse({
            guardianName: formData.guardianName,
            guardianPhone: formData.guardianPhone,
            source: formData.source,
            referralUserName: formData.referralUserName,
            referralPhoneNumber: formData.referralPhoneNumber,
          });
          if (
            formData.source === "referral" &&
            (!formData.referralUserName.trim() || !formData.referralPhoneNumber.trim())
          ) {
            if (!formData.referralUserName.trim()) {
              newErrors.referralUserName = "Referral user name is required";
            }
            if (!formData.referralPhoneNumber.trim()) {
              newErrors.referralPhoneNumber = "Referral phone number is required";
            }
            setErrors(newErrors);
            return false;
          }
          break;

        case 2: // Student Details
          const step2Schema = z.object({
            students: tuitionFormSchema.shape.students,
          });
          step2Schema.parse({
            students: formData.students,
          });
          break;
        case 3: // Schedule & Preferences
          const step3Schema = z.object({
            classType: tuitionFormSchema.shape.classType,
            preferredTime: tuitionFormSchema.shape.preferredTime,
          });
          step3Schema.parse({
            classType: formData.classType,
            preferredTime: formData.preferredTime,
          });
          // Frequency/days mismatch — informational only, does not block
          if (formData.frequency && formData.preferredDays.length > 0) {
            const freq = parseInt(formData.frequency, 10);
            if (formData.preferredDays.length < freq) {
              newErrors.preferredDays = `You selected ${freq} day(s)/week but only chose ${formData.preferredDays.length} day(s). Consider selecting at least ${freq}.`;
              setErrors(newErrors);
            }
          }
          break;
        case 4: // Location & Notes (final step)
          const step4Schema = z.object({
            preferredLocation: tuitionFormSchema.shape.preferredLocation,
          });
          step4Schema.parse({
            preferredLocation: formData.preferredLocation,
          });
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
      reportClientError(error, { feature: "admin-tuition-form" });
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
            guardianName: tuitionFormSchema.shape.guardianName,
            guardianPhone: tuitionFormSchema.shape.guardianPhone,
            source: tuitionFormSchema.shape.source,
            referralUserName: tuitionFormSchema.shape.referralUserName,
            referralPhoneNumber: tuitionFormSchema.shape.referralPhoneNumber,
          }).parse({
            guardianName: formData.guardianName,
            guardianPhone: formData.guardianPhone,
            source: formData.source,
            referralUserName: formData.referralUserName,
            referralPhoneNumber: formData.referralPhoneNumber,
          });
          if (
            formData.source === "referral" &&
            (!formData.referralUserName.trim() || !formData.referralPhoneNumber.trim())
          ) {
            return false;
          }
          break;
        case 2:
          z.object({ students: tuitionFormSchema.shape.students }).parse({
            students: formData.students,
          });
          break;
        case 3:
          z.object({
            classType: tuitionFormSchema.shape.classType,
            preferredTime: tuitionFormSchema.shape.preferredTime,
          }).parse({
            classType: formData.classType,
            preferredTime: formData.preferredTime,
          });
          break;
        case 4:
          z.object({
            preferredLocation: tuitionFormSchema.shape.preferredLocation,
          }).parse({ preferredLocation: formData.preferredLocation });
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
      // Map students: each entry becomes a student with subjects as single-item array
      const mappedStudents = formData.students.map((s) => ({
        className: s.class.trim(),
        board: s.board.trim(),
        subjects: [s.subject.trim()],
      }));

      const payload: Record<string, unknown> = {
        guardianName: formData.guardianName.trim(),
        guardianPhone: formData.guardianPhone.trim(),
        source: formData.source,
        ...(formData.source === "referral" && formData.referralUserName.trim()
          ? {
              referralUserName: formData.referralUserName.trim(),
              referralPhoneNumber: formData.referralPhoneNumber.trim(),
            }
          : {}),
        students: mappedStudents,
        classType: classTypeToApi[formData.classType] || "offline",
        frequencyPerWeek: parseInt(formData.frequency || "3", 10),
        preferredDays: formData.preferredDays,
        preferredTime: formData.preferredTime,
        location: formData.preferredLocation.trim(),
        monthlyBudget: parseInt(formData.remuneration || "0", 10),
        status: "open" as const,
      };

      // Optional fields
      const notesParts: string[] = [];
      if (formData.notes?.trim()) notesParts.push(formData.notes.trim());
      if (notesParts.length > 0) payload.notes = notesParts.join("\n");

      // Include enquiryId if available (create mode only)
      if (!isEditMode && enquiry?._id) payload.enquiryId = enquiry._id;

      // Include status for edit mode
      if (isEditMode) payload.status = formData.status;

      const url = isEditMode ? `/api/v1/posts/${postId}` : "/api/v1/posts";
      const res = await fetch(url, {
        method: isEditMode ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        if (res.status === 401) {
          addToast({
            description: "Your admin session expired. Please sign in again.",
            color: "danger",
          });
          router.push("/admin/login");
          return;
        }

        if (res.status === 403) {
          throw new Error("Admin access required to manage tuition posts");
        }

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
            (isEditMode ? "Failed to update post" : "Failed to create post"),
        );
      }

      const data = await res.json();

      // Show success animation
      setShowSuccess(true);
      addToast({
        description: isEditMode
          ? "Tuition post updated successfully!"
          : `Post ${data.post.postId} created successfully!`,
        color: "success",
      });

      // Navigate after showing success
      setTimeout(() => {
        router.push(
          isEditMode ? `/admin/tuitions/${postId}` : "/admin/tuitions",
        );
        router.refresh();
      }, 2000);
    } catch (error) {
      reportClientError(error, { feature: "admin-tuition-form" });
      addToast({
        description:
          error instanceof Error
            ? error.message
            : isEditMode
              ? "Failed to update post"
              : "Failed to create post",
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

  if (!isSignedIn || !user) {
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
        <p className="text-danger text-lg">Post not found</p>
        <Button
          variant="light"
          className="mt-4"
          onPress={() => router.push("/admin/tuitions")}
        >
          Back to Tuitions
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto p-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 justify-center">
          <h3 className="text-xl font-bold">
            {isEditMode ? "Edit Tuition" : "Create Tuition"}
          </h3>
        </div>
        <p className="text-sm text-default-500 text-center">
          {isEditMode ? "Update the details below" : "Fill in the details"}
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
            {isEditMode ? "Tuition Post Updated!" : "Tuition Post Created!"}
          </h3>
          <p className="text-default-500 animate-in fade-in duration-500 delay-400">
            {isEditMode
              ? "Your tuition post has been successfully updated."
              : "Your tuition post has been successfully created."}
          </p>
        </div>
      ) : isSubmitting ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Spinner size="lg" color="primary" />
          <p className="text-default-500">
            {isEditMode
              ? "Updating tuition post..."
              : "Creating tuition post..."}
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
            {/* Step 1: Guardian Details */}
            <Step>
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-default-700">
                  Guardian Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Guardian Name"
                    placeholder="Enter guardian name"
                    value={formData.guardianName}
                    onChange={(e) =>
                      handleChange("guardianName", e.target.value)
                    }
                    isRequired
                    isInvalid={!!errors.guardianName}
                    errorMessage={errors.guardianName}
                    variant="bordered"
                    startContent={
                      <User size={18} className="text-default-400" />
                    }
                  />{" "}
                  <Input
                    label="Guardian Phone"
                    placeholder="Enter phone number"
                    type="tel"
                    value={formatPhone(formData.guardianPhone)}
                    onChange={(e) => handleGuardianPhoneChange(e.target.value)}
                    isRequired
                    isInvalid={!!errors.guardianPhone}
                    errorMessage={errors.guardianPhone}
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
                    {[{ key: ADD_NEW_VALUE, label: "➕ Add new options" }, ...combinedSources].map((source) => (
                      <SelectItem key={source.key}>{source.label}</SelectItem>
                    ))}
                  </Select>
                  {formData.source === "referral" && (
                    <ReferralPicker
                      nameValue={formData.referralUserName}
                      phoneValue={formData.referralPhoneNumber}
                      options={referralOptions}
                      onNameChange={(value) => handleChange("referralUserName", value)}
                      onPhoneChange={(value) => handleChange("referralPhoneNumber", value)}
                      isRequired
                      isInvalid={!!errors.referralUserName || !!errors.referralPhoneNumber}
                      errorMessage={errors.referralUserName}
                      phoneErrorMessage={errors.referralPhoneNumber}
                      className="md:col-span-2"
                    />
                  )}
                </div>
              </div>
            </Step>

            {/* Step 2: Student Details */}
            <Step>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-semibold text-default-700">
                    Student Details
                  </h4>
                  <Button
                    size="sm"
                    color="primary"
                    variant="flat"
                    onPress={addStudent}
                    startContent={<span className="text-lg">+</span>}
                  >
                    Add Student
                  </Button>
                </div>
                {formData.students.map((student, index) => (
                  <Card key={index} className="p-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-default-700">
                          Student {index + 1}
                        </p>
                        {formData.students.length > 1 && (
                          <Button
                            size="sm"
                            color="danger"
                            variant="light"
                            onPress={() => removeStudent(index)}
                          >
                            Remove
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Autocomplete
                          label="Class"
                          placeholder="Search class"
                          selectedKey={student.class}
                          onSelectionChange={(key) =>
                            handleStudentChange(index, "class", key as string)
                          }
                          isRequired
                          isInvalid={!!errors[`students.${index}.class`]}
                          errorMessage={errors[`students.${index}.class`]}
                          variant="bordered"
                        >
                          {classes.map((cls) => (
                            <AutocompleteItem key={cls.key}>
                              {cls.label}
                            </AutocompleteItem>
                          ))}
                        </Autocomplete>

                        <Autocomplete
                          label="Board"
                          placeholder="Search board"
                          selectedKey={student.board}
                          onSelectionChange={(key) =>
                            handleStudentChange(index, "board", key as string)
                          }
                          isRequired
                          isInvalid={!!errors[`students.${index}.board`]}
                          errorMessage={errors[`students.${index}.board`]}
                          variant="bordered"
                        >
                          {boards.map((board) => (
                            <AutocompleteItem key={board.key}>
                              {board.label}
                            </AutocompleteItem>
                          ))}
                        </Autocomplete>

                        <Autocomplete
                          label="Subject"
                          placeholder="Search subject"
                          selectedKey={student.subject}
                          onSelectionChange={(key) => {
                            const value = key as string;
                            if (value === ADD_NEW_VALUE) {
                              setIsSubjectManagerOpen(true);
                              return;
                            }
                            handleStudentChange(index, "subject", value);
                          }}
                          isRequired
                          isInvalid={!!errors[`students.${index}.subject`]}
                          errorMessage={errors[`students.${index}.subject`]}
                          variant="bordered"
                        >
                          {[{ key: ADD_NEW_VALUE, label: "➕ Add new option" }, ...combinedSubjects].map((sub) => (
                            <AutocompleteItem key={sub.key}>
                              {sub.label}
                            </AutocompleteItem>
                          ))}
                        </Autocomplete>
                      </div>
                    </div>
                  </Card>
                ))}
                <Input
                  label="Remuneration (/month)"
                  placeholder="e.g. 5000"
                  type="tel"
                  value={formData.remuneration}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "");
                    handleChange("remuneration", value);
                  }}
                  variant="bordered"
                  startContent={
                    <FaRupeeSign size={18} className="text-default-400" />
                  }
                  description="Enter amount in numbers only"
                />
              </div>
            </Step>

            {/* Step 3: Schedule & Preferences */}
            <Step>
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-default-700">
                  Schedule & Preferences
                </h4>
                {/* Class Type */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-default-700">
                    Class Type
                  </label>{" "}
                  <RadioGroup
                    value={formData.classType}
                    onValueChange={(value) => handleChange("classType", value)}
                    orientation="horizontal"
                  >
                    {classTypes.map((ct) => (
                      <Radio key={ct.key} value={ct.key}>
                        {ct.label}
                      </Radio>
                    ))}
                  </RadioGroup>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select
                    label="Frequency"
                    placeholder="Select frequency"
                    selectedKeys={
                      formData.frequency ? [formData.frequency] : []
                    }
                    onChange={(e: any) =>
                      handleChange("frequency", e.target.value)
                    }
                    variant="bordered"
                    startContent={
                      <Clock size={18} className="text-default-400" />
                    }
                  >
                    {frequencies.map((freq) => (
                      <SelectItem key={freq.key}>{freq.label}</SelectItem>
                    ))}
                  </Select>{" "}
                  <div className="space-y-2">
                    <Input
                      label="Preferred Time"
                      placeholder="e.g. 4:00 PM – 6:00 PM"
                      value={formData.preferredTime}
                      onValueChange={(value) =>
                        handleChange("preferredTime", value)
                      }
                      startContent={
                        <Clock
                          size={16}
                          className="text-default-400 shrink-0"
                        />
                      }
                      isInvalid={!!errors.preferredTime}
                      errorMessage={errors.preferredTime}
                      variant="bordered"
                      description={
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {PREFERRED_TIME_SUGGESTIONS.map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() =>
                                setFormData((prev) => ({
                                  ...prev,
                                  preferredTime: prev.preferredTime
                                    ? `${prev.preferredTime}, ${t}`
                                    : t,
                                }))
                              }
                              className="px-2 py-0.5 text-xs rounded-full border border-default-300
          bg-default-100 hover:bg-primary hover:text-white hover:border-primary
          text-default-600 transition-colors cursor-pointer"
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      }
                    />
                  </div>
                </div>{" "}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-default-700">
                    Preferred Days
                  </label>{" "}
                  <CheckboxGroup
                    className="gap-1"
                    value={formData.preferredDays}
                    onValueChange={(value) =>
                      handleChange("preferredDays", value)
                    }
                    orientation="horizontal"
                    classNames={{ wrapper: "gap-3" }}
                  >
                    {days.map((day) => (
                      <CustomCheckbox key={day} value={day}>
                        {day}
                      </CustomCheckbox>
                    ))}
                  </CheckboxGroup>
                  {/* Frequency/days live hint */}
                  {formData.frequency &&
                    (() => {
                      const freq = parseInt(formData.frequency, 10);
                      const selected = formData.preferredDays.length;
                      if (selected === 0) return null;
                      if (selected < freq)
                        return (
                          <p className="text-xs text-warning-600 mt-1">
                            ⚠ You need at least <strong>{freq}</strong> day(s)
                            for your chosen frequency — {selected} selected so
                            far.
                          </p>
                        );
                      if (selected > freq)
                        return (
                          <p className="text-xs text-default-400 mt-1">
                            ℹ {selected} days selected — only {freq} required
                            for this frequency.
                          </p>
                        );
                      return (
                        <p className="text-xs text-success-600 mt-1">
                          ✓ {selected} day(s) match your frequency.
                        </p>
                      );
                    })()}
                </div>
              </div>
            </Step>

            {/* Step 4: Location & Notes */}
            <Step>
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-default-700">
                  Location & Additional Information
                </h4>
                <Input
                  label="Preferred Location"
                  placeholder="Enter location/address"
                  value={formData.preferredLocation}
                  onChange={(e) =>
                    handleChange("preferredLocation", e.target.value)
                  }
                  isRequired
                  isInvalid={!!errors.preferredLocation}
                  errorMessage={errors.preferredLocation}
                  variant="bordered"
                  startContent={
                    <MapPin size={18} className="text-default-400" />
                  }
                />{" "}
                <Textarea
                  label="Additional Notes"
                  placeholder="Any additional requirements or information..."
                  value={formData.notes}
                  onChange={(e: any) => handleChange("notes", e.target.value)}
                  variant="bordered"
                  minRows={4}
                  description={
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {tuitionNotesSuggestions.map((s) => (
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
                    {tuitionStatuses.map((s) => (
                      <SelectItem key={s.key}>{s.label}</SelectItem>
                    ))}
                  </Select>
                )}
              </div>
            </Step>

            {/* Step 5: Review & Confirm */}
            <Step>
              <div className="space-y-4">
                <>
                  <h4 className="text-lg text-center font-semibold text-default-700">
                    Review Your Tuition Post
                  </h4>

                  <div className="bg-warning/10 p-4 rounded-lg border border-warning/20">
                    <p className="text-sm text-warning-700">
                      Please review all information carefully before confirming.
                      Once submitted, the tuition post will be{" "}
                      {isEditMode ? "updated" : "created"}.
                    </p>
                  </div>

                  <Card>
                    <CardBody className="gap-2">
                      {/* Guardian Information */}
                      <div>
                        <p className="text-sm font-semibold text-default-700 mb-2">
                          Guardian Information
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-default-500">Name:</span>{" "}
                            <span className="font-medium">
                              {formData.guardianName}
                            </span>
                          </div>
                          <div>
                            <span className="text-default-500">Phone:</span>{" "}
                            <span className="font-medium">
                              {formatPhone(formData.guardianPhone)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-divider" />

                      {/* Students Information */}
                      <div>
                        <p className="text-sm font-semibold text-default-700 mb-2">
                          Total Students: {formData.students.length}
                        </p>
                        <div className="space-y-3">
                          {formData.students.map((student, index) => (
                            <Card key={index} className="bg-default-50">
                              <CardBody className="py-2 px-3">
                                <p className="text-xs font-semibold text-default-600 mb-1">
                                  Student {index + 1}
                                </p>
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                  <div>
                                    <span className="text-default-500">
                                      Class:
                                    </span>{" "}
                                    <Chip size="sm" variant="flat">
                                      {student.class}
                                    </Chip>
                                  </div>
                                  <div>
                                    <span className="text-default-500">
                                      Subject:
                                    </span>{" "}
                                    <span className="font-medium">
                                      {student.subject}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-default-500">
                                      Board:
                                    </span>{" "}
                                    <span className="font-medium">
                                      {student.board}
                                    </span>
                                  </div>
                                </div>
                              </CardBody>
                            </Card>
                          ))}
                        </div>
                      </div>

                      <div className="border-t border-divider" />

                      {/* Schedule & Preferences */}
                      <div>
                        <p className="text-sm font-semibold text-default-700 mb-2">
                          Schedule & Preferences
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-default-500">
                              Class Type:
                            </span>{" "}
                            <Chip
                              size="sm"
                              variant="flat"
                              color="primary"
                              className="capitalize"
                            >
                              {formData.classType}
                            </Chip>
                          </div>
                          {formData.frequency && (
                            <div>
                              <span className="text-default-500">
                                Frequency:
                              </span>{" "}
                              <span className="font-medium">
                                {frequencies.find(
                                  (f) => f.key === formData.frequency,
                                )?.label || formData.frequency}
                              </span>
                            </div>
                          )}
                          <div>
                            <span className="text-default-500">
                              Preferred Time:
                            </span>{" "}
                            <Chip size="sm" variant="flat" color="secondary">
                              {formData.preferredTime}
                            </Chip>
                          </div>
                          {formData.remuneration && (
                            <div>
                              <span className="text-default-500">
                                Remuneration:
                              </span>{" "}
                              <span className="font-medium text-success">
                                ₹{formData.remuneration}/month
                              </span>
                            </div>
                          )}
                        </div>{" "}
                        {formData.preferredDays.length > 0 && (
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-default-500 text-sm">
                              Preferred Days:
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {days
                                .filter((d) =>
                                  formData.preferredDays.includes(d),
                                )
                                .map((day, idx) => (
                                  <Chip
                                    key={idx}
                                    size="sm"
                                    variant="flat"
                                    color="primary"
                                  >
                                    {day}
                                  </Chip>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="border-t border-divider" />

                      {/* Location */}
                      <div className="flex gap-2">
                        <p className="text-sm font-semibold text-default-700">
                          Location
                        </p>
                        <p className="text-sm text-default-600">
                          {formData.preferredLocation}
                        </p>
                      </div>

                      {formData.notes && (
                        <>
                          <div className="border-t border-divider" />
                          <div>
                            <p className="text-sm font-semibold text-default-700">
                              Additional Notes
                            </p>
                            <p className="text-sm text-default-600">
                              {formData.notes}
                            </p>
                          </div>
                        </>
                      )}
                    </CardBody>
                  </Card>
                </>
              </div>
            </Step>
          </Stepper>
        </div>
      )}

      <OptionManagerModal
        title="Sources"
        endpoint="/api/v1/admin/sources"
        items={extraSources}
        isOpen={isSourceManagerOpen}
        onClose={() => setIsSourceManagerOpen(false)}
        onRefresh={loadSources}
      />

      <OptionManagerModal
        title="Subjects"
        endpoint="/api/v1/admin/subjects"
        items={extraSubjects}
        isOpen={isSubjectManagerOpen}
        onClose={() => setIsSubjectManagerOpen(false)}
        onRefresh={loadSubjects}
      />

      {/* Add Student Modal */}
      <Modal isOpen={isAddStudentOpen} onClose={closeAddStudent} size="sm">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            Add Another Student
          </ModalHeader>
          <ModalBody>
            <p className="text-sm text-default-600">
              If you have multiple students under one guardian, you can add them
              here. <br />
              <br />
              Copy the previous student's details
            </p>
            <div className="p-2 bg-default-50 rounded-lg text-sm text-default-500 space-y-1">
              <p>
                <span className="font-medium">Class:</span>{" "}
                {formData.students[formData.students.length - 1]?.class || "—"}
              </p>
              <p>
                <span className="font-medium">Subject:</span>{" "}
                {formData.students[formData.students.length - 1]?.subject ||
                  "—"}
              </p>
              <p>
                <span className="font-medium">Board:</span>{" "}
                {formData.students[formData.students.length - 1]?.board || "—"}
              </p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => confirmAddStudent(true)}>
              Yes, copy data
            </Button>
            <Button color="primary" onPress={() => confirmAddStudent(false)}>
              No, start blank
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
