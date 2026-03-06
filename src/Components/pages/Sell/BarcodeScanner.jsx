import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import useScanDetection from "use-scan-detection";
import { sendBarCode, startSale } from "../../../store/creators/saleThunk";
import { useSale } from "../../../store/slices/saleSlice";
import { useAlert } from "@/hooks/useDialog";
import { validateResErrors } from "../../../../tools/validateResErrors";
// import { sendBarCode } from "../../../store/creators/productCreators";

const BarcodeScanner = ({ id }) => {
  const [barcodeScan, setBarcodeScan] = useState("");
  const { barcodeError } = useSale();
  const alert = useAlert();
  const dispatch = useDispatch();
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
        const errorMessage = validateResErrors(err, "Ошибка при сканировании штрих-кода");
        alert(errorMessage, true);
      }
    })();
  }, [barcodeScan, dispatch, id]);

  return (
    <div>
      {barcodeError?.message && (
        <p style={{ color: "red", marginLeft: "30px" }}>
          {barcodeError.message}
        </p>
      )}
      {/* </p> */}
    </div>
  );
};

export default BarcodeScanner;
