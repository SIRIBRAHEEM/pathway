// Small shadcn-style primitives for Pathway: copy-paste components owned
// by this project, styled once in src/index.css and reused everywhere.
// Icons come from Lucide (lucide-react).

export function Button({ variant = '', block = false, size = '', className = '', ...props }) {
  const classes = ['btn', variant, block ? 'btn-full' : '', size, className].filter(Boolean).join(' ');
  return <button className={classes} {...props} />;
}

export function Badge({ tone = '', className = '', ...props }) {
  return <span className={['badge', tone, className].filter(Boolean).join(' ')} {...props} />;
}

export function StatChip({ value, label }) {
  return (
    <span className="stat-chip">
      <strong>{value}</strong> {label}
    </span>
  );
}

export function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Input({ className = '', ...props }) {
  return <input className={['input', className].filter(Boolean).join(' ')} {...props} />;
}

export function Select({ className = '', ...props }) {
  return <select className={['select', className].filter(Boolean).join(' ')} {...props} />;
}

export function Textarea({ className = '', ...props }) {
  return <textarea className={['textarea', className].filter(Boolean).join(' ')} {...props} />;
}

export function Progress({ percent }) {
  return (
    <div className="progress-track" role="progressbar" aria-valuenow={percent} aria-valuemin="0" aria-valuemax="100">
      <div className="progress-fill" style={{ width: `${percent}%` }} />
    </div>
  );
}

export function EmptyState({ icon: Icon, children }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={19} strokeWidth={1.9} />
      </span>
      <p>{children}</p>
    </div>
  );
}

export function SectionLabel({ icon: Icon, children }) {
  return (
    <h3 className="section-label">
      {Icon && <Icon size={13} strokeWidth={2.2} />}
      {children}
    </h3>
  );
}
