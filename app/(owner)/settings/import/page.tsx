import type { Metadata } from "next";
import { PageHeader } from "@/components/owner/page-header";
import { ImportWizard } from "@/components/import/import-wizard";

export const metadata: Metadata = { title: "Import from Google Sheet" };

export default function ImportPage() {
  return (
    <>
      <PageHeader
        title="Import from the Google Sheet"
        description="Upload the CSV exports of your tabs. You review the mapping before anything is written."
      />
      <ImportWizard />
    </>
  );
}
