import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const groups = [
  {
    label: "AOTF Group - 1",
    url: "https://chat.whatsapp.com/Kkenc1KIna3Ha7W883hlTD?s=cl&p=a&mlu=4&ilr=4",
    ordering: 1,
  },
  {
    label: "AOTF Group - 2",
    url: "https://chat.whatsapp.com/BZ8gk2VO7wvHOzQQ5HowNN?s=cl&p=a&mlu=4&ilr=4",
    ordering: 2,
  },
  {
    label: "AOTF Group - 3",
    url: "https://chat.whatsapp.com/IQFV7D4xaoJLmWeWzgXBHS?s=cl&p=a&mlu=4&ilr=4",
    ordering: 3,
  },
  {
    label: "AOTF Group - 4",
    url: "https://chat.whatsapp.com/Ek9u0mfFDQ68qxtXGMbWy3?s=cl&p=a&mlu=4&ilr=4",
    ordering: 4,
  },
  {
    label: "AOTF Group - 5",
    url: "https://chat.whatsapp.com/Ian1tjYD3MEBWSeUGw5YPk?s=cl&p=a&mlu=4&ilr=4",
    ordering: 5,
  },
  {
    label: "AOTF Group - 6",
    url: "https://chat.whatsapp.com/KhJgkx2eCKq1jAtNbm5bE9?s=cl&p=a&mlu=4&ilr=4",
    ordering: 6,
  },
  {
    label: "AOTF Group - 7",
    url: "https://chat.whatsapp.com/FieKZs5wP4I87aW4fy6b84?s=cl&p=a&mlu=4&ilr=4",
    ordering: 7,
  },
  {
    label: "AOTF Group - 8",
    url: "https://chat.whatsapp.com/JV0BdXvbusE6h4jqSOQSUR?s=cl&p=a&mlu=4&ilr=4",
    ordering: 8,
  },
  {
    label: "AOTF Group - 9",
    url: "https://chat.whatsapp.com/K2Q5Q2oBOkX99ftgLE66El?s=cl&p=a&mlu=4&ilr=4",
    ordering: 9,
  },
  {
    label: "AOTF Group - 10",
    url: "https://chat.whatsapp.com/EY7qm77zP6MKoOSy2cmLSN?s=cl&p=a&mlu=4&ilr=4",
    ordering: 10,
  },
  {
    label: "AOTF Group - 11",
    url: "https://chat.whatsapp.com/KBWdcJY66dn3Dq5Ihzf3aV?s=cl&p=a&mlu=4&ilr=4",
    ordering: 11,
  },
  {
    label: "AOTF Group - 12",
    url: "https://chat.whatsapp.com/HRVGmBsXqd4F7lVM17g7Vj?s=cl&p=a&mlu=4&ilr=4",
    ordering: 12,
  },
  {
    label: "AOTF Group - 13",
    url: "https://chat.whatsapp.com/L7V5nsIQjWr4gIxn7TpAeI?s=cl&p=a&mlu=4&ilr=4",
    ordering: 13,
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
      { label: group.label },
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
