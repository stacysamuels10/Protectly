'use client'

import * as React from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDateTime } from '@/lib/utils'
import {
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

interface ActivityAttempt {
  id: string
  email: string
  name: string | null
  status: string
  eventName: string
  rejectionReason: string | null
  createdAt: string
}

interface StatusCounts {
  APPROVED: number
  REJECTED: number
  RATE_LIMITED: number
}

interface ActivityApiResponse {
  attempts: ActivityAttempt[]
  total: number
  page: number
  limit: number
  totalPages: number
  statusCounts: StatusCounts
  retentionDays: number
}

interface ActivityLogClientProps {
  allowlistId: string | null
}

function getStatusBadgeVariant(status: string): 'success' | 'error' | 'warning' | 'default' {
  if (status === 'APPROVED') return 'success'
  if (status === 'REJECTED') return 'error'
  if (status === 'RATE_LIMITED') return 'warning'
  return 'default'
}

function getStatusLabel(status: string): string {
  if (status === 'APPROVED') return 'Approved'
  if (status === 'REJECTED') return 'Rejected'
  if (status === 'RATE_LIMITED') return 'Rate Limited'
  return status
}

export function ActivityLogClient({ allowlistId: _allowlistId }: ActivityLogClientProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const status = searchParams.get('status') ?? 'ALL'
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const q = searchParams.get('q') ?? ''

  const [data, setData] = React.useState<ActivityApiResponse | null>(null)
  const [loading, setLoading] = React.useState(true)

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '') {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    }
    const queryString = params.toString()
    router.replace(pathname + (queryString ? '?' + queryString : ''))
  }

  React.useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (status !== 'ALL') params.set('status', status)
    params.set('page', String(page))
    params.set('limit', '25')
    if (q) params.set('search', q)

    fetch('/api/dashboard/activity?' + params.toString())
      .then((res) => res.json())
      .then((json: ActivityApiResponse) => {
        setData(json)
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }, [status, page, q])

  const retentionDays = data?.retentionDays ?? 30
  const statusCounts = data?.statusCounts ?? { APPROVED: 0, REJECTED: 0, RATE_LIMITED: 0 }
  const totalAll = statusCounts.APPROVED + statusCounts.REJECTED + statusCounts.RATE_LIMITED
  const totalPages = data?.totalPages ?? 1
  const total = data?.total ?? 0
  const limit = data?.limit ?? 25
  const currentPage = data?.page ?? page

  const start = total === 0 ? 0 : (currentPage - 1) * limit + 1
  const end = Math.min(currentPage * limit, total)

  const hasActiveFilters = status !== 'ALL' || q !== ''

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Activity Log</h1>
        <p className="text-muted-foreground">
          View all booking attempts from the last {retentionDays} days.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success-light">
                <CheckCircle className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statusCounts.APPROVED}</p>
                <p className="text-sm text-muted-foreground">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-error-light">
                <XCircle className="h-5 w-5 text-error" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statusCounts.REJECTED}</p>
                <p className="text-sm text-muted-foreground">Rejected</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning-light">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statusCounts.RATE_LIMITED}</p>
                <p className="text-sm text-muted-foreground">Rate Limited</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter toolbar */}
      <div className="flex items-center gap-4">
        <Tabs
          value={status}
          onValueChange={(val) => {
            updateParams({ status: val === 'ALL' ? null : val, page: null })
          }}
        >
          <TabsList>
            <TabsTrigger value="ALL">
              All
              <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.5 text-xs">
                {totalAll}
              </span>
            </TabsTrigger>
            <TabsTrigger value="APPROVED">
              Approved
              <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.5 text-xs">
                {statusCounts.APPROVED}
              </span>
            </TabsTrigger>
            <TabsTrigger value="REJECTED">
              Rejected
              <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.5 text-xs">
                {statusCounts.REJECTED}
              </span>
            </TabsTrigger>
            <TabsTrigger value="RATE_LIMITED">
              Rate Limited
              <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.5 text-xs">
                {statusCounts.RATE_LIMITED}
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {/* Search input — implemented in Plan 02 */}
      </div>

      {/* Activity table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Attempts</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b last:border-0">
                  <div className="flex items-center gap-4">
                    <div className="h-6 w-20 animate-pulse bg-muted rounded" />
                    <div>
                      <div className="h-4 w-40 animate-pulse bg-muted rounded" />
                      <div className="h-3 w-32 animate-pulse bg-muted rounded mt-1" />
                    </div>
                  </div>
                  <div className="h-4 w-24 animate-pulse bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : total === 0 ? (
            hasActiveFilters ? (
              <div className="text-center py-12">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                  <Search className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No results found</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  No booking attempts match your current filters. Try adjusting your search.
                </p>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mx-auto mb-4">
                  <Activity className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No activity yet</h3>
                <p className="text-muted-foreground mb-2 max-w-sm mx-auto">
                  Booking attempts will appear here once your Calendly webhook is active and someone tries to schedule a meeting.
                </p>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Each booking is automatically checked against your allowlist.
                </p>
              </div>
            )
          ) : (
            <div>
              {data?.attempts.map((attempt) => (
                <div
                  key={attempt.id}
                  className="flex items-center justify-between py-3 border-b last:border-0"
                >
                  <div className="flex items-center gap-4">
                    <Badge variant={getStatusBadgeVariant(attempt.status)}>
                      {getStatusLabel(attempt.status)}
                    </Badge>
                    <div>
                      <p className="font-medium">{attempt.email}</p>
                      <p className="text-sm text-muted-foreground">
                        {attempt.name && `${attempt.name} · `}
                        {attempt.eventName}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(attempt.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              aria-label="Previous page"
              disabled={currentPage === 1}
              onClick={() => updateParams({ page: String(currentPage - 1) })}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
              // Show ellipsis for large page counts
              if (totalPages > 7) {
                const showPage =
                  pageNum === 1 ||
                  pageNum === totalPages ||
                  Math.abs(pageNum - currentPage) <= 1
                if (!showPage) {
                  if (pageNum === 2 && currentPage > 4) return <span key={pageNum}>...</span>
                  if (pageNum === totalPages - 1 && currentPage < totalPages - 3) return <span key={pageNum}>...</span>
                  if (pageNum !== 2 && pageNum !== totalPages - 1) return null
                }
              }

              return (
                <Button
                  key={pageNum}
                  variant="outline"
                  size="sm"
                  aria-current={pageNum === currentPage ? 'page' : undefined}
                  className={
                    pageNum === currentPage
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : ''
                  }
                  onClick={() => updateParams({ page: String(pageNum) })}
                >
                  {pageNum}
                </Button>
              )
            })}

            <Button
              variant="outline"
              size="sm"
              aria-label="Next page"
              disabled={currentPage === totalPages}
              onClick={() => updateParams({ page: String(currentPage + 1) })}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            Showing {start}-{end} of {total}
          </p>
        </div>
      )}
    </div>
  )
}
