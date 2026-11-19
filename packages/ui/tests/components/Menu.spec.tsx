import type { GetQueuesResponse } from '@bull-board/api/typings/responses';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Menu } from '../../src/components/Menu/Menu';
import { useMenuState } from '../../src/hooks/useMenuState';
import { useSettingsStore } from '../../src/hooks/useSettings';
import { createWrapper, render, makeQueue } from '../testUtils';

beforeEach(() => {
  useSettingsStore.setState({
    pollingInterval: 0,
    jobsPerPage: 10,
    confirmQueueActions: false,
    sortQueues: false,
    sidebarCollapsed: false,
  });
  useMenuState.setState({ state: {} });
});

function renderMenu(hasHistoryProvider: boolean | undefined, jobSchedulerCount = 0) {
  const getQueues = jest.fn(() =>
    Promise.resolve<GetQueuesResponse>({ queues: [makeQueue('test', { jobSchedulerCount })] })
  );

  const api = { getQueues };
  const { Wrapper } = createWrapper({
    api,
    uiConfig: hasHistoryProvider === undefined ? {} : { hasHistoryProvider },
  });
  render(<Menu />, { wrapper: Wrapper });
  return api;
}

it('renders the metrics-history nav link when hasHistoryProvider is true', async () => {
  renderMenu(true);

  const link = await screen.findByText('MENU.METRICS_HISTORY');
  expect(link.getAttribute('href')).toContain('metrics-history');
});

it('does not render the metrics-history nav link when hasHistoryProvider is false', async () => {
  renderMenu(false);

  // Wait for the queues list to settle so we're not just observing a pre-render gap.
  await screen.findByText('test');
  expect(screen.queryByText('MENU.METRICS_HISTORY')).toBeNull();
});

it('does not render the metrics-history nav link when hasHistoryProvider is undefined', async () => {
  renderMenu(undefined);

  await screen.findByText('test');
  expect(screen.queryByText('MENU.METRICS_HISTORY')).toBeNull();
});

it('renders the schedulers nav link once a queue has a scheduler', async () => {
  renderMenu(false, 2);

  const link = await screen.findByText('MENU.SCHEDULERS');
  expect(link.getAttribute('href')).toContain('job-schedulers');
});

it('does not render the schedulers nav link when nothing is scheduled', async () => {
  renderMenu(false, 0);

  expect(screen.queryByText('MENU.SCHEDULERS')).toBeNull();
});

it('collapses and reopens a queue group when its header is clicked', async () => {
  const getQueues = jest.fn(() =>
    Promise.resolve<GetQueuesResponse>({ queues: [makeQueue('billing.invoices')] })
  );
  const { Wrapper } = createWrapper({ api: { getQueues }, uiConfig: {} });
  render(<Menu />, { wrapper: Wrapper });

  const group = await screen.findByText('billing');
  expect(screen.queryByText('invoices')).toBeTruthy();

  fireEvent.click(group);
  await waitFor(() => expect(screen.queryByText('invoices')).toBeNull());

  fireEvent.click(screen.getByText('billing'));
  await waitFor(() => expect(screen.queryByText('invoices')).toBeTruthy());
});

it('shows a pill per status, zeros included, summed on groups, and a sort menu', async () => {
  const counts = (completed: number, failed: number) => ({
    ...makeQueue('x').counts,
    completed,
    failed,
  });
  const getQueues = jest.fn(() =>
    Promise.resolve<GetQueuesResponse>({
      queues: [
        makeQueue('Checkout-Order', { delimiter: undefined, counts: counts(1200, 3) }),
        makeQueue('Checkout-Abandoned', { delimiter: undefined, counts: counts(5, 0) }),
      ],
    })
  );
  useSettingsStore.setState({ groupByPrefix: true });
  const { Wrapper } = createWrapper({ api: { getQueues } });
  render(<Menu />, { wrapper: Wrapper });

  const pill = (root: Element, status: string) =>
    root.querySelector(`li[title="${status}"]`)?.textContent;

  // The group sums its queues; every status the queues report has a pill, zero or not.
  const group = (await screen.findByText('Checkout')).closest('button')!;
  expect(pill(group, 'completed')).toBe('1205');
  expect(pill(group, 'failed')).toBe('3');
  expect(pill(group, 'waiting')).toBe('0');

  // Groups may start open; open it only if it is not. Leaves keep their full queue name.
  if (!screen.queryByText('Checkout-Order')) fireEvent.click(group);
  const order = (await screen.findByText('Checkout-Order')).closest('a')!;
  expect(pill(order, 'failed')).toBe('3');
  expect(pill(screen.getByText('Checkout-Abandoned').closest('a')!, 'failed')).toBe('0');

  expect(screen.getByRole('button', { name: 'MENU.SORT' })).toBeTruthy();
  useSettingsStore.setState({ groupByPrefix: undefined });
});
