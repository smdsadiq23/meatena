const KWD_TO_USD_RATE = Number(process.env.KWD_TO_USD_RATE ?? 3.25);

export function dualCurrency(
  value: number | string | undefined | null,
  rate = KWD_TO_USD_RATE,
) {
  const kwd = Number(value ?? 0);
  return `KWD ${kwd.toFixed(3)} / USD ${(kwd * rate).toFixed(2)}`;
}
