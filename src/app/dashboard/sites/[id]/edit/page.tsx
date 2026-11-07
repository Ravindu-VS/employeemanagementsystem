import EditSitePage from './edit-site';

export function generateStaticParams() {
  return [{ id: '1' }];
}

export default function Page() {
  return <EditSitePage />;
}
