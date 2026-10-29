// Google Maps JavaScript API Loader & Encoded Polyline Decoder
// Compliant with CSP, loading=async standards, and gm_authFailure interception

declare global {
  interface Window {
    google?: any;
    gm_authFailure?: () => void;
    __googleMapsLoadingPromise?: Promise<any> | null;
  }
}

let authFailed = false;
let authErrorMessage = "";

export function getGoogleMapsBrowserApiKey(): string {
  const envKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY;
  return typeof envKey === "string" ? envKey.trim() : "";
}

export function isGoogleMapsAuthFailed(): boolean {
  return authFailed;
}

export function getGoogleMapsAuthError(): string {
  return authErrorMessage;
}

/**
 * Dynamically loads the Google Maps JavaScript API script.
 * Uses modern loading=async parameter and safe error interception.
 * Never prints or leaks the API key in client console or DOM errors.
 */
export function loadGoogleMaps(apiKey?: string): Promise<any> {
  const key = apiKey || getGoogleMapsBrowserApiKey();

  if (!key) {
    return Promise.reject(
      new Error("MISSING_KEY: VITE_GOOGLE_MAPS_API_KEY is not configured in frontend/.env")
    );
  }

  if (window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }

  if (authFailed) {
    return Promise.reject(
      new Error(`AUTH_FAILURE: ${authErrorMessage || "Google Maps API authentication failed."}`)
    );
  }

  if (window.__googleMapsLoadingPromise) {
    return window.__googleMapsLoadingPromise;
  }

  window.__googleMapsLoadingPromise = new Promise((resolve, reject) => {
    // Intercept Google Maps authentication failure callback
    const prevAuthFailure = window.gm_authFailure;
    window.gm_authFailure = () => {
      authFailed = true;
      authErrorMessage =
        "Google Maps Authentication Failed: Check API key validity, billing status, or HTTP referrer restrictions in Google Cloud Console.";
      console.warn("[Google Maps SDK] gm_authFailure intercepted:", authErrorMessage);
      window.dispatchEvent(
        new CustomEvent("google-maps-auth-failure", {
          detail: { error: authErrorMessage },
        })
      );
      if (typeof prevAuthFailure === "function") prevAuthFailure();
    };

    const existingScript = document.getElementById("google-maps-js-sdk");
    if (existingScript) {
      existingScript.addEventListener("load", () => {
        if (window.google?.maps) resolve(window.google.maps);
        else reject(new Error("Google Maps object unavailable after script load."));
      });
      existingScript.addEventListener("error", () =>
        reject(new Error("Failed to load Google Maps JavaScript SDK."))
      );
      return;
    }

    const script = document.createElement("script");
    script.id = "google-maps-js-sdk";
    script.type = "text/javascript";
    // loading=async is the modern Google Maps recommended bootstrap parameter
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      key
    )}&libraries=geometry,places&loading=async`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      if (window.google?.maps) {
        resolve(window.google.maps);
      } else {
        // Wait briefly for async library bootstrap
        setTimeout(() => {
          if (window.google?.maps) {
            resolve(window.google.maps);
          } else {
            reject(new Error("Google Maps library not ready after script load."));
          }
        }, 100);
      }
    };

    script.onerror = () => {
      reject(
        new Error(
          "NETWORK_ERROR: Could not reach Google Maps CDN. Check internet connectivity or adblockers."
        )
      );
    };

    document.head.appendChild(script);
  });

  return window.__googleMapsLoadingPromise;
}

/**
 * Decodes an encoded polyline string into an array of { lat, lng } coordinates.
 * Compatible with Google Routes API encoded polyline format.
 */
export function decodePolyline(encoded: string): Array<{ lat: number; lng: number }> {
  if (!encoded) return [];

  // Use Google Maps native decoder if available
  if (window.google?.maps?.geometry?.encoding?.decodePath) {
    try {
      const path = window.google.maps.geometry.encoding.decodePath(encoded);
      return path.map((p: any) => ({ lat: p.lat(), lng: p.lng() }));
    } catch {
      // Fall through to manual decoder
    }
  }

  // Pure TypeScript decoder algorithm (works offline without Google SDK)
  const points: Array<{ lat: number; lng: number }> = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({ lat: lat * 1e-5, lng: lng * 1e-5 });
  }

  return points;
}
