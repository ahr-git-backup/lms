import React from 'react';
import { AlertTriangle, CheckCircle2, Info, Link as LinkIcon, MonitorPlay } from 'lucide-react';
import PublicHeader from '@/components/PublicHeader';

const Tutorial = () => {
  return (
    <div className="flex flex-col min-h-screen w-full">
      <PublicHeader />
      <div className="w-full px-2 sm:px-4 py-8 md:py-12">
        <div className="bg-card border rounded-none sm:rounded-xl shadow-sm p-4 sm:p-10 mb-8 w-full">
          {/* Header Section */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 text-primary">
            কিভাবে একাউন্ট খুলবেন এবং কোর্স কিনবেন?
          </h1>
          <p className="text-muted-foreground text-lg">
            অ্যাটলাস কোর্সেস এ নতুন একাউন্ট খোলা থেকে শুরু করে কোর্স কেনার সম্পূর্ণ গাইডলাইন নিচে দেওয়া হলো।
          </p>
        </div>

        {/* Content Section - Markdown Style using Prose */}
        <div className="prose prose-slate dark:prose-invert max-w-none text-[17px] leading-relaxed">
          
          {/* Step 1 */}
          <div className="relative mb-8 pl-8 sm:pl-12">
            <div className="absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
              ১
            </div>
            <h3 className="text-xl font-bold mt-0 mb-3 text-foreground flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              রেজিস্ট্রেশন বা একাউন্ট খোলা
            </h3>
            <p className="text-muted-foreground">
              প্রথমে <a href="/login" className="text-primary font-medium underline underline-offset-4 hover:text-primary/80">লগইন পেজ</a> থেকে <strong>Create New Account</strong> এ ক্লিক করে <a href="/register" className="text-primary font-medium underline underline-offset-4 hover:text-primary/80">রেজিস্টার পেজে</a> যেতে হবে। 
            </p>
            <p className="text-muted-foreground">
              এরপর তোমার নাম, মোবাইল নাম্বার, ইমেইল সহ যা যা চেয়েছে সব কিছুই সুন্দর ভাবে সময় নিয়ে পূরণ করতে হবে।
            </p>
            <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg p-4 my-4">
              <div className="flex gap-3">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <p className="m-0 text-blue-900 dark:text-blue-200 text-sm">
                  <strong>খেয়াল রাখতে হবে:</strong> যেই ইমেইল টা দিচ্ছো সেটা আর পাসওয়ার্ড টা অবশ্যই মনে রাখতে হবে। কারণ পরবর্তীতে এগুলো দিয়েই তোমাকে ওয়েবসাইটে লগইন করতে হবে। সবকিছু পূরণ করা হলে আবার চেক করে নিবে। এরপর <strong>Register</strong> বাটনে ক্লিক করবে।
                </p>
              </div>
            </div>
            
            {/* Image for Step 1 */}
            <div className="my-6 w-full -mx-4 sm:mx-0 sm:w-full overflow-hidden border-y sm:border shadow-sm">
               <img src="https://pub-48488a27fc9244d9b86fec8da3eb89f4.r2.dev/public/9402a8d4-05ad-4d5d-85ff-0300b9ad1803.png" alt="Registration Form" className="w-full h-auto object-contain" />
            </div>
          </div>

          {/* Step 2 */}
          <div className="relative mb-8 pl-8 sm:pl-12">
            <div className="absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
              ২
            </div>
            <h3 className="text-xl font-bold mt-0 mb-3 text-foreground flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              ইমেইল কনফার্মেশন (গুরুত্বপূর্ণ)
            </h3>
            
            {/* Critical Highlight Box for Step 2 */}
            <div className="bg-red-50 dark:bg-red-950/30 border-l-4 border-red-500 dark:border-red-600 rounded-r-lg p-5 my-5 shadow-sm">
              <div className="flex gap-3">
                <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-500 shrink-0" />
                <div>
                  <h4 className="m-0 text-red-800 dark:text-red-400 font-bold mb-1">গুরুত্ত্বপুর্ণ পয়েন্ট!</h4>
                  <p className="m-0 text-red-900/90 dark:text-red-300 text-sm">
                    রেজিস্টার বাটনে ক্লিকের পর তুমি যেই ইমেইল দিয়েছিলে সেখানে একটা <strong>Confirmation Mail</strong> যাবে। সেই মেইলে থাকা লিংকে ক্লিক করতে হবে। এরপর তোমাকে ওয়েবসাইটে নিয়ে আসবে মেইলের লিংক।
                  </p>
                </div>
              </div>
            </div>

            <p className="text-muted-foreground">
              লিংকে ক্লিক করার পর অটো লগইনও হয়ে যেতে পারে। ওয়েবসাইটের <strong>Login</strong> বাটনে ক্লিক করে চেক করো। যদি লগইন না হয় তাহলে যেই ইমেইল দিয়েছিলে সেই মেইল ও পাসওয়ার্ড বসিয়ে লগইন করবে।
            </p>

            {/* Image for Step 2 */}
            <div className="my-6 w-full -mx-4 sm:mx-0 sm:w-full overflow-hidden border-y sm:border shadow-sm">
               <img src="https://pub-48488a27fc9244d9b86fec8da3eb89f4.r2.dev/public/4498f8bc-ac4b-4743-8701-fb92289fb770.png" alt="Email Confirmation Inbox" className="w-full h-auto object-contain" />
            </div>
          </div>

          {/* Step 3 */}
          <div className="relative mb-8 pl-8 sm:pl-12">
            <div className="absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
              ৩
            </div>
            <h3 className="text-xl font-bold mt-0 mb-3 text-foreground flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              কোর্স এনরোল এবং পেমেন্ট
            </h3>
            <p className="text-muted-foreground">
              এরপর <a href="/courses" className="text-primary font-medium underline underline-offset-4 hover:text-primary/80">কোর্সেস পেজ</a> থেকে তুমি যেই কোর্স কিনতে চাও তা পছন্দ করে <strong>Enroll now</strong> এ ক্লিক করবে। এরপর কোনো কুপন কোড থাকলে এপ্লাই করবে।
            </p>
            <ul className="text-muted-foreground">
              <li>এরপর সেই কোর্সের টাকা ওয়েবসাইটে দেয়া নাম্বারে <strong>বিকাশ</strong> অথবা <strong>নগদে</strong> সেন্ড মানি করবে।</li>
              <li>তারপর গুগল ফর্ম পূরণ করবে।</li>
              <li>স্টেপ ৩ এ তোমার মোবাইল নাম্বার দিবে (যেটা থেকে বিকাশ করছো) আর বিকাশের টাকা পাঠানোর পর মেসেজে Trx দিয়ে একটা নাম্বার দেয় ওইটা লিখে দিবা।</li>
            </ul>

            {/* Image for Step 3 */}
            <div className="my-6 w-full -mx-4 sm:mx-0 sm:w-full overflow-hidden border-y sm:border shadow-sm">
               <img src="https://pub-48488a27fc9244d9b86fec8da3eb89f4.r2.dev/public/13e11908-a9d2-4f29-a03d-358ca6cd0c13.png" alt="Course Enrollment Payment Trx" className="w-full h-auto object-contain" />
            </div>
          </div>

          {/* Step 4 */}
          <div className="relative mb-8 pl-8 sm:pl-12">
            <div className="absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
              ৪
            </div>
            <h3 className="text-xl font-bold mt-0 mb-3 text-foreground flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              এডমিনকে জানানো
            </h3>
            <p className="text-muted-foreground">
              উপরের ৩ টা স্টেপ কমপ্লিট করে নিচের লিংকে মেসেজ দিও:
            </p>
            <div className="flex flex-col sm:flex-row gap-3 my-4">
              <a href="https://t.me/AtlasWeb_Robot" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors no-underline">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.825 8.356c-.52 4.095-1.527 10.613-2.023 13.565-.224 1.343-.597 1.79-1.39 1.838-1.554.094-2.73-1.077-4.234-2.067-2.358-1.55-3.69-2.522-5.99-4.04-2.65-1.748-.934-2.708.57-4.269.394-.41 7.23-6.66 7.363-7.22.016-.071.03-.338-.135-.455-.164-.116-.39-.06-.554-.022-.234.053-3.955 2.518-11.162 7.397-1.054.721-2.008 1.077-2.862 1.058-.94-.022-2.75-.529-4.098-.967-1.656-.538-2.969-.824-2.86-1.737.056-.47 1.066-1.77 3.033-3.896 4.39-4.755 9.074-9.764 12.924-12.01C16.514 1.258 17.5 1.006 18.156.974c.94-.047 3.024.215 3.996 1.155.808.784.887 1.956.88 2.76.012-1.325.26-4.5.342-6.533z"/></svg>
                AtlasWeb Robot
              </a>
              <a href="https://t.me/rafi_somc" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white font-medium rounded-lg transition-colors no-underline">
                <LinkIcon className="w-4 h-4" />
                @rafi_somc
              </a>
            </div>
            
            <div className="bg-muted p-4 rounded-lg border">
              <p className="m-0 text-sm font-medium"><strong>মেসেজের ডেমো:</strong></p>
              <p className="m-0 text-muted-foreground mt-2 italic border-l-2 border-primary pl-3">
                "ভাইয়া আমি ওয়েবসাইটে নতুন একাউন্ট খুলে এই কোর্স (কোর্সের নাম) কিনেছি এবং আমি এই নাম্বার থেকে (যে নাম্বার থেকে টাকা পাঠিয়েছি) এত টাকা (টাকার পরিমাণ) পাঠিয়েছি। কাইন্ডলি আমাকে কোর্সে এপ্রুভ করেন।"
              </p>
            </div>
          </div>

          {/* Step 5 */}
          <div className="relative pl-8 sm:pl-12">
            <div className="absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
              ৫
            </div>
            <h3 className="text-xl font-bold mt-0 mb-3 text-foreground flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              এপ্রুভালের জন্য অপেক্ষা
            </h3>
            <p className="text-muted-foreground mb-0">
              তোমাকে সব কিছু চেক করে এপ্রুভ করা হবে। অনুগ্রহ করে ওয়েট করবে। এপ্রুভ হওয়ার পর ওয়েবসাইটের ড্যাশবোর্ড থেকে কোর্সের সব ভিডিও ক্লাস ও এক্সাম দিতে পারবে।
            </p>
          </div>
          
          {/* Divider */}
          <hr className="my-16 border-dashed border-2" />

          {/* Password Reset Section */}
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold tracking-tight mb-4 text-primary">
              পাসওয়ার্ড ভুলে গেলে কিভাবে রিকভার করবেন?
            </h2>
            <p className="text-muted-foreground text-lg">
              কোনো কারণে পাসওয়ার্ড ভুলে গেলে আপনার একাউন্ট ফিরিয়ে আনার সহজ নিয়ম।
            </p>
          </div>

          {/* PR Step 1 */}
          <div className="relative mb-8 pl-8 sm:pl-12">
            <div className="absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
              ১
            </div>
            <h3 className="text-xl font-bold mt-0 mb-3 text-foreground flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              রিসেট লিংক পাঠানো
            </h3>
            <p className="text-muted-foreground">
              প্রথমে <a href="/login" className="text-primary font-medium underline underline-offset-4 hover:text-primary/80">লগইন পেজে</a> গিয়ে <strong>Forgot Password?</strong> লেখায় ক্লিক করুন। অথবা সরাসরি <a href="/forgot-password" className="text-primary font-medium underline underline-offset-4 hover:text-primary/80">পাসওয়ার্ড রিকভারি পেজে</a> যান।
            </p>
            <p className="text-muted-foreground">
              সেখানে আপনার একাউন্টের ইমেইল এড্রেসটি দিন, ক্যাপচা (Captcha) পূরণ করুন এবং <strong>Send Reset Link</strong> বাটনে ক্লিক করুন।
            </p>
            
            {/* Image Placeholder PR Step 1 */}
            <div className="my-6 bg-muted/50 border rounded-lg aspect-[21/9] flex items-center justify-center relative overflow-hidden">
               <div className="text-center p-6">
                 <MonitorPlay className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                 <p className="text-sm text-muted-foreground font-medium">Image Placeholder: Forgot Password Form</p>
               </div>
            </div>
          </div>

          {/* PR Step 2 */}
          <div className="relative mb-8 pl-8 sm:pl-12">
            <div className="absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
              ২
            </div>
            <h3 className="text-xl font-bold mt-0 mb-3 text-foreground flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              ইমেইল চেক করুন
            </h3>
            <p className="text-muted-foreground">
              আপনার ইমেইলে একটি পাসওয়ার্ড রিসেট লিংক পাঠানো হবে (ইনবক্স এবং স্প্যাম ফোল্ডার চেক করুন)। ইমেইলটি ওপেন করে সেই লিংকে ক্লিক করুন।
            </p>
          </div>

          {/* PR Step 3 */}
          <div className="relative pl-8 sm:pl-12">
            <div className="absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
              ৩
            </div>
            <h3 className="text-xl font-bold mt-0 mb-3 text-foreground flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              নতুন পাসওয়ার্ড সেট করুন
            </h3>
            <p className="text-muted-foreground">
              লিংকে ক্লিক করার পর আপনাকে নতুন পাসওয়ার্ড সেট করার পেজে নিয়ে আসবে। সেখানে আপনার নতুন পাসওয়ার্ড দিয়ে এবং আবার একই পাসওয়ার্ড দিয়ে নিশ্চিত করে <strong>Update Password</strong> বাটনে ক্লিক করুন।
            </p>
            <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg p-4 my-4">
              <div className="flex gap-3">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <p className="m-0 text-blue-900 dark:text-blue-200 text-sm">
                  <strong>টিপস:</strong> আপনার নতুন পাসওয়ার্ডটি অবশ্যই কমপক্ষে ৬ অক্ষরের হতে হবে। আপডেট হওয়ার পর এই নতুন পাসওয়ার্ড দিয়ে আপনি আবার লগইন করতে পারবেন।
                </p>
              </div>
            </div>
            
            {/* Image Placeholder PR Step 2/3 */}
            <div className="my-6 bg-muted/50 border rounded-lg aspect-[21/9] flex items-center justify-center relative overflow-hidden">
               <div className="text-center p-6">
                 <MonitorPlay className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                 <p className="text-sm text-muted-foreground font-medium">Image Placeholder: Reset Password Form</p>
               </div>
            </div>
          </div>

        </div>
      </div>
    </div>
    </div>
  );
};

export default Tutorial;
