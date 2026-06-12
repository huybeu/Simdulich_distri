import type { PropsWithChildren, ReactNode } from "react";

type SectionProps = PropsWithChildren<{
  /** Optional DOM id (e.g. link từ bên ngoài). */
  id?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}>;

export function Section({ id, title, subtitle, actions, children }: SectionProps) {
  return (
    <section id={id} className="panel">
      <header className="panel__header">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p className="muted">{subtitle}</p> : null}
        </div>
        {actions}
      </header>
      <div className="panel__body">{children}</div>
    </section>
  );
}
