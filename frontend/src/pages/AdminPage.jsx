import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api, { isMockMode } from '../api';
import clsx from 'clsx';

function AdminPage() {
  const [data, setData] = useState({ employees: [], articles: [], machine_groups: [] });
  const [plan, setPlan] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Inline form state (tracked per employee ID if needed, or a single active form)
  // We'll use a single active form state for simplicity: { employeeId: 1, ... }
  const [addingForEmployee, setAddingForEmployee] = useState(null);

  // Form fields
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedArticle, setSelectedArticle] = useState('');
  const [goal, setGoal] = useState(0);

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  useEffect(() => {
    // Reset goal when group/article changes
    if (selectedGroup && selectedArticle) {
        fetchDefaultGoal();
    }
  }, [selectedGroup, selectedArticle]);

  const fetchData = async () => {
    try {
      const [dataRes, planRes] = await Promise.all([
        api.get('/data'),
        api.get(`/plan?target_date=${selectedDate}`)
      ]);
      setData(dataRes.data);
      setPlan(planRes.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data", error);
      setLoading(false);
    }
  };

  const fetchDefaultGoal = async () => {
      // Don't fetch if 'Sjuk'
      const group = data.machine_groups.find(g => g.id === parseInt(selectedGroup));
      if (group && group.name === 'Sjuk') return;

      try {
          const res = await api.get(`/default-goal?article_id=${selectedArticle}&machine_group_id=${selectedGroup}`);
          if (res.data.goal > 0) {
              setGoal(res.data.goal);
          }
      } catch (error) {
          console.error("Error fetching default goal", error);
      }
  }

  const startAdding = (employeeId) => {
      setAddingForEmployee(employeeId);
      setSelectedGroup('');
      setSelectedArticle('');
      setGoal(0);
  }

  const cancelAdding = () => {
      setAddingForEmployee(null);
      setSelectedGroup('');
      setSelectedArticle('');
      setGoal(0);
  }

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addingForEmployee || !selectedGroup) return;

    // Check if Sjuk
    const group = data.machine_groups.find(g => g.id === parseInt(selectedGroup));
    const isSick = group && group.name === 'Sjuk';

    if (!isSick && !selectedArticle) return; // Article required if not sick

    try {
      await api.post('/plan', {
        employee_id: parseInt(addingForEmployee),
        article_id: isSick ? null : parseInt(selectedArticle),
        machine_group_id: parseInt(selectedGroup),
        goal: isSick ? 0 : parseInt(goal),
        date: selectedDate,
        status: 'active'
      });

      cancelAdding();
      fetchData();
    } catch (error) {
      console.error("Error adding task", error);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await api.put(`/plan/${id}`, { status });
      fetchData();
    } catch (error) {
      console.error("Error updating status", error);
    }
  };

  const deleteTask = async (id) => {
      if(!confirm("Är du säker på att du vill ta bort uppgiften?")) return;
      try {
          await api.delete(`/plan/${id}`);
          fetchData();
      } catch (error) {
          console.error("Error deleting task", error);
      }
  }

  const updateGoal = async (id, newGoal) => {
      try {
          await api.put(`/plan/${id}`, { goal: newGoal });
          fetchData();
      } catch (error) {
          console.error("Error updating goal", error);
      }
  }

  if (loading) return <div className="p-4">Laddar...</div>;

  // Group plan by Employee
  const groupedPlan = {};
  data.employees.forEach(e => {
      groupedPlan[e.id] = plan.filter(p => p.employee.id === e.id);
  });

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8 sticky top-0 bg-gray-100 z-10 py-4 border-b border-gray-200">
            <div className="flex items-center gap-4">
                <Link to="/" className="text-gray-600 hover:text-gray-900">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                </Link>
                <h1 className="text-3xl font-bold text-gray-800">Planeringsverktyg (Admin)</h1>
            </div>

            <div className="flex items-center gap-4">
                <div className="flex flex-col items-end">
                    <label className="text-xs font-bold text-gray-500 uppercase">Planeringsdatum</label>
                    <input
                        type="date"
                        className="border border-gray-300 rounded-md p-1 bg-white shadow-sm"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                    />
                </div>
                {isMockMode && (
                    <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-semibold border border-yellow-200">
                        Demo
                    </span>
                )}
            </div>
        </div>

        {/* Employee Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {data.employees.sort((a,b) => a.name.localeCompare(b.name)).map(employee => {
                const employeeTasks = groupedPlan[employee.id] || [];
                const isAdding = addingForEmployee === employee.id;

                // Determine if adding a 'Sjuk' task currently
                const currentGroupObj = data.machine_groups.find(g => g.id === parseInt(selectedGroup));
                const isSickSelected = currentGroupObj && currentGroupObj.name === 'Sjuk';

                return (
                    <div key={employee.id} className="bg-white rounded-lg shadow border border-gray-200 flex flex-col h-full">
                        <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800">{employee.name}</h3>
                                <span className="text-xs text-gray-500 font-mono">#{employee.number}</span>
                            </div>
                            <button
                                onClick={() => startAdding(employee.id)}
                                className="bg-blue-100 text-blue-700 p-1.5 rounded-full hover:bg-blue-200 transition-colors"
                                title="Lägg till jobb"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                    <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                                </svg>
                            </button>
                        </div>

                        <div className="p-4 flex-1 space-y-3">
                            {/* Task List */}
                            {employeeTasks.map(task => (
                                <div key={task.id} className={clsx(
                                    "p-3 rounded-md border text-sm relative group",
                                    task.machine_group.name === 'Sjuk' ? "bg-red-50 border-red-200" :
                                    task.status === 'active' ? "bg-green-50 border-green-200" : "bg-yellow-50 border-yellow-200"
                                )}>
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-bold text-gray-700">{task.machine_group.name}</span>
                                        <button onClick={() => deleteTask(task.id)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                                <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    </div>

                                    {task.machine_group.name !== 'Sjuk' && (
                                        <>
                                            <div className="text-gray-900 font-medium mb-2">{task.article.name}</div>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1">
                                                    <span className="text-xs text-gray-500">Mål:</span>
                                                    <input
                                                        type="number"
                                                        className="w-14 border rounded p-0.5 text-xs"
                                                        defaultValue={task.goal}
                                                        onBlur={(e) => {
                                                            const val = parseInt(e.target.value);
                                                            if(val !== task.goal) updateGoal(task.id, val);
                                                        }}
                                                    />
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {task.status === 'planned' ? (
                                                        <span onClick={() => updateStatus(task.id, 'active')} className="cursor-pointer text-xs bg-gray-200 hover:bg-green-200 text-gray-700 px-1.5 py-0.5 rounded border border-gray-300">
                                                            Starta
                                                        </span>
                                                    ) : (
                                                        <span onClick={() => updateStatus(task.id, 'planned')} className="cursor-pointer text-xs bg-green-200 hover:bg-yellow-200 text-green-800 px-1.5 py-0.5 rounded border border-green-300">
                                                            Pågående
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}

                            {/* Add Form */}
                            {isAdding && (
                                <form onSubmit={handleAdd} className="bg-blue-50 p-3 rounded-md border border-blue-200 space-y-3">
                                    <div>
                                        <select
                                            className="w-full border border-blue-300 rounded p-1.5 text-sm"
                                            value={selectedGroup}
                                            onChange={e => setSelectedGroup(e.target.value)}
                                            autoFocus
                                        >
                                            <option value="">Maskingrupp...</option>
                                            {data.machine_groups.sort((a,b) => a.name.localeCompare(b.name)).map(g => (
                                                <option key={g.id} value={g.id}>{g.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {!isSickSelected && (
                                        <>
                                            <div>
                                                <select
                                                    className="w-full border border-blue-300 rounded p-1.5 text-sm"
                                                    value={selectedArticle}
                                                    onChange={e => setSelectedArticle(e.target.value)}
                                                >
                                                    <option value="">Artikel...</option>
                                                    {data.articles.sort((a,b) => a.name.localeCompare(b.name)).map(a => (
                                                        <option key={a.id} value={a.id}>{a.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <input
                                                    type="number"
                                                    placeholder="Mål"
                                                    className="w-full border border-blue-300 rounded p-1.5 text-sm"
                                                    value={goal}
                                                    onChange={e => setGoal(e.target.value)}
                                                />
                                            </div>
                                        </>
                                    )}

                                    <div className="flex gap-2">
                                        <button type="submit" className="flex-1 bg-blue-600 text-white text-xs py-1.5 rounded hover:bg-blue-700">Spara</button>
                                        <button type="button" onClick={cancelAdding} className="flex-1 bg-gray-200 text-gray-700 text-xs py-1.5 rounded hover:bg-gray-300">Avbryt</button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
      </div>
    </div>
  );
}

export default AdminPage;
