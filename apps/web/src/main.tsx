import { Toast } from "@heroui/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { router } from "./app/router";
import { queryClient } from "./lib/query-client";
import "./styles/app.css";
import "./styles/loading.css";
import "./styles/toast.css";

const container = document.getElementById("root");
if (!container) throw new Error("Missing application root");
createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toast.Provider placement="top" maxVisibleToasts={1} />
    </QueryClientProvider>
  </StrictMode>,
);
