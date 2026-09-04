import { handleApiError } from "@/lib/api-utils";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User from "@/lib/models/User";
import WhatsAppGroupLink from "@/lib/models/WhatsAppGroupLink";
import { syncUserMetadataToClerk } from "@/lib/services/clerk-sync.service";

/**
 * GET /api/v1/onboarding/whatsapp
 * Returns all active WhatsApp group links in configured order.
 */
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

    const groups = await WhatsAppGroupLink.find({ status: "active" })
      .select("_id label url capacity memberCount")
      .sort({ ordering: 1 })
      .lean();

    return NextResponse.json({ groups });
  } catch (error) {
    return handleApiError(error, "GET /api/v1/onboarding/whatsapp");
  }
}

/**
 * POST /api/v1/onboarding/whatsapp
 * Called when the user taps a WhatsApp group link.
 * Marks whatsappGroupCompleted = true and syncs to Clerk.
 */
export async function POST() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    await dbConnect();

    const userDoc = await User.findOne({ clerkId });
    if (!userDoc) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!userDoc.whatsappGroupCompleted) {
      userDoc.whatsappGroupCompleted = true;
      await userDoc.save(); // pre-save hook derives onboardingCompleted
      void syncUserMetadataToClerk(clerkId);
    }

    return NextResponse.json({
      success: true,
      onboardingCompleted: Boolean(userDoc.onboardingCompleted),
      whatsappGroupCompleted: true,
    });
  } catch (error) {
    return handleApiError(error, "POST /api/v1/onboarding/whatsapp");
  }
}
