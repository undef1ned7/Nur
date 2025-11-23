import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Plus, Upload, X } from "lucide-react";

export function AddCarDialog({ onAddCar, agentName, agentId }) {
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [formData, setFormData] = useState({
    make: "",
    model: "",
    year: new Date().getFullYear(),
    vin: "",
    origin: "Корея",
    destination: "Салон Москва",
    shippingDate: new Date().toISOString().split("T")[0],
    estimatedArrival: "",
    notes: "",
    price: 0,
  });

  const handlePhotoUpload = (e) => {
    const files = e.target.files;
    if (files) {
      const newPhotos = [];
      Array.from(files).forEach((file) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          newPhotos.push(reader.result);
          if (newPhotos.length === files.length) {
            setPhotos((prev) => [...prev, ...newPhotos]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removePhoto = (index) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onAddCar({
      ...formData,
      photos,
      agentId,
      agentName,
      status: "pending",
    });
    setOpen(false);
    setFormData({
      make: "",
      model: "",
      year: new Date().getFullYear(),
      vin: "",
      origin: "Корея",
      destination: "Салон Москва",
      shippingDate: new Date().toISOString().split("T")[0],
      estimatedArrival: "",
      notes: "",
      price: 0,
    });
    setPhotos([]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Добавить автомобиль
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Добавить новый автомобиль</DialogTitle>
          <DialogDescription>
            Заполните информацию о новом автомобиле для отправки
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="make">Марка</Label>
              <Input
                id="make"
                value={formData.make}
                onChange={(e) =>
                  setFormData({ ...formData, make: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Модель</Label>
              <Input
                id="model"
                value={formData.model}
                onChange={(e) =>
                  setFormData({ ...formData, model: e.target.value })
                }
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="year">Год выпуска</Label>
              <Input
                id="year"
                type="number"
                value={formData.year || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    year:
                      parseInt(e.target.value, 10) ||
                      new Date().getFullYear(),
                  })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vin">VIN номер</Label>
              <Input
                id="vin"
                value={formData.vin}
                onChange={(e) =>
                  setFormData({ ...formData, vin: e.target.value })
                }
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="origin">Откуда</Label>
              <Input
                id="origin"
                value={formData.origin}
                onChange={(e) =>
                  setFormData({ ...formData, origin: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="destination">Куда</Label>
              <Input
                id="destination"
                value={formData.destination}
                onChange={(e) =>
                  setFormData({ ...formData, destination: e.target.value })
                }
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="shippingDate">Дата отправки</Label>
              <Input
                id="shippingDate"
                type="date"
                value={formData.shippingDate}
                onChange={(e) =>
                  setFormData({ ...formData, shippingDate: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estimatedArrival">Ожидаемое прибытие</Label>
              <Input
                id="estimatedArrival"
                type="date"
                value={formData.estimatedArrival}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    estimatedArrival: e.target.value,
                  })
                }
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="price">Стоимость ($)</Label>
            <Input
              id="price"
              type="number"
              value={formData.price || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  price: parseFloat(e.target.value) || 0,
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Примечания</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Фотографии автомобиля</Label>
            <div className="border-2 border-dashed rounded-lg p-4">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                className="hidden"
                id="photo-upload"
              />
              <label htmlFor="photo-upload" className="cursor-pointer">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Upload className="h-8 w-8" />
                  <span>Нажмите для загрузки фото</span>
                </div>
              </label>
            </div>
            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                {photos.map((photo, index) => (
                  <div key={index} className="relative">
                    <img
                      src={photo}
                      alt={`Car ${index + 1}`}
                      className="w-full h-24 object-cover rounded"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Отмена
            </Button>
            <Button type="submit">Добавить автомобиль</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
