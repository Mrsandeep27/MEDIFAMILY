"use client";

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) {
    console.warn("This browser does not support notifications");
    return false;
  }

  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;

  const result = await Notification.requestPermission();
  return result === "granted";
}

export function showNotification(
  title: string,
  options?: NotificationOptions
): void {
  if (Notification.permission !== "granted") return;

  const notification = new Notification(title, {
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-96x96.png",
    ...options,
  });

  notification.onclick = () => {
    window.focus();
    notification.close();
  };
}

export function showReminderNotification(
  medicineName: string,
  memberName: string,
  dosage?: string,
  beforeFood?: boolean
): void {
  const body = [
    dosage,
    beforeFood ? "Before food" : "After food",
    `for ${memberName}`,
  ]
    .filter(Boolean)
    .join(" · ");

  showNotification(`Time for ${medicineName}`, {
    body,
    tag: `reminder-${medicineName}-${Date.now()}`,
    requireInteraction: true,
  });
}
