import { AppLayout } from "@/components/layout/AppLayout";
import { ChatPanel } from "@/components/chat/ChatPanel";

export default function Chat() {
  return (
    <AppLayout>
      <div className="h-[calc(100dvh-7.5rem)] min-h-[620px]">
        <ChatPanel embedded className="h-full w-full" />
      </div>
    </AppLayout>
  );
}