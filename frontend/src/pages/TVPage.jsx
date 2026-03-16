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

function SectionPill({ children, tone = 'current' }) {
  return (
    <span
      className={clsx(
        'inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]',
        tone === 'current' && 'bg-sky-400/12 text-sky-200 ring-1 ring-sky-300/20',
        tone === 'upcoming' && 'bg-amber-300/10 text-amber-100 ring-1 ring-amber-200/15',
      )}
    >
      {children}
    </span>
  );
}

function TaskCard({ item, variant = 'current' }) {
  const isSpecial =
    item.machine_group?.name === 'Sjuk' || item.machine_group?.name === 'Arbetsledning';
  const isSick = item.machine_group?.name === 'Sjuk';

  return (
    <article
      className={clsx(
        'rounded-xl border px-3.5 py-3',
        variant === 'current' && 'border-slate-700 bg-slate-950/65 shadow-[0_10px_24px_rgba(2,6,23,0.28)]',
        variant === 'upcoming' && 'border-slate-800 bg-slate-950/30',
        isSick && variant === 'current' && 'border-red-400/45 bg-red-500/8',
        isSick && variant === 'upcoming' && 'border-red-400/25 bg-red-500/5',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className={clsx(
              'truncate text-[11px] font-semibold uppercase tracking-[0.16em]',
              isSick
                ? 'text-red-200'
                : variant === 'current'
                  ? 'text-sky-200'
                  : 'text-amber-100/85',
            )}
          >
            {item.machine_group?.name ?? 'Okänd'}
          </div>

          {!isSpecial && (
            <div
              className={clsx(
                'mt-1 truncate text-[15px] font-semibold leading-tight',
                variant === 'current' ? 'text-slate-100' : 'text-slate-300',
              )}
            >
              {item.article?.name || '-'}
            </div>
          )}

          {isSpecial && (
            <div
              className={clsx(
                'mt-1 text-[15px] font-semibold leading-tight',
                isSick ? 'text-red-100' : 'text-slate-100',
              )}
            >
              {isSick ? 'Ej i produktion idag' : 'Arbetar utanför ordinarie flöde'}
            </div>
          )}
        </div>

        {!isSpecial && (
          <div
            className={clsx(
              'shrink-0 rounded-lg border px-2.5 py-1.5 text-xs font-semibold',
              variant === 'current'
                ? 'border-slate-700 bg-slate-900 text-slate-100'
                : 'border-slate-800 bg-slate-950/60 text-slate-400',
            )}
          >
            Mål {item.goal}
          </div>
        )}
      </div>

      {item.comment && (
        <div
          className={clsx(
            'mt-3 rounded-lg border px-2.5 py-2 text-xs leading-relaxed',
            variant === 'current'
              ? 'border-white/8 bg-white/3 text-slate-300'
              : 'border-white/6 bg-black/10 text-slate-400',
          )}
        >
          {item.comment}
        </div>
      )}
    </article>
  );
}

function EmployeePanel({ group }) {
  const isIdle = group.current.length === 0 && group.upcoming.length === 0;

  return (
    <section
      className={clsx(
        'flex h-full min-h-[280px] flex-col rounded-[22px] border shadow-[0_18px_40px_rgba(2,6,23,0.34)] backdrop-blur-sm',
        group.isSick
          ? 'border-red-400/35 bg-[linear-gradient(180deg,rgba(37,16,22,0.98),rgba(15,23,42,0.95))]'
          : isIdle
            ? 'border-slate-800 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,6,23,0.96))] opacity-80'
            : 'border-slate-700/80 bg-[linear-gradient(180deg,rgba(22,34,56,0.96),rgba(3,7,18,0.98))]',
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-slate-100">
            {group.employee.name}
          </div>
        </div>
        <div className="shrink-0 rounded-full bg-white/4 px-2.5 py-1 font-mono text-xs text-slate-400 ring-1 ring-white/8">
          {group.employee.number}
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-h-[154px] rounded-2xl border border-slate-700/70 bg-slate-900/28 p-3.5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <SectionPill tone="current">Nu</SectionPill>
            {group.current.length > 0 && (
              <div className="text-[11px] text-slate-500">
                {group.current.length} {group.current.length === 1 ? 'uppgift' : 'uppgifter'}
              </div>
            )}
          </div>

          {group.current.length > 0 ? (
            <div className="space-y-2.5">
              {group.current.map((item) => (
                <TaskCard key={item.id} item={item} variant="current" />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/25 px-3 py-6 text-center text-sm text-slate-500">
              Ingen plan just nu
            </div>
          )}
        </div>

        <div className="mt-auto rounded-2xl border border-dashed border-slate-800 bg-slate-950/32 p-3.5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <SectionPill tone="upcoming">Nästa</SectionPill>
            {group.upcomingDate && (
              <div className="rounded-full bg-white/4 px-2 py-1 text-[11px] text-slate-400 ring-1 ring-white/8">
                {parseLocalDate(group.upcomingDate).toLocaleDateString('sv-SE', {
                  day: 'numeric',
                  month: 'numeric',
                })}
              </div>
            )}
          </div>

          {group.upcoming.length > 0 ? (
            <div className="space-y-2.5">
              {group.upcoming.map((item) => (
                <TaskCard key={item.id} item={item} variant="upcoming" />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-white/6 bg-black/10 px-3 py-4 text-sm text-slate-600">
              Ingen ändring planerad
            </div>
          )}
        </div>
      </div>
    </section>
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
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#08101f_0%,#020617_100%)]" />
        <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-sky-500/8 blur-3xl" />
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-amber-300/6 blur-3xl" />
      </div>

      <div className="relative p-4">
        <header className="mb-5 flex items-center justify-between gap-4 rounded-[22px] border border-white/8 bg-white/4 px-5 py-4 shadow-[0_18px_40px_rgba(2,6,23,0.28)] backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Produktion
              </div>
              <h1 className="text-2xl font-semibold tracking-[0.02em] text-slate-50">
                Planering
              </h1>
            </div>
            {isMockMode && (
              <span className="rounded-full border border-yellow-700/60 bg-yellow-900/30 px-2.5 py-1 text-xs font-semibold text-yellow-200">
                Demo
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden rounded-full border border-white/8 bg-black/10 px-3 py-2 text-sm text-slate-300 md:block">
              {new Date().toLocaleDateString('sv-SE', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </div>
            <Link
              to="/admin"
              className="rounded-full border border-white/8 bg-black/10 p-2.5 text-slate-400 transition-colors hover:text-slate-100"
            >
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
          <div className="flex h-[80vh] items-center justify-center rounded-[22px] border border-white/8 bg-white/4 text-2xl text-slate-500 backdrop-blur-sm">
            Ingen plan
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {groupedPlan.map((group) => (
              <EmployeePanel key={group.employee.id} group={group} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default TVPage;
