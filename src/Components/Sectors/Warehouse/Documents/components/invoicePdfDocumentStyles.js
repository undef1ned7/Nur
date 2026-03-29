import { StyleSheet } from "@react-pdf/renderer";

export const invoicePdfStyles = StyleSheet.create({
  page: {
    fontFamily: "Roboto",
    fontSize: 8,
    padding: 15,
    color: "#000",
  },

  header: {
    marginBottom: 6,
    textAlign: "center",
  },
  title: {
    fontSize: 11,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 8,
    textAlign: "center",
    marginTop: 1,
  },

  partiesRow: {
    flexDirection: "row",
    marginTop: 6,
    marginBottom: 6,
    gap: 6,
  },
  partyBox: {
    flex: 1,
    padding: 5,
  },
  partyTitle: {
    fontSize: 8,
    fontWeight: "bold",
    marginBottom: 4,
    textAlign: "center",
  },
  partyField: {
    marginBottom: 2,
    fontSize: 7,
  },
  partyLabel: {
    width: 70,
    fontSize: 7,
  },
  partyValue: {
    fontSize: 7,
  },
  warehouse: {
    marginTop: 4,
    marginBottom: 6,
    fontSize: 7,
  },

  goodsTable: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#000",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    minHeight: 12,
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tableHeader: {
    backgroundColor: "#f5f5f5",
    fontWeight: "bold",
    fontSize: 7,
  },
  tableCell: {
    padding: 3,
    borderRightWidth: 1,
    borderRightColor: "#000",
    fontSize: 7,
    justifyContent: "center",
  },
  tableCellLast: {
    borderRightWidth: 0,
  },
  colNo: { width: "4%" },
  colName: { width: "25%" },
  colUnit: { width: "8%" },
  colQty: { width: "8%", textAlign: "right" },
  colPriceNoDiscount: { width: "12%", textAlign: "right" },
  colDiscount: { width: "8%", textAlign: "right" },
  colPrice: { width: "12%", textAlign: "right" },
  colSum: { width: "13%", textAlign: "right" },
  colNoTransfer: { width: "5%" },
  colNameTransfer: { width: "52%" },
  colArtTransfer: { width: "8%" },
  colUnitTransfer: { width: "10%" },
  colQtyTransfer: { width: "25%", textAlign: "right" },
  colArt: { width: "8%" },

  totalsSection: {
    marginTop: 6,
    marginLeft: "auto",
    width: 280,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
    fontSize: 7,
  },
  totalLabel: {
    fontSize: 7,
  },
  totalValue: {
    fontSize: 7,
    fontWeight: "normal",
  },
  totalBold: {
    fontWeight: "bold",
    fontSize: 8,
  },

  signatures: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 40,
  },
  signatureCol: {
    flex: 1,
    fontSize: 7,
  },
  signatureLabel: {
    marginBottom: 5,
    fontSize: 7,
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    marginBottom: 2,
    minHeight: 15,
  },
  signatureSeal: {
    fontSize: 6,
    marginTop: 2,
    fontStyle: "italic",
  },
});
