import type { AppQueue, Status } from '@bull-board/api/typings/app';
import cn from 'clsx';
import { Ban, Pause } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink, useHistory } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useMenuState } from '../../../hooks/useMenuState';
import { useSelectedStatuses } from '../../../hooks/useSelectedStatuses';
import { links } from '../../../utils/links';
import { collectQueues, countPausedQueues, countQueues } from '../../../utils/queueTreeCounts';
import { AppQueueTreeNode } from '../../../utils/toTree';
import { ChevronDown } from '../../Icons/ChevronDown';
import {
  drawerStatuses,
  MONITOR_STATUS_ORDER,
  StatusBar,
  StatusCountChips,
} from '../../Monitor/StatusCounts';
import s from './MenuTree.module.css';

/** Every status any queue in the group reports, with the counts summed. */
function groupCounts(node: AppQueueTreeNode) {
  const queues = collectQueues(node);
  const seen = new Set<Status>(queues.flatMap((queue) => queue.statuses));
  const statuses = drawerStatuses(MONITOR_STATUS_ORDER.filter((status) => seen.has(status)));
  const counts: Partial<Record<Status, number>> = {};
  for (const queue of queues) {
    for (const status of statuses) {
      counts[status] = (counts[status] ?? 0) + (queue.counts[status] ?? 0);
    }
  }
  return { statuses, counts };
}

const QueueItem = ({ node, queue }: { node: AppQueueTreeNode; queue: AppQueue }) => {
  const history = useHistory();
  const selectedStatuses = useSelectedStatuses();
  // A queue grouped by its name prefix keeps its full name, as Bull Monitor lists it; a part of
  // a delimiter tree shows only its own segment.
  const name = queue.delimiter ? node.name : queue.name;
  const statuses = drawerStatuses(queue.statuses);

  return (
    <NavLink
      to={links.queuePage(queue.name, selectedStatuses)}
      activeClassName={s.active}
      className={s.item}
      title={queue.name}
    >
      {(queue.isPaused || queue.readOnlyMode) && (
        <span className={s.itemIcon}>{queue.isPaused ? <Pause /> : <Ban />}</span>
      )}
      <span className={s.itemText}>
        <span className={s.queueName}>{name}</span>
        <StatusCountChips
          statuses={statuses}
          counts={queue.counts}
          onSelect={(status) => history.push(links.queuePage(queue.name, { [queue.name]: status }))}
        />
        <StatusBar statuses={statuses} counts={queue.counts} />
      </span>
    </NavLink>
  );
};

export const MenuTree = ({
  tree,
  level = 0,
  parentPath = '',
}: {
  tree: AppQueueTreeNode;
  level?: number;
  parentPath?: string;
}) => {
  const { t } = useTranslation();
  const toggleMenu = useMenuState((state) => state.toggleMenu);
  const childPaths = tree.children.map((node) =>
    parentPath ? `${parentPath}/${node.name}` : node.name
  );
  const openStates = useMenuState(
    useShallow((state) => childPaths.map((path) => state.isMenuOpen(path)))
  );

  return (
    <ul
      className={cn(s.menu, level > 0 && s.level)}
      style={{ '--level': level } as React.CSSProperties}
    >
      {tree.children.map((node, index) => {
        const menuPath = childPaths[index];
        const isOpen = openStates[index];

        if (!node.children.length) {
          return (
            <li key={node.name}>{node.queue && <QueueItem node={node} queue={node.queue} />}</li>
          );
        }

        const { statuses, counts } = groupCounts(node);
        const paused = countPausedQueues(node);
        return (
          <li key={node.name}>
            <button
              className={s.groupHeader}
              onClick={() => toggleMenu(menuPath)}
              aria-expanded={isOpen}
            >
              <span className={s.groupTitle}>
                <ChevronDown className={cn(s.chevron, isOpen && s.chevronOpen)} />
                <span className={s.groupName}>{node.name}</span>
                <span className={s.groupCount}>
                  {countQueues(node)}
                  {paused > 0 && (
                    <span className={s.groupPausedCount}>
                      {' · '}
                      {paused} {t('MENU.PAUSED').toLowerCase()}
                    </span>
                  )}
                </span>
              </span>
              <StatusCountChips statuses={statuses} counts={counts} className={s.groupChips} />
              <StatusBar statuses={statuses} counts={counts} />
            </button>
            {isOpen && <MenuTree tree={node} level={level + 1} parentPath={menuPath} />}
          </li>
        );
      })}
    </ul>
  );
};
