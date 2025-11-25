import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  deleteProductAsync,
  updateProductAsync,
} from "../../../../store/creators/productCreators";
import { useClient } from "../../../../store/slices/ClientSlice";
import { useProducts } from "../../../../store/slices/productSlice";
import {
  getCashBoxes,
  useCash,
  addCashFlows,
} from "../../../../store/slices/cashSlice";

export default function EditModal({
  item,
  onClose,
  onSaveSuccess,
  onDeleteConfirm,
}) {
  const { updating, updateError, deleting, deleteError } = useSelector(
    (state) => state.product
  );
  const { brands, categories } = useProducts();
  const { list } = useClient();
  const { list: cashBoxes } = useCash();
  const filterClient1 = list.filter((item) => item.type === "suppliers");
  const [selectedCashBox, setSelectedCashBox] = useState("");
  const [editData, setEditData] = useState({
    id: item.id || "",
    name: item.name || "",
    barcode: item.barcode || "",
    brand: item.brand || "",
    category: item.category || "",
    client: item.client || "",
    price: item.price || "",
    purchase_price: item.purchase_price || "",
    quantity: item.quantity || "",
    plu: item.plu || "",
    scale_type: item.scale_type || "",
  });
  const dispatch = useDispatch();
  const changeEditData = (key, value) => {
    setEditData({
      ...editData,
      [key]: value,
    });
  };

  const saveData = async () => {
    try {
      await dispatch(
        updateProductAsync({
          productId: item.id,
          updatedData: { ...editData },
        })
      ).unwrap();

      const oldQty = Number(item.quantity) || 0;
      const newQty = Number(editData.quantity) || 0;
      const deltaQty = newQty - oldQty;

      if (deltaQty !== 0 && selectedCashBox) {
        const unitPrice = Number(editData.purchase_price) || 0;
        const amount = Math.abs(deltaQty) * unitPrice;
        const type = deltaQty > 0 ? "income" : "expense";

        await dispatch(
          addCashFlows({
            cashbox: selectedCashBox,
            type,
            name: `Изм. остатков по товару: ${editData.name}`,
            amount,
            meta: {
              product_id: item.id,
              old_quantity: oldQty,
              new_quantity: newQty,
              delta_quantity: deltaQty,
              unit_price_used: unitPrice,
              basis: "purchase_price",
            },
          })
        ).unwrap();
      }

      // alert("Данные сохранены");
      onSaveSuccess?.();
    } catch (err) {
      console.error("Failed to update product:", err);
      alert("Ошибка при сохранении: " + (err.message || JSON.stringify(err)));
    }
  };
  const handleDelete = async () => {
    if (window.confirm("Вы уверены, что хотите удалить этот товар?")) {
      await dispatch(deleteProductAsync(item.id)).unwrap();
      onClose();
    }
  };

  useEffect(() => {
    dispatch(getCashBoxes());
  }, [dispatch]);

  // Автоматически выбираем первую кассу по индексу
  useEffect(() => {
    if (cashBoxes && cashBoxes.length > 0 && !selectedCashBox) {
      const firstCashBox = cashBoxes[0];
      const firstCashBoxId = firstCashBox?.id || firstCashBox?.uuid || "";
      if (firstCashBoxId) {
        setSelectedCashBox(firstCashBoxId);
      }
    }
  }, [cashBoxes, selectedCashBox]);
  return (
    <div className="edit-modal sklad">
      <div className="edit-modal__overlay" onClick={onClose} />
      <div className="edit-modal__content">
        <div className="edit-modal__header">
          <h3>Редактирование товара {item?.name}</h3>
          <X className="edit-modal__close-icon" size={20} onClick={onClose} />
        </div>

        {/* Название */}
        <div className="edit-modal__section">
          <label>Название *</label>
          <input
            type="text"
            name="name"
            value={editData.name}
            onChange={(e) => {
              changeEditData("name", e.target.value);
            }}
            required
          />
        </div>

        {/* Штрих код */}
        <div className="edit-modal__section">
          <label>Штрих код *</label>
          <input
            type="text"
            name="barcode"
            value={editData.barcode}
            onChange={(e) => {
              changeEditData("barcode", e.target.value);
            }}
            required
          />
        </div>

        {/* Бренд */}
        <div className="edit-modal__section">
          <label>Бренд *</label>
          <select
            name="brand_name"
            value={editData.brand}
            onChange={(e) => {
              changeEditData("brand", e.target.value);
            }}
            required
          >
            <option value="">-- Выберите бренд --</option>
            {brands?.map((brand, idx) => (
              <option key={brand.id ?? idx} value={brand.name}>
                {brand.name}
              </option>
            ))}
          </select>
        </div>

        {/* Категория */}
        <div className="edit-modal__section">
          <label>Категория *</label>
          <select
            name="category_name"
            value={editData.category}
            onChange={(e) => {
              changeEditData("category", e.target.value);
            }}
            required
          >
            <option value="">-- Выберите категорию --</option>
            {categories?.map((category, idx) => (
              <option key={category.id ?? idx} value={category.name}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        {/* Поставщик */}
        <div className="edit-modal__section">
          <label>Поставщик *</label>
          <select
            name="client"
            value={editData.client}
            onChange={(e) => {
              changeEditData("client", e.target.value);
            }}
            required
          >
            <option value="">-- Выберите поставщика --</option>
            {filterClient1?.map((client, idx) => (
              <option key={client.id ?? idx} value={client.id}>
                {client.full_name}
              </option>
            ))}
          </select>
        </div>

        {/* Розничная цена */}
        <div className="edit-modal__section">
          <label>Розничная цена *</label>
          <input
            type="number"
            name="price"
            value={editData.price}
            onChange={(e) => {
              changeEditData("price", e.target.value);
            }}
            min="0"
            step="0.01"
            required
          />
        </div>

        {/* Закупочная цена */}
        <div className="edit-modal__section">
          <label>Закупочная цена *</label>
          <input
            type="number"
            name="purchase_price"
            value={editData.purchase_price}
            onChange={(e) => {
              changeEditData("purchase_price", e.target.value);
            }}
            min="0"
            step="0.01"
            required
          />
        </div>

        {/* касса автоматически выбирается - скрыто от пользователя */}

        {/* Количество */}
        <div className="edit-modal__section">
          <label>Количество *</label>
          <input
            type="number"
            name="quantity"
            value={editData.quantity}
            onChange={(e) => {
              changeEditData("quantity", e.target.value);
            }}
            min="0"
            required
          />
        </div>

        {/* ПЛУ */}
        <div className="edit-modal__section">
          <label>ПЛУ</label>
          <input
            type="number"
            name="plu"
            value={editData.plu}
            onChange={(e) => {
              changeEditData("plu", e.target.value);
            }}
            min="0"
            max="2147483647"
            placeholder="Номер ПЛУ для весов (можно не заполнять)"
          />
        </div>

        {/* Тип товара для весов */}
        <div className="edit-modal__section">
          <label>Тип товара для весов</label>
          <select
            name="scale_type"
            value={editData.scale_type}
            onChange={(e) => {
              changeEditData("scale_type", e.target.value);
            }}
          >
            <option value="">-- Выберите тип --</option>
            <option value="piece">Штучный</option>
            <option value="weight">Весовой</option>
          </select>
        </div>

        <div className="edit-modal__footer">
          <button
            className="edit-modal__reset"
            onClick={handleDelete}
            disabled={deleting || updating}
          >
            {deleting ? "Удаление..." : "Удалить"}
          </button>
          <button
            className="edit-modal__save"
            onClick={saveData}
            // disabled={updating || deleting}
          >
            {updating ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
