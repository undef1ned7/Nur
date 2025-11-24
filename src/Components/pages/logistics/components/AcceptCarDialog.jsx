import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { CheckCircle2 } from "lucide-react";

export function AcceptCarDialog({
  car,
  open,
  onOpenChange,
  onAccept,
  managerName,
}) {
  const [notes, setNotes] = useState("");

  // Сброс формы при закрытии
  useEffect(() => {
    if (!open) {
      setNotes("");
    }
  }, [open]);

  const handleAccept = () => {
    if (car) {
      onAccept(car.id, notes);
      setNotes("");
      onOpenChange(false);
    }
  };

  if (!car) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Приёмка автомобиля
          </DialogTitle>
          <DialogDescription>
            Проверьте состояние автомобиля и добавьте примечания
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
            <p>
              <span className="text-gray-600">Автомобиль:</span>{" "}
              <span className="text-gray-900 font-medium">
                {car.make} {car.model} ({car.year})
              </span>
            </p>
            <p>
              <span className="text-gray-600">VIN:</span>{" "}
              <span className="text-gray-900 font-medium">{car.vin}</span>
            </p>
            <p>
              <span className="text-gray-600">Агент:</span>{" "}
              <span className="text-gray-900 font-medium">{car.agentName}</span>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="acceptance-notes">Примечания при приёмке</Label>
            <Textarea
              id="acceptance-notes"
              placeholder="Укажите состояние автомобиля, наличие дефектов и другие замечания..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button onClick={handleAccept}>Подтвердить приёмку</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
