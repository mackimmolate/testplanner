import React, { useState, useEffect } from 'react';
import api from '../api';
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
          <h1 className="text-4xl font-bold tracking-wider text-blue-400">PRODUKTIONSPLANERING</h1>
          <div className="text-2xl font-mono text-gray-400">
              {new Date().toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
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
