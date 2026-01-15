import React, { useState, useEffect } from 'react';
import api from '../api';
import clsx from 'clsx';

function AdminPage() {
  const [data, setData] = useState({ employees: [], articles: [], machine_groups: [] });
  const [plan, setPlan] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedArticle, setSelectedArticle] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [goal, setGoal] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedGroup && selectedArticle) {
        fetchDefaultGoal();
    }
  }, [selectedGroup, selectedArticle]);

  const fetchData = async () => {
    try {
      const [dataRes, planRes] = await Promise.all([
        api.get('/data'),
        api.get('/plan')
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
      try {
          const res = await api.get(`/default-goal?article_id=${selectedArticle}&machine_group_id=${selectedGroup}`);
          if (res.data.goal > 0) {
              setGoal(res.data.goal);
          }
      } catch (error) {
          console.error("Error fetching default goal", error);
      }
  }

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!selectedGroup || !selectedArticle || !selectedEmployee) return;

    try {
      await api.post('/plan', {
        employee_id: parseInt(selectedEmployee),
        article_id: parseInt(selectedArticle),
        machine_group_id: parseInt(selectedGroup),
        goal: parseInt(goal),
        date: new Date().toLocaleDateString('sv-SE'),
        status: 'planned' // Default to planned
      });
      // Reset form (keep group maybe?)
      setSelectedArticle('');
      setGoal(0);
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

  // Group plan items
  const groupedPlan = {};
  data.machine_groups.forEach(g => {
      const items = plan.filter(p => p.machine_group.id === g.id);
      if (items.length > 0) {
          groupedPlan[g.name] = items;
      }
  });

  // Also show groups with no items? Maybe not for admin list to save space, but good for "Add" context.
  // Actually, list items by ID descending or something? No, grouped by machine is requested.

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-800">Planeringsverktyg (Admin)</h1>

        {/* Add Task Form */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">Lägg till uppgift</h2>
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Maskingrupp</label>
              <select
                className="w-full border border-gray-300 rounded-md p-2"
                value={selectedGroup}
                onChange={e => setSelectedGroup(e.target.value)}
              >
                <option value="">Välj grupp...</option>
                {data.machine_groups.sort((a,b) => a.name.localeCompare(b.name)).map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Artikel</label>
              <select
                className="w-full border border-gray-300 rounded-md p-2"
                value={selectedArticle}
                onChange={e => setSelectedArticle(e.target.value)}
              >
                <option value="">Välj artikel...</option>
                {data.articles.sort((a,b) => a.name.localeCompare(b.name)).map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Personal</label>
              <select
                className="w-full border border-gray-300 rounded-md p-2"
                value={selectedEmployee}
                onChange={e => setSelectedEmployee(e.target.value)}
              >
                <option value="">Välj personal...</option>
                {data.employees.sort((a,b) => a.name.localeCompare(b.name)).map(e => (
                  <option key={e.id} value={e.id}>{e.name} ({e.number})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mål (Antal)</label>
              <input
                type="number"
                className="w-full border border-gray-300 rounded-md p-2"
                value={goal}
                onChange={e => setGoal(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 font-semibold"
            >
              Lägg till
            </button>
          </form>
        </div>

        {/* Plan List */}
        <div className="grid grid-cols-1 gap-6">
            {Object.keys(groupedPlan).sort().map(groupName => (
                <div key={groupName} className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                        <h3 className="text-lg font-bold text-gray-800">{groupName}</h3>
                    </div>
                    <div className="p-0">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Artikel</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Personal</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mål</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Åtgärder</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {groupedPlan[groupName].map(item => (
                                    <tr key={item.id} className={item.status === 'active' ? 'bg-green-50' : ''}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={clsx(
                                                "px-2 inline-flex text-xs leading-5 font-semibold rounded-full",
                                                item.status === 'active' ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                                            )}>
                                                {item.status === 'active' ? 'Pågående' : 'Planerat'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{item.article.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.employee.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <input
                                                type="number"
                                                className="w-20 border rounded p-1"
                                                defaultValue={item.goal}
                                                onBlur={(e) => {
                                                    if(parseInt(e.target.value) !== item.goal) {
                                                        updateGoal(item.id, parseInt(e.target.value));
                                                    }
                                                }}
                                            />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                            {item.status === 'planned' && (
                                                <button onClick={() => updateStatus(item.id, 'active')} className="text-green-600 hover:text-green-900">Starta</button>
                                            )}
                                            {item.status === 'active' && (
                                                <button onClick={() => updateStatus(item.id, 'planned')} className="text-yellow-600 hover:text-yellow-900">Pausa</button>
                                            )}
                                            <button onClick={() => deleteTask(item.id)} className="text-red-600 hover:text-red-900">Ta bort</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
            {Object.keys(groupedPlan).length === 0 && (
                <p className="text-center text-gray-500 mt-8">Inga planerade uppgifter än.</p>
            )}
        </div>
      </div>
    </div>
  );
}

export default AdminPage;
