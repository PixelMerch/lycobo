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

/** 分组里的一行：左侧标签与说明，右侧值或操作；传 children 时内容排在标签下方，占满整行。 */
export function SettingsRow({
  label,
  value,
  hint,
  action,
  children,
}: {
  label: string;
  value?: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className={children ? "settings-row settings-row--stacked" : "settings-row"}>
      <div className="settings-row-text">
        <span className="settings-row-label">{label}</span>
        {hint && <span className="settings-row-hint">{hint}</span>}
      </div>
      {value !== undefined && <div className="settings-row-value">{value}</div>}
      {action && <div className="settings-row-action">{action}</div>}
      {children}
    </div>
  );
}
