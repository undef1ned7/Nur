import { Card, CardContent } from "./ui/card";

export function StatCard({ title, value, icon: Icon, description, trend }) {
  return (
    <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div className="h-12 w-12 rounded-xl bg-[#ffd600]/20 flex items-center justify-center">
            <Icon className="h-6 w-6 text-[#ffd600]" />
          </div>
          {trend && (
            <div
              className={`px-2 py-1 rounded-lg text-xs font-medium ${
                trend.isPositive
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {trend.isPositive ? "+" : ""}
              {trend.value}%
            </div>
          )}
        </div>
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-gray-900 text-2xl font-semibold">{value}</h2>
          </div>
          {description && (
            <p className="text-xs text-gray-500 mt-1">{description}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
