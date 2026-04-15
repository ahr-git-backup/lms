const fs = require('fs');

const path = 'src/pages/Register.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldAlert = `<div className="rounded-md border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900/50 dark:bg-yellow-900/20">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5" />
                  <div className="text-sm text-yellow-800 dark:text-yellow-400">
                    <p className="font-bold mb-1">সতর্কবার্তা!</p>
                    <p>আপনার ফোন নম্বর এবং পাসওয়ার্ড মনে রাখুন এবং কোথাও লিখে রাখুন।</p>
                  </div>
                </div>
              </div>`;

const newAlert = `<div className="rounded-md border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900/50 dark:bg-yellow-900/20">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5" />
                  <div className="text-sm text-yellow-800 dark:text-yellow-400 space-y-1">
                    <p className="font-bold mb-1 text-base">সতর্কবার্তা!</p>
                    <p>আপনার ফোন নম্বর এবং পাসওয়ার্ড মনে রাখুন এবং কোথাও লিখে রাখুন।</p>
                    <p className="font-semibold text-red-600 dark:text-red-400">অবশ্যই নিজের সচল ইমেইল দিবেন।</p>
                    <p>আপনার ইমেইলে একটি ভেরিফিকেশন লিংক যাবে, যা দিয়ে একাউন্ট ভেরিফাই করতে হবে। ইনবক্সে না পেলে Spam ফোল্ডার চেক করুন। ইমেইল ভেরিফাই না করলে লগইন করা যাবে না। লিংকটি ২৪ ঘণ্টার মধ্যে এক্সপায়ার হয়ে যাবে।</p>
                  </div>
                </div>
              </div>`;

content = content.replace(oldAlert, newAlert);

const oldTurnstile = `<div className="flex justify-center py-2">
                <Turnstile
                  siteKey="0x4AAAAAACpBHrpNCl36IKek"
                  onSuccess={(token) => setCaptchaToken(token)}
                />
              </div>

              <Button type="submit" className="mt-4 w-full" disabled={loading || !captchaToken}>`;

const newTurnstile = `<div className="flex justify-center py-2">
                <Turnstile
                  siteKey="0x4AAAAAACpBHrpNCl36IKek"
                  onSuccess={(token) => setCaptchaToken(token)}
                />
              </div>

              <div className="flex items-start space-x-2 py-2 mb-2">
                <Checkbox
                  id="emailVerificationConfirm"
                  required
                />
                <Label htmlFor="emailVerificationConfirm" className="text-sm font-medium leading-tight peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  I confirm that I understand an email verification link will be sent to the email address I provided, and I must verify it to login. (আমি বুঝতে পেরেছি যে আমার ইমেইলে একটি ভেরিফিকেশন লিংক যাবে এবং লগইন করার জন্য আমাকে সেটি ভেরিফাই করতে হবে।)
                </Label>
              </div>

              <Button type="submit" className="mt-4 w-full" disabled={loading || !captchaToken}>`;

content = content.replace(oldTurnstile, newTurnstile);

fs.writeFileSync(path, content, 'utf8');
console.log("Patched Register.tsx");
