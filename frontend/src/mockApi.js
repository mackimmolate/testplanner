import initialData from './data/initialData.json';

// Initialize local storage if empty
if (!localStorage.getItem('planner_plan')) {
    localStorage.setItem('planner_plan', JSON.stringify([]));
}

if (!localStorage.getItem('planner_default_goals')) {
    localStorage.setItem('planner_default_goals', JSON.stringify({}));
}

export const getMockData = () => {
    return Promise.resolve({ data: initialData });
};

export const getMockPlan = (targetDate) => {
    const plan = JSON.parse(localStorage.getItem('planner_plan') || '[]');
    // Filter by date if provided, otherwise return all? No, API usually returns for date.
    // The backend endpoint `GET /plan` takes a `target_date`.

    // Default to today if not provided (though wrapper usually handles this)
    const dateToFilter = targetDate || new Date().toISOString().split('T')[0];

    const filteredPlan = plan.filter(item => item.date === dateToFilter);

    // Join with initial data to provide full objects
    const populatedPlan = filteredPlan.map(item => {
        const employee = initialData.employees.find(e => e.id === item.employee_id);
        const article = initialData.articles.find(a => a.id === item.article_id);
        const machine_group = initialData.machine_groups.find(m => m.id === item.machine_group_id);
        return { ...item, employee, article, machine_group };
    });
    return Promise.resolve({ data: populatedPlan });
};

export const createMockPlanItem = (item) => {
    const plan = JSON.parse(localStorage.getItem('planner_plan') || '[]');
    const newItem = {
        ...item,
        id: Date.now(),
        quantity_done: 0
    };
    plan.push(newItem);
    localStorage.setItem('planner_plan', JSON.stringify(plan));

    // Save default goal
    const goals = JSON.parse(localStorage.getItem('planner_default_goals') || '{}');
    goals[`${item.article_id}-${item.machine_group_id}`] = item.goal;
    localStorage.setItem('planner_default_goals', JSON.stringify(goals));

    // Return populated item
    const employee = initialData.employees.find(e => e.id === item.employee_id);
    const article = initialData.articles.find(a => a.id === item.article_id);
    const machine_group = initialData.machine_groups.find(m => m.id === item.machine_group_id);

    return Promise.resolve({ data: { ...newItem, employee, article, machine_group } });
};

export const updateMockPlanItem = (id, updates) => {
    const plan = JSON.parse(localStorage.getItem('planner_plan') || '[]');
    const index = plan.findIndex(p => p.id === parseInt(id));
    if (index !== -1) {
        plan[index] = { ...plan[index], ...updates };
        localStorage.setItem('planner_plan', JSON.stringify(plan));

        // Populate return
        const item = plan[index];
        const employee = initialData.employees.find(e => e.id === item.employee_id);
        const article = initialData.articles.find(a => a.id === item.article_id);
        const machine_group = initialData.machine_groups.find(m => m.id === item.machine_group_id);

        return Promise.resolve({ data: { ...item, employee, article, machine_group } });
    }
    return Promise.reject(new Error("Not found"));
};

export const deleteMockPlanItem = (id) => {
    let plan = JSON.parse(localStorage.getItem('planner_plan') || '[]');
    plan = plan.filter(p => p.id !== parseInt(id));
    localStorage.setItem('planner_plan', JSON.stringify(plan));
    return Promise.resolve({ data: { ok: true } });
};

export const getMockDefaultGoal = (articleId, machineGroupId) => {
    const goals = JSON.parse(localStorage.getItem('planner_default_goals') || '{}');
    const goal = goals[`${articleId}-${machineGroupId}`] || 0;
    return Promise.resolve({ data: { goal } });
};
