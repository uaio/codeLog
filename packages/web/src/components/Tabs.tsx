import { CSSProperties, ReactNode, useRef } from 'react';

export interface Tab {
  id: string;
  label: string;
  icon: string;
  content: ReactNode;
  badge?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  const activeTabData = tabs.find((t) => t.id === activeTab);
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div style={styles.container}>
      <div style={styles.tabBar}>
        <div ref={scrollRef} style={styles.tabList}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onChange(tab.id)}
                style={{
                  ...styles.tab,
                  ...(isActive ? styles.tabActive : styles.tabInactive),
                }}
              >
                <span style={styles.tabIcon}>{tab.icon}</span>
                <span style={styles.tabLabel}>{tab.label}</span>
                {tab.badge != null && tab.badge > 0 && !isActive && (
                  <span style={styles.badge}>{tab.badge > 99 ? '99+' : tab.badge}</span>
                )}
                {isActive && <span style={styles.tabActiveBar} />}
              </button>
            );
          })}
        </div>
      </div>
      <div style={styles.tabContent}>{activeTabData?.content}</div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    border: '1px solid #e2e8f0',
  },
  tabBar: {
    borderBottom: '1px solid #e2e8f0',
    backgroundColor: '#f8fafc',
    flexShrink: 0,
  },
  tabList: {
    display: 'flex',
    overflowX: 'auto',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
    gap: '2px',
    padding: '0 8px',
  },
  tab: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '10px 14px',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    transition: 'color 0.15s, background 0.15s',
    borderRadius: '6px 6px 0 0',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  tabActive: {
    color: '#4f46e5',
    backgroundColor: '#ffffff',
  },
  tabInactive: {
    color: '#64748b',
  },
  tabIcon: {
    fontSize: '14px',
    lineHeight: 1,
  },
  tabLabel: {
    fontSize: '13px',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '16px',
    height: '16px',
    padding: '0 4px',
    borderRadius: '8px',
    backgroundColor: '#ef4444',
    color: '#fff',
    fontSize: '10px',
    fontWeight: 700,
    lineHeight: 1,
    marginLeft: '2px',
  },
  tabActiveBar: {
    position: 'absolute',
    bottom: '-1px',
    left: '8px',
    right: '8px',
    height: '2px',
    backgroundColor: '#4f46e5',
    borderRadius: '2px 2px 0 0',
  },
  tabContent: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
};
