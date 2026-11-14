import { Menu } from '@base-ui/react/menu';
import { STATUSES } from '@bull-board/api/constants/statuses';
import type { AppJob, AppQueue, JobCleanStatus, Status } from '@bull-board/api/typings/app';
import { useQueryClient } from '@tanstack/react-query';
import cn from 'clsx';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  FastForward,
  Info,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Save,
  Square,
  SquareCheck,
  SquareMinus,
  Trash2,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory, useLocation } from 'react-router-dom';
import { queryKeys } from '../../hooks/queryKeys';
import { useApi } from '../../hooks/useApi';
import { useConfirm } from '../../hooks/useConfirm';
import { useSettingsStore } from '../../hooks/useSettings';
import { DropdownContent } from '../DropdownContent/DropdownContent';
import { IconButton } from './IconButton';
import { StatusChip } from './StatusCounts';
import s from './JobsTable.module.css';

/** Bull Monitor's per-page options, capped at the API's 300 jobs per page. */
const PER_PAGE_OPTIONS = [10, 25, 50, 75, 100, 250, 300];
const CLEAN_STATUSES: { status: JobCleanStatus; label: string }[] = [
  { status: 'wait', label: 'waiting' },
  { status: 'active', label: 'active' },
  { status: 'completed', label: 'completed' },
  { status: 'delayed', label: 'delayed' },
  { status: 'failed', label: 'failed' },
];

const pad = (n: number) => String(n).padStart(2, '0');

/** dayjs `YYYY-MM-DD HH:mm:ss`, local time, as Bull Monitor prints every date. */
export function formatDateTime(ms?: number | null): string {
  if (!ms) return '';
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** The `ms` package's short form: 250ms, 3s, 2m, 1h, 2d. */
export function formatDuration(ms?: number | null): string {
  if (!ms || ms <= 0) return '';
  const abs = Math.abs(ms);
  if (abs >= 86_400_000) return `${Math.round(ms / 86_400_000)}d`;
  if (abs >= 3_600_000) return `${Math.round(ms / 3_600_000)}h`;
  if (abs >= 60_000) return `${Math.round(ms / 60_000)}m`;
  if (abs >= 1000) return `${Math.round(ms / 1000)}s`;
  return `${ms}ms`;
}

/**
 * A job's status for the Status column. A specific tab is that status; the "latest" view mixes
 * them, so it is read off the job's own timestamps.
 */
export function jobStatus(job: AppJob, selected: Status): string {
  if (selected !== STATUSES.latest) return selected;
  if (job.finishedOn) return job.isFailed ? 'failed' : 'completed';
  if (job.processedOn) return 'active';
  if ((job.delay ?? 0) > 0 && job.timestamp + (job.delay ?? 0) > Date.now()) return 'delayed';
  return 'waiting';
}

const isEmptyJson = (value: unknown) =>
  value === undefined ||
  value === null ||
  (typeof value === 'object' && Object.keys(value as object).length === 0);

const pretty = (value: unknown) =>
  typeof value === 'string' ? value : JSON.stringify(value, null, 2);

function download(name: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export interface JobRowActions {
  editData: (job: AppJob) => void;
  remove: (job: AppJob) => () => Promise<void>;
  retry: (job: AppJob) => () => Promise<void>;
  promote: (job: AppJob) => () => Promise<void>;
  duplicate: (job: AppJob) => void;
  reschedule: (job: AppJob) => void;
  reprioritise: (job: AppJob) => void;
}

export interface QueueToolbarActions {
  addJob: () => void;
  cleanAll: (status: JobCleanStatus) => () => Promise<void>;
  pause: () => () => Promise<void>;
  resume: () => () => Promise<void>;
  retryAll: () => () => Promise<void>;
  promoteAll: () => () => Promise<void>;
}

interface JobsTableProps {
  queue: AppQueue;
  status: Status;
  jobUrl: (job: AppJob) => { pathname: string; search: string };
  rowActions: JobRowActions;
  toolbarActions: QueueToolbarActions;
  /** The queue's own menu (concurrency, rate limit, empty...) at the end of the toolbar. */
  moreMenu?: React.ReactNode;
  /** Badges shown at the right of the toolbar (workers, rate limit, schedulers). */
  badges?: React.ReactNode;
  loading?: boolean;
  emptyText: string;
  total: number;
}

const Accordion = ({
  title,
  danger,
  children,
}: {
  title: string;
  danger?: boolean;
  children: React.ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <div className={s.accordion}>
      <button
        type="button"
        className={s.accordionSummary}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{title}</span>
        <ChevronDown className={cn(s.expandIcon, open && s.expandOpen)} />
      </button>
      {open && (
        <div className={s.accordionDetails}>
          <pre className={cn(s.json, danger && s.jsonDanger)}>{children}</pre>
        </div>
      )}
    </div>
  );
};

const InfoPanel = ({ job, status }: { job: AppJob; status: string }) => {
  const { t } = useTranslation();
  const failed = status === 'failed' || (!!job.finishedOn && job.isFailed);
  const steps = [
    { label: t('MONITOR.STEP_QUEUED'), at: job.timestamp },
    ...((job.delay ?? 0) > 0
      ? [{ label: t('MONITOR.STEP_DELAYED'), at: job.timestamp + (job.delay ?? 0) }]
      : []),
    { label: t('MONITOR.STEP_PROCESSED'), at: job.processedOn },
    {
      label: failed ? t('MONITOR.STEP_FAILED') : t('MONITOR.STEP_FINISHED'),
      at: job.finishedOn,
      error: failed,
    },
  ];
  const result = failed ? job.failedReason : job.returnValue;

  return (
    <div className={s.info}>
      <ol className={s.stepper}>
        {steps.map((step, index) => (
          <li key={step.label} className={cn(s.step, !step.at && s.stepPending)}>
            <span className={cn(s.stepIcon, step.error && s.stepIconError)}>{index + 1}</span>
            <span className={s.stepText}>
              <span className={cn(s.stepLabel, step.error && s.stepLabelError)}>{step.label}</span>
              <span className={s.stepDate}>{formatDateTime(step.at)}</span>
            </span>
          </li>
        ))}
      </ol>
      {!isEmptyJson(result) && (
        <pre className={cn(s.json, s.infoJson, failed && s.jsonDanger)}>{pretty(result)}</pre>
      )}
      <pre className={cn(s.json, s.infoJson)}>{pretty(job.opts)}</pre>
    </div>
  );
};

const RowMenu = ({
  job,
  status,
  queue,
  jobUrl,
  actions,
}: {
  job: AppJob;
  status: string;
  queue: AppQueue;
  jobUrl: { pathname: string; search: string };
  actions: JobRowActions;
}) => {
  const { t } = useTranslation();
  const history = useHistory();
  const writable = !queue.readOnlyMode;
  const canRetry =
    writable &&
    queue.allowRetries &&
    (status === 'failed' || (status === 'completed' && queue.allowCompletedRetries));

  return (
    <Menu.Root>
      <Menu.Trigger
        render={
          <IconButton size="small" label={t('MONITOR.MORE')}>
            <Ellipsis />
          </IconButton>
        }
      />
      <Menu.Portal>
        <Menu.Positioner align="start" style={{ zIndex: 1300 }}>
          <DropdownContent>
            {canRetry && (
              <Menu.Item onClick={actions.retry(job)}>{t('JOB.ACTIONS.RETRY')}</Menu.Item>
            )}
            {writable && status === 'delayed' && (
              <Menu.Item onClick={actions.promote(job)}>{t('JOB.ACTIONS.PROMOTE')}</Menu.Item>
            )}
            {writable && (
              <Menu.Item onClick={() => actions.duplicate(job)}>
                {t('JOB.ACTIONS.DUPLICATE')}
              </Menu.Item>
            )}
            {writable && status === 'delayed' && (
              <Menu.Item onClick={() => actions.reschedule(job)}>
                {t('JOB.ACTIONS.RESCHEDULE')}
              </Menu.Item>
            )}
            {writable && (status === 'waiting' || status === 'prioritized') && (
              <Menu.Item onClick={() => actions.reprioritise(job)}>
                {t('JOB.ACTIONS.REPRIORITISE')}
              </Menu.Item>
            )}
            <Menu.Item onClick={() => download(`${queue.name}-${job.id}.json`, job)}>
              {t('MONITOR.SAVE_JSON')}
            </Menu.Item>
            <Menu.Item onClick={() => history.push(jobUrl)}>{t('MONITOR.OPEN_JOB')}</Menu.Item>
          </DropdownContent>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
};

const Checkbox = ({
  checked,
  indeterminate,
  label,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  label: string;
  onChange: () => void;
}) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={indeterminate ? 'mixed' : checked}
    aria-label={label}
    className={cn(s.checkbox, (checked || indeterminate) && s.checkboxOn)}
    onClick={onChange}
  >
    {indeterminate ? <SquareMinus /> : checked ? <SquareCheck /> : <Square />}
  </button>
);

export const JobsTable = ({
  queue,
  status,
  jobUrl,
  rowActions,
  toolbarActions,
  moreMenu,
  badges,
  loading,
  emptyText,
  total,
}: JobsTableProps) => {
  const { t } = useTranslation();
  const api = useApi();
  const history = useHistory();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { openConfirm } = useConfirm();
  const jobsPerPage = useSettingsStore((state) => state.jobsPerPage);
  const setSettings = useSettingsStore((state) => state.setSettings);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [infoOpen, setInfoOpen] = useState<Set<string>>(new Set());
  const writable = !queue.readOnlyMode;
  const jobs = queue.jobs;
  const key = (job: AppJob) => `${job.id}`;

  // A selection belongs to the rows on screen; another page, status or queue starts empty.
  useEffect(() => setSelected(new Set()), [queue.name, status, location.search]);

  const selectedJobs = useMemo(
    () => jobs.filter((job) => selected.has(key(job))),
    [jobs, selected]
  );
  const allSelected = jobs.length > 0 && selectedJobs.length === jobs.length;
  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  const bulk = async (kind: 'retry' | 'remove') => {
    try {
      await openConfirm({
        description: t(
          kind === 'retry' ? 'MONITOR.CONFIRM_RETRY_SELECTED' : 'MONITOR.CONFIRM_DELETE_SELECTED',
          { count: selectedJobs.length }
        ),
      });
    } catch {
      return;
    }
    await Promise.allSettled(
      selectedJobs.map((job) =>
        kind === 'retry' ? api.retryJob(queue.name, job.id) : api.cleanJob(queue.name, job.id)
      )
    );
    setSelected(new Set());
    await queryClient.invalidateQueries({ queryKey: queryKeys.queues.all });
  };

  // Pagination: the page lives in the URL, the page size in the settings.
  const query = new URLSearchParams(location.search);
  const page = Math.max(1, Number(query.get('page')) || 1);
  const pageCount = queue.pagination.pageCount;
  const from = total === 0 ? 0 : (page - 1) * jobsPerPage + 1;
  const to = Math.min(total, page * jobsPerPage);
  const goTo = (next: number) => {
    const params = new URLSearchParams(location.search);
    if (next <= 1) params.delete('page');
    else params.set('page', String(next));
    history.push({ pathname: location.pathname, search: params.toString() });
  };

  const failedTab = status === 'failed';
  const anyFailedSelected = selectedJobs.some((job) => job.isFailed);

  return (
    <div className={s.card}>
      <div className={s.toolbar}>
        {selectedJobs.length > 0 ? (
          <>
            <span className={s.selectedCount}>
              {t('MONITOR.SELECTED', { count: selectedJobs.length })}
            </span>
            {writable && (failedTab || anyFailedSelected) && queue.allowRetries && (
              <IconButton
                size="large"
                label={t('MONITOR.RETRY_SELECTED')}
                onClick={() => bulk('retry')}
              >
                <RotateCcw />
              </IconButton>
            )}
            {writable && (
              <IconButton
                size="large"
                color="error"
                label={t('MONITOR.DELETE_SELECTED')}
                onClick={() => bulk('remove')}
              >
                <Trash2 />
              </IconButton>
            )}
            <IconButton
              size="large"
              label={t('MONITOR.SAVE_JSON')}
              onClick={() => download(`${queue.name}-selected.json`, selectedJobs)}
            >
              <Save />
            </IconButton>
          </>
        ) : (
          <div className={s.queueActions}>
            <IconButton
              label={t('QUEUE.ACTIONS.ADD_JOB')}
              disabled={!writable}
              onClick={toolbarActions.addJob}
            >
              <Plus />
            </IconButton>
            <Menu.Root>
              <Menu.Trigger
                disabled={!writable}
                render={
                  <IconButton color="error" label={t('MONITOR.CLEAN')} disabled={!writable}>
                    <Trash2 />
                  </IconButton>
                }
              />
              <Menu.Portal>
                <Menu.Positioner align="start" style={{ zIndex: 1300 }}>
                  <DropdownContent>
                    {CLEAN_STATUSES.map((item) => (
                      <Menu.Item key={item.status} onClick={toolbarActions.cleanAll(item.status)}>
                        {item.label}
                      </Menu.Item>
                    ))}
                  </DropdownContent>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
            <IconButton
              label={t('MONITOR.EXPORT_JSON')}
              onClick={() => download(`${queue.name}-${status}.json`, jobs)}
            >
              <Save />
            </IconButton>
            {queue.isPaused ? (
              <IconButton
                label={t('QUEUE.ACTIONS.RESUME')}
                disabled={!writable}
                onClick={toolbarActions.resume()}
              >
                <Play />
              </IconButton>
            ) : (
              <IconButton
                label={t('QUEUE.ACTIONS.PAUSE')}
                disabled={!writable}
                onClick={toolbarActions.pause()}
              >
                <Pause />
              </IconButton>
            )}
            {writable &&
              queue.allowRetries &&
              (failedTab || (status === 'completed' && queue.allowCompletedRetries)) &&
              jobs.length > 0 && (
                <IconButton
                  label={t('QUEUE.ACTIONS.RETRY_ALL')}
                  onClick={toolbarActions.retryAll()}
                >
                  <RotateCcw />
                </IconButton>
              )}
            {writable && status === 'delayed' && jobs.length > 0 && (
              <IconButton
                label={t('QUEUE.ACTIONS.PROMOTE_ALL')}
                onClick={toolbarActions.promoteAll()}
              >
                <FastForward />
              </IconButton>
            )}
            {moreMenu}
          </div>
        )}
        {badges && <div className={s.badges}>{badges}</div>}
      </div>

      <div className={s.tableContainer}>
        <table className={s.table}>
          <thead>
            <tr>
              <th className={s.checkboxCell}>
                <Checkbox
                  checked={allSelected}
                  indeterminate={selectedJobs.length > 0 && !allSelected}
                  label={t('MONITOR.SELECT_ALL')}
                  onChange={() =>
                    setSelected(allSelected ? new Set() : new Set(jobs.map((job) => key(job))))
                  }
                />
              </th>
              <th className={s.actionsCell}>{t('MONITOR.COLUMNS.ACTIONS')}</th>
              <th>{t('MONITOR.COLUMNS.ID')}</th>
              <th>{t('MONITOR.COLUMNS.STATUS')}</th>
              <th>{t('MONITOR.COLUMNS.NAME')}</th>
              <th>{t('MONITOR.COLUMNS.TIMESTAMP')}</th>
              <th>{t('MONITOR.COLUMNS.DELAY')}</th>
              <th className={s.narrow}>{t('MONITOR.COLUMNS.TIME')}</th>
              <th className={s.narrow}>{t('MONITOR.COLUMNS.ATTEMPTS')}</th>
              <th className={s.narrow}>{t('MONITOR.COLUMNS.PROGRESS')}</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => {
              const id = key(job);
              const rowStatus = jobStatus(job, status);
              const failed = rowStatus === 'failed' || (!!job.finishedOn && job.isFailed);
              const hasData = !isEmptyJson(job.data);
              const hasReturn = !isEmptyJson(job.returnValue);
              const hasError = job.stacktrace.length > 0 || !!job.failedReason;
              const showInfo = infoOpen.has(id);
              const extra = hasData || hasReturn || hasError || showInfo;
              const blocks = [hasData, hasReturn, hasError].filter(Boolean).length;
              const url = jobUrl(job);

              return (
                <React.Fragment key={id}>
                  <tr className={cn(extra && s.withExtra, failed && s.failedRow)}>
                    <td className={s.checkboxCell}>
                      <Checkbox
                        checked={selected.has(id)}
                        label={t('MONITOR.SELECT_JOB', { id })}
                        onChange={() => setSelected((set) => toggle(set, id))}
                      />
                    </td>
                    <td className={s.actionsCell}>
                      <div className={s.rowActions}>
                        <IconButton
                          size="small"
                          color="primary"
                          label={t('JOB.ACTIONS.UPDATE_DATA')}
                          disabled={!writable}
                          onClick={() => rowActions.editData(job)}
                        >
                          <Pencil />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          label={t('MONITOR.DELETE_JOB')}
                          disabled={!writable}
                          onClick={rowActions.remove(job)}
                        >
                          <Trash2 />
                        </IconButton>
                        <IconButton
                          size="small"
                          label={t('MONITOR.INFO')}
                          aria-expanded={showInfo}
                          onClick={() => setInfoOpen((set) => toggle(set, id))}
                        >
                          <Info />
                        </IconButton>
                        <RowMenu
                          job={job}
                          status={rowStatus}
                          queue={queue}
                          jobUrl={url}
                          actions={rowActions}
                        />
                      </div>
                    </td>
                    <td>
                      <Link className={s.jobLink} to={url}>
                        {job.id}
                      </Link>
                    </td>
                    <td>
                      <StatusChip status={rowStatus} />
                    </td>
                    <td>{job.name}</td>
                    <td className={s.nowrap}>{formatDateTime(job.timestamp)}</td>
                    <td className={s.nowrap}>
                      {(job.delay ?? 0) > 0 ? formatDateTime(job.timestamp + (job.delay ?? 0)) : ''}
                    </td>
                    <td className={s.narrow}>
                      {job.finishedOn && job.processedOn
                        ? formatDuration(job.finishedOn - job.processedOn)
                        : ''}
                    </td>
                    <td className={s.narrow}>{job.attempts}</td>
                    <td className={s.narrow}>
                      {typeof job.progress === 'object'
                        ? JSON.stringify(job.progress)
                        : String(job.progress)}
                    </td>
                  </tr>
                  {extra && (
                    <tr className={s.extraRow}>
                      <td colSpan={10}>
                        {failed && job.failedReason && (
                          <div className={s.errorLine} role="alert">
                            <span className={s.errorLabel}>{t('JOB.FAILED_LABEL')}</span>
                            <span className={s.errorMessage}>
                              {job.failedReason.split('\n')[0]}
                            </span>
                          </div>
                        )}
                        {showInfo && <InfoPanel job={job} status={rowStatus} />}
                        {blocks > 0 && (
                          <div className={cn(s.blocks, blocks > 1 && s.blocksTwo)}>
                            {hasData && (
                              <Accordion title={t('MONITOR.JOB_DATA')}>
                                {pretty(job.data)}
                              </Accordion>
                            )}
                            {hasReturn && (
                              <Accordion title={t('MONITOR.RETURN_VALUE')}>
                                {pretty(job.returnValue)}
                              </Accordion>
                            )}
                            {hasError && (
                              <Accordion title={t('MONITOR.STACKTRACE')} danger>
                                {job.stacktrace.length > 0
                                  ? job.stacktrace.join('\n\n')
                                  : job.failedReason}
                              </Accordion>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        {loading ? (
          <div className={s.spinner} aria-label="loading" />
        ) : (
          jobs.length === 0 && <p className={s.empty}>{emptyText}</p>
        )}
      </div>

      <div className={s.pagination}>
        <span className={s.spacer} />
        <label className={s.perPage}>
          <span>{t('MONITOR.PER_PAGE')}</span>
          <select
            value={jobsPerPage}
            onChange={({ currentTarget }) => {
              setSettings({ jobsPerPage: Number(currentTarget.value) });
              goTo(1);
            }}
          >
            {[...new Set([...PER_PAGE_OPTIONS, jobsPerPage])]
              .sort((a, b) => a - b)
              .map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
          </select>
        </label>
        <span className={s.range}>{t('MONITOR.RANGE', { from, to, count: total })}</span>
        <span className={s.pageActions}>
          <IconButton
            label={t('MONITOR.PREV_PAGE')}
            disabled={page <= 1}
            onClick={() => goTo(page - 1)}
          >
            <ChevronLeft />
          </IconButton>
          <IconButton
            label={t('MONITOR.NEXT_PAGE')}
            disabled={page >= pageCount}
            onClick={() => goTo(page + 1)}
          >
            <ChevronRight />
          </IconButton>
        </span>
      </div>
    </div>
  );
};
