import axios from "axios";

// Create axios instance with default config
const axiosInstance = axios.create({
  baseURL: "/api", // This will be relative to your Next.js app
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // This is important for handling cookies
  timeout: 30000, // 30 second default timeout
});

// Add request interceptor
axiosInstance.interceptors.request.use(
  (config) => {
    // Only log in development
    if (process.env.NODE_ENV === "development") {
      console.log("Making request:", {
        url: config.url,
        method: config.method,
      });
    }
    return config;
  },
  (error) => {
    // Ignore cancellation errors
    if (
      error.name === "CanceledError" ||
      error.code === "ERR_CANCELED" ||
      error.message === "canceled"
    ) {
      return Promise.reject(error);
    }
    console.error("Request interceptor error:", {
      message: error.message,
      url: error.config?.url,
      method: error.config?.method,
    });
    return Promise.reject(error);
  }
);

// Add response interceptor
axiosInstance.interceptors.response.use(
  (response) => {
    // Only log in development
    if (process.env.NODE_ENV === "development") {
      console.log("Response received:", {
        url: response.config.url,
        status: response.status,
      });
    }
    return response;
  },
  (error) => {
    // Ignore cancellation errors (these are expected when React Query cancels requests)
    if (
      error.name === "CanceledError" ||
      error.code === "ERR_CANCELED" ||
      error.message === "canceled" ||
      error.config?.signal?.aborted
    ) {
      // Silently ignore cancelled requests - they're expected behavior
      return Promise.reject(error);
    }

    // Handle common errors here
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error("Response error:", {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
        method: error.config?.method,
      });
    } else if (error.request) {
      // The request was made but no response was received
      // Only log if it's not a timeout (timeouts are handled by the calling code)
      if (
        error.code !== "ECONNABORTED" &&
        !error.message?.includes("timeout")
      ) {
        console.error("Request error:", {
          message: error.message || "No response received from server",
          url: error.config?.url,
          method: error.config?.method,
          code: error.code,
        });
      }
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error("Error:", {
        message: error.message,
        url: error.config?.url,
        method: error.config?.method,
      });
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
