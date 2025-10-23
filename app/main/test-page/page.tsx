"use client";
import toast from "react-hot-toast";

export default function ToastTester() {
  return (
    <button
      className="bg-blue-600 text-white px-4 py-2 rounded"
      onClick={() => {
        console.log("Triggering toast...");
        toast.success("Hello from react-hot-toast!");
      }}
    >
      Test Toast
    </button>
  );
}
