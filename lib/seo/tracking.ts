export const SEO_TRACKING = {
  googleAnalyticsMeasurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "",
  googleSiteVerification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ?? "",
  searchConsoleProperty: process.env.NEXT_PUBLIC_SITE_URL ?? "",
};

export function isAnalyticsEnabled(): boolean {
  return Boolean(SEO_TRACKING.googleAnalyticsMeasurementId);
}
