import cn from 'clsx';
import { CircleX, Plus } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useLocation } from 'react-router-dom';
import { useSettingsStore } from '../../hooks/useSettings';
import { IconButton } from './IconButton';
import s from './QueueTabs.module.css';

const MAX_TABS = 20;

/** The queue a tab shows, from its stored URL (`/queue/<name>?...`). */
export function tabQueueName(url: string): string {
  const match = /^\/queue\/([^/?]+)/.exec(url);
  return match ? decodeURIComponent(match[1]) : url;
}

/**
 * Bull Monitor's workspaces: a row of chips, one per open tab, each remembering a queue page with
 * its status, page and filters. Picking a queue in the drawer changes the active tab; "+" opens
 * a copy of the current one, and a tab closes from its chip while more than one is open.
 */
export const QueueTabs = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const location = useLocation();
  const tabs = useSettingsStore((state) => state.tabs ?? []);
  const activeTab = useSettingsStore((state) => state.activeTab ?? 0);
  const setSettings = useSettingsStore((state) => state.setSettings);
  const current = `${location.pathname}${location.search}`;

  // The active tab follows wherever the board navigates.
  useEffect(() => {
    if (tabs.length === 0) {
      setSettings({ tabs: [current], activeTab: 0 });
      return;
    }
    const index = Math.min(activeTab, tabs.length - 1);
    if (tabs[index] !== current) {
      setSettings({ tabs: tabs.map((tab, i) => (i === index ? current : tab)), activeTab: index });
    }
  }, [current]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (index: number) => {
    setSettings({ activeTab: index });
    history.push(tabs[index]);
  };

  const add = () => {
    const next = [...tabs, current].slice(-MAX_TABS);
    setSettings({ tabs: next, activeTab: next.length - 1 });
  };

  const close = (index: number) => {
    if (tabs.length < 2) return;
    const next = tabs.filter((_, i) => i !== index);
    if (index === activeTab) {
      const neighbour = Math.min(index, next.length - 1);
      setSettings({ tabs: next, activeTab: neighbour });
      history.push(next[neighbour]);
    } else {
      setSettings({ tabs: next, activeTab: index < activeTab ? activeTab - 1 : activeTab });
    }
  };

  return (
    <div className={s.card}>
      <div className={s.chips}>
        {tabs.map((tab, index) => (
          <span
            key={`${index}-${tab}`}
            role="tab"
            aria-selected={index === activeTab}
            tabIndex={0}
            className={cn(s.chip, index === activeTab && s.active)}
            onClick={() => open(index)}
            onKeyDown={(event) => event.key === 'Enter' && open(index)}
          >
            <span className={s.label}>{tabQueueName(tab)}</span>
            {tabs.length > 1 && (
              <button
                type="button"
                className={s.close}
                aria-label={t('QUEUE.TABS.CLOSE')}
                title={t('QUEUE.TABS.CLOSE')}
                onClick={(event) => {
                  event.stopPropagation();
                  close(index);
                }}
              >
                <CircleX />
              </button>
            )}
          </span>
        ))}
        {tabs.length < MAX_TABS && (
          <IconButton size="small" label={t('QUEUE.TABS.ADD')} onClick={add}>
            <Plus />
          </IconButton>
        )}
      </div>
    </div>
  );
};
