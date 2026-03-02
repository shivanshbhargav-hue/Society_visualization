import { useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { DashboardMap } from "@/components/DashboardMap";
import { useSpatialData, type Store, type SLA } from "@/hooks/use-spatial-data";

const Index = () => {
  const [store, setStore] = useState<Store>("HSR");
  const [sla, setSla] = useState<SLA>("1");
  const spatial = useSpatialData(store, sla);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <DashboardSidebar
          store={store}
          sla={sla}
          onStoreChange={setStore}
          onSlaChange={setSla}
          result={spatial}
          loading={spatial.loading}
        />
        <div className="flex-1 flex flex-col">
          <header className="h-10 flex items-center border-b border-border/30 bg-background/80 backdrop-blur-sm px-2 gap-2">
            <SidebarTrigger />
            <span className="text-xs text-muted-foreground">
              {store} · {sla}-hr SLA · {spatial.featuresInZone.length} features in zone
            </span>
          </header>
          <main className="flex-1 relative">
            <DashboardMap store={store} result={spatial} />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Index;
