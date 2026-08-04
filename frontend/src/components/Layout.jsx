import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { currentUser, logout } from '../auth';

/**
 * App shell: topbar with app name + user, sidebar with the user's projects,
 * and the routed content below.
 */
export default function Layout() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const user = currentUser();

  useEffect(() => {
    let active = true;
    api.get('/projects')
      .then((data) => { if (active) setProjects(Array.isArray(data) ? data : []); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark">◇</span>
          <span>Workflow</span>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            All Projects
          </NavLink>

          <div className="nav-section-title">Projects</div>
          {loading && <div className="nav-muted">Loading…</div>}
          {!loading && projects.length === 0 && (
            <div className="nav-muted">No projects yet</div>
          )}
          {projects.map((p) => (
            <NavLink
              key={p.id}
              to={`/projects/${p.id}`}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              {p.name}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          {user && (
            <div className="user-chip">
              <div className="user-avatar">{user.name?.[0]?.toUpperCase() || '?'}</div>
              <div className="user-meta">
                <div className="user-name">{user.name || 'User'}</div>
                <div className="user-email">{user.email}</div>
              </div>
            </div>
          )}
          <button className="btn btn-ghost btn-block" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
