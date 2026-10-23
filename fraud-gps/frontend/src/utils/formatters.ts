export function formatCurrency(amount: string): string {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(amount);
  if (!match) return '—';
  const [, sign, digits, fraction = ''] = match;
  const grouped = BigInt(digits).toLocaleString('en-IN');
  const decimal = fraction.padEnd(2, '0');
  return `${sign}₹${grouped}${decimal === '00' ? '' : `.${decimal}`}`;
}
export function formatDate(iso: string): string {
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00+05:30` : iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  })
    .format(date)
    .replaceAll(' ', '-');
}
export function formatTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata',
      })
        .format(date)
        .toUpperCase();
}
export function maskAccount(label: string | undefined): string {
  return label && /^XXXX\d{4}$/.test(label) ? label : 'Unavailable';
}

export function formatMinutes(minutes: number | null): string {
  if (minutes === null) return 'Not observed';
  return minutes < 1 ? `${Math.round(minutes * 60)} sec` : `${Number(minutes.toFixed(1))} min`;
}
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Number(seconds.toFixed(1))} sec`;
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} hr ${minutes % 60} min` : `${minutes} min`;
}
