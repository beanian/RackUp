import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col h-full">
      {/* App header */}
      <header className="shrink-0 panel-wood px-4 py-2.5 text-center border-b border-trim-light/30">
        <h1 className="font-display text-2xl text-gold glow-gold tracking-wide">
          The Cueman's Arch
        </h1>
      </header>

      {/* Scrollable content area */}
      <main className="flex-1 overflow-y-auto px-3 pt-3 pb-20">
        {children}
      </main>

      {/* Bottom tab navigation */}
      <nav className="fixed bottom-0 inset-x-0 z-50 panel-wood border-t border-trim-light/30">
        <div className="flex">
          <TabLink to="/" icon="&#127968;" label="Dashboard" />
          <TabLink to="/leaderboard" icon="&#127942;" label="Leaderboard" />
          <TabLink to="/players" icon="&#128100;" label="Players" />
          <TabLink to="/history" icon="&#128197;" label="History" />
        </div>
        {/* Safe area inset for notched phones */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    </div>
  );
}

function TabLink({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `btn-press flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors ${
          isActive ? 'text-gold' : 'text-chalk-dim'
        }`
      }
    >
      <span className="text-xl" dangerouslySetInnerHTML={{ __html: icon }} />
      <span className="text-[11px] font-bold tracking-wide">{label}</span>
    </NavLink>
  );
}
