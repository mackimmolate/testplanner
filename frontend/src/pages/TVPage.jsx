import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

import api, { isMockMode } from '../api';
import { addDays, formatLocalDate, parseLocalDate, todayLocalDate } from '../dateUtils';

function buildTaskSignature(items) {
  return [...items]
    .map((item) => [
      item.machine_group?.id ?? '',
      item.article?.id ?? '',
      item.goal ?? 0,
      item.comment ?? '',
    ].join(':'))
    .sort()
    .join('|');
}

function SectionLabel({ children, tone = 'neutral' }) {
  return (
    <div
      className={clsx(
        'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em]',
        tone === 'current' && 'bg-sky-500/12 text-sky-200 ring-1 ring-sky-400/20',
        tone === 'upcoming' && 'bg-white/6 text-slate-300 ring-1 ring-white/10',
        tone === 'neutral' && 'bg-white/6 text-slate-300 ring-1 ring-white/10',
      )}
    >
      {children}
    </div>
  );
}

function TaskBlock({ item, tone = 'current' }) {
  const isSpecial =
    item.machine_group?.name === 'Sjuk' || item.machine_group?.name === 'Arbetsledning';

  return (
    <div
      className={clsx(
        'rounded-lg border px-3 py-2.5',
        tone === 'current' && 'border-slate-600 bg-slate-900/55 shadow-sm',
        tone === 'upcoming' && 'border-slate-700 bg-slate-900/25',
        item.machine_group?.name === 'Sjuk' &&
          (tone === 'current'
            ? 'border-red-400/50 bg-red-500/8'
            : 'border-red-400/30 bg-red-500/5'),
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-100">
            {item.machine_group?.name ?? 'Okänd'}
          </div>
          {!isSpecial && (
            <div className={clsx('truncate text-sm', tone === 'current' ? 'text-slate-300' : 'text-slate-400')}>
              {item.article?.name || '-'}
            </div>
          )}
        </div>

        {!isSpecial && (
          <div
            className={clsx(
              'shrink-0 rounded-md border px-2 py-1 text-xs font-medium',
              tone === 'current'
                ? 'border-slate-600 bg-slate-800 text-slate-200'
                : 'border-slate-700 bg-slate-900/50 text-slate-400',
            )}
          >
            Mål {item.goal}
          </div>
        )}
      </div>

      {item.comment && (
        <div className="mt-2 border-t border-white/8 pt-2 text-xs text-slate-400">
          {item.comment}
        </div>
      )}
    </div>
  );
}

function TVPage() {
  const [employees, setEmployees] = useState([]);
  const [planData, setPlanData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    const loadPlans = async () => {
      try {
        const today = todayLocalDate();
        const dates = [];
        for (let offset = 0; offset < 7; offset += 1) {
          dates.push(formatLocalDate(addDays(today, offset)));
        }

        const [dataRes, ...planResponses] = await Promise.all([
          api.get('/data'),
          ...dates.map(async (targetDate) => ({
            date: targetDate,
            items: (await api.get(`/plan?target_date=${targetDate}`)).data,
          })),
        ]);

        if (!isActive) {
          return;
        }

        setEmployees(
          [...dataRes.data.employees].sort((left, right) => left.name.localeCompare(right.name)),
        );
        setPlanData(planResponses);
      } catch (error) {
        console.error('Kunde inte hämta plan', error);
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    void loadPlans();
    const intervalId = window.setInterval(() => {
      void loadPlans();
    }, 30000);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-3xl text-slate-100">
        Laddar...
      </div>
    );
  }

  const today = todayLocalDate();
  const todayItems = planData.find((entry) => entry.date === today)?.items || [];
  const futureDays = planData.filter((entry) => entry.date > today);

  const groupedPlan = employees.map((employee) => {
    const current = todayItems.filter((item) => item.employee.id === employee.id);
    const currentSignature = buildTaskSignature(current);
    const isSick = current.some((item) => item.machine_group?.name === 'Sjuk');

    let upcoming = [];
    let upcomingDate = null;

    for (const day of futureDays) {
      const userItems = day.items.filter((item) => item.employee.id === employee.id);
      const nextSignature = buildTaskSignature(userItems);
      if (nextSignature !== currentSignature) {
        upcoming = userItems;
        upcomingDate = day.date;
        break;
      }
    }

    return {
      employee,
      current,
      upcoming,
      upcomingDate,
      isSick,
    };
  });

  return (
    <div className="min-h-screen bg-slate-950 p-3 text-slate-100">
      <header className="mb-4 flex items-center justify-between gap-4 px-1">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-wide text-slate-100">Planering</h1>
          {isMockMode && (
            <span className="rounded border border-yellow-700/60 bg-yellow-900/30 px-2 py-0.5 text-xs text-yellow-200">
              Demo
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="text-sm text-slate-400">
            {new Date().toLocaleDateString('sv-SE', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </div>
          <Link to="/admin" className="text-slate-500 transition-colors hover:text-slate-300">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          </Link>
        </div>
      </header>

      {groupedPlan.length === 0 ? (
        <div className="flex h-[80vh] items-center justify-center text-2xl text-slate-500">
          Ingen plan
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {groupedPlan.map((group) => (
            <div
              key={group.employee.id}
              className={clsx(
                'flex min-h-[230px] flex-col rounded-xl border bg-slate-900 shadow-[0_12px_30px_rgba(0,0,0,0.22)]',
                group.isSick ? 'border-red-400/40' : 'border-slate-800',
              )}
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-3 py-2.5">
                <div className="truncate text-sm font-semibold text-slate-100">
                  {group.employee.name}
                </div>
                <div className="shrink-0 font-mono text-[11px] text-slate-500">
                  {group.employee.number}
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-3 p-3">
                <section className="min-h-[112px] rounded-lg border border-slate-800 bg-slate-800/40 p-3">
                  <div className="mb-2">
                    <SectionLabel tone="current">Nu</SectionLabel>
                  </div>
                  {group.current.length > 0 ? (
                    <div className="space-y-2">
                      {group.current.map((item) => (
                        <TaskBlock key={item.id} item={item} tone="current" />
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">Ingen plan</div>
                  )}
                </section>

                <section className="rounded-lg border border-dashed border-slate-800 bg-slate-950/35 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <SectionLabel tone="upcoming">Nästa</SectionLabel>
                    {group.upcomingDate && (
                      <div className="text-[11px] text-slate-500">
                        {parseLocalDate(group.upcomingDate).toLocaleDateString('sv-SE', {
                          day: 'numeric',
                          month: 'numeric',
                        })}
                      </div>
                    )}
                  </div>

                  {group.upcoming.length > 0 ? (
                    <div className="space-y-2">
                      {group.upcoming.map((item) => (
                        <TaskBlock key={item.id} item={item} tone="upcoming" />
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-600">Ingen ändring planerad</div>
                  )}
                </section>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TVPage;
