/**
 * Global API Utility for authenticated requests
 * Automatically intercepts 401 Unauthorized responses and attempts to refresh the Directus token.
 */

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

export const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  let token = localStorage.getItem("directus_access_token");
  
  // Create a mutable copy of headers
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const finalOptions: RequestInit = {
    ...options,
    headers,
    mode: options.mode || "cors",
  };

  let res = await fetch(url, finalOptions);

  // Intercept 401s and attempt refresh
  if (res.status === 401) {
    console.log("Access token expired (401). Attempting global token refresh...");
    
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = (async () => {
        const refreshToken = localStorage.getItem("directus_refresh_token");
        if (refreshToken) {
          try {
            const refreshRes = await fetch("https://dev-directus.rearlytech.com/auth/refresh", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ refresh_token: refreshToken })
            });
            
            if (refreshRes.ok) {
              const refreshData = await refreshRes.json();
              if (refreshData.data?.access_token) {
                localStorage.setItem("directus_access_token", refreshData.data.access_token);
                if (refreshData.data.refresh_token) {
                  localStorage.setItem("directus_refresh_token", refreshData.data.refresh_token);
                }
                return refreshData.data.access_token;
              }
            }
          } catch (err) {
            console.error("Network error during token refresh:", err);
          }
        }
        return null;
      })();
    }

    const newAccessToken = await refreshPromise;
    
    // Once the promise is resolved (or if we were the last one waiting), clear the lock
    isRefreshing = false;
    refreshPromise = null;

    if (newAccessToken) {
      console.log("Token refreshed successfully. Retrying original request...");
      headers["Authorization"] = `Bearer ${newAccessToken}`;
      finalOptions.headers = headers;
      res = await fetch(url, finalOptions);
    } else {
      console.warn("Token refresh failed. Forcing logout.");
      localStorage.removeItem("directus_access_token");
      localStorage.removeItem("directus_refresh_token");
      localStorage.removeItem("erp_jwt");
      localStorage.removeItem("erp_user");
      window.location.href = "/login";
    }
  }
  
  return res;
};
