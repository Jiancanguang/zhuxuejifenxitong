import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, LogOut, Shield, Menu, X } from 'lucide-react';
import { isAdminLoggedIn, adminLogout } from '../../services/admin';
import { useScrollLock } from '../../hooks/useMobile';

const navItems = [
  { path: '/admin', icon: LayoutDashboard, label: '仪表盘', end: true },
  { path: '/admin/users', icon: Users, label: '用户管理' },
];

export const AdminLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  useScrollLock(mobileNavOpen);

  useEffect(() => {
    if (!isAdminLoggedIn()) {
      navigate('/admin/login');
    }
  }, [navigate]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    adminLogout();
    navigate('/admin/login');
  };

  if (!isAdminLoggedIn()) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-100 md:flex safe-area-left safe-area-right">
      {/* Mobile Topbar */}
      <header className="md:hidden sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 safe-area-top">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-pink-500 to-rose-500 rounded-lg flex items-center justify-center shadow">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-800 leading-tight">管理后台</h1>
              <p className="text-[11px] text-slate-500 leading-tight">班级宠物园</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileNavOpen(prev => !prev)}
            className="touch-target-lg rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
            aria-label={mobileNavOpen ? '关闭导航' : '打开导航'}
            aria-expanded={mobileNavOpen}
          >
            {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Backdrop */}
      {mobileNavOpen && (
        <button
          type="button"
          className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]"
          onClick={() => setMobileNavOpen(false)}
          aria-label="关闭侧边导航"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col shrink-0 safe-area-top pt-[calc(env(safe-area-inset-top,0px)+0.5rem)] md:pt-0
          transition-transform duration-200
          ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="p-6 border-b border-white/10 hidden md:block">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-500 rounded-xl flex items-center justify-center shadow-lg shadow-pink-500/30">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg">管理后台</h1>
              <p className="text-xs text-slate-400">班级宠物园</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">退出登录</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-4 sm:p-6 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
