import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Send, Facebook, Users } from "lucide-react";

const Community = () => {
  useEffect(() => {
    document.title = "Community – Atlas";
  }, []);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Community</h1>
        <p className="text-sm text-muted-foreground">Join our community channels to stay updated.</p>
      </header>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Telegram Card */}
        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900 shadow-md hover:shadow-lg transition-all">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500 rounded-full text-white">
                <Send className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl">Telegram Channel</CardTitle>
            </div>
            <CardDescription>
              Join our official Telegram channel for instant updates, notices, and direct support.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white" asChild>
              <a href="https://t.me/atlasweb_robot" target="_blank" rel="noopener noreferrer">
                Join Telegram
              </a>
            </Button>
          </CardContent>
        </Card>

        {/* Facebook Card */}
        <Card className="border-indigo-200 bg-indigo-50/50 dark:bg-indigo-950/20 dark:border-indigo-900 shadow-md hover:shadow-lg transition-all">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-600 rounded-full text-white">
                <Facebook className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl">Facebook Group</CardTitle>
            </div>
            <CardDescription>
              Join our Facebook group to discuss with other students and share knowledge.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white" asChild>
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer">
                Join Facebook Group
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Community;
