import { handleApiError } from "@/lib/api-utils";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Admin from "@/lib/models/Admin";
import Referral from "@/lib/models/Referral";
import Post from "@/lib/models/Post";
import Invoice from "@/lib/models/Invoice";
import { siteConfig } from "@/config/site";

async function getCallerAdmin(userId: string) {
  const { sessionClaims } = await auth();
  let metadata = sessionClaims?.publicMetadata as
    | Record<string, unknown>
    | undefined;

  if (metadata?.isAdmin !== true) {
    try {
      const client = await clerkClient();
      const clerkUser = await client.users.getUser(userId);
      metadata = clerkUser.publicMetadata as Record<string, unknown> | undefined;
    } catch {
      metadata = undefined;
    }
  }

  if (metadata?.isAdmin !== true) return null;

  await dbConnect();
  return Admin.findOne({ clerkId: userId }, { role: 1 }).lean();
}

function slugifyInvoiceSegment(value: string) {
  const slug = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug.slice(0, 12) || "REF";
}

/** POST /api/v1/admin/payments/generate-payout
 *  Body: { adminClerkId: string; year: number; month: number }
 *
 *  Generates an Invoice document that records the admin's payout for the
 *  given month (sum of monthlyBudget * payoutPercentage for paid tuition posts).
 *  Returns the public-viewable invoiceId.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const callerAdmin = await getCallerAdmin(userId);
    if (
      !callerAdmin ||
      (callerAdmin.role !== "super_admin" && callerAdmin.role !== "admin")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as {
      adminClerkId?: string;
      year?: unknown;
      month?: unknown;
      referralUserName?: string;
      referralPhoneNumber?: string;
      amount?: unknown;
    };

    const { adminClerkId } = body;
    const year = Number(body.year);
    const month = Number(body.month); // 1-indexed
    const referralUserName = body.referralUserName?.trim() ?? "";
    const referralPhoneNumber = body.referralPhoneNumber?.trim() ?? "";
    const manualAmount = Number(body.amount);

    const isReferralInvoice = Boolean(referralUserName);

    if (!year || !month || month < 1 || month > 12) {
      return NextResponse.json(
        { error: "Valid year and month (1-12) are required" },
        { status: 400 },
      );
    }

    if (isReferralInvoice) {
      if (!referralPhoneNumber) {
        return NextResponse.json(
          { error: "Referral phone number is required" },
          { status: 400 },
        );
      }
      if (!manualAmount || manualAmount <= 0) {
        return NextResponse.json(
          { error: "A valid invoice amount is required" },
          { status: 400 },
        );
      }

      await dbConnect();

      const referralDocs = await Referral.find(
        {
          referralUserName,
          referralPhoneNumber,
        },
        { postId: 1, referralUserName: 1, referralPhoneNumber: 1 },
      ).lean();

      const referredPostIds = referralDocs
        .map((referral) => referral.postId?.trim())
        .filter((postId): postId is string => Boolean(postId && !postId.startsWith("J-")));
      const referredJobIds = referralDocs
        .map((referral) => referral.postId?.trim())
        .filter((postId): postId is string => Boolean(postId && postId.startsWith("J-")));

      const amount = Math.round(manualAmount * 100) / 100;
      const shortId = slugifyInvoiceSegment(
        `${referralUserName}-${referralPhoneNumber}`,
      );
      const mm = String(month).padStart(2, "0");
      const invoiceId = `INV-REF-${shortId}-${mm}-${year}`;

      const monthNames = [
        "January","February","March","April","May","June",
        "July","August","September","October","November","December",
      ];
      const periodLabel = `${monthNames[month - 1]} ${year}`;

      const updateData = {
        $set: {
          invoiceId,
          version: 1,
          isLatest: true,

          source: {
            name: siteConfig.name ?? "Academy of Tutorials & Freelancers",
            address: siteConfig.contact?.address?.street ?? "",
            phone: siteConfig.contact?.phone ?? "",
            email: siteConfig.contact?.email ?? "",
          },

          recipient: {
            name: referralUserName,
            phone: referralPhoneNumber,
            email: "",
          },

          serviceProvider: {
            name: siteConfig.name ?? "Academy of Tutorials & Freelancers",
            address: siteConfig.contact?.address?.street ?? "",
            phone: siteConfig.contact?.phone ?? "",
            websiteUrl: siteConfig.url ?? "https://www.aotf.in",
            signatureUrl: "/api/v1/admin/private-image?name=sign.png",
          },

          amount: {
            currency: "INR",
            subTotal: amount,
            taxPercentage: 0,
            taxAmount: 0,
            grandTotal: amount,
          },

          breakdown: {
            items: [
              {
                name: `Referral Payout — ${referralUserName}`,
                description: `Referral invoice for ${periodLabel} at a manual amount`,
                quantity: 1,
                unitAmount: amount,
                total: amount,
              },
            ],
            notes: `Referral invoice for ${periodLabel}.`,
          },

          paymentStatus: "unpaid",
          referralPhoneNumber,
          referredPostIds,
          referredJobIds,
        },
        $setOnInsert: {
          invoiceDate: new Date(),
        },
      };

      const invoice = await Invoice.findOneAndUpdate(
        { invoiceId },
        updateData,
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );

      return NextResponse.json(
        {
          success: true,
          invoiceId: invoice.invoiceId,
          grandTotal: amount,
          referralUserName,
          referralPhoneNumber,
          referredPostIds,
          referredJobIds,
        },
        { status: 201 },
      );
    }

    if (!adminClerkId || typeof adminClerkId !== "string") {
      return NextResponse.json(
        { error: "adminClerkId is required" },
        { status: 400 },
      );
    }
    if (!year || !month || month < 1 || month > 12) {
      return NextResponse.json(
        { error: "Valid year and month (1-12) are required" },
        { status: 400 },
      );
    }

    await dbConnect();

    // ── Fetch target admin ──────────────────────────────────────────────────
    const targetAdmin = await Admin.findOne(
      { clerkId: adminClerkId },
      { name: 1, email: 1, payoutPercentage: 1, clerkId: 1 },
    ).lean();

    if (!targetAdmin) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }

    const payoutPct: number = (targetAdmin as any).payoutPercentage ?? 0;

    // ── Date range (JS-side filtering to avoid Mongoose 9.x CastError) ──────
    const startDate = new Date(year, month - 1, 1); // first day of month
    const endDate = new Date(year, month, 1);        // first day of next month (exclusive)

    // Step 1 — all posts created by this admin (we need postIds to query invoices)
    const adminPosts = await Post.find(
      { createdByAdminClerkId: adminClerkId },
      { postId: 1, guardianName: 1, monthlyBudget: 1, paymentstatus: 1, paymentDate: 1 },
    ).lean();

    if (adminPosts.length === 0) {
      return NextResponse.json(
        { error: "No tuition posts found for this admin" },
        { status: 404 },
      );
    }

    const postIdList = adminPosts
      .map((p) => (p.postId as string | undefined)?.trim())
      .filter(Boolean) as string[];

    // Step 2 — use native MongoDB driver to bypass Mongoose 9.x CastErrors
    // (Mongoose casts operator objects like $in/$gte on string/date fields)
    const allInvoicesForPosts = await Invoice.collection
      .find(
        { isLatest: true, postId: { $in: postIdList } },
        { projection: { postId: 1, paymentStatus: 1, paymentDate: 1 } },
      )
      .toArray();

    const paidInvoices = allInvoicesForPosts.filter(
      (inv) => inv.paymentStatus === "paid" || inv.paymentStatus === "partial",
    );

    // Build a map: postId → invoice paymentDate
    const invoicePaidDateByPostId = new Map<string, Date>();
    for (const inv of paidInvoices) {
      if (inv.postId && inv.paymentDate) {
        invoicePaidDateByPostId.set(inv.postId.trim(), new Date(inv.paymentDate));
      }
    }

    // Step 3 — determine which posts are "paid" in the selected month
    // Priority: invoice paymentDate → fallback to Post.paymentDate (if paymentstatus=="done")
    type PaidPost = { postId: string; guardianName: string; monthlyBudget: number; paidVia: "invoice" | "direct" };
    const paidPosts: PaidPost[] = [];

    for (const post of adminPosts) {
      const pid = (post.postId as string | undefined)?.trim() ?? "";
      if (!pid) continue;

      // Invoice-based payment (source of truth)
      const invDate = invoicePaidDateByPostId.get(pid);
      if (invDate && invDate >= startDate && invDate < endDate) {
        paidPosts.push({
          postId: pid,
          guardianName: post.guardianName,
          monthlyBudget: Number(post.monthlyBudget) || 0,
          paidVia: "invoice",
        });
        continue;
      }

      // Fallback: direct payment recorded on the Post document
      if (post.paymentstatus === "done" && post.paymentDate) {
        const d = new Date(post.paymentDate);
        if (d >= startDate && d < endDate) {
          paidPosts.push({
            postId: pid,
            guardianName: post.guardianName,
            monthlyBudget: Number(post.monthlyBudget) || 0,
            paidVia: "direct",
          });
        }
      }
    }

    if (paidPosts.length === 0) {
      return NextResponse.json(
        { error: "No paid tuition posts found for this admin in the selected period" },
        { status: 404 },
      );
    }



    // ── Build line items ────────────────────────────────────────────────────
    const lineItems = paidPosts.map((post) => {
      const budget = Number(post.monthlyBudget) || 0;
      const payoutAmount = Math.round((budget * payoutPct) / 100 * 100) / 100;
      return {
        name: `Tuition Payout — ${post.guardianName}`,
        description: `Post ID: ${post.postId} | Budget: ₹${budget} × ${payoutPct}%`,
        quantity: 1,
        unitAmount: payoutAmount,
        total: payoutAmount,
        postDetails: { postId: post.postId as string },
      };
    });

    const subTotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    const grandTotal = Math.round(subTotal * 100) / 100;

    // ── Generate deterministic invoiceId ────────────────────────────────────
    // Format: INV-PAYOUT-[AdminShortId]-[MM]-[YYYY]
    const shortId = adminClerkId.slice(-6).toUpperCase();
    const mm = String(month).padStart(2, "0");
    const invoiceId = `INV-PAYOUT-${shortId}-${mm}-${year}`;

    // ── Month label for the invoice date line ──────────────────────────────
    const monthNames = [
      "January","February","March","April","May","June",
      "July","August","September","October","November","December",
    ];
    const periodLabel = `${monthNames[month - 1]} ${year}`;

    // ── Create or Update Invoice (Upsert) ──────────────────────────────────
    const updateData = {
      $set: {
        invoiceId,
        version: 1,
        isLatest: true,

        source: {
          name: siteConfig.name ?? "Academy of Tutorials & Freelancers",
          address: siteConfig.contact?.address?.street ?? "",
          phone: siteConfig.contact?.phone ?? "",
          email: siteConfig.contact?.email ?? "",
        },

        recipient: {
          name: targetAdmin.name,
          email: (targetAdmin as any).email ?? "",
        },

        serviceProvider: {
          name: siteConfig.name ?? "Academy of Tutorials & Freelancers",
          address: siteConfig.contact?.address?.street ?? "",
          phone: siteConfig.contact?.phone ?? "",
          websiteUrl: siteConfig.url ?? "https://www.aotf.in",
          signatureUrl: "/api/v1/admin/private-image?name=sign.png",
        },

        amount: {
          currency: "INR",
          subTotal: grandTotal,
          taxPercentage: 0,
          taxAmount: 0,
          grandTotal,
        },

        breakdown: {
          items: lineItems,
          notes: `Admin payout for ${periodLabel} at ${payoutPct}% of paid tuition monthly budgets. ${paidPosts.length} tuition(s) included.`,
        },

        paymentStatus: "unpaid",
      },
      $setOnInsert: {
        invoiceDate: new Date(),
      }
    };

    const invoice = await Invoice.findOneAndUpdate(
      { invoiceId },
      updateData,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json(
      {
        success: true,
        invoiceId: invoice.invoiceId,
        grandTotal,
        postCount: paidPosts.length,
        payoutPercentage: payoutPct,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(
      error,
      "POST /api/v1/admin/payments/generate-payout",
    );
  }
}
