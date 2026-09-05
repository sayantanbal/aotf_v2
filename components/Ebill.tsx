"use client";

import { siteConfig } from "@/config/site";
import { format } from "date-fns";

type Item = {
  name: string;
  description?: string;
  qty: number;
  rate: number;
  price: number;
};

interface Props {
  orderNumber: string;
  orderType: string;
  amount: number;
  date: Date;
  customerName: string;
  phone: string;
  items: Item[];
  subtotal: number;
  totalQty: number;
  sgst: number;
  cgst: number;
  roundOff: number;
  total: number;
  postId: string;
  postLabel?: string;
  jobLabel?: string;
  referralPhoneNumber?: string;
  referredJobIds?: string;
  enquiryId?: string;
  invoiceId: string;
  tutorId: string;
  tutorName: string;
  tutorPhone: string;
}

export function EBill({
  orderNumber,
  orderType,
  amount,
  date,
  customerName,
  phone,
  items,
  subtotal,
  totalQty,
  sgst,
  cgst,
  roundOff,
  total,
  postId,
  postLabel = "Post ID",
  jobLabel,
  referralPhoneNumber,
  referredJobIds,
  enquiryId,
  invoiceId,
  tutorName,
  tutorPhone,
}: Props) {
  return (
    <main className="max-w-112.5 mx-auto shadow-lg p-3 flex flex-col gap-3 rounded-2xl bg-white border-dashed border-2 border-slate-200">
      {/* HEADER */}
      <header className="text-center space-y-1">
        <img src="/AOTF.svg" alt="AOTF Logo" className="mx-auto w-16 mb-5" />
        <p className="text-sm text-slate-500">
          Belgharia, Kolkata, West Bengal 700056
        </p>
        <div className="flex justify-center gap-3 text-xs text-slate-400">
          <p>Ph. {siteConfig.contact.phone}</p>
          <p>Email: {siteConfig.contact.email}</p>
        </div>
      </header>

      {/* ORDER INFO */}
      <section className="grid grid-cols-2 gap-y-4 py-4 border-y border-slate-100">
        <Info label="Invoice ID" value={invoiceId} />
        <Info label="Order Type" value={orderType} />
        <Info label="Fees" value={`₹ ${amount}`} highlight />
        <Info label="Date" value={format(date, "dd/MM/yy HH:mm")} />

        {/* ✅ NEW FIELDS */}
        <Info label={postLabel} value={postId} />

        {jobLabel ? <Info label={jobLabel} value={referredJobIds || "N/A"} /> : null}

        {referralPhoneNumber ? <Info label="Referral Phone" value={referralPhoneNumber} /> : null}

        <Info label="Enquiry ID" value={enquiryId || "-"} />
        <Info label="Tutor" value={`${tutorName}`} />
        <Info label="Tutor Phone" value={tutorPhone} />
      </section>

      {/* CUSTOMER */}
      <section className="bg-slate-50 p-3 rounded-lg shadow-sm">
        <p className="text-[10px] uppercase text-slate-400 font-bold">
          Customer Details
        </p>
        <p className="text-sm font-bold">{customerName}</p>
        <p className="text-sm text-slate-600">{phone}</p>
      </section>

      {/* BILL CARD */}
      <div className="rounded-xl shadow-lg overflow-hidden">
        {/* HEADER */}
        <div className="bg-linear-to-br from-blue-800 to-blue-500 text-white py-2 text-center">
          <h2 className="text-2xl font-bold tracking-widest">E-BILL</h2>
          <p className="text-xs mt-1 opacity-90">
            Academy of Tutorials & Freelancers
          </p>
        </div>

        <div className="p-5">
          {/* ITEMS */}
          <table className="w-full text-xs mb-4">
            <thead>
              <tr className="border-b">
                <th className="py-2 text-left">Tuition</th>
                <th className="py-2 text-right">Price</th>
              </tr>
            </thead>

            <tbody>
              {items.map((item, i) => (
                <tr key={i} className="border-b">
                  <td className="py-3">
                    <p>{item.name}</p>
                    {item.description && (
                      <p className="text-[10px] text-slate-400 mt-0.5">{item.description}</p>
                    )}
                  </td>
                  <td className="text-right font-semibold align-top pt-3">₹{item.price}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* SUMMARY */}
          <div className="space-y-2 ">
            <div className="bg-blue-50 p-3 rounded-lg flex justify-between mt-3">
              <span className="font-bold text-blue-900">Total Payable</span>
              <span className="text-xl font-extrabold text-blue-700">
                ₹{total}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="text-center space-y-3 mt-auto">
        <p className="text-sm text-slate-500">Thank you for choosing AOTF!</p>
        <a
          href="https://aotf.in"
          className="px-4 py-1.5 bg-blue-50 text-blue-600 text-xs rounded-full"
        >
          www.aotf.in
        </a>
      </footer>
    </main>
  );
}

/* SMALL COMPONENTS */

function Info({ label, value, highlight }: any) {
  return (
    <div className="border-l-2 border-blue-200 pl-3">
      <p className="text-[10px] text-slate-400 uppercase">{label}</p>
      <p className={highlight ? "text-blue-700 font-bold" : "font-semibold"}>
        {value}
      </p>
    </div>
  );
}

function Row({ label, value }: any) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}
