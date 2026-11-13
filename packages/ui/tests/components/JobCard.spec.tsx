import type { AppJob, Status } from '@bull-board/api/typings/app';
import { screen } from '@testing-library/react';
import { JobCard } from '../../src/components/JobCard/JobCard';
import { createWrapper, render } from '../testUtils';

// The real module spins up a web worker through `import.meta.url`, which Jest cannot parse.
jest.mock('../../src/utils/highlight/highlight', () => ({
  asyncHighlight: (code: string) => Promise.resolve(code),
}));

const baseJob = {
  id: '7',
  name: 'webhook',
  timestamp: 1_700_000_000_000,
  processedOn: 1_700_000_001_000,
  finishedOn: 1_700_000_002_000,
  progress: 0,
  attempts: 1,
  stacktrace: [],
  opts: {},
  data: { orderId: 1 },
  returnValue: null,
  isFailed: false,
} as unknown as AppJob;

const noop = () => Promise.resolve() as any;
const actions = {
  updateJobData: jest.fn(),
  duplicateJob: jest.fn(),
  rescheduleJob: jest.fn(),
  reprioritiseJob: jest.fn(),
  removeUnprocessedChildren: noop,
  promoteJob: noop,
  retryJob: noop,
  cleanJob: noop,
  getJobLogs: () => Promise.resolve([]),
};

const renderCard = (job: AppJob, status: Status) => {
  const { Wrapper } = createWrapper({ api: {} });
  return render(<JobCard job={job} status={status} actions={actions} readOnlyMode allowRetries />, {
    wrapper: Wrapper,
  });
};

it('puts the first line of a failed job error in a red banner under the latest tab', () => {
  renderCard(
    {
      ...baseJob,
      isFailed: true,
      failedReason: 'Request failed with status 500\n    at handler (worker.js:10)',
    },
    'latest'
  );

  const banner = screen.getByRole('alert');
  expect(banner.textContent).toContain('JOB.FAILED_LABEL');
  expect(banner.textContent).toContain('Request failed with status 500');
  expect(banner.textContent).not.toContain('worker.js');
  // The error tab comes first for a failed job, wherever it is listed.
  expect(screen.getAllByRole('tab')[0].textContent).toBe('JOB.TABS.ERROR');
});

it('shows no banner for a job that did not fail, or one completed after a failed attempt', () => {
  renderCard(baseJob, 'latest');
  expect(screen.queryByRole('alert')).toBeNull();
});

it('keeps a job completed on retry free of the banner', () => {
  renderCard({ ...baseJob, isFailed: true, failedReason: 'first try failed' }, 'completed');
  expect(screen.queryByRole('alert')).toBeNull();
});
