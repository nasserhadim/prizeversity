import { Helmet } from 'react-helmet-async';

const defaultMeta = {
  title: 'Prizeversity — Gamified Classroom Progression & Skill Tree',
  description:
    'Prizeversity turns classroom progression into a Skill Tree — students level up and invest in stats that change gameplay: Multiplier, Luck, Shield, and more.',
  url: 'https://prizeversity.com',
};

const SEO = ({ title, description, path }) => {
  const fullTitle = title
    ? `${title} | Prizeversity`
    : defaultMeta.title;
  const desc = description || defaultMeta.description;
  const canonicalUrl = path
    ? `${defaultMeta.url}${path}`
    : defaultMeta.url;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <link rel="canonical" href={canonicalUrl} />

      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={canonicalUrl} />

      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:url" content={canonicalUrl} />
    </Helmet>
  );
};

export default SEO;
