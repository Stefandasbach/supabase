import dayjs from 'dayjs'
import { partition } from 'lodash'
import { useMemo, useState } from 'react'
import {
  ComposableMap,
  Geographies,
  Geography,
  Line,
  Marker,
  ZoomableGroup,
} from 'react-simple-maps'

import { AWS_REGIONS_KEYS, BASE_PATH } from 'lib/constants'
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconMoreVertical,
} from 'ui'
import {
  AVAILABLE_REPLICA_REGIONS,
  DatabaseConfiguration,
  MOCK_DATABASES,
} from './InstanceConfiguration.constants'
import GeographyData from './MapData.json'

// [Joshen] Foresee that we'll skip this view for initial launch

interface MapViewProps {
  onSelectDeployNewReplica: (region: AWS_REGIONS_KEYS) => void
  onSelectResizeReplica: (database: DatabaseConfiguration) => void
  onSelectDropReplica: (database: DatabaseConfiguration) => void
}

const MapView = ({
  onSelectDeployNewReplica,
  onSelectResizeReplica,
  onSelectDropReplica,
}: MapViewProps) => {
  const [zoom, setZoom] = useState<number>(1)
  const [center, setCenter] = useState<[number, number]>([14, 7])
  const [tooltip, setTooltip] = useState<{
    x: number
    y: number
    region: { key: string; country?: string; name?: string }
  }>()

  const [[primary], replicas] = partition(MOCK_DATABASES, (database) => database.type === 'PRIMARY')
  const primaryCoordinates = AVAILABLE_REPLICA_REGIONS.find(
    (region) => region.region === primary.region
  )?.coordinates ?? [0, 0]

  const selectedRegionKey =
    AVAILABLE_REPLICA_REGIONS.find((region) => region.coordinates === center)?.region ?? ''
  const showRegionDetails = zoom === 1.5 && selectedRegionKey !== undefined
  const selectedRegion = AVAILABLE_REPLICA_REGIONS.find(
    (region) => region.region === selectedRegionKey
  )
  const databasesInSelectedRegion = useMemo(
    () =>
      MOCK_DATABASES.filter((database) => database.region.includes(selectedRegionKey))
        .sort((a, b) => (a.id > b.id ? 1 : 0))
        .sort((database) => (database.type === 'PRIMARY' ? -1 : 0)),
    [selectedRegionKey]
  )

  return (
    <div className="bg-background">
      <ComposableMap projectionConfig={{ scale: 140 }} height={354}>
        <ZoomableGroup
          center={center}
          zoom={zoom}
          minZoom={1}
          maxZoom={1.5}
          filterZoomEvent={({ constructor: { name } }) =>
            !['MouseEvent', 'WheelEvent'].includes(name)
          }
        >
          <Geographies geography={GeographyData}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  strokeWidth={0.3}
                  pointerEvents="none"
                  className="fill-gray-300 stroke-gray-200"
                />
              ))
            }
          </Geographies>

          {replicas.map((database) => {
            const coordinates = AVAILABLE_REPLICA_REGIONS.find(
              (region) => region.region === database.region
            )?.coordinates

            return (
              <Line
                key={`line-${database.id}-${primary.id}`}
                from={coordinates}
                to={primaryCoordinates}
                stroke="white"
                strokeWidth={1}
                strokeLinecap="round"
                strokeOpacity={0.2}
                strokeDasharray={'3, 3'}
                className="map-path"
              />
            )
          })}

          {AVAILABLE_REPLICA_REGIONS.map((region) => {
            const databases =
              MOCK_DATABASES.filter((database) => database.region === region.region) ?? []
            const coordinates = AVAILABLE_REPLICA_REGIONS.find(
              (r) => r.region === region.region
            )?.coordinates

            const hasNoDatabases = databases.length === 0
            const hasPrimary = databases.some((database) => database.type === 'PRIMARY')
            const replicas = databases.filter((database) => database.type === 'READ_REPLICA') ?? []

            return (
              <Marker
                key={region.key}
                coordinates={coordinates}
                onMouseEnter={(event) =>
                  setTooltip({
                    x: event.clientX,
                    y: event.clientY,
                    region: {
                      key: region.key,
                      country: region.name,
                      name: hasNoDatabases
                        ? undefined
                        : hasPrimary
                        ? 'Primary Database'
                        : `${replicas.length} Read Replica${
                            replicas.length > 1 ? 's' : ''
                          } deployed`,
                    },
                  })
                }
                onMouseLeave={() => setTooltip(undefined)}
                onClick={() => {
                  if (coordinates) {
                    setCenter(coordinates)
                    setZoom(1.5)
                  }
                }}
              >
                <circle
                  r={4}
                  className={`cursor-pointer ${
                    hasNoDatabases
                      ? 'fill-background-surface-300 stroke-white/20'
                      : hasPrimary
                      ? 'fill-brand stroke-brand-500'
                      : 'fill-brand-500 stroke-brand-400'
                  }`}
                />
              </Marker>
            )
          })}
        </ZoomableGroup>
      </ComposableMap>

      {tooltip !== undefined && (
        <div
          className="absolute w-[220px] bg-black bg-opacity-50 rounded border"
          style={{ left: tooltip.x - 420, top: tooltip.y - 130 }}
        >
          <div className="px-3 py-2 flex flex-col gap-y-2">
            <div className="flex items-center gap-x-2">
              <img
                alt="region icon"
                className="w-5 rounded-sm"
                src={`${BASE_PATH}/img/regions/${tooltip.region.key}.svg`}
              />
              <p className="text-xs">{tooltip.region.country}</p>
            </div>
            <p
              className={`text-xs ${
                tooltip.region.name === undefined ? 'text-foreground-light' : ''
              }`}
            >
              {tooltip.region.name ?? 'No databases deployed'}
            </p>
          </div>
        </div>
      )}

      {showRegionDetails && selectedRegion && (
        <div className="absolute bottom-4 right-4 flex flex-col gap-y-2 bg-black bg-opacity-50 backdrop-blur-sm border rounded w-[400px] py-4">
          <div className="flex items-center justify-between px-4">
            <div>
              <p className="text-xs text-foreground-light">
                {databasesInSelectedRegion.length} database
                {databasesInSelectedRegion.length > 1 ? 's' : ''} deployed in
              </p>
              <p className="text-sm">{selectedRegion.name}</p>
            </div>
            <img
              alt="region icon"
              className="w-10 rounded-sm"
              src={`${BASE_PATH}/img/regions/${selectedRegion.key}.svg`}
            />
          </div>

          <div>
            <ul
              className={`flex flex-col border-t divide-y ${
                databasesInSelectedRegion.length > 0 ? 'border-b' : ''
              }`}
            >
              {databasesInSelectedRegion.map((database) => {
                const created = dayjs(database.inserted_at).format('DD MMM YYYY, HH:mm:ss (ZZ)')

                return (
                  <li
                    key={database.id}
                    className="text-sm px-4 py-2 flex items-center justify-between"
                  >
                    <div className="flex flex-col gap-y-1">
                      <p className="flex items-center gap-x-2">
                        {database.type === 'PRIMARY'
                          ? 'Primary Database'
                          : `Read Replica (ID: ${database.id})`}
                        {database.type === 'READ_REPLICA' && <Badge color="green">Healthy</Badge>}
                      </p>
                      {database.type === 'READ_REPLICA' && (
                        <p className="text-xs text-foreground-light">Created on: {created}</p>
                      )}
                    </div>
                    {database.type === 'READ_REPLICA' && (
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Button type="text" icon={<IconMoreVertical />} className="px-1" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="p-0 w-32" side="bottom" align="end">
                          <DropdownMenuItem
                            className="gap-x-2"
                            onClick={() => onSelectResizeReplica(database)}
                          >
                            Resize replica
                          </DropdownMenuItem>
                          <div className="border-t" />
                          <DropdownMenuItem
                            className="gap-x-2"
                            onClick={() => onSelectDropReplica(database)}
                          >
                            Drop replica
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="mt-2 flex items-center justify-end gap-x-2 px-4">
            <Button type="default" onClick={() => onSelectDeployNewReplica(selectedRegion.key)}>
              Deploy new replica here
            </Button>
            <Button
              type="default"
              onClick={() => {
                setCenter([14, 7])
                setZoom(1)
              }}
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default MapView
