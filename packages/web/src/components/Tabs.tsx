import { CSSProperties, ReactNode } from 'react';

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

  return (
    <div style={styles.container}>
      <div style={styles.tabList}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.tabActive : styles.tabInactive),
            }}
          >
            <span style={styles.tabIcon}>{tab.icon}</span>
            <span style={styles.tabLabel}>{tab.label}</span>
            {tab.badge != null && tab.badge > 0 && activeTab !== tab.id && (
              <span style={styles.badge}>{tab.badge > 99 ? '99+' : tab.badge}</span>
            )}
            {activeTab === tab.id && <span style={styles.tabIndicator} />}
          </button>
        ))}
      </div>
      <div style={styles.tabContent}>{activeTabData?.content}</div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    backgroundColor: '#fff',
  },
  tabList: {
    display: 'flex',
    borderBottom: '1px solid #e8e8e8',
    backgroundColor: '#fafafa',
    flexShrink: 0,
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '16px',
    height: '16px',
    padding: '0 4px',
    borderRadius: '8px',
    backgroundColor: '#ff4d4f',
    color: '#fff',
    fontSize: '10px',
    fontWeight: 700,
    lineHeight: 1,
    marginLeft: '4px',
  },
  tab: {
    position: 'relative' as const,
    display: 'flex',
    alignItems: 'center' as const,
    gap: '6px',
    padding: '12px 20px',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s ease',
  },
  tabActive: {
    color: '#1890ff',
    backgroundColor: '#fff',
  },
  tabInactive: {
    color: '#666',
  },
  tabIcon: {
    fontSize: '16px',
  },
  tabLabel: {
    fontSize: '13px',
  },
  tabIndicator: {
    position: 'absolute' as const,
    bottom: '0',
    left: '0',
    right: '0',
    height: '2px',
    backgroundColor: '#1890ff',
  },
  tabContent: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const,
  },
};
