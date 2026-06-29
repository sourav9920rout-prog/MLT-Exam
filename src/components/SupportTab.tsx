import React, { useState } from 'react';
import { Heart, Check } from 'lucide-react';

export default function SupportTab() {
  const [amount, setAmount] = useState<number | 'other'>(50);
  const [customAmount, setCustomAmount] = useState<string>('');

  const handlePayment = () => {
    let finalAmount = amount === 'other' ? parseFloat(customAmount) : amount;
    if (isNaN(finalAmount) || finalAmount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    const upiLink = `upi://pay?pa=9716084965@slc&pn=Mr%20TINU%20BHALLA&cu=INR&am=${finalAmount}`;
    
    // Redirect to UPI link
    window.location.href = upiLink;
  };

  return (
    <div className="bg-white rounded-xl shadow-[0_0_20px_rgba(45,212,191,0.15)] border border-teal-100 p-8 text-center max-w-2xl mx-auto space-y-6">
      <div className="w-20 h-20 bg-gradient-to-tr from-teal-100 to-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 border border-teal-200">
        <Heart size={40} className="text-teal-500 fill-teal-500" />
      </div>
      <h2 className="text-2xl font-bold bg-gradient-to-r from-teal-500 to-emerald-500 bg-clip-text text-transparent">Support the App</h2>
      <p className="text-slate-600 text-sm leading-relaxed">
        If you find this application helpful for your medical laboratory technology preparation, consider supporting its development and maintenance. Your contribution helps keep the servers running and enables new features!
      </p>
      
      <div className="pt-4 max-w-md mx-auto space-y-4">
        <h3 className="font-semibold text-slate-700 text-left">Select Amount (₹)</h3>
        <div className="grid grid-cols-3 gap-3">
          {[10, 25, 50, 100].map((preset) => (
            <button
              key={preset}
              onClick={() => setAmount(preset)}
              className={`py-3 rounded-xl border-2 font-bold transition-all flex items-center justify-center gap-2 ${
                amount === preset 
                  ? 'border-teal-500 bg-teal-50 text-teal-600' 
                  : 'border-slate-100 bg-white text-slate-600 hover:border-teal-200 hover:bg-teal-50/50'
              }`}
            >
              ₹{preset}
              {amount === preset && <Check size={16} />}
            </button>
          ))}
          <button
            onClick={() => setAmount('other')}
            className={`col-span-2 py-3 rounded-xl border-2 font-bold transition-all flex items-center justify-center gap-2 ${
              amount === 'other'
                ? 'border-teal-500 bg-teal-50 text-teal-600'
                : 'border-slate-100 bg-white text-slate-600 hover:border-teal-200 hover:bg-teal-50/50'
            }`}
          >
            Other Amount
            {amount === 'other' && <Check size={16} />}
          </button>
        </div>

        {amount === 'other' && (
          <div className="pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <input
              type="number"
              min="1"
              placeholder="Enter custom amount in ₹"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              className="w-full px-4 py-3 border-2 border-teal-200 rounded-xl focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 transition-all font-semibold text-slate-700"
            />
          </div>
        )}
      </div>

      <div className="pt-4">
        <button 
          onClick={handlePayment}
          className="w-full max-w-md inline-flex justify-center items-center gap-3 px-8 py-4 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl font-bold text-lg hover:shadow-[0_0_25px_rgba(45,212,191,0.6)] transition-all hover:-translate-y-1"
        >
          <Heart size={20} />
          Pay via UPI
        </button>
        <p className="text-xs text-slate-400 mt-4">
          If nothing happens when you click the button, you can directly use this UPI ID: <strong>9716084965@slc</strong>
        </p>
      </div>
    </div>
  );
}
