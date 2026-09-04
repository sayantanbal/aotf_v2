import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import WhatsAppGroupLink from "@/lib/models/WhatsAppGroupLink";
import { requirePermission } from "@/lib/admin/requirePermission";

export async function GET(req: Request) {
  try {
    const access = await requirePermission("whatsapp:manage")(req);
    if (access.error) return access.error;

    await dbConnect();
    const groups = await WhatsAppGroupLink.find().sort({
      ordering: 1,
      createdAt: -1,
    });
    return NextResponse.json(groups);
  } catch (error) {
    console.error("[whatsapp-groups-api] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch WhatsApp groups" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const access = await requirePermission("whatsapp:manage")(req);
    if (access.error) return access.error;

    const { userId } = await auth();
    const body = await req.json();

    const { label, url, status, capacity, ordering } = body as {
      label: string;
      url: string;
      status?: "active" | "inactive" | "full" | "archived" | "custom";
      capacity?: number;
      ordering?: number;
    };

    if (!label || !url) {
      return NextResponse.json(
        { error: "Label and URL are required" },
        { status: 400 },
      );
    }

    await dbConnect();
    const newGroup = await WhatsAppGroupLink.create({
      label,
      url,
      status: status || "active",
      capacity: capacity || 1024,
      ordering: ordering || 0,
      creatorClerkId: userId,
    });

    return NextResponse.json(newGroup, { status: 201 });
  } catch (error) {
    console.error("[whatsapp-groups-api] POST error:", error);
    return NextResponse.json(
      { error: "Failed to create WhatsApp group" },
      { status: 500 },
    );
  }
}
