import { Plus, X } from "lucide-react";
import { useState } from "react";
import { useLocation } from "react-router-dom";
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
    window.dispatchEvent(new CustomEvent("fab-action", { detail: action }));
  };

  return (
    <div className="fab-position">
      {open && (
        <div className="flex flex-col gap-2.5 mb-3 items-end">
          {actions.map((a, i) => (
            <button
              key={a.action}
              onClick={() => handleAction(a.action)}
              className="flex items-center gap-2.5 rounded-2xl bg-card px-5 py-3 text-sm font-medium shadow-float-hover border-0 hover:shadow-soft-xl transition-all duration-200 animate-fab-pop"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "h-14 w-14 rounded-2xl flex items-center justify-center shadow-float-hover transition-all duration-250",
          open
            ? "bg-muted text-muted-foreground rotate-45 shadow-float"
            : "bg-primary text-primary-foreground hover:shadow-soft-xl hover:-translate-y-0.5"
        )}
      >
        {open ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
      </button>
    </div>
  );
}
