"use client";

import { parseISO } from "date-fns";
import { useForm } from "react-hook-form";
import { AlertTriangle } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { cloneElement, isValidElement, ReactElement } from "react";

import { useDisclosure } from "@/hooks/use-disclosure";
import { useCalendar } from "@/calendar/contexts/calendar-context";
import { useUpdateEvent } from "@/calendar/hooks/use-update-event";

import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Textarea } from "@heroui/input";
import { DatePicker } from "@heroui/date-picker";
import { Select, SelectItem } from "@heroui/select";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { Avatar } from "@heroui/avatar";

import { CalendarDate } from "@internationalized/date";

import { eventSchema } from "@/calendar/schemas";
import type { IEvent } from "@/calendar/interfaces";
import type { TEventFormData } from "@/calendar/schemas";

interface IProps {
  children: React.ReactNode;
  event: IEvent;
}

export function EditEventDialog({ children, event }: IProps) {
  const { isOpen, onClose, onToggle } = useDisclosure();
  const { users } = useCalendar();
  const { updateEvent } = useUpdateEvent();
  type DatePickerValue = React.ComponentProps<typeof DatePicker>["value"];

  const form = useForm<TEventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      user: event.user.id,
      title: event.title,
      description: event.description,
      startDate: parseISO(event.startDate),
      startTime: {
        hour: parseISO(event.startDate).getHours(),
        minute: parseISO(event.startDate).getMinutes(),
      },
      endDate: parseISO(event.endDate),
      endTime: {
        hour: parseISO(event.endDate).getHours(),
        minute: parseISO(event.endDate).getMinutes(),
      },
      color: event.color,
    },
  });

  const onSubmit = (values: TEventFormData) => {
    const user = users.find((u) => u.id === values.user);
    if (!user) throw new Error("User not found");

    const start = new Date(values.startDate);
    start.setHours(values.startTime.hour, values.startTime.minute);

    const end = new Date(values.endDate);
    end.setHours(values.endTime.hour, values.endTime.minute);

    updateEvent({
      ...event,
      user,
      title: values.title,
      description: values.description,
      color: values.color,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    });

    onClose();
  };

  // ✅ FIXED TRIGGER
  const trigger = isValidElement(children)
    ? cloneElement(children as ReactElement<any>, {
        onClick: (e: any) => {
          (children as ReactElement<any>).props?.onClick?.(e);
          onToggle();
        },
        ...(typeof children.type !== "string"
          ? {
              onPress: (e: any) => {
                (children as ReactElement<any>).props?.onPress?.(e);
                onToggle();
              },
            }
          : {}),
      })
    : children;

  return (
    <>
      {trigger}

      <Modal isOpen={isOpen} onOpenChange={onToggle} placement="top">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Edit Event</ModalHeader>

              <ModalBody>
                <form
                  id="event-form"
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="grid gap-4 py-4"
                >
                  {/* USER */}
                  <Select
                    label="Responsible"
                    selectedKeys={
                      form.watch("user") ? [form.watch("user")] : []
                    }
                    onSelectionChange={(keys) => {
                      const value = Array.from(keys)[0] as string;
                      form.setValue("user", value);
                    }}
                    isInvalid={!!form.formState.errors.user}
                    errorMessage={form.formState.errors.user?.message}
                  >
                    {users.map((user) => (
                      <SelectItem key={user.id} textValue={user.name ?? "User"}>
                        <div className="flex items-center gap-2">
                          <Avatar
                            src={user.picturePath ?? undefined}
                            name={user.name ?? "User"}
                            className="size-6"
                          />
                          {user.name}
                        </div>
                      </SelectItem>
                    ))}
                  </Select>

                  {/* TITLE */}
                  <Input
                    label="Title"
                    {...form.register("title")}
                    isInvalid={!!form.formState.errors.title}
                    errorMessage={form.formState.errors.title?.message}
                  />

                  {/* START DATE */}
                  <DatePicker
                    label="Start date"
                    value={
                      form.watch("startDate")
                        ? (new CalendarDate(
                            form.watch("startDate").getFullYear(),
                            form.watch("startDate").getMonth() + 1,
                            form.watch("startDate").getDate(),
                          ) as unknown as DatePickerValue)
                        : null
                    }
                    onChange={(val) => {
                      if (!val) return;
                      const date = val as CalendarDate;
                      form.setValue(
                        "startDate",
                        new Date(date.year, date.month - 1, date.day),
                      );
                    }}
                  />

                  {/* START TIME */}
                  <Input
                    label="Start time"
                    type="time"
                    value={
                      form.watch("startTime")
                        ? `${String(form.watch("startTime").hour).padStart(2, "0")}:${String(
                            form.watch("startTime").minute,
                          ).padStart(2, "0")}`
                        : ""
                    }
                    onChange={(e) => {
                      const [h, m] = e.target.value.split(":").map(Number);
                      form.setValue("startTime", { hour: h, minute: m });
                    }}
                  />

                  {/* END DATE */}
                  <DatePicker
                    label="End date"
                    value={
                      form.watch("endDate")
                        ? (new CalendarDate(
                            form.watch("endDate").getFullYear(),
                            form.watch("endDate").getMonth() + 1,
                            form.watch("endDate").getDate(),
                          ) as unknown as DatePickerValue)
                        : null
                    }
                    onChange={(val) => {
                      if (!val) return;
                      const date = val as CalendarDate;
                      form.setValue(
                        "endDate",
                        new Date(date.year, date.month - 1, date.day),
                      );
                    }}
                  />

                  {/* END TIME */}
                  <Input
                    label="End time"
                    type="time"
                    value={
                      form.watch("endTime")
                        ? `${String(form.watch("endTime").hour).padStart(2, "0")}:${String(
                            form.watch("endTime").minute,
                          ).padStart(2, "0")}`
                        : ""
                    }
                    onChange={(e) => {
                      const [h, m] = e.target.value.split(":").map(Number);
                      form.setValue("endTime", { hour: h, minute: m });
                    }}
                  />

                  {/* COLOR */}
                  <Select
                    label="Color"
                    selectedKeys={
                      form.watch("color") ? [form.watch("color")] : []
                    }
                    onSelectionChange={(keys) => {
                      const value = Array.from(
                        keys,
                      )[0] as TEventFormData["color"];
                      form.setValue("color", value);
                    }}
                  >
                    {[
                      "blue",
                      "green",
                      "red",
                      "yellow",
                      "purple",
                      "orange",
                      "gray",
                    ].map((c) => (
                      <SelectItem key={c}>{c}</SelectItem>
                    ))}
                  </Select>

                  {/* DESCRIPTION */}
                  <Textarea
                    label="Description"
                    {...form.register("description")}
                  />
                </form>
              </ModalBody>

              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  Cancel
                </Button>

                <Button form="event-form" type="submit">
                  Save changes
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
