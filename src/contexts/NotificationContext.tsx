import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

interface NotificationContextType {
  requestPermission: () => Promise<void>;
  sendNotification: (title: string, options?: NotificationOptions) => void;
  permission: NotificationPermission;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const { toast } = useToast();

  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) {
      console.log("This browser does not support desktop notification");
      return;
    }
    try {
      const p = await Notification.requestPermission();
      setPermission(p);
      if (p === 'granted') {
          toast({ title: "Notifications enabled" });
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error);
    }
  }, [toast]);

  const sendNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (permission === "granted") {
      new Notification(title, {
          icon: "/favicon.png", // Assuming a favicon exists, or use a logo URL
          ...options
      });
    } else {
        // Fallback to toast if permission not granted
        toast({ title: title, description: options?.body });
    }
  }, [permission, toast]);

  return (
    <NotificationContext.Provider value={{ requestPermission, sendNotification, permission }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotification must be used within a NotificationProvider");
  }
  return context;
};
