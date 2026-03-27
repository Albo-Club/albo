import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface RunStatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

export function RunStatusBadge({ status, size = "md" }: RunStatusBadgeProps) {
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  switch (status) {
    case "success":
      return <CheckCircle2 className={`${iconSize} text-green-500 shrink-0`} />;
    case "error":
      return <XCircle className={`${iconSize} text-red-500 shrink-0`} />;
    case "warn":
      return <AlertCircle className={`${iconSize} text-amber-500 shrink-0`} />;
    default:
      return <AlertCircle className={`${iconSize} text-muted-foreground shrink-0`} />;
  }
}
