import * as _ from 'lodash';
import {
  DashboardsCard,
  DashboardsTab,
  DashboardsOverviewHealthPrometheusSubsystem,
  ModelFeatureFlag,
  ModelDefinition,
  Plugin,
  DashboardsOverviewQuery,
} from '@console/plugin-sdk';
import { GridPosition } from '@console/internal/components/dashboard';
import { OverviewQuery } from '@console/internal/components/dashboards-page/overview-dashboard/queries';
import * as models from './models';
import {
  CAPACITY_USAGE_QUERIES,
  StorageDashboardQuery,
  STORAGE_HEALTH_QUERIES,
} from './constants/queries';
import { STORAGE_HEALTH_RESOURCES, StorageDashboardResource } from './constants/resources';
import { getCephHealthState } from './components/dashboard-page/storage-dashboard/health-card/utils';

type ConsumedExtensions =
  | ModelFeatureFlag
  | ModelDefinition
  | DashboardsTab
  | DashboardsCard
  | DashboardsOverviewHealthPrometheusSubsystem
  | DashboardsOverviewQuery;

const CEPH_FLAG = 'CEPH';

const plugin: Plugin<ConsumedExtensions> = [
  {
    type: 'ModelDefinition',
    properties: {
      models: _.values(models),
    },
  },
  {
    type: 'FeatureFlag/Model',
    properties: {
      model: models.CephClusterModel,
      flag: CEPH_FLAG,
    },
  },
  {
    type: 'Dashboards/Tab',
    properties: {
      id: 'persistent-storage',
      title: 'Persistent Storage',
      required: CEPH_FLAG,
    },
  },
  // Ceph Storage Dashboard Left cards
  {
    type: 'Dashboards/Card',
    properties: {
      tab: 'persistent-storage',
      position: GridPosition.LEFT,
      loader: () =>
        import(
          './components/dashboard-page/storage-dashboard/details-card' /* webpackChunkName: "ceph-storage-details-card" */
        ).then((m) => m.default),
      required: CEPH_FLAG,
    },
  },
  {
    type: 'Dashboards/Card',
    properties: {
      tab: 'persistent-storage',
      position: GridPosition.LEFT,
      loader: () =>
        import(
          './components/dashboard-page/storage-dashboard/inventory-card' /* webpackChunkName: "ceph-storage-inventory-card" */
        ).then((m) => m.default),
      required: CEPH_FLAG,
    },
  },
  // Ceph Storage Dashboard Main Cards
  {
    type: 'Dashboards/Card',
    properties: {
      tab: 'persistent-storage',
      position: GridPosition.MAIN,
      loader: () =>
        import(
          './components/dashboard-page/storage-dashboard/health-card/health-card' /* webpackChunkName: "ceph-storage-health-card" */
        ).then((m) => m.default),
      required: CEPH_FLAG,
    },
  },
  {
    type: 'Dashboards/Card',
    properties: {
      tab: 'persistent-storage',
      position: GridPosition.MAIN,
      span: 6,
      loader: () =>
        import(
          './components/dashboard-page/storage-dashboard/capacity-card/capacity-card' /* webpackChunkName: "ceph-storage-capacity-card" */
        ).then((m) => m.default),
      required: CEPH_FLAG,
    },
  },
  {
    type: 'Dashboards/Card',
    properties: {
      tab: 'persistent-storage',
      position: GridPosition.MAIN,
      span: 6,
      loader: () =>
        import(
          './components/dashboard-page/storage-dashboard/data-resiliency/data-resiliency' /* webpackChunkName: "ceph-storage-data-resiliency-card" */
        ).then((m) => m.DataResiliencyWithResources),
      required: CEPH_FLAG,
    },
  },
  {
    type: 'Dashboards/Card',
    properties: {
      tab: 'persistent-storage',
      position: GridPosition.MAIN,
      loader: () =>
        import(
          './components/dashboard-page/storage-dashboard/top-consumers-card/top-consumers-card' /* webpackChunkName: "ceph-storage-top-consumers-card" */
        ).then((m) => m.default),
      required: CEPH_FLAG,
    },
  },
  // Ceph Storage Dashboard Right Cards
  {
    type: 'Dashboards/Card',
    properties: {
      tab: 'persistent-storage',
      position: GridPosition.RIGHT,
      loader: () =>
        import(
          './components/dashboard-page/storage-dashboard/events-card' /* webpackChunkName: "ceph-storage-events-card" */
        ).then((m) => m.default),
      required: CEPH_FLAG,
    },
  },
  {
    type: 'Dashboards/Card',
    properties: {
      tab: 'persistent-storage',
      position: GridPosition.RIGHT,
      loader: () =>
        import(
          './components/dashboard-page/storage-dashboard/utilization-card/utilization-card' /* webpackChunkName: "ceph-storage-utilization-card" */
        ).then((m) => m.default),
      required: CEPH_FLAG,
    },
  },
  {
    type: 'Dashboards/Overview/Health/Prometheus',
    properties: {
      title: 'Storage',
      query: STORAGE_HEALTH_QUERIES[StorageDashboardQuery.CEPH_STATUS_QUERY],
      resource: STORAGE_HEALTH_RESOURCES[StorageDashboardResource.CEPH_CLUSTER_RESOURCE],
      healthHandler: getCephHealthState,
      required: CEPH_FLAG,
    },
  },
  {
    type: 'Dashboards/Overview/Query',
    properties: {
      queryKey: OverviewQuery.STORAGE_TOTAL,
      query: CAPACITY_USAGE_QUERIES[StorageDashboardQuery.CEPH_CAPACITY_TOTAL],
      required: CEPH_FLAG,
    },
  },
  {
    type: 'Dashboards/Overview/Query',
    properties: {
      queryKey: OverviewQuery.STORAGE_UTILIZATION,
      query: `${CAPACITY_USAGE_QUERIES[StorageDashboardQuery.CEPH_CAPACITY_USED]}[60m:5m]`,
      required: CEPH_FLAG,
    },
  },
];

export default plugin;
