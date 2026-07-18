import type { ReactNode } from "react";

export type StatusTone = "neutral" | "success" | "warning" | "danger";

export type StatusCardProps = {
  title: string;
  value: ReactNode;
  description?: string;
  icon?: ReactNode;
  tone?: StatusTone;
  footer?: ReactNode;
};

export default function StatusCard({
  title,
  value,
  description,
  icon,
  tone = "neutral",
  footer
}: StatusCardProps) {
  return (
    <article className={`status-card status-card--${tone}`}>
      <header className="status-card__header">
        <div>
          <p className="status-card__title">{title}</p>
          <div className="status-card__value">{value}</div>
        </div>
        {icon ? <div className="status-card__icon">{icon}</div> : null}
      </header>

      {description ? (
        <p className="status-card__description">{description}</p>
      ) : null}

      {footer ? <footer className="status-card__footer">{footer}</footer> : null}
    </article>
  );
}
