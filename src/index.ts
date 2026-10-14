export { VERSION } from "./version.js";
export { CHANNELS, VendorError, LocalConsentStore, HttpConsentAdapter, MailchimpConsentAdapter, TwilioConsentAdapter, IntercomConsentAdapter, createVendorConsentAdapter, grantConsent, revokeConsent, checkConsent, assertConsentRequest } from "./core.js";
export type { Channel, ConsentStatus, ConsentRecord, ConsentRequest, ConsentResult, ConsentStore, VendorConsentAdapter, VendorName } from "./core.js";
