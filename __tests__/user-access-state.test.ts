import {
  deriveAccessFromRole,
  deriveOnboardingCompleted,
} from "@/lib/models/User";

describe("user access and onboarding state", () => {
  it("teacher access is tuition-only and candidate access is both", () => {
    expect(deriveAccessFromRole("teacher")).toEqual({
      hasTuitionAccess: true,
      hasCandidateAccess: false,
    });

    expect(deriveAccessFromRole("teacher_candidate")).toEqual({
      hasTuitionAccess: true,
      hasCandidateAccess: true,
    });
  });

  it("onboarding completes only after all required steps are marked complete", () => {
    expect(
      deriveOnboardingCompleted({
        detailsCompleted: true,
        paymentCompleted: true,
        whatsappGroupCompleted: true,
      }),
    ).toBe(true);

    expect(
      deriveOnboardingCompleted({
        detailsCompleted: true,
        paymentCompleted: true,
        whatsappGroupCompleted: false,
      }),
    ).toBe(false);
  });
});
