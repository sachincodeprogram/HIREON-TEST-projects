const mongoose = require('mongoose');
const Wallet            = require('../models/Wallet');
const WalletTransaction = require('../models/WalletTransaction');

const DUPLICATE_KEY_ERROR = 11000;

async function getOrCreateWallet(riderId, session) {
  let wallet = await Wallet.findOne({ rider: riderId }).session(session || null);
  if (!wallet) {
    const opts = session ? { session } : {};
    const created = await Wallet.create([{ rider: riderId, balance: 0 }], opts);
    wallet = created[0];
  }
  return wallet;
}

// Ek hi mongoose transaction me: balance $inc + ledger insert. Dono ATOMIC hain —
// agar ledger insert duplicate-key error de (isi order/isi razorpay payment ke
// liye pehle se entry hai), pura transaction abort ho jaata hai aur balance
// $inc bhi rollback ho jaata hai. Isse double credit/debit kabhi nahi hota,
// chahe webhook 2 baar aaye ya confirm-delivery retry ho jaaye.
async function applyWalletEntry({ riderId, type, amountPaise, direction, orderId, razorpayOrderId, razorpayPaymentId, description }) {
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    throw new Error('amountPaise must be a positive integer (paise)');
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const wallet = await getOrCreateWallet(riderId, session);
      const delta  = direction === 'debit' ? -amountPaise : amountPaise;

      const updatedWallet = await Wallet.findByIdAndUpdate(
        wallet._id,
        { $inc: { balance: delta } },
        { new: true, session }
      );

      try {
        const [txn] = await WalletTransaction.create([{
          rider:  riderId,
          wallet: wallet._id,
          type,
          amount: amountPaise,
          balanceAfter: updatedWallet.balance,
          order:  orderId || null,
          razorpayOrderId:   razorpayOrderId || null,
          razorpayPaymentId: razorpayPaymentId || null,
          description: description || '',
        }], { session });
        result = { wallet: updatedWallet, transaction: txn, duplicate: false };
      } catch (err) {
        if (err.code === DUPLICATE_KEY_ERROR) {
          throw Object.assign(new Error('Wallet entry already processed'), { isDuplicate: true });
        }
        throw err;
      }
    });
    return result;
  } catch (err) {
    if (err.isDuplicate) {
      const existing = await WalletTransaction.findOne(
        razorpayPaymentId ? { razorpayPaymentId } : { order: orderId, type }
      );
      const wallet = await Wallet.findOne({ rider: riderId });
      return { wallet, transaction: existing, duplicate: true };
    }
    throw err;
  } finally {
    session.endSession();
  }
}

const creditWallet = (opts) => applyWalletEntry({ ...opts, direction: 'credit' });
const debitWallet  = (opts) => applyWalletEntry({ ...opts, direction: 'debit' });

module.exports = { getOrCreateWallet, creditWallet, debitWallet };
