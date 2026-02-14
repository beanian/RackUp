import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Home', icon: '⬤' },
  { to: '/camera', label: 'Camera', icon: '⬤' },
  { to: '/players', label: 'Players', icon: '⬤' },
  { to: '/history', label: 'History', icon: '⬤' },
  { to: '/recordings', label: 'Recordings', icon: '⬤' },
  { to: '/stats', label: 'Stats', icon: '⬤' },
];

export default function Layout() {
  return (
    <div className="flex flex-col h-full bg-board-dark">
      {/* Wood frame wrapper */}
      <div
        className="flex flex-col flex-1 overflow-hidden mx-1.5 mt-1.5 xl:mx-3 xl:mt-3 2xl:mx-4 2xl:mt-4 border-[6px] xl:border-[10px] 2xl:border-[14px] border-trim border-b-0 rounded-t-lg xl:rounded-t-xl"
        style={{
          boxShadow:
            `inset 0 2px 8px rgba(0,0,0,0.5), 0 0 0 1px var(--color-frame-shadow)`,
        }}
      >
        {/* Main content */}
        <main className="flex-1 min-h-0 overflow-y-auto px-4 pt-4 xl:px-8 xl:pt-8 2xl:px-10 2xl:pt-10">
          <Outlet />
        </main>

        {/* Bottom navigation — wood trim bar */}
        <nav className="flex-shrink-0 panel-wood !rounded-none border-t-2 xl:border-t-3 border-trim-light">
          <div className="flex justify-around">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `btn-press flex-1 py-4 xl:py-6 2xl:py-8 text-center font-bold text-lg xl:text-2xl 2xl:text-3xl tracking-wide transition-colors ${
                    isActive
                      ? 'text-gold bg-trim-light/30'
                      : 'text-chalk-dim hover:text-chalk active:text-chalk'
                  }`
                }
              >
                <span className="font-display">{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
