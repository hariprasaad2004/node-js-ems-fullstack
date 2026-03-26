export function formatDate(value) { // Format a date string for display.
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
}

export function formatDateTime(value) { // Format a date-time string for display.
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

export function formatDuration(startValue, endValue) { // Format duration between two timestamps.
  if (!startValue || !endValue) return '-';
  const start = new Date(startValue);
  const end = new Date(endValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '-';
  const minutes = Math.max(0, Math.round((end - start) / 60000));
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

export function formatStatus(status) { // Humanize a status value.
  if (!status) return '-';
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function formatEmployeeLabel(employee) { // Build a concise employee label.
  if (!employee) return '';
  const dept = employee.department ? ` (${employee.department})` : '';
  return `${employee.name}${dept} - ${employee.email}`;
}

