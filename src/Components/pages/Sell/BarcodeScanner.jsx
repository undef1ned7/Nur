import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import useScanDetection from "use-scan-detection";
import { sendBarCode, startSale } from "../../../store/creators/saleThunk";
import { useSale } from "../../../store/slices/saleSlice";
// import { sendBarCode } from "../../../store/creators/productCreators";

const BarcodeScanner = ({ id }) => {
  const [barcodeScan, setBarcodeScan] = useState("");
  const { barcodeError } = useSale();

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
          console.log("Ошибка от сервера:", result.error);
          return;
        }
      } catch (err) {
        // log something readable
        console.error("sendBarCode/startSale failed:", err);
      }
    })();
  }, [barcodeScan, dispatch, id]);

  return (
    <div>
      <p>
        {barcodeError?.message && (
          <p style={{ color: "red", marginLeft: "30px" }}>
            {barcodeError.message}
          </p>
        )}
      </p>
    </div>
  );
};

export default BarcodeScanner;
