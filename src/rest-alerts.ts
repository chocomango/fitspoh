let audio: AudioContext | undefined;

function appleMobile() {
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  );
}

function homeScreen() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function restAlertHint() {
  return appleMobile()
    ? "On iPhone, phone notifications require opening the app from a Home Screen icon. Safari Share → Add to Home Screen installs it. This version cannot deliver rest alerts while the app is suspended or the phone is locked; use your phone timer."
    : "Sound plays while the app is running. Phone notifications may be delayed in the background. For alerts with the browser closed or phone locked, use your phone timer.";
}

export async function enableRestAlerts() {
  // Start both gated APIs during the tap, before yielding user activation.
  const sound = (async () => {
    try {
      audio ??= new AudioContext();
      await audio.resume();
      return true;
    } catch {
      return false;
    }
  })();
  let permission: Promise<NotificationPermission> | undefined;
  const needsInstall = appleMobile() && !homeScreen();
  if (
    !needsInstall &&
    "Notification" in window &&
    "serviceWorker" in navigator
  ) {
    try {
      permission = Notification.requestPermission().catch(
        () => "default" as const,
      );
    } catch {
      /* Sound remains available when notification permissions fail. */
    }
  }
  const soundEnabled = await sound;
  const soundMessage = soundEnabled
    ? "Sound enabled while the app is open."
    : "Sound is unavailable in this browser.";
  if (needsInstall)
    return `${soundMessage} On iPhone, open the app from a Home Screen icon to request notifications. Use your phone timer for locked-screen rest alerts.`;
  if (!permission)
    return `${soundMessage} Phone notifications are unavailable here. Use your phone timer for locked-screen alerts.`;
  const result = await permission;
  return result === "granted"
    ? `${soundMessage} Notifications allowed while the app runs. Locked-screen rest alerts require your phone timer.`
    : `${soundMessage} Phone notifications were not allowed; check your browser settings.`;
}

export async function playRestAlert() {
  try {
    if (audio?.state === "running") {
      for (let i = 0; i < 3; i++) {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        const start = audio.currentTime + i * 0.35;
        oscillator.frequency.value = 880;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
        gain.gain.linearRampToValueAtTime(0, start + 0.25);
        oscillator.connect(gain);
        gain.connect(audio.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.26);
      }
    }
  } catch {
    // Audio failure must not prevent the separate notification attempt.
  }
  try {
    if (
      "Notification" in window &&
      Notification.permission === "granted" &&
      "serviceWorker" in navigator
    ) {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration?.showNotification("Rest complete", {
        body: "Ready for your next set.",
        tag: "fitspoh-rest",
        icon: new URL("icon-192.png", document.baseURI).href,
      });
    }
  } catch {
    // An unavailable system alert must never interrupt workout logging.
  }
}
