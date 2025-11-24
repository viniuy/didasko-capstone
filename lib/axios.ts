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
    console.log("Making request:", {
      url: config.url,
      method: config.method,
      params: config.params,
      data: config.data,
    });
    return config;
  },
  (error) => {
    console.error("Request interceptor error:", {
      message: error.message,
      config: error.config,
      stack: error.stack,
    });
    return Promise.reject(error);
  }
);

// Add response interceptor
axiosInstance.interceptors.response.use(
  (response) => {
    console.log("Response received:", {
      url: response.config.url,
      status: response.status,
      data: response.data,
    });
    return response;
  },
  (error) => {
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
        params: error.config?.params,
        headers: error.config?.headers,
        stack: error.stack,
      });
    } else if (error.request) {
      // The request was made but no response was received
      console.error("Request error:", {
        message: "No response received from server",
        request: error.request,
        url: error.config?.url,
        method: error.config?.method,
        params: error.config?.params,
        stack: error.stack,
      });
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error("Error:", {
        message: error.message,
        stack: error.stack,
        config: error.config,
      });
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
