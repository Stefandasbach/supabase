import { PermissionAction } from '@supabase/shared-types/out/constants'
import { useParams } from 'common/hooks'
import ReportWidget from 'components/interfaces/Reports/ReportWidget'
import { isUnixMicro, unixMicroToIsoTimestamp } from 'components/interfaces/Settings/Logs'
import FunctionsLayout from 'components/layouts/FunctionsLayout'
import AreaChart from 'components/ui/Charts/AreaChart'
import BarChart from 'components/ui/Charts/BarChart'
import StackedBarChart from 'components/ui/Charts/StackedBarChart'
import NoPermission from 'components/ui/NoPermission'
import {
  useFunctionsInvStatsQuery,
  useFunctionsResourceQuery,
} from 'data/analytics/functions-inv-stats-query'
import { useEdgeFunctionQuery } from 'data/edge-functions/edge-function-query'
import dayjs, { Dayjs } from 'dayjs'
import { useCheckPermissions } from 'hooks'
import useFillTimeseriesSorted from 'hooks/analytics/useFillTimeseriesSorted'
import sumBy from 'lodash/sumBy'
import { observer } from 'mobx-react-lite'
import { useRouter } from 'next/router'
import { useMemo, useState } from 'react'
import { ChartIntervals, NextPageWithLayout } from 'types'
import { Button } from 'ui'

const CHART_INTERVALS: ChartIntervals[] = [
  {
    key: '5min',
    label: '5 min',
    startValue: 5,
    startUnit: 'minute',
    format: 'MMM D, h:mm:ssa',
  },
  {
    key: '15min',
    label: '15 min',
    startValue: 15,
    startUnit: 'minute',
    format: 'MMM D, h:mma',
  },
  {
    key: '1hr',
    label: '1 hour',
    startValue: 1,
    startUnit: 'hour',
    format: 'MMM D, h:mma',
  },
  {
    key: '1day',
    label: '1 day',
    startValue: 1,
    startUnit: 'hour',
    format: 'MMM D, h:mma',
  },
  {
    key: '7day',
    label: '7 days',
    startValue: 7,
    startUnit: 'day',
    format: 'MMM D',
  },
]

const PageLayout: NextPageWithLayout = () => {
  const router = useRouter()
  const { ref: projectRef, functionSlug } = useParams()
  const [interval, setInterval] = useState<string>('15min')
  const selectedInterval = CHART_INTERVALS.find((i) => i.key === interval) || CHART_INTERVALS[1]
  const { data: selectedFunction } = useEdgeFunctionQuery({
    projectRef,
    slug: functionSlug,
  })
  const id = selectedFunction?.id

  const { data, error } = useFunctionsInvStatsQuery({
    projectRef,
    functionId: id,
    interval: selectedInterval.key,
  })
  const { data: resourceUsageData, error: resourceUsageError } = useFunctionsResourceQuery({
    projectRef,
    functionId: id,
    interval: selectedInterval.key,
  })
  const isChartLoading = !data?.result && !error ? true : false
  const isResourceChartLoading = !resourceUsageData?.result && !error ? true : false

  const normalizedResourceData = useMemo(() => {
    return (resourceUsageData?.result || []).map((d: any) => ({
      avg_cpu_time_used: d.avg_cpu_time_used,
      avg_memory_used: (d.avg_heap_memory_used + d.avg_external_memory_used) / (1024 * 1024),
      timestamp: isUnixMicro(d.timestamp) ? unixMicroToIsoTimestamp(d.timestamp) : d.timestamp,
    }))
  }, [resourceUsageData?.result])

  const normalizedData = useMemo(() => {
    return (data?.result || [])
      .map((d: any) => [
        {
          status: '2xx',
          count: d.success_count,
          timestamp: isUnixMicro(d.timestamp) ? unixMicroToIsoTimestamp(d.timestamp) : d.timestamp,
        },
        {
          status: '3xx',
          count: d.redirect_count,
          timestamp: isUnixMicro(d.timestamp) ? unixMicroToIsoTimestamp(d.timestamp) : d.timestamp,
        },
        {
          status: '4xx',
          count: d.client_err_count,
          timestamp: isUnixMicro(d.timestamp) ? unixMicroToIsoTimestamp(d.timestamp) : d.timestamp,
        },
        {
          status: '5xx',
          count: d.server_err_count,
          timestamp: isUnixMicro(d.timestamp) ? unixMicroToIsoTimestamp(d.timestamp) : d.timestamp,
        },
      ])
      .flat()
  }, [data?.result])

  const execNormalizedData = useMemo(() => {
    return (data?.result || []).map((d: any) => ({
      ...d,
      timestamp: isUnixMicro(d.timestamp) ? unixMicroToIsoTimestamp(d.timestamp) : d.timestamp,
    }))
  }, [data?.result])

  const [startDate, endDate]: [Dayjs, Dayjs] = useMemo(() => {
    const start = dayjs()
      .subtract(selectedInterval.startValue, selectedInterval.startUnit as dayjs.ManipulateType)
      .startOf(selectedInterval.startUnit as dayjs.ManipulateType)

    const end = dayjs().startOf(selectedInterval.startUnit as dayjs.ManipulateType)
    return [start, end]
  }, [selectedInterval])

  const execChartData = useFillTimeseriesSorted(
    execNormalizedData,
    'timestamp',
    ['avg_execution_time', 'count'],
    0,
    startDate.toISOString(),
    endDate.toISOString()
  )
  // const chartData = useFillTimeseriesSorted(
  //   normalizedData,
  //   'timestamp',
  //   ['status', 'count'],
  //   0,
  //   startDate.toISOString(),
  //   endDate.toISOString()
  // )
  const chartData = normalizedData
  console.log(chartData)

  const resourceChartData = useFillTimeseriesSorted(
    normalizedResourceData,
    'timestamp',
    ['avg_cpu_time_used', 'avg_memory_used'],
    0,
    startDate.toISOString(),
    endDate.toISOString()
  )

  const canReadFunction = useCheckPermissions(
    PermissionAction.FUNCTIONS_READ,
    functionSlug as string
  )
  if (!canReadFunction) {
    return <NoPermission isFullPage resourceText="access this edge function" />
  }
  return (
    <div className="space-y-6 py-2">
      <div className="flex flex-row items-center gap-2">
        <div className="flex items-center">
          {CHART_INTERVALS.map((item, i) => {
            const classes = []

            if (i === 0) {
              classes.push('rounded-tr-none rounded-br-none')
            } else if (i === CHART_INTERVALS.length - 1) {
              classes.push('rounded-tl-none rounded-bl-none')
            } else {
              classes.push('rounded-none')
            }

            return (
              <Button
                key={`function-filter-${i}`}
                type={interval === item.key ? 'secondary' : 'default'}
                onClick={() => setInterval(item.key)}
                className={classes.join(' ')}
              >
                {item.label}
              </Button>
            )
          })}
        </div>

        <span className="text-xs text-foreground-light">
          Statistics for past {selectedInterval.label}
        </span>
      </div>
      <div className="">
        <div className="grid grid-cols-1 md:grid-cols-2 md:gap-4 lg:grid-cols-2 lg:gap-8">
          <ReportWidget
            title="Execution time"
            tooltip="Average execution time of function invocations"
            data={execChartData}
            isLoading={isChartLoading}
            renderer={(props) => {
              const latest = execChartData[execChartData.length - 1]
              let highlightedValue
              if (latest) {
                highlightedValue = latest['avg_execution_time']
              }
              return (
                <AreaChart
                  className="w-full"
                  xAxisKey="timestamp"
                  customDateFormat={selectedInterval.format}
                  yAxisKey="avg_execution_time"
                  data={props.data}
                  format="ms"
                  highlightedValue={highlightedValue}
                />
              )
            }}
          />
          <ReportWidget
            title="Invocations"
            data={chartData}
            isLoading={isChartLoading}
            renderer={(props) => (
              <StackedBarChart
                className="w-full"
                xAxisKey="timestamp"
                yAxisKey="count"
                stackKey="status"
                data={props.data}
                highlightedValue={sumBy(props.data, 'count')}
                customDateFormat={selectedInterval.format}
                stackColors={['brand', 'slate', 'yellow', 'red']}
                onBarClick={(v) => {
                  router.push(
                    `/project/${projectRef}/functions/${functionSlug}/invocations?its=${startDate.toISOString()}&ite=${
                      v.timestamp
                    }`
                  )
                }}
              />
            )}
          />
          <ReportWidget
            title="CPU time"
            tooltip="Average CPU time usage for the function"
            data={resourceChartData}
            isLoading={isResourceChartLoading}
            renderer={(props) => {
              const latest = normalizedResourceData[normalizedResourceData.length - 1]
              let highlightedValue
              if (latest) {
                highlightedValue = latest['avg_cpu_time_used']
              }
              return (
                <AreaChart
                  className="w-full"
                  xAxisKey="timestamp"
                  customDateFormat={selectedInterval.format}
                  yAxisKey="avg_cpu_time_used"
                  data={props.data}
                  format="ms"
                  highlightedValue={highlightedValue}
                />
              )
            }}
          />
          <ReportWidget
            title="Memory"
            tooltip="Average memory usage for the function"
            data={resourceChartData}
            isLoading={isResourceChartLoading}
            renderer={(props) => {
              const latest = normalizedResourceData[normalizedResourceData.length - 1]
              let highlightedValue
              if (latest) {
                highlightedValue = latest['avg_memory_used']
              }
              return (
                <AreaChart
                  className="w-full"
                  xAxisKey="timestamp"
                  customDateFormat={selectedInterval.format}
                  yAxisKey="avg_memory_used"
                  data={props.data}
                  format="MB"
                  highlightedValue={highlightedValue}
                />
              )
            }}
          />
        </div>
      </div>
    </div>
  )
}

PageLayout.getLayout = (page) => <FunctionsLayout>{page}</FunctionsLayout>

export default observer(PageLayout)
