export function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const mobileRegex = /Mobi|Android|iPhone|iPad|Windows Phone/i;
  return mobileRegex.test(ua) || (typeof window !== "undefined" && window.innerWidth <= 768);
}