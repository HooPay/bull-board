import type { AppQueue, JobsOrder } from '@bull-board/api/typings/app';
import { CircleHelp, Delete, Info, ListFilter, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  hasActiveJobFilters,
  JobFilters as Filters,
  useJobFilters,
} from '../../hooks/useJobFilters';
import { useSettingsStore } from '../../hooks/useSettings';
import { IconButton } from '../Monitor/IconButton';
import { OutlinedInput, OutlinedSelect } from '../Monitor/OutlinedField';
import { FilterBuilder } from './FilterBuilder';
import s from './JobFilters.module.css';

const TYPING_DEBOUNCE_MS = 400;

/** A text input that follows the URL and writes back to it once typing pauses. */
function useDebouncedFilter(
  value: string,
  commit: (value: string) => void
): [string, (value: string) => void, () => void] {
  const [draft, setDraft] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Follows the URL when it changes underneath (back button, another queue, a shared link).
  useEffect(() => setDraft(value), [value]);
  useEffect(() => () => clearTimeout(timer.current ?? undefined), []);

  const change = (next: string) => {
    setDraft(next);
    clearTimeout(timer.current ?? undefined);
    timer.current = setTimeout(() => commit(next), TYPING_DEBOUNCE_MS);
  };
  const flush = () => {
    clearTimeout(timer.current ?? undefined);
    if (draft !== value) commit(draft);
  };
  return [draft, change, flush];
}

/** Examples of the search syntax; picking one puts it in the search field. */
const SEARCH_EXAMPLES = [
  { code: 'data.payload.organizationId = 77', help: 'QUEUE.FILTERS.SEARCH_HELP_EQUALS' },
  { code: "data.email ILIKE '%@hoopay.com.br'", help: 'QUEUE.FILTERS.SEARCH_HELP_LIKE' },
  { code: "data.status IN ('paid', 'refunded')", help: 'QUEUE.FILTERS.SEARCH_HELP_IN' },
  { code: 'data.coupon IS NULL', help: 'QUEUE.FILTERS.SEARCH_HELP_NULL' },
  { code: "name = 'webhook' AND data.amount >= 100", help: 'QUEUE.FILTERS.SEARCH_HELP_COMBINE' },
  { code: "$icontains(data.description, 'pix')", help: 'QUEUE.FILTERS.SEARCH_HELP_CONTAINS' },
] as const;

export const JobFilters = ({ queue }: { queue: AppQueue }) => {
  const { t } = useTranslation();
  const [filters, update] = useJobFilters();
  const set = (key: keyof Filters) => (value: string) => update({ [key]: value });

  const [jobId, changeJobId, flushJobId] = useDebouncedFilter(filters.jobId, set('jobId'));
  const [search, changeSearch, flushSearch] = useDebouncedFilter(filters.search, set('search'));

  const result = hasActiveJobFilters(filters) ? queue.search : undefined;
  const [builderOpen, setBuilderOpen] = useState(false);

  const hideTip = useSettingsStore((state) => !!state.hideSearchTip);
  const setSettings = useSettingsStore((state) => state.setSettings);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const pick = (code: string) => {
    changeSearch(code);
    update({ search: code });
  };

  return (
    <div className={s.filters}>
      {!hideTip && (
        <div className={s.tip} role="note">
          <Info className={s.tipIcon} />
          <span className={s.tipMessage}>
            {t('QUEUE.FILTERS.TIP_BEFORE')}
            <a href="https://docs.jsonata.org/overview.html" target="_blank" rel="noreferrer">
              jsonata
            </a>
            {t('QUEUE.FILTERS.TIP_MIDDLE')}
            <a
              href="#examples"
              onClick={(event) => {
                event.preventDefault();
                setExamplesOpen((open) => !open);
              }}
            >
              {t('QUEUE.FILTERS.TIP_EXAMPLES')}
            </a>
            .
          </span>
          <IconButton
            size="small"
            className={s.tipClose}
            label={t('QUEUE.FILTERS.TIP_CLOSE')}
            onClick={() => setSettings({ hideSearchTip: true })}
          >
            <X />
          </IconButton>
        </div>
      )}

      <div className={s.row}>
        <OutlinedInput
          className={s.jobId}
          label={t('QUEUE.FILTERS.JOB_ID')}
          value={jobId}
          onChange={changeJobId}
          inputProps={{ onKeyDown: (event) => event.key === 'Enter' && flushJobId() }}
        />
        <OutlinedSelect
          className={s.order}
          label={t('QUEUE.FILTERS.ORDER')}
          value={filters.order}
          onChange={(order) => update({ order: order as JobsOrder })}
          options={[
            { value: 'desc', text: t('QUEUE.FILTERS.ORDER_DESC') },
            { value: 'asc', text: t('QUEUE.FILTERS.ORDER_ASC') },
          ]}
        />
        <OutlinedInput
          className={s.search}
          label={t('QUEUE.FILTERS.SEARCH')}
          value={search}
          onChange={changeSearch}
          inputProps={{
            placeholder: t('QUEUE.FILTERS.SEARCH_PLACEHOLDER'),
            onKeyDown: (event) => event.key === 'Enter' && flushSearch(),
          }}
          endAdornment={
            <>
              <IconButton
                size="small"
                label={t('QUEUE.FILTERS.SEARCH_HELP')}
                aria-expanded={examplesOpen}
                onClick={() => setExamplesOpen((open) => !open)}
              >
                <CircleHelp className={s.smallIcon} />
              </IconButton>
              <IconButton
                size="small"
                label={t('QUEUE.FILTERS.CLEAR')}
                onClick={() => {
                  changeSearch('');
                  update({ search: '' });
                }}
              >
                <Delete className={s.smallIcon} />
              </IconButton>
            </>
          }
        />
        <button
          type="button"
          className={s.builderToggle}
          aria-pressed={builderOpen}
          onClick={() => setBuilderOpen((open) => !open)}
        >
          <ListFilter />
          {t('QUEUE.FILTERS.BUILDER')}
        </button>
      </div>

      {examplesOpen && (
        <ul className={s.helpList} id="examples">
          {SEARCH_EXAMPLES.map((example) => (
            <li key={example.code}>
              <button type="button" className={s.example} onClick={() => pick(example.code)}>
                {example.code}
              </button>
              <span className={s.exampleHelp}>{t(example.help)}</span>
            </li>
          ))}
        </ul>
      )}

      {builderOpen && <FilterBuilder queueName={queue.name} jobs={queue.jobs} onApply={pick} />}

      {result && (
        <p className={s.result} role="status">
          {t('QUEUE.FILTERS.RESULT', { count: result.matched })}
          {result.truncated && (
            <span className={s.truncated}>
              {' · '}
              {t('QUEUE.FILTERS.TRUNCATED', { scanned: result.scanned.toLocaleString() })}
            </span>
          )}
        </p>
      )}
    </div>
  );
};
