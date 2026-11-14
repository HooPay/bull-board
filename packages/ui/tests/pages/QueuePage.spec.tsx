import type { AppQueue } from '@bull-board/api/typings/app';
import type { GetQueuesResponse } from '@bull-board/api/typings/responses';
import { waitFor } from '@testing-library/react';
import { createMemoryHistory } from 'history';
import { useSettingsStore } from '../../src/hooks/useSettings';
import { QueuePage } from '../../src/pages/QueuePage/QueuePage';
import { createWrapper, makeQueue, render } from '../testUtils';

jest.mock('../../src/utils/highlight/highlight', () => ({
  asyncHighlight: async (code: string) => code,
}));

beforeEach(() => {
  useSettingsStore.setState({ pollingInterval: 0, jobsPerPage: 10 });
});

function renderPage(overrides: Partial<AppQueue> = {}) {
  const queues = [makeQueue('reports', { jobSchedulerCount: 2, ...overrides })];
  const getQueues = jest.fn(() => Promise.resolve<GetQueuesResponse>({ queues }));
  const { Wrapper } = createWrapper({
    api: { getQueues },
    history: createMemoryHistory({ initialEntries: ['/queue/reports'] }),
  });

  const { container } = render(<QueuePage />, { wrapper: Wrapper });

  const schedulersLink = () => container.querySelector('a[href*="/job-schedulers"]');

  return { container, schedulersLink };
}

it('renders the schedulers link with the badges at the end of the jobs toolbar', async () => {
  const { container, schedulersLink } = renderPage();

  await waitFor(() => expect(schedulersLink()).toBeTruthy());
  expect(container.querySelector('.badges a[href*="/job-schedulers"]')).toBeTruthy();
});

it('lists the jobs as Bull Monitor table rows, a failed one with its error up front', async () => {
  const job = {
    id: '42',
    name: 'webhook',
    timestamp: new Date(2026, 10, 14, 9, 5, 7).getTime(),
    processedOn: new Date(2026, 10, 14, 9, 5, 8).getTime(),
    finishedOn: new Date(2026, 10, 14, 9, 5, 10).getTime(),
    progress: 0,
    attempts: 3,
    stacktrace: ['Error: boom\n    at worker.js:1'],
    failedReason: 'Request failed with status 500',
    opts: {},
    data: { orderId: 7 },
    returnValue: null,
    isFailed: true,
  };
  const queues = [
    makeQueue('reports', { jobs: [job as any], counts: { ...makeQueue('x').counts, failed: 1 } }),
  ];
  const getQueues = jest.fn(() => Promise.resolve<GetQueuesResponse>({ queues }));
  const { Wrapper } = createWrapper({
    api: { getQueues },
    history: createMemoryHistory({ initialEntries: ['/queue/reports?status=failed'] }),
  });
  const { container, findByText, getByRole } = render(<QueuePage />, { wrapper: Wrapper });

  const row = (await findByText('webhook')).closest('tr')!;
  const cells = [...row.querySelectorAll('td')].map((cell) => cell.textContent);
  expect(cells).toEqual(
    expect.arrayContaining(['42', 'failed', 'webhook', '2026-11-14 09:05:07', '2s', '3'])
  );
  expect(getByRole('alert').textContent).toContain('Request failed with status 500');
  expect(container.textContent).toContain('MONITOR.RANGE');
});

it('keeps the schedulers link on a read only queue', async () => {
  const { schedulersLink } = renderPage({ readOnlyMode: true });

  await waitFor(() => expect(schedulersLink()).toBeTruthy());
});
