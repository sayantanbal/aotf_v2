describe("legacy teacher migration mapping", () => {
  it("maps legacy teacher fields into Profile and OnboardingDetails format", async () => {
    const { mapLegacyTeacherToProfile, mapLegacyTeacherToOnboarding } = require(
      "../scripts/lib/legacy-teacher-mapping.js"
    );

    const teacher = {
      _id: { $oid: "6922b2221eccde09dc0371f4" },
      teacherId: "AOT-3P35N414",
      name: "Arnesh Jana",
      email: "janaarnesh@gmail.com",
      phone: "9051306766",
      location: "Belgharia",
      experience: "0-1",
      qualifications: "BBA",
      schoolBoard: "CBSE",
      subjectsTeaching: ["Commerce and Accounts Group", "Arts Group"],
      teachingMode: "both",
      bio: "",
      whatsappNumber: "9051306766",
      registrationFeeStatus: "paid",
      termsAgreedAt: { $date: "2025-11-23T07:05:07.335Z" },
      createdAt: { $date: "2025-11-23T07:05:06.451Z" },
    };

    const profile = mapLegacyTeacherToProfile(teacher, "user_123", "janaarnesh");
    const onboarding = mapLegacyTeacherToOnboarding(
      teacher,
      "user_123",
      "64d1767d6f3b7c8a0d9d1234"
    );

    expect(profile.displayName).toBe("Arnesh Jana");
    expect(profile.location).toBe("Belgharia");
    expect(profile.phone).toBe("9051306766");
    expect(profile.whatsapp).toBe("9051306766");
    expect(profile.subjects).toEqual(["Commerce and Accounts Group", "Arts Group"]);
    expect(profile.qualification).toBe("BBA");
    expect(profile.board).toBe("CBSE");
    expect(profile.experience).toBe(1);
    expect(onboarding).not.toHaveProperty("userId");
    expect(onboarding).not.toHaveProperty("clerkId");
    expect(onboarding.teachingExp).toBe("0-1");
    expect(onboarding.jobExp).toBe("0-1");
    expect(onboarding.phone).toBe("9051306766");
    expect(onboarding.whatsapp).toBe("9051306766");
    expect(onboarding.address).toBe("Belgharia");
  });
});
