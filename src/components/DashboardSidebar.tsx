import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Store, SLA, SpatialResult } from "@/hooks/use-spatial-data";
import { MapPin, Users, Hash, Layers } from "lucide-react";

interface Props {
  store: Store;
  sla: SLA;
  onStoreChange: (s: Store) => void;
  onSlaChange: (s: SLA) => void;
  result: SpatialResult;
  loading: boolean;
}

export function DashboardSidebar({ store, sla, onStoreChange, onSlaChange, result, loading }: Props) {
  const sortedCategories = Object.entries(result.categoryCounts).sort((a, b) => b[1] - a[1]);

  return (
    <Sidebar className="border-r border-border/40">
      <SidebarHeader className="p-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Layers className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-foreground">Blitz Logistics</h1>
            <p className="text-[10px] text-muted-foreground">Coverage & Demand</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Controls */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
            Controls
          </SidebarGroupLabel>
          <SidebarGroupContent className="space-y-3 px-1">
            <div>
              <label className="text-[11px] text-muted-foreground mb-1 block">Dark Store</label>
              <Select value={store} onValueChange={(v) => onStoreChange(v as Store)}>
                <SelectTrigger className="h-8 text-xs bg-background/50 border-border/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HSR">HSR</SelectItem>
                  <SelectItem value="Marathali">Marathali</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground mb-1 block">SLA Coverage</label>
              <Select value={sla} onValueChange={(v) => onSlaChange(v as SLA)}>
                <SelectTrigger className="h-8 text-xs bg-background/50 border-border/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1-hr coverage</SelectItem>
                  <SelectItem value="2">2-hr coverage</SelectItem>
                  <SelectItem value="3">3-hr coverage</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Stats */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
            Metrics
          </SidebarGroupLabel>
          <SidebarGroupContent className="space-y-2 px-1">
            <StatCard
              icon={<MapPin className="h-3.5 w-3.5 text-chart-1" />}
              label="Active Store"
              value={store}
              loading={loading}
            />
            <StatCard
              icon={<Users className="h-3.5 w-3.5 text-chart-2" />}
              label="Households Covered"
              value={result.totalHouseholds.toLocaleString()}
              loading={loading}
            />
            <StatCard
              icon={<Hash className="h-3.5 w-3.5 text-chart-3" />}
              label="Unique Pincodes"
              value={result.uniquePincodes.toString()}
              loading={loading}
            />
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Category Breakdown */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
            Demand Categories
          </SidebarGroupLabel>
          <SidebarGroupContent className="px-1">
            {loading ? (
              <p className="text-xs text-muted-foreground">Loading...</p>
            ) : sortedCategories.length === 0 ? (
              <p className="text-xs text-muted-foreground">No features in zone</p>
            ) : (
              <div className="space-y-1">
                {sortedCategories.map(([cat, count]) => (
                  <div
                    key={cat}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs bg-muted/30"
                  >
                    <span className="text-muted-foreground truncate mr-2">{cat}</span>
                    <span className="font-mono font-medium text-foreground tabular-nums">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

function StatCard({
  icon,
  label,
  value,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/30 bg-muted/20 p-3">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <p className="text-lg font-bold text-foreground tabular-nums">
        {loading ? "—" : value}
      </p>
    </div>
  );
}
