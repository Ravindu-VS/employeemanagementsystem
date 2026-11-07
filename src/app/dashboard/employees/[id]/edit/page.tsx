import EditEmployeePage from './edit-employee';

export function generateStaticParams() {
  return [{ id: 'default' }];
}

export default function Page() {
  return <EditEmployeePage />;
}
