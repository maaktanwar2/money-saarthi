// Page Layout Component - Main layout wrapper
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import MobileNav from './MobileNav';
import { cn, storage } from '../lib/utils';

export const PageLayout = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => storage.get('sidebarCollapsed', false)
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Sync sidebar state via custom event (no polling)
  useEffect(() => {
    const handleStorageChange = () => {
      setSidebarCollapsed(storage.get('sidebarCollapsed', false));
    };
    const handleSidebarToggle = (e) => {
      setSidebarCollapsed(e.detail.collapsed);
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('sidebarToggle', handleSidebarToggle);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('sidebarToggle', handleSidebarToggle);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar - Desktop */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 z-50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <motion.div
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            onClick={(e) => e.stopPropagation()}
          >
            <Sidebar />
          </motion.div>
        </motion.div>
      )}

      {/* Main Content */}
      <main
        className={cn(
          'min-h-screen transition-all duration-300',
          sidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-64'
        )}
      >
        <Header onMenuClick={() => setMobileMenuOpen(true)} />
        
        <div className="p-6 pb-24 lg:pb-6">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileNav onMoreClick={() => setMobileMenuOpen(true)} />
    </div>
  );
};

// Page Header Component
export const PageHeader = ({ 
  title, 
  description, 
  badge,
  accuracy,
  trades,
  actions,
  breadcrumbs = []
}) => (
  <div className="mb-8">
    {/* Breadcrumbs */}
    {breadcrumbs.length > 0 && (
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-2">
            {i > 0 && <span>/</span>}
            {crumb.link ? (
              <a href={crumb.link} className="hover:text-foreground transition-colors">
                {crumb.label}
              </a>
            ) : (
              <span className="text-foreground">{crumb.label}</span>
            )}
          </span>
        ))}
      </div>
    )}

    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">{title}</h1>
          {badge && (
            <span className={cn(
              'px-2 py-0.5 text-xs font-semibold rounded',
              badge === 'AI' && 'bg-violet-500/20 text-violet-400',
              badge === 'Pro' && 'bg-amber-500/20 text-amber-400',
              badge === 'New' && 'bg-primary/20 text-primary',
              !['AI', 'Pro', 'New'].includes(badge) && 'bg-secondary text-secondary-foreground'
            )}>
              {badge}
            </span>
          )}
        </div>
        {description && (
          <p className="text-muted-foreground mt-1">{description}</p>
        )}
        
        {/* Accuracy Stats */}
        {(accuracy !== undefined || trades !== undefined) && (
          <div className="flex items-center gap-4 mt-3">
            {accuracy !== undefined && (
              <div className="flex items-center gap-2">
                <div className={cn(
                  'w-2 h-2 rounded-full',
                  accuracy >= 70 ? 'bg-bullish' : accuracy >= 50 ? 'bg-amber-500' : 'bg-bearish'
                )} />
                <span className="text-sm">
                  <span className="font-semibold">{accuracy}%</span>
                  <span className="text-muted-foreground ml-1">Accuracy</span>
                </span>
              </div>
            )}
            {trades !== undefined && (
              <span className="text-sm text-muted-foreground">
                {trades.toLocaleString()} backtested trades
              </span>
            )}
          </div>
        )}
      </div>
      
      {actions && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  </div>
);

// Section Component
export const Section = ({ title, description, children, className, action }) => (
  <section className={cn('mb-8', className)}>
    {(title || action) && (
      <div className="flex items-center justify-between mb-4">
        <div>
          {title && <h2 className="text-xl font-semibold">{title}</h2>}
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        {action}
      </div>
    )}
    {children}
  </section>
);

export default PageLayout;
