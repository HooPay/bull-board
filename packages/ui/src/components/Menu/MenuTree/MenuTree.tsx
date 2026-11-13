import cn from 'clsx';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useMenuState } from '../../../hooks/useMenuState';
import { useSelectedStatuses } from '../../../hooks/useSelectedStatuses';
import { dynamicTranslationKey } from '../../../utils/dynamicTranslationKey';
import { links } from '../../../utils/links';
import { aggregateCounts, countPausedQueues, countQueues } from '../../../utils/queueTreeCounts';
import { AppQueueTreeNode } from '../../../utils/toTree';
import { ChevronDown } from '../../Icons/ChevronDown';
import s from './MenuTree.module.css';

/** One dot and count per status that has jobs, in the overview's order and colours. */
const StatusDots = ({ node }: { node: AppQueueTreeNode }) => {
  const { t, i18n } = useTranslation();
  const counts = aggregateCounts(node);
  if (counts.total === 0) return null;

  const format = new Intl.NumberFormat(i18n.language || undefined, {
    notation: 'compact',
    maximumFractionDigits: 1,
  });

  return (
    <span className={s.dots}>
      {counts.statuses.map((status) => {
        const label = t(dynamicTranslationKey(`QUEUE.STATUS.${status.toUpperCase()}`));
        const value = counts.byStatus[status] ?? 0;
        return (
          <span key={status} className={s.dotCount} title={`${label}: ${value.toLocaleString()}`}>
            <span className={s.dot} style={{ backgroundColor: `var(--status-${status})` }} />
            {format.format(value)}
          </span>
        );
      })}
    </span>
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
  const selectedStatuses = useSelectedStatuses();
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
        const isLeafNode = !node.children.length;
        const displayName = node.name;
        const menuPath = childPaths[index];
        const isOpen = openStates[index];

        return (
          <li key={node.name}>
            {isLeafNode ? (
              <NavLink
                to={links.queuePage(node.queue!.name, selectedStatuses)}
                activeClassName={s.active}
                title={displayName}
              >
                <span className={s.queueName}>{displayName}</span>
                {node.queue?.isPaused && <span className={s.isPaused}>[ {t('MENU.PAUSED')} ]</span>}
                <StatusDots node={node} />
              </NavLink>
            ) : (
              <>
                <button className={s.groupHeader} onClick={() => toggleMenu(menuPath)}>
                  <ChevronDown className={cn(s.chevron, isOpen && s.chevronOpen)} />
                  <span className={s.groupName}>{displayName}</span>
                  <span className={s.groupCount}>
                    {countQueues(node)}
                    {countPausedQueues(node) > 0 && (
                      <span className={s.groupPausedCount}>
                        {' · '}
                        {countPausedQueues(node)} {t('MENU.PAUSED').toLowerCase()}
                      </span>
                    )}
                  </span>
                  <StatusDots node={node} />
                </button>
                {isOpen && <MenuTree tree={node} level={level + 1} parentPath={menuPath} />}
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
};
