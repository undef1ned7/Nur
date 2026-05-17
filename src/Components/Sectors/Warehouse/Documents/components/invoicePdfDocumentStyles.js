import { StyleSheet } from "@react-pdf/renderer";

/** Макет «как в Excel»: сетка, заголовок по центру, блоки поставщик/покупатель. */
export const invoicePdfStyles = StyleSheet.create({
  page: {
    fontFamily: "Roboto",
    fontSize: 9,
    paddingTop: 14,
    paddingBottom: 14,
    paddingHorizontal: 16,
    color: "#000",
  },

  title: {
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },

  partyBlock: {
    marginBottom: 8,
    gap: 2,
  },
  partyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    fontSize: 9,
  },
  partyLabel: {
    width: 72,
    fontWeight: "bold",
    flexShrink: 0,
  },
  partyValue: {
    flex: 1,
    fontSize: 9,
  },
  partySubRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    fontSize: 9,
    paddingLeft: 72,
  },
  metaRow: {
    flexDirection: "row",
    fontSize: 9,
    marginBottom: 2,
  },
  metaLabel: {
    fontWeight: "bold",
    marginRight: 4,
  },

  goodsTable: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#000",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    minHeight: 14,
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tableHeader: {
    backgroundColor: "#ffffff",
    fontWeight: "bold",
  },
  tableCell: {
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderRightColor: "#000",
    fontSize: 8,
    justifyContent: "center",
  },
  tableCellLast: {
    borderRightWidth: 0,
  },
  cellCenter: { textAlign: "center" },
  cellRight: { textAlign: "right" },
  cellLeft: { textAlign: "left" },

  colNo: { width: "5%" },
  colArt: { width: "11%" },
  colName: { width: "38%" },
  colQty: { width: "9%" },
  colUnit: { width: "7%" },
  colPrice: { width: "14%" },
  colSum: { width: "16%" },

  colNoWide: { width: "6%" },
  colNameWide: { width: "54%" },
  colArtWide: { width: "14%" },
  colUnitWide: { width: "10%" },
  colQtyWide: { width: "16%" },

  footerLabelCell: {
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderRightColor: "#000",
    fontSize: 8,
    fontWeight: "bold",
    justifyContent: "center",
  },
  footerSumCell: {
    paddingVertical: 3,
    paddingHorizontal: 4,
    fontSize: 8,
    fontWeight: "bold",
    textAlign: "right",
    justifyContent: "center",
  },

  summaryBlock: {
    marginTop: 6,
    gap: 3,
  },
  summaryLine: {
    fontSize: 9,
  },
  summaryAmountWords: {
    fontSize: 10,
    fontWeight: "bold",
    marginTop: 2,
  },

  signatures: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 40,
  },
  signatureCol: {
    flex: 1,
    fontSize: 8,
  },
  signatureLabel: {
    marginBottom: 4,
    fontSize: 8,
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    minHeight: 14,
  },

  inventoryNote: {
    marginTop: 8,
    fontSize: 8,
    gap: 2,
  },
});
