export default function Sidebar({ title, items, activeSection, onSelect }) { // Sidebar navigation component.
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <img src="/EMS-icon.png" alt="EMS logo" />
        </div>
        <div className="sidebar-title">{title}</div>
      </div>
      <nav className="nav-list">
        {items.map((item) => (
          <div
            key={item.id}
            className={`nav-item ${activeSection === item.id ? 'active' : ''}`}
            data-section={item.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(item.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect(item.id);
              }
            }}
          >
            {item.label}
          </div>
        ))}
      </nav>
    </aside>
  );
}

