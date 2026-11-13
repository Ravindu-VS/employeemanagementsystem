'use client';

/**
 * =====================================================
 * ORGANISATION CHART
 * =====================================================
 * Built from roles, site supervisors and each employee's optional
 * "Reports to" (set on the employee edit page).
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Network } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useRequireRole } from '@/components/providers/auth-provider';
import { Empty, PageHeader, Pill, Spinner } from '@/components/dashboard/page-bits';
import { ACCESS_MATRIX } from '@/domain/roles';
import { buildOrgTree, countNodes, type OrgNode } from '@/domain/org';
import { getAllEmployees, getAllSites } from '@/services';
import { ROLE_OPTIONS, ROUTES } from '@/constants';

const roleLabel = (r: string) => ROLE_OPTIONS.find((o) => o.value === r)?.label || r;

export default function OrgChartPage() {
  const { isAuthorized } = useRequireRole(ACCESS_MATRIX.org_chart);
  const { data: employees = [], isLoading } = useQuery({ queryKey: ['employees'], queryFn: getAllEmployees, enabled: isAuthorized });
  const { data: sites = [] } = useQuery({ queryKey: ['sites'], queryFn: getAllSites, enabled: isAuthorized });
  const tree = useMemo(() => buildOrgTree(employees, sites), [employees, sites]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (uid: string) => setCollapsed((s) => { const n = new Set(s); if (n.has(uid)) n.delete(uid); else n.add(uid); return n; });

  if (!isAuthorized) return null;

  return (
    <div className="space-y-6">
      <PageHeader title="Organisation chart" subtitle={`${countNodes(tree)} active people. Set “Reports to” on an employee to override the default line.`}>
        <Button variant="outline" size="sm" onClick={() => setCollapsed(new Set())}>Expand all</Button>
      </PageHeader>
      <Card>
        <CardContent className="overflow-x-auto p-4">
          {isLoading ? <Spinner /> : tree.length === 0 ? <Empty text="No active employees" /> : (
            <ul className="min-w-max space-y-1">{tree.map((n) => <Node key={n.uid} node={n} collapsed={collapsed} toggle={toggle} />)}</ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Node({ node, collapsed, toggle }: { node: OrgNode; collapsed: Set<string>; toggle: (uid: string) => void }) {
  const open = !collapsed.has(node.uid);
  const has = node.children.length > 0;
  return (
    <li>
      <div className="flex min-h-[44px] items-center gap-2 rounded-md px-2 hover:bg-muted/50">
        {has ? (
          <button aria-label={open ? 'Collapse' : 'Expand'} onClick={() => toggle(node.uid)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded hover:bg-muted">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : <Network className="mx-2 h-4 w-4 shrink-0 text-muted-foreground" />}
        <Link href={ROUTES.EMPLOYEES.DETAIL(node.uid)} className="whitespace-nowrap font-medium text-foreground hover:underline">{node.name}</Link>
        <Pill tone={node.role === 'owner' || node.role === 'ceo' ? 'amber' : node.role === 'manager' || node.role === 'supervisor' ? 'blue' : 'slate'}>{roleLabel(node.role)}</Pill>
        {has && <span className="text-xs text-muted-foreground">{countNodes(node.children)}</span>}
      </div>
      {has && open && <ul className="ml-3 space-y-1 border-l border-border pl-2 sm:ml-5 sm:pl-3">{node.children.map((c) => <Node key={c.uid} node={c} collapsed={collapsed} toggle={toggle} />)}</ul>}
    </li>
  );
}
