const pesos = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

/** 80000 → "$80.000" (COP, no decimals). */
export const formatCop = (amount: number) => `$${pesos.format(amount)}`;

/** 1 → "1 hora", 2.5 → "2,5 horas". */
export const formatHours = (hours: number) =>
  `${String(hours).replace('.', ',')} ${hours === 1 ? 'hora' : 'horas'}`;

/** "09:30" → 570. */
export const minutesOf = (time: string) => {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

/** '2026-11-03' → "martes, 3 de noviembre". */
export const formatLongDate = (date: string) =>
  new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Bogota',
  }).format(new Date(`${date}T12:00:00-05:00`));
