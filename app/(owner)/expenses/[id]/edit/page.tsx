import { notFound } from "next/navigation";
import { PageHeader } from "@/components/owner/page-header";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { createClient } from "@/lib/supabase/server";
import { updateExpense } from "../../actions";

export default async function EditExpensePage({ params }: PageProps<"/expenses/[id]/edit">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: expense } = await supabase.from("expenses").select("*").eq("id", id).maybeSingle();
  if (!expense) notFound();
  return (
    <>
      <PageHeader title={`Edit ${expense.name}`} />
      <ExpenseForm
        action={updateExpense.bind(null, expense.id)}
        expense={expense}
        defaultDate={expense.paid_at}
        cancelHref={`/expenses?month=${expense.paid_at.slice(0, 7)}`}
      />
    </>
  );
}
