/**
 * @file client.ts
 * @description Re-exporta o cliente HTTP core e helpers de browser.
 * @hooks Import preferido: `@/lib/api/client`
 *
 * @see admin/lib/api/README.md
 */

/** Re-export core HTTP client and browser helpers. Domain modules live in sibling files. */
export {
  api,
  apiBlob,
  apiForm,
  apiText,
  ApiClientError,
  blobObjectUrl,
  downloadBlob,
  login,
  printHTML,
} from "../api";
