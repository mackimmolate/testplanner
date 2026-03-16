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
      <div className="flex min-h-screen items-center justify-center bg-gray-900 text-4xl text-white">
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
    <div className="min-h-screen overflow-hidden bg-gray-900 p-2 text-white">
      <header className="mb-4 flex items-center justify-between px-2">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold tracking-wider text-blue-400">Planering</h1>
          {isMockMode && (
            <span className="rounded border border-yellow-700 bg-yellow-900/50 px-2 py-0.5 text-xs text-yellow-200">
              Demo
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="font-mono text-xl text-gray-400">
            {new Date().toLocaleDateString('sv-SE', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </div>
          <Link to="/admin" className="text-gray-600 transition-colors hover:text-gray-400">
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
        <div className="flex h-[80vh] items-center justify-center text-3xl text-gray-500">
          Ingen plan
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {groupedPlan.map((group) => (
            <div
              key={group.employee.id}
              className={clsx(
                'flex min-h-[140px] flex-col rounded border shadow',
                group.isSick ? 'border-red-500/50 bg-red-900/30' : 'border-gray-700 bg-gray-800',
              )}
            >
              <div
                className={clsx(
                  'flex items-center justify-between border-b px-2 py-1',
                  group.isSick ? 'border-red-500/30 bg-red-900/50' : 'border-gray-600 bg-gray-700',
                )}
              >
                <h2 className="truncate text-sm font-bold text-white">
                  {group.employee.name}{' '}
                  <span className="ml-0.5 text-xs text-gray-400">({group.employee.number})</span>
                </h2>
              </div>

              <div className="flex flex-1 flex-col gap-2 p-2">
                {group.current.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {group.current.map((item, index) => {
                      const isSpecial = (
                        item.machine_group?.name === 'Sjuk' ||
                        item.machine_group?.name === 'Arbetsledning'
                      );

                      return (
                        <div
                          key={item.id}
                          className={clsx(
                            'rounded border-l-2 bg-gray-900/60 p-1.5',
                            item.machine_group?.name === 'Sjuk' ? 'border-red-500' : 'border-green-500',
                            isSpecial && 'flex min-h-[5rem] flex-col items-center justify-center text-center',
                          )}
                        >
                          <div className="flex w-full items-start justify-between">
                            <div
                              className={clsx(
                                'mb-0.5 uppercase leading-none tracking-wider',
                                item.machine_group?.name === 'Sjuk'
                                  ? 'w-full text-center text-xl font-bold text-red-500'
                                  : isSpecial
                                    ? 'w-full text-center text-xl font-bold text-green-400'
                                    : 'text-lg font-bold text-green-400',
                              )}
                            >
                              {item.machine_group?.name ?? 'Okänd'}
                            </div>
                            {!isSpecial && (
                              <span className="ml-1 font-mono text-[10px] text-gray-500">#{index + 1}</span>
                            )}
                          </div>

                          {!isSpecial && (
                            <>
                              <div className="mb-1 text-lg font-bold leading-tight text-white">
                                {item.article?.name || '-'}
                              </div>
                              <div className="flex w-full items-center justify-between text-gray-300">
                                <div className="text-xs text-gray-500">Mål</div>
                                <div className="font-mono text-xl font-bold leading-none text-blue-300">
                                  {item.goal}
                                </div>
                              </div>
                            </>
                          )}

                          {item.comment && (
                            <div className="mt-1 w-full break-words border-t border-gray-700 pt-0.5 text-center text-sm italic text-yellow-200">
                              "{item.comment}"
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-2 text-center text-xs italic text-gray-600">Ingen plan</div>
                )}

                {group.upcoming.length > 0 && (
                  <div className="mt-auto border-t border-gray-700/50 pt-1">
                    <div className="mb-1 flex items-center justify-between">
                      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-yellow-500">
                        Nästa
                      </h3>
                      {group.upcomingDate && (
                        <span className="text-[10px] text-gray-500">
                          {parseLocalDate(group.upcomingDate).toLocaleDateString('sv-SE', {
                            day: 'numeric',
                            month: 'numeric',
                          })}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      {group.upcoming.map((item) => (
                        <div
                          key={item.id}
                          className="rounded border-l-2 border-yellow-500/30 bg-gray-800/60 p-1 opacity-70"
                        >
                          <div className="truncate">
                            <div className="text-[10px] leading-none text-gray-500">
                              {item.machine_group?.name ?? 'Okänd'}
                            </div>
                            <div className="truncate text-[10px] font-medium text-gray-300">
                              {item.article?.name || '-'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TVPage;
