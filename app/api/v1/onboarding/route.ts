import { handleApiError } from "@/lib/api-utils";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User from "@/lib/models/User";
import Payment from "@/lib/models/Payment";
import OnboardingDetails from "@/lib/models/OnboardingDetails";
import { ensureUserRecord } from "@/lib/utils/ensure-user";
import { syncUserMetadataToClerk } from "@/lib/services/clerk-sync.service";

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
    const {
      phone,
      whatsapp,
      address,
      teachingExp,
      jobExp,
      qualification,
      board,
      plan,
    } = body as {
      phone?: string;
      whatsapp?: string;
      address?: string;
      teachingExp?: string;
      jobExp?: string;
      qualification?: string;
      board?: string;
      plan?: string;
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

    const validBoards = [
      "CBSE",
      "ICSE",
      "ISC",
      "IB",
      "WB-Bengali",
      "WB-English",
    ];
    if (board !== undefined && !validBoards.includes(board)) {
      return NextResponse.json(
        { error: "Invalid board value" },
        { status: 400 },
      );
    }

    const validPlans = ["teacher", "teacher_candidate"];
    if (plan !== undefined && !validPlans.includes(plan)) {
      return NextResponse.json(
        { error: "Invalid plan value" },
        { status: 400 },
      );
    }

    await dbConnect();

    // Ensure User + Profile exist (self-heals if the Clerk webhook was delayed)
    const user = await ensureUserRecord(clerkId);

    const updateFields: Record<string, unknown> = { userId: user._id };
    if (phone !== undefined) updateFields.phone = phone;
    if (whatsapp !== undefined) updateFields.whatsapp = whatsapp;
    if (address !== undefined) updateFields.address = address;
    if (teachingExp !== undefined) updateFields.teachingExp = teachingExp;
    if (jobExp !== undefined) updateFields.jobExp = jobExp;
    if (qualification !== undefined) updateFields.qualification = qualification;
    if (board !== undefined) updateFields.board = board;
    if (plan !== undefined) updateFields.plan = plan;
    // Refresh the 72-hour TTL on every save while payment hasn't happened
    updateFields.expiresAt = user.paymentCompleted
      ? null
      : new Date(Date.now() + 72 * 60 * 60 * 1000);

    const onboardingDetails = await OnboardingDetails.findOneAndUpdate(
      { clerkId },
      { $set: updateFields },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    console.log(`[onboarding] Upserted onboarding details for ${clerkId}`);

    // Mark detailsCompleted on the User if all required fields are present
    const allRequiredFilled =
      !!onboardingDetails?.phone &&
      !!onboardingDetails?.whatsapp &&
      !!onboardingDetails?.teachingExp &&
      !!onboardingDetails?.qualification &&
      !!onboardingDetails?.board;

    let userDoc = await User.findOne({ clerkId });
    if (allRequiredFilled) {
      if (userDoc && !userDoc.detailsCompleted) {
        userDoc.detailsCompleted = true;
        await userDoc.save(); // pre-save hook derives onboardingCompleted
        // Fire-and-forget sync to Clerk
        void syncUserMetadataToClerk(clerkId);
      }
    }

    return NextResponse.json({
      success: true,
      onboardingDetails,
      detailsCompleted: Boolean(userDoc?.detailsCompleted),
      paymentCompleted: Boolean(userDoc?.paymentCompleted),
      whatsappGroupCompleted: Boolean(userDoc?.whatsappGroupCompleted),
      onboardingCompleted: Boolean(userDoc?.onboardingCompleted),
    });
  } catch (error) {
    return handleApiError(error, "PATCH /api/v1/onboarding");
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

    const [onboardingDetails, userDoc] = await Promise.all([
      OnboardingDetails.findOne({ clerkId }),
      User.findOne(
        { clerkId },
        {
          createdAt: 1,
          onboardingCompleted: 1,
          detailsCompleted: 1,
          paymentCompleted: 1,
          whatsappGroupCompleted: 1,
          hasTuitionAccess: 1,
          hasCandidateAccess: 1,
          createdByAdmin: 1,
        },
      ),
    ]);

    // Check if the user has a paid payment but onboardingCompleted is still false
    let paymentPaidButNotOnboarded = false;
    if (userDoc && !userDoc.onboardingCompleted && !userDoc.paymentCompleted) {
      const paidPayment = await Payment.findOne({
        clerkId,
        status: "paid",
      }).lean();
      if (paidPayment) {
        paymentPaidButNotOnboarded = true;
      }
    }

    return NextResponse.json({
      onboardingDetails,
      createdAt: userDoc?.createdAt ?? null,
      onboardingCompleted: userDoc?.onboardingCompleted ?? false,
      detailsCompleted: userDoc?.detailsCompleted ?? false,
      paymentCompleted: userDoc?.paymentCompleted ?? false,
      whatsappGroupCompleted: userDoc?.whatsappGroupCompleted ?? false,
      createdByAdmin: userDoc?.createdByAdmin ?? false,
      paymentPaidButNotOnboarded,
    });
  } catch (error) {
    return handleApiError(error, "GET /api/v1/onboarding");
  }
}
