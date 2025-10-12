import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import useScanDetection from "use-scan-detection";
import { createProductWithBarcode } from "../../../store/creators/productCreators";
import { useProducts } from "../../../store/slices/productSlice";

const AddProductBarcode = () => {
  const { barcodeError } = useProducts();
  const [barcodeScan, setBarcodeScan] = useState("");
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
          createProductWithBarcode({ barcode: barcodeScan })
        ).unwrap();
        // await dispatch(startSale()).unwrap();

        if (result?.error) {
          console.log("Ошибка от сервера:", result.error);
          return;
        }
      } catch (err) {
        // log something readable
        console.error("sendBarCode/startSale failed:", err);
      }
    })();
  }, [barcodeScan, dispatch]);
  return (
    <div>
      {barcodeError?.barcode && (
        <p style={{ color: "red", marginLeft: "30px" }}>
          {barcodeError.barcode}
        </p>
      )}
    </div>
  );
};

export default AddProductBarcode;
