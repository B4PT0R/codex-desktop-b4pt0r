import type {
  ButtonHTMLAttributes,
  ComponentType,
  ReactNode,
} from "react";
import { IconButton } from "./IconButton";

export function SettingsControlsBar({
  actions,
  label,
  status,
}: {
  actions: ReactNode;
  label?: ReactNode;
  status?: ReactNode;
}) {
  return (
    <div className="settings-controls-bar">
      <div className="settings-controls-bar-summary">
        {label && <strong>{label}</strong>}
        {status && <span>{status}</span>}
      </div>
      <div className="settings-controls-bar-actions">{actions}</div>
    </div>
  );
}

export function SettingsControlsBarButton({
  children,
  icon: Icon,
  iconClassName,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ComponentType<{ className?: string }>;
  iconClassName?: string;
}) {
  return (
    <IconButton
      className="settings-controls-bar-button"
      icon={Icon}
      iconClassName={iconClassName}
      label={children}
      size="medium"
      type={type}
      variant="tertiary"
      {...props}
    />
  );
}
