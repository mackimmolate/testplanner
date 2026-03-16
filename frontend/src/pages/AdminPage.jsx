import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

import api, { isMockMode } from '../api';
import ManagePersonnelModal from '../components/ManagePersonnelModal';
import { addDays, formatLocalDate, parseLocalDate, todayLocalDate } from '../dateUtils';

function getWeek(dateValue) {
  const date = new Date(Date.UTC(
    dateValue.getFullYear(),
    dateValue.getMonth(),
    dateValue.getDate(),
  ));
  const dayNumber = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

function AdminPage() {
  const [data, setData] = useState({ employees: [], articles: [], machine_groups: [] });
  const [plan, setPlan] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(todayLocalDate());
  const [isPersonnelModalOpen, setIsPersonnelModalOpen] = useState(false);
  const [addingForEmployee, setAddingForEmployee] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedArticle, setSelectedArticle] = useState('');
  const [goal, setGoal] = useState('0');
  const [comment, setComment] = useState('');

  const fetchData = useCallback(async (targetDate) => {
    try {
      const [dataRes, planRes] = await Promise.all([
        api.get('/data'),
        api.get(`/plan?target_date=${targetDate}`),
      ]);
      setData(dataRes.data);
      setPlan(planRes.data);
    } catch (error) {
      console.error('Kunde inte hämta data', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void fetchData(selectedDate);
  }, [fetchData, selectedDate]);

  useEffect(() => {
    if (!selectedGroup || !selectedArticle) {
      setGoal('0');
      return;
    }

    const group = data.machine_groups.find(
      (machineGroup) => machineGroup.id === Number.parseInt(selectedGroup, 10),
    );
    if (group && (group.name === 'Sjuk' || group.name === 'Arbetsledning')) {
      setGoal('0');
      return;
    }

    let cancelled = false;

    const loadDefaultGoal = async () => {
      try {
        const res = await api.get(
          `/default-goal?article_id=${selectedArticle}&machine_group_id=${selectedGroup}`,
        );
        if (!cancelled) {
          setGoal(String(res.data.goal ?? 0));
        }
      } catch (error) {
          console.error('Kunde inte hämta standardmål', error);
      }
    };

    void loadDefaultGoal();

    return () => {
      cancelled = true;
    };
  }, [data.machine_groups, selectedArticle, selectedGroup]);

  const startAdding = (employeeId) => {
    setAddingForEmployee(employeeId);
    setSelectedGroup('');
    setSelectedArticle('');
    setGoal('0');
    setComment('');
  };

  const cancelAdding = () => {
    setAddingForEmployee(null);
    setSelectedGroup('');
    setSelectedArticle('');
    setGoal('0');
    setComment('');
  };

  const handleAdd = async (event) => {
    event.preventDefault();
    if (!addingForEmployee || !selectedGroup) {
      return;
    }

    const group = data.machine_groups.find(
      (machineGroup) => machineGroup.id === Number.parseInt(selectedGroup, 10),
    );
    const isSpecialGroup = group && (group.name === 'Sjuk' || group.name === 'Arbetsledning');

    const machineGroupId = Number.parseInt(selectedGroup, 10);
    const articleId = Number.parseInt(selectedArticle, 10);
    const parsedGoal = Number.parseInt(goal, 10);

    if (!Number.isInteger(machineGroupId)) {
      return;
    }

    if (!isSpecialGroup && !Number.isInteger(articleId)) {
      return;
    }

    if (!isSpecialGroup && (!Number.isInteger(parsedGoal) || parsedGoal < 0)) {
      return;
    }

    try {
      await api.post('/plan', {
        employee_id: addingForEmployee,
        article_id: isSpecialGroup ? null : articleId,
        machine_group_id: machineGroupId,
        goal: isSpecialGroup ? 0 : parsedGoal,
        date: selectedDate,
        status: 'active',
        comment: comment || null,
      });

      cancelAdding();
      await fetchData(selectedDate);
    } catch (error) {
      console.error('Kunde inte spara uppgift', error);
    }
  };

  const clearTask = async (task) => {
    if (!window.confirm('Ta bort uppgift?')) {
      return;
    }

    try {
      await api.post('/plan', {
        employee_id: task.employee.id,
        date: selectedDate,
        machine_group_id: null,
        article_id: null,
        goal: 0,
        status: 'active',
      });
      await fetchData(selectedDate);
    } catch (error) {
      console.error('Kunde inte ta bort uppgift', error);
    }
  };

  const updateGoal = async (id, newGoal) => {
    try {
      await api.put(`/plan/${id}`, { goal: newGoal });
      await fetchData(selectedDate);
    } catch (error) {
      console.error('Kunde inte uppdatera mål', error);
    }
  };

  const updateComment = async (id, newComment) => {
    try {
      await api.put(`/plan/${id}`, { comment: newComment });
      await fetchData(selectedDate);
    } catch (error) {
      console.error('Kunde inte uppdatera kommentar', error);
    }
  };

  if (loading) {
    return <div className="p-4">Laddar...</div>;
  }

  const selectedDateObject = parseLocalDate(selectedDate);
  const sortedEmployees = [...data.employees].sort((left, right) => left.name.localeCompare(right.name));
  const sortedMachineGroups = [...data.machine_groups].sort((left, right) => left.name.localeCompare(right.name));
  const sortedArticles = [...data.articles].sort((left, right) => left.name.localeCompare(right.name));

  const groupedPlan = {};
  sortedEmployees.forEach((employee) => {
    groupedPlan[employee.id] = plan.filter((item) => item.employee.id === employee.id);
  });

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="sticky top-0 z-10 mb-8 flex items-center justify-between border-b border-gray-200 bg-gray-100 py-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-gray-600 hover:text-gray-900">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-6 w-6"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
            </Link>
            <h1 className="text-3xl font-bold text-gray-800">Planering</h1>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsPersonnelModalOpen(true)}
              className="rounded bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-300"
            >
              Personal
            </button>
            <div className="flex flex-col items-end">
              <div className="mb-1 text-sm font-bold text-gray-700">
                {selectedDateObject.toLocaleDateString('sv-SE', { weekday: 'long' })} v.{getWeek(selectedDateObject)}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSelectedDate(formatLocalDate(addDays(selectedDate, -1)))}
                  className="rounded bg-gray-200 p-1 text-gray-600 hover:bg-gray-300"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="h-5 w-5"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                  </svg>
                </button>
                <input
                  type="date"
                  className="rounded-md border border-gray-300 bg-white p-1 shadow-sm"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                />
                <button
                  onClick={() => setSelectedDate(formatLocalDate(addDays(selectedDate, 1)))}
                  className="rounded bg-gray-200 p-1 text-gray-600 hover:bg-gray-300"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="h-5 w-5"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              </div>
            </div>
            {isMockMode && (
              <span className="rounded-full border border-yellow-200 bg-yellow-100 px-3 py-1 text-sm font-semibold text-yellow-800">
                Demo
              </span>
            )}
          </div>
        </div>

        <ManagePersonnelModal
          isOpen={isPersonnelModalOpen}
          onClose={() => setIsPersonnelModalOpen(false)}
          employees={sortedEmployees}
          onUpdate={() => fetchData(selectedDate)}
        />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sortedEmployees.map((employee) => {
            const employeeTasks = groupedPlan[employee.id] || [];
            const isAdding = addingForEmployee === employee.id;
            const currentGroup = data.machine_groups.find(
              (machineGroup) => machineGroup.id === Number.parseInt(selectedGroup, 10),
            );
            const isSpecialGroupSelected = currentGroup && (
              currentGroup.name === 'Sjuk' || currentGroup.name === 'Arbetsledning'
            );

            return (
              <div key={employee.id} className="flex h-full flex-col rounded-lg border border-gray-200 bg-white shadow">
                <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 p-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">{employee.name}</h3>
                    <span className="font-mono text-xs text-gray-500">#{employee.number}</span>
                  </div>
                  <button
                    onClick={() => startAdding(employee.id)}
                    className="rounded-full bg-blue-100 p-1.5 text-blue-700 transition-colors hover:bg-blue-200"
                    title="Lägg jobb"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                      <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
                    </svg>
                  </button>
                </div>

                <div className="flex-1 space-y-3 p-4">
                  {employeeTasks.map((task, index) => (
                    <div
                      key={task.id}
                      className={clsx(
                        'group relative rounded-md border p-3 text-sm',
                        task.machine_group?.name === 'Sjuk'
                          ? 'border-red-200 bg-red-50'
                          : task.status === 'active'
                            ? 'border-green-200 bg-green-50'
                            : 'border-yellow-200 bg-yellow-50',
                      )}
                    >
                      <div className="mb-1 flex items-start justify-between">
                        <div className="flex gap-2">
                          <span className="font-mono text-xs text-gray-400">#{index + 1}</span>
                          <span className="font-bold text-gray-700">{task.machine_group?.name ?? 'Okänd'}</span>
                        </div>
                        <button
                          onClick={() => clearTask(task)}
                          className="text-red-400 opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                            <path
                              fillRule="evenodd"
                              d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443a41.03 41.03 0 0 0-2.365.298.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4Zm-1.42 3.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      </div>

                      {task.machine_group?.name !== 'Sjuk' && task.machine_group?.name !== 'Arbetsledning' && (
                        <>
                          <div className="mb-2 font-medium text-gray-900">{task.article?.name}</div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-500">Mål</span>
                              <input
                                type="number"
                                min="0"
                                className="w-14 rounded border p-0.5 text-xs"
                                defaultValue={task.goal}
                                onBlur={(event) => {
                                  const nextValue = event.target.value.trim();
                                  if (nextValue === '') {
                                    event.target.value = String(task.goal);
                                    return;
                                  }

                                  const parsedGoal = Number.parseInt(nextValue, 10);
                                  if (!Number.isInteger(parsedGoal) || parsedGoal < 0) {
                                    event.target.value = String(task.goal);
                                    return;
                                  }

                                  if (parsedGoal !== task.goal) {
                                    void updateGoal(task.id, parsedGoal);
                                  }
                                }}
                              />
                            </div>
                          </div>
                        </>
                      )}

                      <div className="mt-2 border-t border-gray-200 pt-1">
                        <input
                          type="text"
                          className="w-full border-none bg-transparent p-0 text-gray-700 placeholder-gray-400 focus:ring-0"
                          placeholder="Kommentar"
                          defaultValue={task.comment || ''}
                          onBlur={(event) => {
                            const nextValue = event.target.value;
                            if (nextValue !== (task.comment || '')) {
                              void updateComment(task.id, nextValue);
                            }
                          }}
                        />
                      </div>
                    </div>
                  ))}

                  {isAdding && (
                    <form onSubmit={handleAdd} className="space-y-3 rounded-md border border-blue-200 bg-blue-50 p-3">
                      <div>
                        <select
                          className="w-full rounded border border-blue-300 p-1.5 text-sm"
                          value={selectedGroup}
                          onChange={(event) => setSelectedGroup(event.target.value)}
                          autoFocus
                        >
                          <option value="">Grupp</option>
                          {sortedMachineGroups.map((group) => (
                            <option key={group.id} value={group.id}>{group.name}</option>
                          ))}
                        </select>
                      </div>

                      {!isSpecialGroupSelected && (
                        <>
                          <div>
                            <select
                              className="w-full rounded border border-blue-300 p-1.5 text-sm"
                              value={selectedArticle}
                              onChange={(event) => setSelectedArticle(event.target.value)}
                            >
                              <option value="">Artikel</option>
                              {sortedArticles.map((article) => (
                                <option key={article.id} value={article.id}>{article.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <input
                              type="number"
                              min="0"
                              placeholder="Mål"
                              className="w-full rounded border border-blue-300 p-1.5 text-sm"
                              value={goal}
                              onChange={(event) => setGoal(event.target.value)}
                            />
                          </div>
                        </>
                      )}

                      <div>
                        <input
                          type="text"
                          placeholder="Kommentar"
                          className="w-full rounded border border-blue-300 p-1.5 text-sm"
                          value={comment}
                          onChange={(event) => setComment(event.target.value)}
                        />
                      </div>

                      <div className="flex gap-2">
                        <button type="submit" className="flex-1 rounded bg-blue-600 py-1.5 text-xs text-white hover:bg-blue-700">
                          Spara
                        </button>
                        <button
                          type="button"
                          onClick={cancelAdding}
                          className="flex-1 rounded bg-gray-200 py-1.5 text-xs text-gray-700 hover:bg-gray-300"
                        >
                          Avbryt
                        </button>
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
