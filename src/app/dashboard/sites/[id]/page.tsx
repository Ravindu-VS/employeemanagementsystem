import SiteDetailPage from './site-detail';

export function generateStaticParams() {
  return [{ id: 'default' }];
}

export default function Page() {
  return <SiteDetailPage />;
}
