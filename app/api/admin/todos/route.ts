import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import dbConnect from "@/lib/db";
import TodoEvent from "@/lib/models/TodoEvent";
import Admin from "@/lib/models/Admin";

export async function POST(req: Request) {
  try {
    await dbConnect();
    
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await Admin.findOne({ clerkId: userId });
    if (!admin || admin.isActive === false) {
      return NextResponse.json({ error: "Forbidden: admin not active" }, { status: 403 });
    }

    const body = await req.json();
    
    if (!body.title || !body.category || !body.status || !body.dueAt) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const todo = new TodoEvent(body);
    await todo.save();

    return NextResponse.json({ success: true, todo });
  } catch (error: any) {
    console.error("POST /api/admin/todos error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
