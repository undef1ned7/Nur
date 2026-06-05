export const supportsPieceFromPack = (product) =>
  Array.isArray(product?.packages) && product.packages.length > 0;

export function getDefaultPackage(product) {
  const pkgs = product?.packages;
  if (!Array.isArray(pkgs) || !pkgs.length) return null;
  return (
    pkgs.find((pkg) => Number(pkg?.quantity_in_package) > 0) || pkgs[0] || null
  );
}

export function pieceUnitPrice(product, pkg) {
  if (pkg?.piece_unit_price != null && pkg.piece_unit_price !== "") {
    return Number(pkg.piece_unit_price);
  }
  const ipp = Number(pkg?.quantity_in_package);
  if (ipp > 0) return Number(product?.price || 0) / ipp;
  return Number(product?.price || 0);
}

export function piecePurchasePrice(product, pkg) {
  const ipp = Number(pkg?.quantity_in_package);
  if (ipp <= 0) return Number(product?.purchase_price || 0);
  return Number(product?.purchase_price || 0) / ipp;
}

export function consumePacks(qty, salePackageId, packages) {
  const q = Number(qty);
  if (!salePackageId) return q;
  const pkg = (packages || []).find((p) => p.id === salePackageId);
  const ipp = Number(pkg?.quantity_in_package ?? 0);
  if (ipp <= 0) throw new Error("quantity_in_package must be > 0");
  return Math.round((q / ipp) * 1000) / 1000;
}

export function maxPiecesAvailable(stockPacks, otherConsumePacks, pkg) {
  const ipp = Number(pkg?.quantity_in_package);
  const freePacks = Math.max(0, Number(stockPacks) - otherConsumePacks);
  return Math.floor(freePacks * ipp);
}

export function cartItemUnitLabel(item, product) {
  if (item?.salePackage || item?.sale_package) {
    const salePackageId = item.salePackage || item.sale_package;
    const pkg = product?.packages?.find((p) => p.id === salePackageId);
    return pkg?.unit || "шт.";
  }
  return product?.unit || item?.unit || "шт.";
}

export function formatCartItemSubtitle(item, product) {
  const unit = cartItemUnitLabel(item, product);
  return `${item.quantity} ${unit} × ${item.unit_price ?? item.price}`;
}
