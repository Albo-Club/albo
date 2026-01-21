import { createContext, useContext, useState, ReactNode } from "react";

interface DealContext {
  companyName: string;
}

interface AIPanelContextType {
  isOpen: boolean;
  openPanel: (dealId?: string, dealContext?: DealContext) => void;
  closePanel: () => void;
  togglePanel: () => void;
  currentDealId: string | null;
  currentDealContext: DealContext | null;
}

const AIPanelContext = createContext<AIPanelContextType | undefined>(undefined);

export function AIPanelProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);
  const [currentDealId, setCurrentDealId] = useState<string | null>(null);
  const [currentDealContext, setCurrentDealContext] = useState<DealContext | null>(null);

  const openPanel = (dealId?: string, dealContext?: DealContext) => {
    setCurrentDealId(dealId || null);
    setCurrentDealContext(dealContext || null);
    setIsOpen(true);
  };

  const closePanel = () => {
    setIsOpen(false);
  };

  const togglePanel = () => {
    if (isOpen) {
      closePanel();
    } else {
      openPanel();
    }
  };

  return (
    <AIPanelContext.Provider
      value={{
        isOpen,
        openPanel,
        closePanel,
        togglePanel,
        currentDealId,
        currentDealContext,
      }}
    >
      {children}
    </AIPanelContext.Provider>
  );
}

export function useAIPanel() {
  const context = useContext(AIPanelContext);
  if (context === undefined) {
    throw new Error("useAIPanel must be used within an AIPanelProvider");
  }
  return context;
}
