import React from "react";
import { Text, View } from "@react-pdf/renderer";
import { safe } from "./invoicePdfDocumentUtils";

export default function InvoicePdfParties({
  docType,
  seller,
  buyer,
  isInventory,
  isTransfer,
}) {
  if (isInventory || isTransfer) return null;

  return (
    <View
      style={{
        flexDirection: "column",
        gap: 4,
        marginTop: 6,
        marginBottom: 6,
      }}
    >
      {["PURCHASE", "PURCHASE_RETURN"].includes(docType) && (
        <>
          <View style={{ flexDirection: "row", fontSize: 8 }}>
            <Text style={{ fontSize: 8, fontWeight: "bold" }}>Поставщик: </Text>
            {buyer ? (
              <Text style={{ fontSize: 8 }}>
                {safe(buyer.name || buyer.full_name)}
              </Text>
            ) : (
              <Text style={{ fontSize: 8 }}>—</Text>
            )}
          </View>
          <View style={{ flexDirection: "row", fontSize: 8 }}>
            <Text style={{ fontSize: 8, fontWeight: "bold" }}>Покупатель: </Text>
            <Text style={{ fontSize: 8 }}>{safe(seller.name)}</Text>
            {seller.address && (
              <Text style={{ fontSize: 8 }}> {safe(seller.address)}</Text>
            )}
          </View>
        </>
      )}
      {["SALE", "SALE_RETURN"].includes(docType) && (
        <>
          <View style={{ flexDirection: "row", fontSize: 8 }}>
            <Text style={{ fontSize: 8, fontWeight: "bold" }}>Поставщик: </Text>
            <Text style={{ fontSize: 8 }}>{safe(seller.name)}</Text>
            {seller.address && (
              <Text style={{ fontSize: 8 }}> {safe(seller.address)}</Text>
            )}
          </View>
          <View style={{ flexDirection: "row", fontSize: 8 }}>
            <Text style={{ fontSize: 8, fontWeight: "bold" }}>Покупатель: </Text>
            {buyer ? (
              <Text style={{ fontSize: 8 }}>
                {safe(buyer.name || buyer.full_name)}
              </Text>
            ) : (
              <Text style={{ fontSize: 8 }}>—</Text>
            )}
          </View>
        </>
      )}
      {["RECEIPT", "WRITE_OFF"].includes(docType) && seller?.name && (
        <View style={{ flexDirection: "row", fontSize: 8 }}>
          <Text style={{ fontSize: 8, fontWeight: "bold" }}>Организация: </Text>
          <Text style={{ fontSize: 8 }}>{safe(seller.name)}</Text>
          {seller.address && (
            <Text style={{ fontSize: 8 }}> {safe(seller.address)}</Text>
          )}
        </View>
      )}
    </View>
  );
}
