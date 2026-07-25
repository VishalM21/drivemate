export function formatMoney(amount: number | null | undefined): string {
  return (amount ?? 0).toFixed(2);
}
