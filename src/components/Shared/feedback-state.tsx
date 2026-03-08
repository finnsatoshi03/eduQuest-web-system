import { AlertTriangle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

type FeedbackStateVariant = "empty" | "error";

interface FeedbackAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "secondary" | "outline" | "destructive";
}

interface FeedbackStateProps {
  title: string;
  description?: string;
  variant?: FeedbackStateVariant;
  actions?: FeedbackAction[];
  className?: string;
}

export default function FeedbackState({
  title,
  description,
  variant = "empty",
  actions = [],
  className = "",
}: FeedbackStateProps) {
  const Icon = variant === "error" ? AlertTriangle : Inbox;
  const iconColor =
    variant === "error"
      ? "text-red-600 dark:text-red-400"
      : "text-zinc-500 dark:text-zinc-400";

  return (
    <div
      className={`flex min-h-[220px] w-full flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center dark:border-zinc-700 dark:bg-zinc-900 ${className}`}
    >
      <Icon className={`mb-3 size-9 ${iconColor}`} />
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && (
        <p className="mt-1 max-w-xl text-sm text-zinc-600 dark:text-zinc-300">
          {description}
        </p>
      )}
      {actions.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {actions.map((action) => (
            <Button
              key={action.label}
              type="button"
              variant={action.variant ?? "outline"}
              onClick={action.onClick}
              className="text-xs"
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
