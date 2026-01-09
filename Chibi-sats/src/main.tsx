import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./i18n"; // Import the i18n configuration
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n"; // Import the i18n instance

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <App />
    </I18nextProvider>
  </React.StrictMode>,
);
