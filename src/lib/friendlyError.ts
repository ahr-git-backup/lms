/**
 * Turns any technical error (Supabase / network / auth / permission) into a short Bangla message the student can
 * understand: WHAT happened and WHAT TO DO. Never shows raw SQL/API text to the user; the raw error is only logged.
 */
export interface FriendlyError {
  title: string;
  description: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function friendlyError(err: any, action = "কাজটি"): FriendlyError {
  const raw = String(err?.message ?? err?.error_description ?? err ?? "").toLowerCase();
  const code = String(err?.code ?? err?.status ?? "");

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { title: "ইন্টারনেট সংযোগ নেই", description: "আপনার ইন্টারনেট বন্ধ আছে। সংযোগ চালু করে আবার চেষ্টা করুন।" };
  }
  if (raw.includes("failed to fetch") || raw.includes("networkerror") || raw.includes("load failed") || raw.includes("network request failed") || raw.includes("timeout") || raw.includes("timed out")) {
    return { title: "সার্ভারের সাথে যোগাযোগ হচ্ছে না", description: "ইন্টারনেট ধীর বা সংযোগ ছিঁড়ে গেছে। কিছুক্ষণ পর আবার চেষ্টা করুন।" };
  }
  if (raw.includes("jwt") || raw.includes("token") && raw.includes("expired") || raw.includes("not authenticated") || raw.includes("invalid refresh") || code === "401") {
    return { title: "লগইনের মেয়াদ শেষ", description: "আপনার সেশন শেষ হয়ে গেছে। অনুগ্রহ করে আবার লগইন করুন।" };
  }
  if (raw.includes("row-level security") || raw.includes("permission denied") || raw.includes("not allowed") || code === "42501" || code === "403") {
    return { title: "এই কাজের অনুমতি নেই", description: `আপনার অ্যাকাউন্টে ${action} করার অনুমতি নেই। কোর্সে এনরোল আছে কিনা দেখুন, অথবা সাপোর্টে জানান।` };
  }
  if (raw.includes("duplicate key") || raw.includes("already exists") || code === "23505") {
    return { title: "আগেই করা আছে", description: `${action} ইতিমধ্যে সম্পন্ন হয়েছে। নতুন করে করার দরকার নেই।` };
  }
  if (raw.includes("violates foreign key") || raw.includes("not found") || code === "23503" || code === "404" || code === "pgrst116") {
    return { title: "তথ্য পাওয়া যায়নি", description: "যা খুঁজছেন সেটি মুছে ফেলা হয়েছে বা আর নেই। পেজ রিফ্রেশ করে আবার দেখুন।" };
  }
  if (raw.includes("more than one row") || raw.includes("subquery") || raw.includes("syntax error") || raw.includes("does not exist") || raw.includes("column") || raw.includes("could not find") || code === "42703" || code === "42883" || code === "pgrst202" || code === "21000") {
    return { title: "আমাদের দিকে একটি সমস্যা হয়েছে", description: "এটি আপনার ভুল নয়। আমরা ঠিক করছি — কিছুক্ষণ পর আবার চেষ্টা করুন। সমস্যা থাকলে সাপোর্টে জানান।" };
  }
  if (code === "429" || raw.includes("too many") || raw.includes("rate limit")) {
    return { title: "অনেক বেশি অনুরোধ", description: "অল্প সময়ে অনেকবার চেষ্টা করা হয়েছে। ১ মিনিট অপেক্ষা করে আবার চেষ্টা করুন।" };
  }
  if (/^5\d\d$/.test(code) || raw.includes("internal server") || raw.includes("bad gateway") || raw.includes("unavailable")) {
    return { title: "সার্ভার এখন ব্যস্ত", description: "সার্ভারে সাময়িক সমস্যা চলছে। কয়েক মিনিট পর আবার চেষ্টা করুন।" };
  }
  return { title: "কিছু একটা সমস্যা হয়েছে", description: `${action} সম্পন্ন করা যায়নি। আবার চেষ্টা করুন; সমস্যা থাকলে সাপোর্টে জানান।` };
}
