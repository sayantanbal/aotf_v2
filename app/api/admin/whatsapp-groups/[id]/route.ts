import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import WhatsAppGroupLink from "@/lib/models/WhatsAppGroupLink";
import { requirePermission } from "@/lib/admin/requirePermission";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requirePermission("whatsapp:manage")(req);
    if (access.error) return access.error;

    const { userId } = await auth();
    const body = await req.json();
    const { id } = await params;

    const updateFields: Record<string, unknown> = {};
    if (body.label !== undefined) updateFields.label = body.label;
    if (body.url !== undefined) updateFields.url = body.url;
    if (body.status !== undefined) updateFields.status = body.status;
    if (body.capacity !== undefined) updateFields.capacity = body.capacity;
    if (body.ordering !== undefined) updateFields.ordering = body.ordering;
    if (body.memberCount !== undefined) updateFields.memberCount = body.memberCount;

    updateFields.updaterClerkId = userId;

    await dbConnect();
    const updatedGroup = await WhatsAppGroupLink.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true }
    );

    if (!updatedGroup) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    return NextResponse.json(updatedGroup);
  } catch (error) {
    console.error("[whatsapp-groups-api] PATCH error:", error);
    return NextResponse.json({ error: "Failed to update WhatsApp group" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requirePermission("whatsapp:manage")(req);
    if (access.error) return access.error;

    const { id } = await params;

    await dbConnect();
    const deletedGroup = await WhatsAppGroupLink.findByIdAndDelete(id);

    if (!deletedGroup) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[whatsapp-groups-api] DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete WhatsApp group" }, { status: 500 });
  }
}
