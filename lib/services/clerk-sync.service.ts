import { clerkClient } from "@clerk/nextjs/server";
import User from "@/lib/models/User";
import { reportError } from "@/lib/sentry-report";

/**
 * Synchronizes the MongoDB User state to Clerk publicMetadata.
 * This ensures the frontend JWT always has the latest access and onboarding flags.
 */
export async function syncUserMetadataToClerk(clerkId: string) {
  const user = await User.findOne({ clerkId }).lean();
  if (!user) {
    console.error(`[clerk-sync] Cannot sync metadata, user not found in DB: ${clerkId}`);
    reportError(new Error("User not found during Clerk metadata sync"), {
      tags: { integration: "clerk", operation: "sync-user-metadata" },
      extra: { clerkId },
    });
    return { success: false, error: "User not found in DB" };
  }

  try {
    const client = await clerkClient();
    await client.users.updateUserMetadata(clerkId, {
      publicMetadata: {
        role: user.role,
        onboardingCompleted: Boolean(user.onboardingCompleted),
        detailsCompleted: Boolean(user.detailsCompleted),
        paymentCompleted: Boolean(user.paymentCompleted),
        whatsappGroupCompleted: Boolean(user.whatsappGroupCompleted),
        hasTuitionAccess: Boolean(user.hasTuitionAccess),
        hasCandidateAccess: Boolean(user.hasCandidateAccess),
      },
    });

    return { success: true };
  } catch (error) {
    if ((error as { status?: number }).status === 404) {
      console.warn(
        `[clerk-sync] Clerk user not found, metadata was not synced: ${clerkId}`,
      );
      return { success: false, error: "Clerk user not found" };
    }
    console.error(`[clerk-sync] Failed to sync metadata to Clerk for ${clerkId}:`, error);
    reportError(error, {
      tags: { integration: "clerk", operation: "sync-user-metadata" },
      extra: { clerkId },
    });
    return { success: false, error: "Clerk API error" };
  }
}
