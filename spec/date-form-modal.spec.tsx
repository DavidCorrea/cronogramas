/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DateFormModal } from "@/app/(app)/[slug]/config/schedules/[id]/DateFormModal";

const noop = () => {};
const translate = (key: string) => key;

function renderEditModal(overrides: { open: boolean; originalDate: string; date: string }) {
  return render(
    <DateFormModal
      mode="edit"
      minDate="2026-10-01"
      maxDate="2026-10-31"
      startUtc=""
      endUtc=""
      note=""
      dateLabel=""
      saving={false}
      onDateChange={noop}
      onStartChange={noop}
      onEndChange={noop}
      onNoteChange={noop}
      onDateLabelChange={noop}
      onSave={noop}
      onClose={noop}
      onDelete={noop}
      t={translate}
      tCommon={translate}
      {...overrides}
    />
  );
}

describe("DateFormModal in edit mode", () => {
  it("renders while closed with no date selected yet", () => {
    expect(() => renderEditModal({ open: false, originalDate: "", date: "" })).not.toThrow();
  });

  it("describes the date being edited once opened", () => {
    renderEditModal({ open: true, originalDate: "2026-10-04", date: "" });
    expect(screen.getByText("Domingo, 4")).toBeInTheDocument();
  });
});
