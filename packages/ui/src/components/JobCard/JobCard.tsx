import { Collapsible } from '@base-ui/react/collapsible';
import { STATUSES } from '@bull-board/api/constants/statuses';
import type { AppJob, Status } from '@bull-board/api/typings/app';
import cn from 'clsx';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useMobileQuery } from '../../hooks/useMobileQuery';
import { useSettingsStore } from '../../hooks/useSettings';
import { Button } from '../Button/Button';
import { Card } from '../Card/Card';
import { ChevronDown } from '../Icons/ChevronDown';
import { ChevronUp } from '../Icons/ChevronUp';
import { UpRightFromSquareSolid } from '../Icons/UpRightFromSquare';
import { Details } from './Details/Details';
import { JobActions } from './JobActions/JobActions';
import { Progress } from './Progress/Progress';
import { Timeline } from './Timeline/Timeline';
import s from './JobCard.module.css';

interface JobCardProps {
  job: AppJob;
  jobUrl?: { pathname: string; search: string };
  status: Status;
  readOnlyMode: boolean;
  allowRetries: boolean;
  actions: {
    updateJobData: () => void;
    duplicateJob: () => void;
    rescheduleJob: () => void;
    reprioritiseJob: () => void;
    removeUnprocessedChildren: () => Promise<void>;
    promoteJob: () => Promise<void>;
    retryJob: () => Promise<void>;
    cleanJob: () => Promise<void>;
    getJobLogs: () => Promise<string[]>;
  };
}

const greenStatuses = [STATUSES.active, STATUSES.completed] as const;

/** The first line of the job's error, for the banner; the full text stays in the Error tab. */
function failureSummary(job: AppJob): string {
  const text = job.failedReason || job.stacktrace[0] || '';
  return text.split('\n')[0].trim();
}

export const JobCard = ({
  job,
  status,
  actions,
  readOnlyMode,
  allowRetries,
  jobUrl,
}: JobCardProps) => {
  const { t } = useTranslation();
  const { collapseJob } = useSettingsStore();
  const isMobile = useMobileQuery();

  const [localCollapse, setLocalCollapse] = useState<boolean>();

  const isExpandedCard = !jobUrl || localCollapse || !collapseJob;
  const showCollapseExpandBtn = collapseJob && jobUrl;
  const idPrefix = /^\d+$/.test(`${job.id}`) ? '#' : '';
  const isShortId = `${job.id}`.length <= 8;
  // A job that failed, seen from a tab that does not already say so (latest, delayed for a retry...).
  const failed = job.isFailed && !greenStatuses.includes(status as any);
  const detailsStatus = failed ? STATUSES.failed : status;

  return (
    <Collapsible.Root
      open={isExpandedCard}
      render={<Card className={cn(s.card, failed && s.failedCard)} />}
    >
      <div className={s.header}>
        <div className={s.titleWithLink}>
          {jobUrl ? (
            <Link className={s.jobLink} to={jobUrl}>
              <span className={s.jobId}>
                {idPrefix}
                {job.id}
              </span>
              {isShortId && <span className={s.jobNameInline}>{job.name}</span>}
            </Link>
          ) : (
            <>
              <span
                className={s.statusDot}
                style={{ backgroundColor: `var(--status-${status})` }}
              />
              <span className={s.jobId}>
                {idPrefix}
                {job.id}
              </span>
              {isShortId && <span className={s.jobNameInline}>{job.name}</span>}
            </>
          )}

          {job.groupId != null && (
            <span className={s.groupPill} title={`Group: ${job.groupId}`}>
              group: {job.groupId}
            </span>
          )}

          {job.priority != null && (
            <span className={s.groupPill}>
              {t('JOB.DIAGNOSTICS.PRIORITY', { priority: job.priority })}
            </span>
          )}

          {job.deduplicationId != null && (
            <span className={s.groupPill} title={job.deduplicationId}>
              {t('JOB.DIAGNOSTICS.DEDUPLICATED', { id: job.deduplicationId })}
            </span>
          )}

          {job.stalledCounter != null && (
            <span className={cn(s.groupPill, s.warnPill)}>
              {t('JOB.DIAGNOSTICS.STALLED', { times: job.stalledCounter })}
            </span>
          )}

          {job.attemptsStarted != null && (
            <span className={s.groupPill}>
              {t('JOB.DIAGNOSTICS.ATTEMPTS_STARTED', { starts: job.attemptsStarted })}
            </span>
          )}

          {job.deferredFailure != null && (
            <span className={cn(s.groupPill, s.warnPill)} title={job.deferredFailure}>
              {t('JOB.DIAGNOSTICS.WILL_FAIL')}
            </span>
          )}

          {job.externalUrl && (
            <a
              className={s.externalLink}
              href={job.externalUrl.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {job.externalUrl.displayText ?? <UpRightFromSquareSolid />}
            </a>
          )}
        </div>

        <div className={s.headerActions}>
          {!readOnlyMode && (
            <JobActions status={status} actions={actions} allowRetries={allowRetries} />
          )}
          {showCollapseExpandBtn && (
            <Button className={s.collapseBtn} onClick={() => setLocalCollapse(!isExpandedCard)}>
              {isExpandedCard ? <ChevronUp /> : <ChevronDown />}
            </Button>
          )}
        </div>
      </div>

      {failed && (
        <div className={s.failedBanner} role="alert" title={job.failedReason || undefined}>
          <span className={s.failedLabel}>{t('JOB.FAILED_LABEL')}</span>
          <span className={s.failedMessage}>{failureSummary(job)}</span>
        </div>
      )}

      <Collapsible.Panel render={<div className={s.details} />}>
        {!isMobile && (
          <div className={s.sideInfo}>
            <Timeline job={job} status={status} />
          </div>
        )}

        <div className={s.contentWrapper}>
          {!isShortId && (
            <h5 className={s.jobName}>
              {job.name}
              {job.attempts > 1 && <span>{t('JOB.ATTEMPTS', { attempts: job.attempts })}</span>}
              {!!job.opts?.repeat?.count && (
                <span>
                  {t(`JOB.REPEAT${!!job.opts?.repeat?.limit ? '_WITH_LIMIT' : ''}`, {
                    count: job.opts.repeat.count,
                    limit: job.opts?.repeat?.limit,
                  })}
                </span>
              )}
            </h5>
          )}

          <div className={s.content}>
            <Details status={detailsStatus} job={job} actions={actions} withTimeline={isMobile} />
          </div>
          <Progress
            progress={job.progress}
            status={
              job.isFailed && !greenStatuses.includes(status as any) ? STATUSES.failed : status
            }
            className={s.progress}
          />
        </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
};
