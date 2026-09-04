/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DesktopTable } from "@/components/SharedScheduleView/DesktopTable";
import type { ScheduleDateInfo, ScheduleEntry } from "@/components/SharedScheduleView/types";

const roleOrder = [
  { id: 1, name: "Guitarra" },
  { id: 2, name: "Bajo" },
];

const entries: ScheduleEntry[] = [
  { id: 1, date: "2026-09-01", roleId: 1, memberId: 101, memberName: "Ana", roleName: "Guitarra" },
  { id: 2, date: "2026-09-01", roleId: 2, memberId: 102, memberName: "Beto", roleName: "Bajo" },
  { id: 3, date: "2026-09-01", roleId: 2, memberId: 103, memberName: "Carla", roleName: "Bajo" },
  { id: 4, date: "2026-09-08", roleId: 1, memberId: 104, memberName: "Diana", roleName: "Guitarra" },
];

const scheduleDates = new Map<string, ScheduleDateInfo>([
  ["2026-09-01", { date: "2026-09-01", type: "assignable" }],
  ["2026-09-08", { date: "2026-09-08", type: "assignable" }],
  ["2026-09-15", { date: "2026-09-15", type: "for_everyone", label: "Retiro" }],
]);

function renderTable(overrides: Partial<React.ComponentProps<typeof DesktopTable>> = {}) {
  return render(
    <DesktopTable
      datesByWeek={[
        { weekNumber: 1, dates: ["2026-09-01", "2026-09-08"] },
        { weekNumber: 2, dates: ["2026-09-15"] },
      ]}
      roleOrder={roleOrder}
      filteredRoleId={null}
      filteredMemberId={null}
      entries={entries}
      scheduleDateByDateMap={scheduleDates}
      forEveryoneSet={new Set(["2026-09-15"])}
      collapsedWeeks={new Set()}
      toggleWeek={() => {}}
      weekDateRangeLabel={(w) => `Semana ${w}`}
      desktopContainerWidth={1400}
      getDateDisplayLabel={(sd) => sd.label ?? ""}
      hasConflict={() => false}
      isPast={() => false}
      t={(key) => key}
      {...overrides}
    />
  );
}

describe("schedule table", () => {
  it("shows every member assigned to a role on a date", () => {
    renderTable();
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("Beto")).toBeInTheDocument();
    expect(screen.getByText("Carla")).toBeInTheDocument();
    expect(screen.getByText("Diana")).toBeInTheDocument();
  });

  it("shows only the filtered role's assignments", () => {
    renderTable({ filteredRoleId: 2 });
    expect(screen.getByText("Beto")).toBeInTheDocument();
    expect(screen.queryByText("Ana")).not.toBeInTheDocument();
    expect(screen.queryByText("Diana")).not.toBeInTheDocument();
  });

  it("labels a for-everyone date instead of listing roles", () => {
    renderTable();
    expect(screen.getByText("Retiro")).toBeInTheDocument();
  });

  it("hides the dates of a collapsed week", () => {
    renderTable({ collapsedWeeks: new Set([1]) });
    expect(screen.queryByText("Ana")).not.toBeInTheDocument();
    expect(screen.getByText("Retiro")).toBeInTheDocument();
  });

  it("renders assignments in the narrow card layout too", () => {
    renderTable({ desktopContainerWidth: 600 });
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("Carla")).toBeInTheDocument();
  });
});
