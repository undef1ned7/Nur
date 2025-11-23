import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Download, Calendar, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export function AnalyticsHeader({ onRefresh, onExport, period, onPeriodChange }) {
  const handleRefresh = () => {
    onRefresh();
    toast.success("Данные обновлены");
  };

  const handleExport = () => {
    onExport();
    toast.success("Отчет экспортирован в формате CSV");
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
      <div>
        <h2 className="bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
          Аналитика продаж
        </h2>
        <p className="text-sm text-muted-foreground">
          Детальная статистика и инфографика
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Select value={period} onValueChange={onPeriodChange}>
          <SelectTrigger className="w-[160px]">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7days">Последние 7 дней</SelectItem>
            <SelectItem value="30days">Последние 30 дней</SelectItem>
            <SelectItem value="3months">Последние 3 месяца</SelectItem>
            <SelectItem value="year">Текущий год</SelectItem>
            <SelectItem value="all">Все время</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          onClick={handleRefresh}
          className="hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          onClick={handleExport}
          className="gap-2 hover:bg-green-50 hover:text-green-600 hover:border-green-200"
        >
          <Download className="h-4 w-4" />
          Экспорт
        </Button>
      </div>
    </div>
  );
}
