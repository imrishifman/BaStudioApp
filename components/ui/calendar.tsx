"use client"

import * as React from "react"
import { DayPicker } from "react-day-picker"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight } from "lucide-react"

type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-2",
        month: "flex flex-col gap-4",
        caption_label: "body-sm font-medium text-[var(--ink-1)]",
        day_button: "h-8 w-8 mx-auto p-0 body-sm rounded-full transition-colors hover:bg-[var(--bg-3)] flex items-center justify-center",
        selected: "bg-[var(--ink-1)] text-[var(--bg-0)] rounded-full",
        today: "text-[var(--accent-violet)] font-semibold",
        outside: "opacity-30",
        disabled: "opacity-30 cursor-not-allowed",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? <ChevronLeft size={14} /> : <ChevronRight size={14} />,
      }}
      {...props}
    />
  )
}

Calendar.displayName = "Calendar"

export { Calendar }
