import { AppLayout } from "@/components/layout/AppLayout";
import { IncomeStatement } from "@/components/finance/IncomeStatement";

export default function IncomeStatementPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <IncomeStatement />
      </div>
    </AppLayout>
  );
}
