import initialData from './data/initialData.json';

// Initialize local storage if empty
if (!localStorage.getItem('planner_plan')) {
    localStorage.setItem('planner_plan', JSON.stringify([]));
}

if (!localStorage.getItem('planner_default_goals')) {
    localStorage.setItem('planner_default_goals', JSON.stringify({}));
}

// Initialize employees if empty (copy from initial)
if (!localStorage.getItem('planner_employees')) {
    localStorage.setItem('planner_employees', JSON.stringify(initialData.employees));
}

export const getMockData = () => {
    const employees = JSON.parse(localStorage.getItem('planner_employees'));
    return Promise.resolve({
        data: {
            ...initialData,
            employees: employees
        }
    });
};

export const createMockEmployee = (employee) => {
    const employees = JSON.parse(localStorage.getItem('planner_employees'));
    const newEmployee = { ...employee, id: Date.now() };
    employees.push(newEmployee);
    localStorage.setItem('planner_employees', JSON.stringify(employees));
    return Promise.resolve({ data: newEmployee });
};

export const deleteMockEmployee = (id) => {
    let employees = JSON.parse(localStorage.getItem('planner_employees'));
    employees = employees.filter(e => e.id !== parseInt(id));
    localStorage.setItem('planner_employees', JSON.stringify(employees));
    return Promise.resolve({ data: { ok: true } });
};

export const getMockPlan = (targetDate) => {
    const plan = JSON.parse(localStorage.getItem('planner_plan') || '[]');
    const employees = JSON.parse(localStorage.getItem('planner_employees'));

    // Default to today if not provided
    const dateLimit = targetDate || new Date().toISOString().split('T')[0];

    // Logic: Carry over. Find latest plan item <= dateLimit for each employee
    const effectivePlan = [];

    employees.forEach(employee => {
        // Find items for this employee
        const employeeItems = plan.filter(p => p.employee_id === employee.id && p.date <= dateLimit);
        // Sort by date desc, then id desc (to break ties)
        employeeItems.sort((a, b) => {
            if (a.date !== b.date) return b.date.localeCompare(a.date);
            return b.id - a.id;
        });

        const latest = employeeItems[0];
        if (latest && latest.machine_group_id) { // Only if not "Void" (null group)
            effectivePlan.push(latest);
        }
    });

    // Join with initial data to provide full objects
    const populatedPlan = effectivePlan.map(item => {
        const employee = employees.find(e => e.id === item.employee_id);
        const article = initialData.articles.find(a => a.id === item.article_id);
        const machine_group = initialData.machine_groups.find(m => m.id === item.machine_group_id);

        // Handle deleted employees safely
        if (!employee) return null;

        return { ...item, employee, article, machine_group };
    }).filter(item => item !== null);
    return Promise.resolve({ data: populatedPlan });
};

export const createMockPlanItem = (item) => {
    let plan = JSON.parse(localStorage.getItem('planner_plan') || '[]');

    // Remove existing item for this employee on this date (to avoid duplicates/ambiguity)
    plan = plan.filter(p => !(p.employee_id === item.employee_id && p.date === item.date));

    const newItem = {
        ...item,
        id: Date.now(),
        quantity_done: 0
    };
    plan.push(newItem);
    localStorage.setItem('planner_plan', JSON.stringify(plan));

    // Save default goal (only if article/group provided)
    if (item.article_id && item.machine_group_id) {
        const goals = JSON.parse(localStorage.getItem('planner_default_goals') || '{}');
        goals[`${item.article_id}-${item.machine_group_id}`] = item.goal;
        localStorage.setItem('planner_default_goals', JSON.stringify(goals));
    }

    // Return populated item
    const employees = JSON.parse(localStorage.getItem('planner_employees'));
    const employee = employees.find(e => e.id === item.employee_id);
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
        const employees = JSON.parse(localStorage.getItem('planner_employees'));
        const employee = employees.find(e => e.id === item.employee_id);
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
