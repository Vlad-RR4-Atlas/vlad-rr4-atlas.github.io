// Прочность ведущей шестерни катушки с учётом износа.
// По данным Potryasov Game: 30% прочности не изнашивается, остальные 70% убывают пропорционально износу.
// Пример автора: шестерня на 100 кг при износе 50% имеет 65 кг, а не 50.

export const NON_WEARING = 0.3;

/** @param {number} baseKg прочность без износа @param {number} wearPercent износ 0-100 */
export function gearStrength(baseKg, wearPercent) {
  const wear = Math.min(Math.max(Number(wearPercent) || 0, 0), 100) / 100;
  const fixed = baseKg * NON_WEARING;
  const wearing = baseKg * (1 - NON_WEARING);
  return { base: baseKg, fixed, wearing, wearingLeft: wearing * (1 - wear), current: fixed + wearing * (1 - wear) };
}
