import type { Status } from '@bull-board/api/typings/app';
import cn from 'clsx';
import s from './StatusCounts.module.css';

/** Bull Monitor's status order, with BullMQ's waiting-children last. */
export const MONITOR_STATUS_ORDER: Status[] = [
  'waiting',
  'active',
  'completed',
  'failed',
  'delayed',
  'paused',
  'prioritized',
  'waiting-children',
];

/** The statuses a queue reports, in Bull Monitor's order ("latest" is bull-board's own view). */
export const monitorStatuses = (statuses: Status[]): Status[] =>
  MONITOR_STATUS_ORDER.filter((status) => statuses.includes(status));

/** The drawer's pills: Bull Monitor's seven, without BullMQ's waiting-children. */
export const drawerStatuses = (statuses: Status[]): Status[] =>
  monitorStatuses(statuses).filter((status) => status !== 'waiting-children');

interface StatusCountChipsProps {
  statuses: Status[];
  counts: Partial<Record<Status, number>>;
  /** Clicking a chip opens that status. */
  onSelect?: (status: Status) => void;
  className?: string;
}

/** The row of small coloured pills under each queue in the drawer, zeros included. */
export const StatusCountChips = ({
  statuses,
  counts,
  onSelect,
  className,
}: StatusCountChipsProps) => (
  <ul className={cn(s.chips, className)}>
    {statuses.map((status) => (
      <li key={status} title={status}>
        <span
          role={onSelect ? 'button' : undefined}
          tabIndex={onSelect ? -1 : undefined}
          className={cn(s.chip, onSelect && s.clickable)}
          style={{ backgroundColor: `var(--status-${status})` }}
          onClick={
            onSelect
              ? (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onSelect(status);
                }
              : undefined
          }
        >
          {counts[status] ?? 0}
        </span>
      </li>
    ))}
  </ul>
);

/** The 3px bar under the pills: one segment per status, as wide as its share of the jobs. */
export const StatusBar = ({
  statuses,
  counts,
}: {
  statuses: Status[];
  counts: Partial<Record<Status, number>>;
}) => {
  const total = statuses.reduce((sum, status) => sum + (counts[status] ?? 0), 0);
  if (total === 0) return null;
  return (
    <div className={s.bar} aria-hidden="true">
      {statuses.map((status) => (
        <div
          key={status}
          style={{
            width: `${((counts[status] ?? 0) / total) * 100}%`,
            backgroundColor: `var(--status-${status})`,
          }}
        />
      ))}
    </div>
  );
};

/** A status as Bull Monitor's medium chip: 32px pill in the status colour. */
export const StatusChip = ({ status }: { status: string }) => (
  <span className={s.statusChip} style={{ backgroundColor: `var(--status-${status})` }}>
    {status}
  </span>
);
