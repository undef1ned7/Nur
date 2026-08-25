import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import useScanDetection from "use-scan-detection";
import {
  isCompanyWarehouseBarcodeProduct,
  lookupMarketWarehouseProductByBarcode,
} from "../../../../../../tools/marketWarehouseBarcodeScan";
import { getBarcodeAmbiguity } from "../../../../../../tools/barcodeAmbiguity";
import { validateResErrors } from "../../../../../../tools/validateResErrors";
import { useAlert } from "@/hooks/useDialog";

const WarehouseBarcodeScanner = ({
  isBlocked,
  onScanStart,
  onScanEnd,
  onAmbiguity,
}) => {
  const navigate = useNavigate();
  const alert = useAlert();
  const barcodeProcessingRef = useRef(false);
  const lastScanTimeRef = useRef(0);
  const lastScannedBarcodeRef = useRef("");
  const isScanningRef = useRef(false);

  useScanDetection({
    minLength: 3,
    onComplete: async (barcode) => {
      const scanned = String(barcode || "").trim();
      if (!scanned || barcodeProcessingRef.current) return;

      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.isContentEditable)
      ) {
        return;
      }
      if (isBlocked) return;

      const now = Date.now();
      const isDuplicateScan =
        lastScannedBarcodeRef.current === scanned &&
        now - lastScanTimeRef.current < 1500;
      if (isDuplicateScan || isScanningRef.current) return;

      barcodeProcessingRef.current = true;
      isScanningRef.current = true;
      lastScannedBarcodeRef.current = scanned;
      lastScanTimeRef.current = now;
      onScanStart?.();

      try {
        const result = await lookupMarketWarehouseProductByBarcode(scanned);
        const productId = result?.product?.id;

        if (productId && isCompanyWarehouseBarcodeProduct(result)) {
          navigate(`/crm/sklad/${productId}`);
          return;
        }

        if (productId && result?.source === "global") {
          alert(
            "Товар найден в глобальном каталоге. Добавьте его на склад компании.",
            false,
          );
          navigate("/crm/sklad/add-product", {
            state: {
              openScanTab: true,
              initialScanBarcode: scanned,
            },
          });
          return;
        }

        alert("Товар с таким штрихкодом не найден.", true);
      } catch (error) {
        const ambiguity = getBarcodeAmbiguity(error);
        if (ambiguity) {
          onAmbiguity?.(ambiguity);
          return;
        }
        const errorMessage = validateResErrors(
          error,
          "Ошибка поиска товара по штрихкоду",
        );
        alert(errorMessage, true);
      } finally {
        barcodeProcessingRef.current = false;
        onScanEnd?.();
        setTimeout(() => {
          isScanningRef.current = false;
        }, 300);
      }
    },
  });

  return null;
};

export default WarehouseBarcodeScanner;
