import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Car as CarIcon, Bell, TruckIcon, Store, UserCircle } from "lucide-react";
import { toast } from "sonner";

export function AppHeader({
  currentUser,
  users,
  stats,
  activeView,
  onChangeView,
  onUserChange,
}) {
  const handleUserSelect = (id) => {
    const user = users.find((u) => u.id === id);
    if (user) {
      onUserChange(user);
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b bg-card shadow-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg">
              <CarIcon className="h-7 w-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                  nurcrm.kg
                </h1>
                <Badge variant="secondary" className="text-xs">
                  PRO
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Профессиональная система управления автологистикой
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Notifications */}
            {(currentUser.role === "manager" ||
              currentUser.role === "agent") && (
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                onClick={() => toast.info("Уведомления пусты")}
              >
                <Bell className="h-5 w-5" />
                {stats.arrived > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] text-white flex items-center justify-center">
                    {stats.arrived}
                  </span>
                )}
              </Button>
            )}

            {/* View Toggle */}
            {(currentUser.role === "agent" ||
              currentUser.role === "manager") && (
              <div className="flex gap-1 bg-muted p-1 rounded-lg">
                <Button
                  variant={activeView === "logistics" ? "default" : "ghost"}
                  onClick={() => onChangeView("logistics")}
                  className="gap-2 h-9"
                  size="sm"
                >
                  <TruckIcon className="h-4 w-4" />
                  Логистика
                </Button>
                <Button
                  variant={activeView === "shop" ? "default" : "ghost"}
                  onClick={() => onChangeView("shop")}
                  className="gap-2 h-9"
                  size="sm"
                >
                  <Store className="h-4 w-4" />
                  Магазин
                </Button>
              </div>
            )}

            {/* User Select */}
            <Select value={currentUser.id} onValueChange={handleUserSelect}>
              <SelectTrigger className="w-[240px]">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <UserCircle className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm">{currentUser.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {currentUser.role === "agent"
                        ? "Агент"
                        : currentUser.role === "manager"
                        ? "Менеджер"
                        : "Покупатель"}
                    </div>
                  </div>
                </div>
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex items-center gap-2">
                      <UserCircle className="h-4 w-4" />
                      <div>
                        <div>{user.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {user.role === "agent"
                            ? "Агент"
                            : user.role === "manager"
                            ? "Менеджер"
                            : "Покупатель"}
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </header>
  );
}
