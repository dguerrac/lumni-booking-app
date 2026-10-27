// Choices offered by the slot forms (quote screen and wizard step 2). The API
// re-checks every rule (opening hours, past times, 30-minute blocks); these
// lists only keep the forms short.
export const START_TIMES = Array.from({ length: 28 }, (_, i) => {
  const minutes = 7 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${minutes % 60 === 0 ? '00' : '30'}`;
});

export const DURATIONS = Array.from({ length: 19 }, (_, i) => 1 + i * 0.5);
