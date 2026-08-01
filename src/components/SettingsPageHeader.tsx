import type { ReactNode } from "react";

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
          <SettingsPageHeaderBadge tone={badgeTone}>
            {badge}
          </SettingsPageHeaderBadge>
        </div>
      )}
    </header>
  );
}

export function SettingsPageHeaderBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "experimental";
}) {
  return (
    <span className={`settings-page-header-badge ${tone}`}>{children}</span>
  );
}
