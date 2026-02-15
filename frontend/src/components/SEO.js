import React from 'react';
import { Helmet } from 'react-helmet-async';
import { SITE_NAME, SITE_URL, DEFAULT_OG_IMAGE } from '../lib/seoConfig';

/**
 * Reusable SEO component — renders <title>, meta tags, OG, Twitter, canonical, and JSON-LD.
 *
 * Usage:
 *   <SEO
 *     title="Live Option Chain Scanner | Real-Time NSE/BSE Data | Money Saarthi"
 *     description="Analyze real-time NSE option chains..."
 *     keywords="option chain, live option chain, ..."
 *     path="/options"
 *     jsonLd={{ '@context': 'https://schema.org', ... }}
 *   />
 */
export default function SEO({ title, description, keywords, path = '/', jsonLd = null }) {
  const canonicalUrl = `${SITE_URL}${path === '/' ? '' : path}`;

  return (
    <Helmet>
      {/* Primary */}
      <title>{title}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:image" content={DEFAULT_OG_IMAGE} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={DEFAULT_OG_IMAGE} />

      {/* JSON-LD Structured Data */}
      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      )}
    </Helmet>
  );
}
