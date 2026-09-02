import { createContext, useContext } from "react";

export type AdminPageActions = {
  refresh?: () => void | Promise<void>;
  exportJson?: () => void | Promise<void>;
};

export type AdminLayoutContextValue = {
  themeColor: string;
  registerPageActions: (actions: AdminPageActions | null) => void;
};

export const AdminLayoutContext = createContext<AdminLayoutContextValue>({
  themeColor: "#1677ff",
  registerPageActions: () => {},
});

export function useAdminLayout(): AdminLayoutContextValue {
  return useContext(AdminLayoutContext);
}
