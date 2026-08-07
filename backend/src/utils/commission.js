// Commission rate config me — .env se aata hai, hardcode nahi. Isi tarah
// wallet floor bhi config me hai (dono paise/percent hisaab se).

const DEFAULT_COMMISSION_PERCENT = 20;
const DEFAULT_WALLET_MIN_BALANCE_PAISE = -50000; // -₹500

function commissionPercent() {
  const pct = Number(process.env.COMMISSION_PERCENT);
  return Number.isFinite(pct) && pct >= 0 && pct <= 100 ? pct : DEFAULT_COMMISSION_PERCENT;
}

// farePaise ko platform commission aur rider ke net earning me todta hai.
function splitFareForCommission(farePaise) {
  const commissionPaise = Math.round((farePaise * commissionPercent()) / 100);
  return { commissionPaise, riderNetPaise: farePaise - commissionPaise };
}

// Wallet balance is floor (paise) se neeche jaaye to rider naye COD orders
// accept nahi kar sakta jab tak recharge na kare.
function walletMinBalancePaise() {
  const v = Number(process.env.WALLET_MIN_BALANCE_PAISE);
  return Number.isFinite(v) ? v : DEFAULT_WALLET_MIN_BALANCE_PAISE;
}

module.exports = { commissionPercent, splitFareForCommission, walletMinBalancePaise };
