import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const groups = [
  {
    label: "AOTF Group - 2",
    url: "https://chat.whatsapp.com/BZ8gk2VO7wvHOzQQ5HowNN?mode=hqrc",
    ordering: 2,
  },
  {
    label: "AOTF Group - 3",
    url: "https://chat.whatsapp.com/IQFV7D4xaoJLmWeWzgXBHS?mode=hqrc",
    ordering: 3,
  },
  {
    label: "AOTF Group - 4",
    url: "https://chat.whatsapp.com/Ek9u0mfFDQ68qxtXGMbWy3?mode=hqrc",
    ordering: 4,
  },
] as const;

async function main() {
  const [
    { default: dbConnect },
    { default: User },
    { default: OnboardingDetails },
    { default: WhatsAppGroupLink },
  ] = await Promise.all([
    import("../lib/db"),
    import("../lib/models/User"),
    import("../lib/models/OnboardingDetails"),
    import("../lib/models/WhatsAppGroupLink"),
  ]);
  await dbConnect();

  for (const group of groups) {
    await WhatsAppGroupLink.updateOne(
      { url: group.url },
      {
        $set: {
          label: group.label,
          url: group.url,
          status: "active",
          capacity: 1024,
          ordering: group.ordering,
        },
        $setOnInsert: {
          memberCount: 0,
          creatorClerkId: null,
          updaterClerkId: null,
        },
      },
      { upsert: true },
    );
  }

  const paidUsers = await User.find({ paymentCompleted: true })
    .select("_id")
    .lean();
  const paidUserIds = paidUsers.map((user) => user._id);
  const cleared = paidUserIds.length
    ? await OnboardingDetails.updateMany(
        { $or: paidUserIds.map((userId) => ({ userId })) },
        { $set: { expiresAt: null } },
      )
    : { modifiedCount: 0 };

  console.log(
    `Seeded ${groups.length} WhatsApp groups and cleared ${cleared.modifiedCount} paid onboarding TTLs.`,
  );
}

main()
  .catch((error) => {
    console.error("Failed to seed WhatsApp groups:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const mongoose = await import("mongoose");
    await mongoose.default.connection.close().catch(() => {});
  });
