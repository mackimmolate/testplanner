export function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(dateValue, amount) {
  const date = typeof dateValue === 'string' ? parseLocalDate(dateValue) : new Date(dateValue);
  date.setDate(date.getDate() + amount);
  return date;
}

export function todayLocalDate() {
  return formatLocalDate(new Date());
}
