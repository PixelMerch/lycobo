import type { ReactNode } from "react";

/** A titled card that stacks settings rows with hairline separators, like a system settings list. */
export function SettingsGroup({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="settings-group" aria-label={title}>
      <header className="settings-group-header">
        <div>
          <h3>{title}</h3>
          {description && <p>{description}</p>}
        </div>
        {action}
      </header>
      <div className="settings-group-body">{children}</div>
    </section>
  );
}

/** One label/value line inside a group; the optional action sits on the right. */
export function SettingsRow({
  label,
  value,
  hint,
  action,
}: {
  label: string;
  value?: ReactNode;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="settings-row">
      <div className="settings-row-text">
        <span className="settings-row-label">{label}</span>
        {hint && <span className="settings-row-hint">{hint}</span>}
      </div>
      {value !== undefined && <div className="settings-row-value">{value}</div>}
      {action && <div className="settings-row-action">{action}</div>}
    </div>
  );
}
