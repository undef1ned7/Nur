import React from "react";
import { Text, View } from "@react-pdf/renderer";
import { invoicePdfStyles as s } from "./invoicePdfDocumentStyles";
import { resolvePartiesForDocType, safe, usesPartyBlocks } from "./invoicePdfDocumentUtils";

function PartyBlock({ label, party }) {
  if (!party?.name || party.name === "—") return null;
  return (
    <View style={s.partyBlock}>
      <View style={s.partyRow}>
        <Text style={s.partyLabel}>{label}</Text>
        <Text style={s.partyValue}>{party.name}</Text>
      </View>
      {party.addressLine ? (
        <View style={s.partySubRow}>
          <Text style={s.partyValue}>{party.addressLine}</Text>
        </View>
      ) : null}
      {party.phoneLine ? (
        <View style={s.partySubRow}>
          <Text style={s.partyValue}>{party.phoneLine}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function InvoicePdfParties({
  docType,
  seller,
  buyer,
  isInventory,
  isTransfer,
}) {
  if (isTransfer) {
    return (
      <View style={{ marginBottom: 8, gap: 2 }}>
        {seller?.name && (
          <>
            <View style={s.partyRow}>
              <Text style={s.partyLabel}>Организация:</Text>
              <Text style={s.partyValue}>{safe(seller.name)}</Text>
            </View>
            {seller.address ? (
              <View style={s.partySubRow}>
                <Text style={s.partyValue}>Адрес: {safe(seller.address)}</Text>
              </View>
            ) : null}
          </>
        )}
      </View>
    );
  }

  if (isInventory) {
    if (!seller?.name) return null;
    return (
      <View style={{ marginBottom: 8 }}>
        <View style={s.partyRow}>
          <Text style={s.partyLabel}>Организация:</Text>
          <Text style={s.partyValue}>{safe(seller.name)}</Text>
        </View>
        {seller.address ? (
          <View style={s.partySubRow}>
            <Text style={s.partyValue}>Адрес: {safe(seller.address)}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  if (!usesPartyBlocks(docType)) {
    return null;
  }

  const { supplier, buyer: buyerParty } = resolvePartiesForDocType(
    docType,
    seller,
    buyer,
  );

  if (["RECEIPT", "WRITE_OFF"].includes(docType)) {
    return <PartyBlock label="Организация:" party={supplier} />;
  }

  return (
    <>
      <PartyBlock label="Поставщик:" party={supplier} />
      <PartyBlock label="Покупатель:" party={buyerParty} />
    </>
  );
}
