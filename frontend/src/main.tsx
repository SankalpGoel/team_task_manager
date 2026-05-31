import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

import App from "@/App";
import { queryClient } from "@/lib/queryClient";
import { useUiStore } from "@/store/uiStore";
import "@/index.css";

function ThemeBoot() {
  React.useEffect(() => {
    useUiStore.getState().applyTheme();
  }, []);
  return null;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeBoot />
        <App />
        <Toaster richColors position="top-right" closeButton />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
