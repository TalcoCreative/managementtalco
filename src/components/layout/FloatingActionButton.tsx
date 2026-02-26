import { Plus, X } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const contextActions: Record<string, { label: string; action: string }[]> = {
  "/tasks": [{ label: "New Task", action: "create-task" }],
  "/projects": [{ label: "New Project", action: "create-project" }],
  "/meeting": [{ label: "New Meeting", action: "create-meeting" }],
  "/shooting": [{ label: "New Shooting", action: "create-shooting" }],
  "/finance": [{ label: "New Entry", action: "create-finance" }],
  "/recruitment": [{ label: "New Candidate", action: "create-candidate" }],
  "/forms": [{ label: "New Form", action: "create-form" }],
  "/event": [{ label: "New Event", action: "create-event" }],
  "/clients": [{ label: "New Client", action: "create-client" }],
  "/asset": [{ label: "New Asset", action: "create-asset" }],
  "/leave": [{ label: "New Leave", action: "create-leave" }],
  "/letters": [{ label: "New Letter", action: "create-letter" }],
};

export function FloatingActionButton() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const actions = contextActions[location.pathname] || [];

  if (actions.length === 0) return null;

  const handleAction = (action: string) => {
    setOpen(false);
    // Dispatch a custom event that pages can listen to
    window.dispatchEvent(new CustomEvent("fab-action", { detail: action }));
  };

  return (
    <div className="fab-position">
      {open && (
        <div className="flex flex-col gap-2 mb-3 items-end animate-fade-in">
          {actions.map((a) => (
            <button
              key={a.action}
              onClick={() => handleAction(a.action)}
              className="flex items-center gap-2 rounded-full bg-card px-4 py-2.5 text-sm font-medium shadow-soft-lg border border-border/30 hover:bg-accent transition-colors"
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "h-14 w-14 rounded-full flex items-center justify-center shadow-soft-lg transition-all duration-200",
          open
            ? "bg-muted text-muted-foreground rotate-45"
            : "bg-primary text-primary-foreground"
        )}
      >
        {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </button>
    </div>
  );
}
