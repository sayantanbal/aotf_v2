import { handleApiError } from "@/lib/api-utils";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Profile from "@/lib/models/Profile";
import User from "@/lib/models/User";
import { ensureUserRecord } from "@/lib/utils/ensure-user";
import Subject from "@/lib/models/Subject";

export async function PATCH(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const body = await req.json();
    const editableFields = new Set([
      "phone",
      "whatsapp",
      "address",
      "teachingExp",
      "jobExp",
      "qualification",
      "board",
      "gender",
      "subjects",
    ]);
    const unsupportedField = Object.keys(body).find(
      (field) => !editableFields.has(field),
    );
    if (unsupportedField) {
      return NextResponse.json(
        {
          error: `${unsupportedField} cannot be changed from the profile editor.`,
        },
        { status: 400 },
      );
    }

    const {
      phone,
      whatsapp,
      address,
      teachingExp,
      jobExp,
      qualification,
      board,
      gender,
      subjects,
    } = body as {
      phone?: string;
      whatsapp?: string;
      address?: string;
      teachingExp?: string;
      jobExp?: string;
      qualification?: string;
      board?: string;
      gender?: string;
      subjects?: string[];
    };

    // Validate phone / whatsapp (10-digit Indian mobile)
    const phoneRegex = /^[6-9]\d{9}$/;
    if (phone !== undefined && !phoneRegex.test(phone)) {
      return NextResponse.json(
        { error: "Phone must be a valid 10-digit Indian mobile number" },
        { status: 400 },
      );
    }
    if (whatsapp !== undefined && !phoneRegex.test(whatsapp)) {
      return NextResponse.json(
        { error: "WhatsApp must be a valid 10-digit Indian mobile number" },
        { status: 400 },
      );
    }

    // Validate address length
    if (address !== undefined && address.length > 200) {
      return NextResponse.json(
        { error: "Address must be 200 characters or less" },
        { status: 400 },
      );
    }

    const validExpRanges = ["0-1", "2-5", "6-10", "10+"];
    if (teachingExp !== undefined && !validExpRanges.includes(teachingExp)) {
      return NextResponse.json(
        { error: "Invalid teachingExp value" },
        { status: 400 },
      );
    }
    if (jobExp !== undefined && !validExpRanges.includes(jobExp)) {
      return NextResponse.json(
        { error: "Invalid jobExp value" },
        { status: 400 },
      );
    }

    const validBoards = ["CBSE", "ICSE", "ISC", "IB", "WB-Bengali", "WB-English"];
    if (board !== undefined && !validBoards.includes(board)) {
      return NextResponse.json(
        { error: "Invalid board value" },
        { status: 400 },
      );
    }

    const normalizedGender = gender?.trim().toLowerCase() as
      | "male"
      | "female"
      | "other"
      | undefined;
    const validGenders = ["male", "female", "other"];
    if (normalizedGender !== undefined && !validGenders.includes(normalizedGender)) {
      return NextResponse.json(
        { error: "Invalid gender value" },
        { status: 400 },
      );
    }

    await dbConnect();

    const updateFields: Record<string, unknown> = {};
    if (phone !== undefined) updateFields.phone = phone;
    if (whatsapp !== undefined) updateFields.whatsapp = whatsapp;
    if (address !== undefined) updateFields.address = address;
    if (teachingExp !== undefined) updateFields.teachingExp = teachingExp;
    if (jobExp !== undefined) updateFields.jobExp = jobExp;
    if (qualification !== undefined) updateFields.qualification = qualification;
    if (board !== undefined) updateFields.board = board;
    if (normalizedGender !== undefined) updateFields.gender = normalizedGender;
    if (subjects !== undefined) {
      if (!Array.isArray(subjects) || subjects.length === 0 || subjects.length > 20) {
        return NextResponse.json({ error: "Select at least one subject" }, { status: 400 });
      }
      if (!subjects.every((s) => typeof s === "string")) {
        return NextResponse.json({ error: "Invalid subjects format" }, { status: 400 });
      }
      const uniqueSubjects = Array.from(new Set(subjects));
      const validSubjects = await Subject.find({
        $or: [
          { key: { $in: uniqueSubjects } },
          { label: { $in: uniqueSubjects } }
        ]
      }).select("key label").lean();

      const invalidSubjects = uniqueSubjects.filter(
        (subject) => !validSubjects.some((vs) => vs.key === subject || vs.label === subject)
      );

      if (invalidSubjects.length > 0) {
        return NextResponse.json({ error: "One or more subjects are invalid" }, { status: 400 });
      }

      const finalKeys = new Set(
        uniqueSubjects.map((subject) => {
          const matched = validSubjects.find((vs) => vs.key === subject || vs.label === subject);
          return matched!.key;
        })
      );
      updateFields.subjects = Array.from(finalKeys);
    }

    // Ensure User + Profile exist (self-heals if the Clerk webhook was delayed)
    const user = await ensureUserRecord(clerkId);

    if (normalizedGender !== undefined) {
      await User.updateOne({ clerkId }, { $set: { gender: normalizedGender } });
    }

    const profile = await Profile.findOneAndUpdate(
      { clerkId },
      {
        $set: updateFields,
        $setOnInsert: {
          userId: user._id,
          clerkId,
          username: user.username,
        },
      },
      { returnDocument: "after", upsert: true },
    );

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    console.log(`[profile] Updated profile for ${clerkId}`);

    const profileSubjectKeys = profile.subjects ?? [];
    const subjectDocs = profileSubjectKeys.length
      ? await Subject.find(
          { $or: profileSubjectKeys.map((key) => ({ key })) },
          { key: 1, label: 1 },
        ).lean()
      : [];
    const labels = new Map(subjectDocs.map((subject) => [subject.key, subject.label]));
    const profileResponse = profile.toObject();
    return NextResponse.json({
      success: true,
      profile: {
        ...profileResponse,
        subjectKeys: profile.subjects,
        subjects: (profile.subjects ?? []).map((subject) => labels.get(subject) ?? subject),
      },
    });
  } catch (error) {
    return handleApiError(error, "PATCH /api/v1/profile");
  }
}

export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    await dbConnect();

    const profile = await Profile.findOne({ clerkId });
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json({ profile });
  } catch (error) {
    return handleApiError(error, "GET /api/v1/profile");
  }
}
