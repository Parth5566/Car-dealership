export function calculateLoan(
  price: number,
  downPayment: number,
  annualRate: number,
  months: number,
) {
  if (
    ![price, downPayment, annualRate, months].every(Number.isFinite) ||
    price <= 0 ||
    price > 1e9 ||
    downPayment < 0 ||
    downPayment > price ||
    annualRate < 0 ||
    annualRate > 40 ||
    !Number.isInteger(months) ||
    months < 1 ||
    months > 120
  )
    return null;
  const principal = price - downPayment;
  const rate = annualRate / 1200;
  const monthly = rate
    ? (principal * rate) / -Math.expm1(-months * Math.log1p(rate))
    : principal / months;
  const repayment = monthly * months;
  let balance = principal;
  const yearly: {
    year: number;
    principal: number;
    interest: number;
    balance: number;
  }[] = [];
  for (let month = 1; month <= months; month++) {
    const interest = balance * rate;
    const paid = Math.min(balance, Math.max(0, monthly - interest));
    balance = Math.max(0, balance - paid);
    const index = Math.floor((month - 1) / 12);
    if (!yearly[index])
      yearly[index] = {
        year: index + 1,
        principal: 0,
        interest: 0,
        balance: 0,
      };
    yearly[index].principal += paid;
    yearly[index].interest += interest;
    yearly[index].balance = month === months ? 0 : balance;
  }
  return {
    principal,
    monthly,
    interest: Math.max(0, repayment - principal),
    repayment,
    total: repayment + downPayment,
    yearly,
  };
}
