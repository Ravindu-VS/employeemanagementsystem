import EmployeeDetailPage from './employee-detail';

export function generateStaticParams() {
  return [{ id: 'default' }];
}

export default function Page() {
  return <EmployeeDetailPage />;
}
