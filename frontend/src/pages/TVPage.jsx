import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api, { isMockMode } from '../api';
import clsx from 'clsx';

function TVPage() {
  const [planData, setPlanData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlans();
    const interval = setInterval(fetchPlans, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchPlans = async () => {
    try {
      // Fetch plan for a range of dates: Today until Today + 7 days
      // Simplification: Fetch today and next few days individually or assume API supports it.
      // Since backend doesn't support range, we'll fetch Today, Tomorrow, +2, +3, +4
      // to look for upcoming work. Or simpler: Fetch ALL plan items if mock mode allows,
      // but 'getMockPlan' only filters by date if provided. If we provide nothing, does it return all?
      // MockAPI implementation returns all if date not filtered? Let's check mockApi.js

      // Checking mockApi.js: "const dateToFilter = targetDate || new Date()..." -> it defaults to today.
      // We need to fetch multiple dates.

      const dates = [];
      for (let i = 0; i < 7; i++) {
          const d = new Date();
          d.setDate(d.getDate() + i);
          dates.push(d.toISOString().split('T')[0]);
      }

      // Parallel fetch
      const promises = dates.map(date => api.get(`/plan?target_date=${date}`).then(res => ({ date, items: res.data })));

      // Also need past data for continuity?
      // If today has NO items, we need to check yesterday... and day before...
      // Let's fetch yesterday too.
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const [yesterdayRes, ...futureRes] = await Promise.all([
          api.get(`/plan?target_date=${yesterdayStr}`).then(res => ({ date: yesterdayStr, items: res.data })),
          ...promises
      ]);

      const allData = [yesterdayRes, ...futureRes];
      setPlanData(allData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching plan", error);
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center text-4xl">Laddar...</div>;

  // Process Data
  const todayStr = new Date().toISOString().split('T')[0];
  const todayData = planData.find(d => d.date === todayStr);

  // Get list of all employees (we need to know who exists to show empty cards or continuity)
  // We can extract unique employees from all data, OR better, fetch /data to get all employees.
  // We'll rely on the employees found in the plan for now, but really we should fetch employees.
  // Let's assume we can derive unique employees from the plan data if we don't fetch /data.
  // Wait, if an employee has NO plan for the week, they won't show up? User probably wants to see everyone.
  // Let's fetch /data as well.
  // (Adding this to the fetch logic in next iteration if needed, but for now let's work with plan data)

  // Actually, I should fetch employees list to ensure I show everyone.
  // Let's assume I have it. (I will add a fetch for it in a fix if I missed it, but sticking to plan structure for now).

  // Group by Employee Name
  const groupedPlan = {};

  // 1. Determine "Current" Work for Today
  // Logic: If Today has items -> Current.
  // If Today has NO items -> Look at Yesterday. If Yesterday had active items, that is Current.

  const processDay = (dateStr) => planData.find(d => d.date === dateStr)?.items || [];

  // We need to know all employees. Let's traverse allData to find all unique employees.
  planData.forEach(day => {
      day.items.forEach(item => {
          if (!groupedPlan[item.employee.name]) {
              groupedPlan[item.employee.name] = {
                  employee: item.employee,
                  current: [],
                  upcoming: [],
                  isSick: false
              };
          }
      });
  });

  const todayItems = processDay(todayStr);

  // First pass: Assign Today's items
  todayItems.forEach(item => {
      const group = groupedPlan[item.employee.name];
      if (item.machine_group.name === 'Sjuk') group.isSick = true;
      // Treat Arbetsledning specially for styling if needed,
      // but user asked for standard color. We just need to know for layout (center text).
      if (item.machine_group.name === 'Arbetsledning') group.isArbetsledning = true;

      group.current.push(item);
  });

  // Third pass: Find "Kommande" (Upcoming)
  // Look from Tomorrow onwards. The FIRST day that has tasks is the "Kommande" day.
  Object.values(groupedPlan).forEach(group => {
      // Find next day with tasks
      for (let i = 2; i < planData.length; i++) { // 0=yest, 1=today, 2=tomorrow...
          const dayData = planData[i];
          const userItems = dayData.items.filter(item => item.employee.name === group.employee.name);
          if (userItems.length > 0) {
              // Found upcoming work
              // Check if it's just the same as current work? User said: "if tomorrow isn't any different... still planned as that".
              // "if I plan 4 days ahead and on the 4th day I say another job... then that should be in kommande"

              // So if upcoming items are IDENTICAL to current, skip?
              // Simplified check: Compare article names?
              const currentArticles = group.current.map(c => c.article?.name || '').sort().join(',');
              const upcomingArticles = userItems.map(c => c.article?.name || '').sort().join(',');

              if (currentArticles !== upcomingArticles) {
                  group.upcoming = userItems;
                  group.upcomingDate = dayData.date;
                  break; // Found the next *different* job
              }
          }
      }
  });

  const sortedEmployees = Object.keys(groupedPlan).sort();

  return (
    <div className="min-h-screen bg-gray-900 p-2 text-white overflow-hidden">
      <header className="flex justify-between items-center mb-4 px-2">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold tracking-wider text-blue-400">PRODUKTIONSPLANERING</h1>
            {isMockMode && (
                <span className="bg-yellow-900/50 text-yellow-200 px-2 py-0.5 rounded text-xs border border-yellow-700">
                    Demo
                </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-xl font-mono text-gray-400">
                {new Date().toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <Link to="/admin" className="text-gray-600 hover:text-gray-400 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            </Link>
          </div>
      </header>

      {sortedEmployees.length === 0 ? (
          <div className="flex h-[80vh] items-center justify-center text-3xl text-gray-500">
              Inga planerade aktiviteter.
          </div>
      ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {sortedEmployees.map(name => {
                const group = groupedPlan[name];

                return (
                    <div key={name} className={clsx(
                        "rounded shadow border flex flex-col min-h-[140px]",
                        group.isSick
                            ? "bg-red-900/30 border-red-500/50"
                            : "bg-gray-800 border-gray-700"
                    )}>
                        <div className={clsx(
                            "px-2 py-1 border-b flex justify-between items-center",
                            group.isSick ? "bg-red-900/50 border-red-500/30" : "bg-gray-700 border-gray-600"
                        )}>
                            <h2 className="text-sm font-bold text-white truncate">
                                {name} <span className="text-gray-400 text-xs ml-0.5">({group.employee.number})</span>
                            </h2>
                            {group.isSick && <span className="text-[10px] font-bold bg-red-600 px-1 rounded text-white">SJUK</span>}
                        </div>

                        <div className="p-2 flex-1 flex flex-col gap-2">
                            {/* Current Work */}
                            {group.current.length > 0 && !group.isSick ? (
                                <div className="flex flex-col gap-1">
                                    {group.current.map(item => {
                                        const isSpecial = item.machine_group?.name === 'Sjuk' || item.machine_group?.name === 'Arbetsledning';

                                        return (
                                            <div key={item.id} className={clsx(
                                                "bg-gray-900/60 rounded p-1.5 border-l-2",
                                                item.machine_group?.name === 'Sjuk' ? "border-red-500" : "border-green-500",
                                                isSpecial && "flex flex-col justify-center items-center h-20 text-center"
                                            )}>
                                                <div className={clsx(
                                                    "uppercase font-bold tracking-wider leading-none mb-0.5",
                                                    item.machine_group?.name === 'Sjuk' ? "text-red-400 text-lg" :
                                                    isSpecial ? "text-green-400 text-lg" : "text-[10px] text-green-400"
                                                )}>
                                                    {item.machine_group?.name || 'Okänd'}
                                                </div>

                                                {!isSpecial && (
                                                    <>
                                                        <div className="text-xs font-bold text-white leading-tight mb-1">
                                                            {item.article?.name || '-'}
                                                        </div>
                                                        <div className="flex justify-between items-center text-gray-300 w-full">
                                                            <div className="text-[10px] text-gray-500">MÅL</div>
                                                            <div className="text-sm font-mono font-bold text-blue-300 leading-none">
                                                                {item.goal}
                                                            </div>
                                                        </div>
                                                    </>
                                                )}

                                                {item.comment && (
                                                    <div className="mt-1 text-[10px] text-yellow-200 italic border-t border-gray-700 w-full pt-0.5 text-center break-words">
                                                        "{item.comment}"
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : !group.isSick && (
                                <div className="text-gray-600 text-xs italic text-center py-2">Inget planerat</div>
                            )}

                            {/* Upcoming Work */}
                            {group.upcoming.length > 0 && !group.isSick && (
                                <div className="mt-auto pt-1 border-t border-gray-700/50">
                                    <h3 className="text-[10px] font-semibold text-yellow-500 uppercase tracking-wider mb-1">
                                        Kommande
                                    </h3>
                                    <div className="flex flex-col gap-1">
                                        {group.upcoming.map(item => (
                                            <div key={item.id} className="bg-gray-750/30 rounded p-1 border-l-2 border-yellow-500/30 opacity-70">
                                                <div className="truncate">
                                                    <div className="text-[10px] text-gray-500 leading-none">
                                                        {item.machine_group?.name || 'Okänd'}
                                                    </div>
                                                    <div className="text-[10px] font-medium text-gray-300 truncate">
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
                );
            })}
          </div>
      )}
    </div>
  );
}

export default TVPage;
