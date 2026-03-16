import initialData from './data/initialData.json';
import { todayLocalDate } from './dateUtils';

if (!localStorage.getItem('planner_plan')) {
  localStorage.setItem('planner_plan', JSON.stringify([]));
}

if (!localStorage.getItem('planner_default_goals')) {
  localStorage.setItem('planner_default_goals', JSON.stringify({}));
}

if (!localStorage.getItem('planner_employees')) {
  localStorage.setItem('planner_employees', JSON.stringify(initialData.employees));
}

export const getMockData = () => {
  const employees = JSON.parse(localStorage.getItem('planner_employees'));
  return Promise.resolve({
    data: {
      ...initialData,
      employees,
    },
  });
};

export const createMockEmployee = (employee) => {
  const employees = JSON.parse(localStorage.getItem('planner_employees'));
  const name = employee.name.trim();
  const number = employee.number.trim();

  if (employees.some((existingEmployee) => existingEmployee.number === number)) {
    return Promise.reject(new Error('Employee number already exists.'));
  }

  const newEmployee = { id: Date.now(), name, number };
  employees.push(newEmployee);
  localStorage.setItem('planner_employees', JSON.stringify(employees));
  return Promise.resolve({ data: newEmployee });
};

export const deleteMockEmployee = (id) => {
  const employeeId = Number.parseInt(id, 10);
  let employees = JSON.parse(localStorage.getItem('planner_employees'));
  let plan = JSON.parse(localStorage.getItem('planner_plan') || '[]');

  employees = employees.filter((employee) => employee.id !== employeeId);
  plan = plan.filter((item) => item.employee_id !== employeeId);

  localStorage.setItem('planner_employees', JSON.stringify(employees));
  localStorage.setItem('planner_plan', JSON.stringify(plan));
  return Promise.resolve({ data: { ok: true } });
};

export const getMockPlan = (targetDate) => {
  const plan = JSON.parse(localStorage.getItem('planner_plan') || '[]');
  const employees = JSON.parse(localStorage.getItem('planner_employees'));
  const dateLimit = targetDate || todayLocalDate();

  const effectivePlan = [];

  employees.forEach((employee) => {
    const employeeItems = plan
      .filter((item) => item.employee_id === employee.id && item.date <= dateLimit)
      .sort((left, right) => right.date.localeCompare(left.date));

    if (employeeItems.length === 0) {
      return;
    }

    const maxDate = employeeItems[0].date;
    const latestItems = employeeItems.filter((item) => item.date === maxDate);
    latestItems.forEach((item) => {
      if (item.machine_group_id) {
        effectivePlan.push(item);
      }
    });
  });

  const populatedPlan = effectivePlan
    .map((item) => {
      const employee = employees.find((candidate) => candidate.id === item.employee_id);
      if (!employee) {
        return null;
      }

      const article = initialData.articles.find((candidate) => candidate.id === item.article_id);
      const machineGroup = initialData.machine_groups.find(
        (candidate) => candidate.id === item.machine_group_id,
      );

      return { ...item, employee, article, machine_group: machineGroup };
    })
    .filter((item) => item !== null);

  return Promise.resolve({ data: populatedPlan });
};

export const createMockPlanItem = (item) => {
  let plan = JSON.parse(localStorage.getItem('planner_plan') || '[]');

  if (item.machine_group_id) {
    const existing = plan.filter(
      (planItem) =>
        planItem.employee_id === item.employee_id &&
        planItem.date === item.date &&
        planItem.machine_group_id,
    );
    if (existing.length >= 4) {
      return Promise.reject(new Error('Max 4 jobs per day allowed.'));
    }
    plan = plan.filter(
      (planItem) =>
        !(
          planItem.employee_id === item.employee_id &&
          planItem.date === item.date &&
          !planItem.machine_group_id
        ),
    );
  } else {
    plan = plan.filter(
      (planItem) =>
        !(planItem.employee_id === item.employee_id && planItem.date === item.date),
    );
  }

  const newItem = {
    ...item,
    id: Date.now(),
    goal: item.goal ?? 0,
    quantity_done: 0,
  };
  plan.push(newItem);
  localStorage.setItem('planner_plan', JSON.stringify(plan));

  if (item.article_id && item.machine_group_id) {
    const goals = JSON.parse(localStorage.getItem('planner_default_goals') || '{}');
    goals[`${item.article_id}-${item.machine_group_id}`] = item.goal;
    localStorage.setItem('planner_default_goals', JSON.stringify(goals));
  }

  const employees = JSON.parse(localStorage.getItem('planner_employees'));
  const employee = employees.find((candidate) => candidate.id === item.employee_id);
  const article = initialData.articles.find((candidate) => candidate.id === item.article_id);
  const machineGroup = initialData.machine_groups.find(
    (candidate) => candidate.id === item.machine_group_id,
  );

  return Promise.resolve({
    data: { ...newItem, employee, article, machine_group: machineGroup },
  });
};

export const updateMockPlanItem = (id, updates) => {
  const plan = JSON.parse(localStorage.getItem('planner_plan') || '[]');
  const index = plan.findIndex((item) => item.id === Number.parseInt(id, 10));
  if (index === -1) {
    return Promise.reject(new Error('Not found'));
  }

  plan[index] = { ...plan[index], ...updates };
  localStorage.setItem('planner_plan', JSON.stringify(plan));

  const item = plan[index];
  const employees = JSON.parse(localStorage.getItem('planner_employees'));
  const employee = employees.find((candidate) => candidate.id === item.employee_id);
  const article = initialData.articles.find((candidate) => candidate.id === item.article_id);
  const machineGroup = initialData.machine_groups.find(
    (candidate) => candidate.id === item.machine_group_id,
  );

  return Promise.resolve({
    data: { ...item, employee, article, machine_group: machineGroup },
  });
};

export const deleteMockPlanItem = (id) => {
  const itemId = Number.parseInt(id, 10);
  const nextPlan = JSON.parse(localStorage.getItem('planner_plan') || '[]').filter(
    (item) => item.id !== itemId,
  );
  localStorage.setItem('planner_plan', JSON.stringify(nextPlan));
  return Promise.resolve({ data: { ok: true } });
};

export const getMockDefaultGoal = (articleId, machineGroupId) => {
  const goals = JSON.parse(localStorage.getItem('planner_default_goals') || '{}');
  const goal = goals[`${articleId}-${machineGroupId}`] || 0;
  return Promise.resolve({ data: { goal } });
};
