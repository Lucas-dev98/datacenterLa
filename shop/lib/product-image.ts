const DL380_GEN10_PLUS = "/products/hpe-dl380-gen10-plus.jpg";
const RTX_6000_ADA = "/products/gpu-nvidia-rtx-6000-ada.jpg";
const LENOVO_SR650_V3 = "/products/lenovo-sr650-v3.jpg";
const DELL_R650 = "/products/dell-poweredge-r650.png";
const DELL_R750 = "/products/dell-poweredge-r750.png";
const SEAGATE_EXOS_CHASSIS = "/products/seagate-exos-chassis.png";

/** DL380 Gen10 Plus / G10 Plus / Gen10+ only — not Gen9, Gen10 (non-Plus), Gen11, or DL360. */
function isDl380Gen10Plus(hay: string): boolean {
  if (!/dl380/.test(hay)) return false;
  return /gen\s*10\s*(plus|\+)|g10\s*(plus|\+)/.test(hay);
}

/** RTX 6000 Ada Generation only — not RTX A6000, RTX 4090, A4000, or other NVIDIA GPUs. */
function isRtx6000Ada(hay: string): boolean {
  return /rtx\s*6000\s*ada/.test(hay);
}

/** Lenovo ThinkSystem SR650 / SR650 V3 only — not Dell PowerEdge R650. */
function isLenovoSr650(hay: string): boolean {
  return /sr650/.test(hay) && /lenovo|thinksystem/.test(hay);
}

/** Seagate Exos storage chassis (NAS/SAN/JBOD) — not loose Exos HDDs. */
function isSeagateExosChassis(hay: string): boolean {
  if (/\bhdd\b/.test(hay)) return false;
  if (/seagate/.test(hay) && /exos/.test(hay)) {
    return /storage|chassis|jbod|corvault|baias|5u84|2u12|4u106/.test(hay) || /exos [xe]\b/.test(hay);
  }
  return /corvault|5u84|2u12/.test(hay);
}

/** Fallback photos by real product family. Files live in /public/products. */
export function categoryFallbackImage(categoryName?: string, productName?: string): string {
  const hay = `${categoryName ?? ""} ${productName ?? ""}`.toLowerCase();

  if (isDl380Gen10Plus(hay)) return DL380_GEN10_PLUS;
  if (/dl380|dl360|proliant/.test(hay)) return "/products/hpe-dl380.jpg";
  if (isLenovoSr650(hay)) return LENOVO_SR650_V3;
  // Word-boundary so Lenovo SR650 does not pick up the Dell R650 photo.
  if (/\br650\b/.test(hay) && /dell|poweredge/.test(hay)) return DELL_R650;
  if (/\br750\b/.test(hay) && /dell|poweredge/.test(hay)) return DELL_R750;
  if (/(^| )1u/.test(hay) && /servidor|poweredge|dell/.test(hay)) return "/products/dell-poweredge-1u.jpg";
  if (/poweredge|r750|precision|thinksystem sr|supermicro|servidor/.test(hay)) {
    return "/products/dell-poweredge-rack.jpg";
  }

  if (isSeagateExosChassis(hay)) return SEAGATE_EXOS_CHASSIS;
  if (/synology|qnap|diskstation|rackstation/.test(hay)) return "/products/storage-nas.jpg";
  if (/storage|powervault|msa |fas27|de2000|unity|isilon|netapp| nas/.test(hay)) {
    return "/products/storage-san.jpg";
  }

  if (/catalyst|nexus|aruba|ex4300|7050|switch/.test(hay)) return "/products/cisco-catalyst.jpg";

  if (/epyc/.test(hay)) return "/products/amd-epyc.jpg";
  if (/xeon/.test(hay)) return "/products/intel-xeon.jpg";
  if (/processador/.test(hay)) return /amd/.test(hay) ? "/products/amd-epyc.jpg" : "/products/intel-xeon.jpg";

  if (/hynix|sodimm|notebook/.test(hay)) return "/products/rdimm-hynix.jpg";
  if (/memór|memoria|rdimm|lrdimm|udimm|ddr/.test(hay)) return "/products/rdimm-micron.jpg";

  if (/m\.2|990 pro|p44/.test(hay)) return "/products/ssd-m2.jpg";
  if (/u\.2|e1\.s|e3s|pm9a3|7450|sn655|p5520|pm1653|cm6|cd8|9550/.test(hay)) return "/products/ssd-u2.jpg";
  if (/ssd/.test(hay)) return /sata/.test(hay) ? "/products/ssd-sata.jpg" : "/products/ssd-u2.jpg";
  if (/hdd|exos|ultrastar/.test(hay)) return "/products/hdd-exos.jpg";

  if (isRtx6000Ada(hay)) return RTX_6000_ADA;
  if (/gpu|rtx|l40|a4000|a6000|instinct|geforce|gráfic/.test(hay)) return "/products/gpu-nvidia.jpg";
  if (/fonte|psu|rm850|seasonic|1200w/.test(hay)) return "/products/psu-atx.jpg";
  if (/rede|nic|sfp|ethernet|hba|fibre|qlogic|connectx|x710|x520|i350|i210|broadcom|lsi/.test(hay)) {
    return "/products/nic-intel.jpg";
  }

  return "/products/nic-intel.jpg";
}

/** Local mapped photos win over API image_url for SKUs we have a specific file for. */
export function productDisplayImage(
  categoryName?: string,
  productName?: string,
  imageUrl?: string,
): string {
  const mapped = categoryFallbackImage(categoryName, productName);
  if (
    mapped === DL380_GEN10_PLUS ||
    mapped === RTX_6000_ADA ||
    mapped === LENOVO_SR650_V3 ||
    mapped === DELL_R650 ||
    mapped === DELL_R750 ||
    mapped === SEAGATE_EXOS_CHASSIS
  ) {
    return mapped;
  }
  return imageUrl || mapped;
}
