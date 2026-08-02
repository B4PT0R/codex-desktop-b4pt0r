import type { ReactNode } from "react";
import { Badge } from "./Badge";

export function SettingsPageHeader({
  badge,
  badgeTone = "neutral",
  description,
}: {
  badge?: ReactNode;
  badgeTone?: "neutral" | "experimental";
  description: ReactNode;
}) {
  return (
    <header className="settings-page-header">
      <p className="settings-page-header-description">{description}</p>
      {badge && (
        <div className="settings-page-header-trailing">
          <Badge label={badge} tone={badgeTone} />
        </div>
      )}
    </header>
  );
}
