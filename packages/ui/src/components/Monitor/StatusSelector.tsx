import type { AppQueue, Status } from '@bull-board/api/typings/app';
import cn from 'clsx';
import { Link, useLocation } from 'react-router-dom';
import { carryJobFilters } from '../../hooks/useJobFilters';
import { useSelectedStatuses } from '../../hooks/useSelectedStatuses';
import { links } from '../../utils/links';
import { monitorStatuses } from './StatusCounts';
import s from './StatusSelector.module.css';

/**
 * Bull Monitor's status row: a medium chip per status reading "<count> <status>", the selected
 * one in the primary colour. bull-board's "latest" view (every status, newest first) comes first.
 */
export const StatusSelector = ({ queue }: { queue: AppQueue }) => {
  const { search: currentSearch } = useLocation();
  const selected = useSelectedStatuses()[queue.name];
  const statuses: Status[] = [
    ...(queue.statuses.includes('latest') ? (['latest'] as Status[]) : []),
    ...monitorStatuses(queue.statuses),
  ];

  return (
    <div className={s.statuses}>
      {statuses.map((status) => {
        const to = links.queuePage(queue.name, { [queue.name]: status });
        const count = queue.counts[status];
        return (
          <Link
            key={status}
            to={{ ...to, search: carryJobFilters(to.search, currentSearch) }}
            className={cn(s.chip, status === selected && s.selected)}
          >
            {count !== undefined && status !== 'latest' && <span className={s.count}>{count}</span>}
            <span className={s.label}>{status}</span>
          </Link>
        );
      })}
    </div>
  );
};
