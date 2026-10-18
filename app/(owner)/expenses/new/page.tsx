import type { Metadata } from "next";
import { PageHeader } from "@/components/owner/page-header";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { localDate } from "@/lib/tz";
import { createExpense } from "../actions";

export const metadata: Metadata = { title: "Add expense" };

export default async function NewExpensePage({ searchParams }: PageProps<"/expenses/new">) {
  const sp = await searchParams;
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : localDate(new Date());
  return (
    <>
      <PageHeader title="Add expense" />
      <ExpenseForm action={createExpense} defaultDate={date} cancelHref="/expenses" />
    </>
  );
}
