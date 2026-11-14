import { Menu as BaseMenu } from '@base-ui/react/menu';
import type { AppQueue } from '@bull-board/api/typings/app';
import cn from 'clsx';
import { ArrowDownWideNarrow, Check } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { useGroupByPrefix } from '../../hooks/useGroupByPrefix';
import { useQueues } from '../../hooks/useQueues';
import { useQueueSearch } from '../../hooks/useQueueSearch';
import { useSettingsStore } from '../../hooks/useSettings';
import { useUIConfig } from '../../hooks/useUIConfig';
import { links } from '../../utils/links';
import { toTree } from '../../utils/toTree';
import { DropdownContent } from '../DropdownContent/DropdownContent';
import { GitHub } from '../Icons/GitHub';
import { IconButton } from '../Monitor/IconButton';
import { OutlinedInput } from '../Monitor/OutlinedField';
import { MONITOR_STATUS_ORDER } from '../Monitor/StatusCounts';
import { MenuTree } from './MenuTree/MenuTree';
import s from './Menu.module.css';

/** Bull Monitor sorts the drawer by one status count, highest first. */
function sortByStatus(queues: AppQueue[], status: string): AppQueue[] {
  if (!status) return queues;
  const count = (queue: AppQueue) => queue.counts[status as keyof AppQueue['counts']] ?? 0;
  return [...queues].sort((a, b) => count(b) - count(a));
}

export const Menu = () => {
  const { t } = useTranslation();
  const { queues } = useQueues();
  const sortQueues = useSettingsStore((state) => state.sortQueues);
  const sidebarCollapsed = useSettingsStore((state) => state.sidebarCollapsed);
  const menuSortStatus = useSettingsStore((state) => state.menuSortStatus ?? '');
  const setSettings = useSettingsStore((state) => state.setSettings);
  const groupByPrefix = useGroupByPrefix();
  const { searchTerm, setSearchTerm } = useQueueSearch();
  const { hasHistoryProvider = false } = useUIConfig();

  const tree = useMemo(() => {
    const visible =
      queues?.filter((queue) =>
        queue.name?.toLowerCase().includes((searchTerm ?? '').toLowerCase())
      ) || [];
    return toTree(sortByStatus(visible, menuSortStatus), sortQueues && !menuSortStatus, {
      groupByPrefix,
    });
  }, [queues, searchTerm, menuSortStatus, sortQueues, groupByPrefix]);

  const showJobSchedulers = queues?.some((queue) => queue.jobSchedulerCount > 0);
  const sortOptions = ['', ...MONITOR_STATUS_ORDER];

  return (
    <aside
      id="bull-board-sidebar"
      className={cn(s.aside, sidebarCollapsed && s.collapsed)}
      aria-hidden={sidebarCollapsed}
    >
      <div className={s.utils}>
        <OutlinedInput
          className={s.filter}
          label={t('MENU.FILTER')}
          value={searchTerm}
          onChange={setSearchTerm}
          inputProps={{ id: 'search-queues', type: 'search' }}
        />
        <BaseMenu.Root>
          <BaseMenu.Trigger
            render={
              <IconButton size="large" label={t('MENU.SORT')}>
                <ArrowDownWideNarrow />
              </IconButton>
            }
          />
          <BaseMenu.Portal>
            <BaseMenu.Positioner align="start" style={{ zIndex: 1300 }}>
              <DropdownContent>
                {sortOptions.map((status) => (
                  <BaseMenu.Item
                    key={status || 'none'}
                    onClick={() => setSettings({ menuSortStatus: status })}
                  >
                    {status === menuSortStatus ? <Check /> : <span className={s.sortSpacer} />}
                    {status ? `${status} ⬇️` : t('MENU.SORT_NONE')}
                  </BaseMenu.Item>
                ))}
              </DropdownContent>
            </BaseMenu.Positioner>
          </BaseMenu.Portal>
        </BaseMenu.Root>
      </div>

      {(hasHistoryProvider || showJobSchedulers) && (
        <div className={s.navLinks}>
          {hasHistoryProvider && (
            <NavLink
              to={links.metricsHistory()}
              className={s.navLink}
              activeClassName={s.navLinkActive}
            >
              {t('MENU.METRICS_HISTORY')}
            </NavLink>
          )}
          {showJobSchedulers && (
            <NavLink
              to={links.jobSchedulers()}
              className={s.navLink}
              activeClassName={s.navLinkActive}
            >
              {t('MENU.SCHEDULERS')}
            </NavLink>
          )}
        </div>
      )}

      <nav className={s.navWrapper}>
        <MenuTree tree={tree} />
      </nav>
      <a
        className={s.appVersion}
        target="_blank"
        rel="noreferrer"
        href={process.env.BULL_BOARD_REPO}
      >
        <GitHub className={s.githubIcon} />
        {process.env.APP_VERSION}
      </a>
    </aside>
  );
};
