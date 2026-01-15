import { AppLayout } from "@/components/layout/AppLayout";
import { BalanceSheet } from "@/components/finance/BalanceSheet";

export default function BalanceSheetPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <BalanceSheet />
      </div>
    </AppLayout>
  );
}
