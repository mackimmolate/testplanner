import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api, { isMockMode } from '../api';
import clsx from 'clsx';

function TVPage() {
  const [plan, setPlan] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlan();
    const interval = setInterval(fetchPlan, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchPlan = async () => {
    try {
      const res = await api.get('/plan');
      setPlan(res.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching plan", error);
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center text-4xl">Laddar...</div>;

  // Group items
  const groupedPlan = {};
  plan.forEach(item => {
      const groupName = item.machine_group.name;
      if (!groupedPlan[groupName]) {
          groupedPlan[groupName] = { active: [], planned: [] };
      }
      if (item.status === 'active') {
          groupedPlan[groupName].active.push(item);
      } else {
          groupedPlan[groupName].planned.push(item);
      }
  });

  const sortedGroups = Object.keys(groupedPlan).sort();

  return (
    <div className="min-h-screen bg-gray-900 p-4 text-white">
      <header className="flex justify-between items-center mb-6 px-4">
          <div className="flex items-center gap-4">
            <h1 className="text-4xl font-bold tracking-wider text-blue-400">PRODUKTIONSPLANERING</h1>
            {isMockMode && (
                <span className="bg-yellow-900/50 text-yellow-200 px-3 py-1 rounded-full text-sm border border-yellow-700">
                    Demo Mode
                </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-2xl font-mono text-gray-400">
                {new Date().toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <Link to="/admin" className="text-gray-600 hover:text-gray-400 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            </Link>
          </div>
      </header>

      {sortedGroups.length === 0 ? (
          <div className="flex h-[80vh] items-center justify-center text-3xl text-gray-500">
              Inga planerade aktiviteter för idag.
          </div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedGroups.map(groupName => {
                const group = groupedPlan[groupName];
                // Only show if there are items? Or shows empty group?
                // The loop is based on plan items, so only groups with items exist.

                return (
                    <div key={groupName} className="bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-700 flex flex-col">
                        <div className="bg-gray-700 px-4 py-3 border-b border-gray-600 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white truncate">{groupName}</h2>
                        </div>

                        <div className="p-4 flex-1 flex flex-col gap-4">
                            {/* Active Section */}
                            {group.active.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-semibold text-green-400 uppercase tracking-wider mb-2">Pågående</h3>
                                    <div className="flex flex-col gap-3">
                                        {group.active.map(item => (
                                            <div key={item.id} className="bg-gray-750 rounded-lg p-3 border-l-4 border-green-500 shadow-sm bg-gray-900/50">
                                                <div className="text-lg font-bold text-white leading-tight mb-1">{item.article.name}</div>
                                                <div className="flex justify-between items-center text-gray-300">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-medium">{item.employee.name}</span>
                                                    </div>
                                                    <div className="text-xl font-mono font-bold text-blue-300">
                                                        Mål: {item.goal}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Planned Section */}
                            {group.planned.length > 0 && (
                                <div className={clsx(group.active.length > 0 && "mt-2 pt-2 border-t border-gray-700")}>
                                    <h3 className="text-xs font-semibold text-yellow-500 uppercase tracking-wider mb-2">Kommande</h3>
                                    <div className="flex flex-col gap-2">
                                        {group.planned.map(item => (
                                            <div key={item.id} className="bg-gray-750/50 rounded p-2 border-l-2 border-yellow-500/50 flex justify-between items-center opacity-80">
                                                <div className="truncate pr-2">
                                                    <div className="text-sm font-medium text-gray-200 truncate">{item.article.name}</div>
                                                    <div className="text-xs text-gray-400">{item.employee.name}</div>
                                                </div>
                                                <div className="text-sm font-mono text-gray-400 whitespace-nowrap">
                                                    {item.goal > 0 ? item.goal : '-'} st
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
