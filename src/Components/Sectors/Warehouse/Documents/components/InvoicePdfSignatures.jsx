import React from "react";
import { Text, View } from "@react-pdf/renderer";
import { invoicePdfStyles as s } from "./invoicePdfDocumentStyles";

export default function InvoicePdfSignatures() {
  return (
    <View style={s.signatures}>
      <View style={s.signatureCol}>
        <Text style={s.signatureLabel}>Отпустил</Text>
        <View style={s.signatureLine} />
      </View>
      <View style={s.signatureCol}>
        <Text style={s.signatureLabel}>Получил</Text>
        <View style={s.signatureLine} />
      </View>
    </View>
  );
}
