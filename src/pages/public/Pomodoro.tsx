import PublicHeader from "@/components/PublicHeader";

const Pomodoro = () => (
  <div className="min-h-screen bg-background text-foreground">
    <PublicHeader />
    <div className="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 className="text-2xl font-bold text-primary">শীঘ্রই আসছে</h1>
      <p className="text-muted-foreground mt-2">এই ফিচারটি খুব শীঘ্রই যুক্ত করা হবে।</p>
    </div>
  </div>
);

export default Pomodoro;
