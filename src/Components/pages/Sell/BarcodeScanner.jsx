import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import useScanDetection from "use-scan-detection";
import {
  manualFilling,
  sendBarCode,
  startSale,
} from "../../../store/creators/saleThunk";
import { useSale } from "../../../store/slices/saleSlice";
import { useAlert } from "@/hooks/useDialog";
import { validateResErrors } from "../../../../tools/validateResErrors";
import { getBarcodeAmbiguity } from "../../../../tools/barcodeAmbiguity";
import BarcodeAmbiguityModal from "../../common/BarcodeAmbiguityModal/BarcodeAmbiguityModal";
// import { sendBarCode } from "../../../store/creators/productCreators";

const BarcodeScanner = ({ id }) => {
  const [barcodeScan, setBarcodeScan] = useState("");
  const { barcodeError } = useSale();
  const alert = useAlert();
  const dispatch = useDispatch();
  const [ambiguity, setAmbiguity] = useState(null);
  const [ambiguityLoading, setAmbiguityLoading] = useState(false);
  // const id = "some-sale-id";
  useScanDetection({
    onComplete: (scanned) => {
      if (scanned.length >= 3) {
        setBarcodeScan(scanned);
      }
    },
    minLength: 3,
  });

  useEffect(() => {
    if (!barcodeScan) return;
    (async () => {
      try {
        const result = await dispatch(
          sendBarCode({ barcode: barcodeScan, id })
        ).unwrap();
        await dispatch(startSale()).unwrap();

        if (result?.error) {
          const errorMessage = validateResErrors(result.error, "Ошибка от сервера");
          alert(errorMessage, true);
          return;
        }
      } catch (err) {
        const barcodeAmbiguity = getBarcodeAmbiguity(err);
        if (barcodeAmbiguity) {
          setAmbiguity(barcodeAmbiguity);
          return;
        }
        const errorMessage = validateResErrors(err, "Ошибка при сканировании штрих-кода");
        alert(errorMessage, true);
      } finally {
        setBarcodeScan("");
      }
    })();
  }, [alert, barcodeScan, dispatch, id]);

  const selectAmbiguousProduct = async (match) => {
    if (!id || !match?.id) return;
    setAmbiguityLoading(true);
    try {
      await dispatch(
        manualFilling({ id, productId: match.id, quantity: 1 }),
      ).unwrap();
      await dispatch(startSale()).unwrap();
      setAmbiguity(null);
    } catch (err) {
      alert(
        validateResErrors(err, "Не удалось добавить выбранный товар"),
        true,
      );
    } finally {
      setAmbiguityLoading(false);
    }
  };

  return (
    <div>
      {barcodeError?.message && (
        <p style={{ color: "red", marginLeft: "30px" }}>
          {barcodeError.message}
        </p>
      )}
      <BarcodeAmbiguityModal
        open={Boolean(ambiguity)}
        message={ambiguity?.message}
        matches={ambiguity?.matches}
        loading={ambiguityLoading}
        onSelect={selectAmbiguousProduct}
        onClose={() => {
          if (!ambiguityLoading) setAmbiguity(null);
        }}
      />
      {/* </p> */}
    </div>
  );
};

export default BarcodeScanner;
