import { handleApiError } from "@/lib/api-utils";
import { NextResponse } from "next/server";
import { startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import dbConnect from "@/lib/db";
import CalendarEvent from "@/lib/models/CalendarEvent";
import Application from "@/lib/models/Application";
import Enquiry from "@/lib/models/Enquiry";
import {
  mapApplication,
  mapEnquiry,
} from "@/lib/services/calendar-event.service";
import type { IEvent } from "@/calendar/interfaces";
import type { TEventColor } from "@/calendar/types";
import mongoose from "mongoose";

async function getEventsInRange(
  startDate: Date,
  endDate: Date,
): Promise<IEvent[]> {
  const docs = await CalendarEvent.find({
    startAt: mongoose.trusted({ $lte: endDate }),
    endAt: mongoose.trusted({ $gte: startDate }),
  })
    .sort({ startAt: 1 })
    .lean();

  const enquiryIds = docs
    .filter((doc) => doc.source.type === "enquiry")
    .map((doc) => doc.source.sourceId)
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  const applicationIds = docs
    .filter((doc) => doc.source.type === "application")
    .map((doc) => doc.source.sourceId)
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const [enquiries, applications] = await Promise.all([
    Enquiry.find({ _id: mongoose.trusted({ $in: enquiryIds }) }).lean(),
    Application.find({ _id: mongoose.trusted({ $in: applicationIds }) }).lean(),
  ]);
  const enquiryMap = new Map(
    enquiries.map((enquiry) => [String(enquiry._id), enquiry]),
  );
  const applicationMap = new Map(
    applications.map((application) => [String(application._id), application]),
  );

  return docs
    .map((doc) => {
      const sourceId = doc.source.sourceId;
      const freshSource =
        doc.source.type === "enquiry"
          ? enquiryMap.get(sourceId)
          : doc.source.type === "application"
            ? applicationMap.get(sourceId)
            : undefined;
      const freshEvent =
        doc.source.type === "enquiry" && freshSource
          ? mapEnquiry(freshSource)
          : doc.source.type === "application" && freshSource
            ? mapApplication(freshSource)
            : null;
      const rawStatus =
        doc.source.type === "enquiry" &&
        freshSource &&
        "currentStatus" in freshSource
          ? freshSource.currentStatus
          : doc.source.type === "application" &&
              freshSource &&
              "status" in freshSource
            ? freshSource.status
            : doc.rawStatus;

      return {
        doc,
        rawStatus,
        event: {
          id: doc._id.toString(),
          startDate: (freshEvent?.startAt ?? doc.startAt).toISOString(),
          endDate: (freshEvent?.startAt
            ? new Date(
                freshEvent.startAt.getTime() +
                  (freshEvent.durationMinutes ?? 60) * 60_000,
              )
            : doc.endAt
          ).toISOString(),
          title: freshEvent?.title ?? doc.title,
          color: (freshEvent?.color ?? doc.color) as TEventColor,
          description: freshEvent?.description ?? doc.description,
          user: {
            id: doc.owner.adminId ?? "system",
            name: doc.owner.adminName ?? "System",
            picturePath: null,
          },
          category: doc.category,
          sourceId,
        },
      };
    })
    .filter(
      ({ doc, rawStatus }) =>
        doc.source.type !== "application" ||
        !["applied", "decline", "auto_declined"].includes(rawStatus),
    )
    .map(({ event }) => event);
}

export async function GET(request: Request) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const monthParam = searchParams.get("month");
    const refDate = dateParam
      ? new Date(dateParam)
      : monthParam
        ? new Date(`${monthParam}-01`)
        : new Date();

    const startDate = dateParam ? startOfDay(refDate) : startOfMonth(refDate);
    const endDate = dateParam ? endOfDay(refDate) : endOfMonth(refDate);

    const events = await getEventsInRange(startDate, endDate);
    return NextResponse.json({ events });
  } catch (error) {
    return handleApiError(error, "GET /api/admin/calendar-events", {
      legacyAdminShape: true,
    });
  }
}
