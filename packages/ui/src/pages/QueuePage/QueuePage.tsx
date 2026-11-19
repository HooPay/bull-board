import { STATUSES } from '@bull-board/api/constants/statuses';
import type { AppJob } from '@bull-board/api/typings/app';
import React, { Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { SchedulersIcon } from '../../components/Icons/Schedulers';
import { JobFilters } from '../../components/JobFilters/JobFilters';
import { Loader } from '../../components/Loader/Loader';
import { JobsTable } from '../../components/Monitor/JobsTable';
import { QueueTabs } from '../../components/Monitor/QueueTabs';
import { StatusSelector } from '../../components/Monitor/StatusSelector';
import { QueueDropdownActions } from '../../components/QueueDropdownActions/QueueDropdownActions';
import { RateLimitBadge } from '../../components/RateLimitBadge/RateLimitBadge';
import { WorkersBadge } from '../../components/WorkersBadge/WorkersBadge';
import { useActiveQueue } from '../../hooks/useActiveQueue';
import { useJob } from '../../hooks/useJob';
import { hasActiveJobFilters, useJobFilters } from '../../hooks/useJobFilters';
import { useModal } from '../../hooks/useModal';
import { useQueues } from '../../hooks/useQueues';
import { useSelectedStatuses } from '../../hooks/useSelectedStatuses';
import { useUIConfig } from '../../hooks/useUIConfig';
import { links } from '../../utils/links';
import s from './QueuePage.module.css';

const AddJobModalLazy = React.lazy(() =>
  import('../../components/AddJobModal/AddJobModal').then(({ AddJobModal }) => ({
    default: AddJobModal,
  }))
);

const UpdateJobDataModalLazy = React.lazy(() =>
  import('../../components/UpdateJobDataModal/UpdateJobDataModal').then(
    ({ UpdateJobDataModal }) => ({
      default: UpdateJobDataModal,
    })
  )
);

const ConcurrencyModalLazy = React.lazy(() =>
  import('../../components/ConcurrencyModal/ConcurrencyModal').then(({ ConcurrencyModal }) => ({
    default: ConcurrencyModal,
  }))
);

const RateLimitModalLazy = React.lazy(() =>
  import('../../components/RateLimitModal/RateLimitModal').then(({ RateLimitModal }) => ({
    default: RateLimitModal,
  }))
);

const EditJobModalLazy = React.lazy(() =>
  import('../../components/EditJobModal/EditJobModal').then(({ EditJobModal }) => ({
    default: EditJobModal,
  }))
);

const QueueMetricsLazy = React.lazy(() =>
  import('../../components/QueueMetrics/QueueMetrics').then(({ QueueMetrics }) => ({
    default: QueueMetrics,
  }))
);

export const QueuePage = () => {
  const { t } = useTranslation();
  const { showMetrics = false } = useUIConfig();
  const selectedStatus = useSelectedStatuses();
  const { actions, loading, isTransitioning } = useQueues();
  const { actions: jobActions } = useJob();
  const queue = useActiveQueue();
  const [jobFilters] = useJobFilters();
  const modal = useModal<
    'addJob' | 'updateJobData' | 'concurrency' | 'rescheduleJob' | 'reprioritiseJob' | 'rateLimit'
  >();
  const [editJob, setEditJob] = useState<AppJob | null>(null);

  if (!queue) {
    return <section>{loading ? <Loader /> : t('QUEUE.NOT_FOUND')}</section>;
  }

  const status = selectedStatus[queue.name];
  const isLatest = status === STATUSES.latest;
  const schedulerCount = queue.jobSchedulerCount ?? 0;
  const filtering = hasActiveJobFilters(jobFilters);

  // The pagination footer's "of N": the search's matches, the status count, or, for the
  // latest view, every job in the queue.
  const total = queue.search
    ? queue.search.matched
    : jobFilters.jobId
      ? queue.jobs.length
      : isLatest
        ? queue.statuses
            .filter((item) => item !== STATUSES.latest)
            .reduce((sum, item) => sum + (queue.counts[item] ?? 0), 0)
        : (queue.counts[status] ?? 0);

  const withJob = (job: AppJob, open: () => void) => {
    setEditJob(job);
    open();
  };

  return (
    <section className={s.page}>
      <QueueTabs />

      <div className={s.card}>
        <StatusSelector queue={queue} />
        <JobFilters queue={queue} />
      </div>

      {showMetrics && (
        <Suspense fallback={null}>
          <QueueMetricsLazy queue={queue} />
        </Suspense>
      )}

      <JobsTable
        queue={queue}
        status={status}
        total={total}
        loading={isTransitioning}
        emptyText={filtering ? t('QUEUE.FILTERS.EMPTY_STATE') : t('QUEUE.EMPTY_STATE', { status })}
        jobUrl={(job) => links.jobPage(queue.name, `${job.id}`, selectedStatus)}
        rowActions={{
          editData: (job) => withJob(job, () => modal.open('updateJobData')),
          remove: (job) => jobActions.cleanJob(queue.name)(job),
          retry: (job) => jobActions.retryJob(queue.name)(job),
          promote: (job) => jobActions.promoteJob(queue.name)(job),
          duplicate: (job) => withJob(job, () => modal.open('addJob')),
          reschedule: (job) => withJob(job, () => modal.open('rescheduleJob')),
          reprioritise: (job) => withJob(job, () => modal.open('reprioritiseJob')),
        }}
        toolbarActions={{
          addJob: () => {
            setEditJob(null);
            modal.open('addJob');
          },
          cleanAll: (cleanStatus) => actions.cleanAll(queue.name, cleanStatus),
          pause: () => actions.pauseQueue(queue.name),
          resume: () => actions.resumeQueue(queue.name),
          retryAll: () =>
            actions.retryAll(queue.name, status === STATUSES.completed ? 'completed' : 'failed'),
          promoteAll: () => actions.promoteAll(queue.name),
        }}
        moreMenu={
          !queue.readOnlyMode && (
            <QueueDropdownActions
              queue={queue}
              actions={{
                ...actions,
                addJob: () => modal.open('addJob'),
                onConcurrency: () => modal.open('concurrency'),
                onRateLimit: () => modal.open('rateLimit'),
              }}
            />
          )
        }
        badges={
          <>
            {schedulerCount > 0 && (
              <Link
                className={s.schedulersLink}
                to={links.jobSchedulers({ queueName: queue.name })}
                aria-label={t('QUEUE.SCHEDULERS_LINK', { count: schedulerCount })}
              >
                <SchedulersIcon />
                <span className={s.schedulersLabel}>{t('SCHEDULERS.TITLE')}</span>
                <span className={s.schedulersCount}>{schedulerCount}</span>
              </Link>
            )}
            <RateLimitBadge queue={queue} />
            <WorkersBadge queue={queue} />
          </>
        }
      />
      <Suspense fallback={null}>
        {modal.isMounted('addJob') && (
          <AddJobModalLazy
            open={modal.isOpen('addJob')}
            onClose={modal.close('addJob')}
            job={editJob}
          />
        )}
        {modal.isMounted('updateJobData') && !!editJob && (
          <UpdateJobDataModalLazy
            open={modal.isOpen('updateJobData')}
            onClose={() => {
              setEditJob(null);
              modal.close('updateJobData');
            }}
            job={editJob}
          />
        )}
        {modal.isMounted('rateLimit') && (
          <RateLimitModalLazy
            open={modal.isOpen('rateLimit')}
            onClose={modal.close('rateLimit')}
            queue={queue}
          />
        )}
        {modal.isMounted('rescheduleJob') && !!editJob && (
          <EditJobModalLazy
            open={modal.isOpen('rescheduleJob')}
            field="delay"
            job={editJob}
            onSubmit={(runAt) => jobActions.changeJobDelay(queue.name, editJob, runAt)()}
            onClose={() => {
              setEditJob(null);
              modal.close('rescheduleJob')();
            }}
          />
        )}
        {modal.isMounted('reprioritiseJob') && !!editJob && (
          <EditJobModalLazy
            open={modal.isOpen('reprioritiseJob')}
            field="priority"
            job={editJob}
            onSubmit={(priority) => jobActions.changeJobPriority(queue.name, editJob, priority)()}
            onClose={() => {
              setEditJob(null);
              modal.close('reprioritiseJob')();
            }}
          />
        )}
        {modal.isMounted('concurrency') && (
          <ConcurrencyModalLazy
            open={modal.isOpen('concurrency')}
            onClose={modal.close('concurrency')}
            queue={queue}
          />
        )}
      </Suspense>
    </section>
  );
};
