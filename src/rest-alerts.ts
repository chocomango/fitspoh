let audio: AudioContext | undefined;

export async function enableRestAlerts() {
  try {
    audio ??= new AudioContext();
    await audio.resume();
  } catch {
    return "Sound is unavailable in this browser. Use your phone timer for alerts.";
  }
  if (!("Notification" in window) || !("serviceWorker" in navigator))
    return "Sound enabled. Phone notifications are unavailable in this browser.";
  try {
    const permission = await Notification.requestPermission();
    return permission === "granted"
      ? "Sound and phone notifications enabled while the app is running. Background alerts may be delayed."
      : "Sound enabled. Phone notifications were not allowed; check your browser settings.";
  } catch {
    return "Sound enabled. Phone notifications are unavailable here.";
  }
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
