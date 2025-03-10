import * as React from 'react';
import * as _ from 'lodash';
import {
  AlertsBody,
  AlertItem,
  getAlerts,
} from '@console/internal/components/dashboard/health-card';
import { DashboardCard } from '@console/internal/components/dashboard/dashboard-card/card';
import { DashboardCardBody } from '@console/internal/components/dashboard/dashboard-card/card-body';
import { DashboardCardHeader } from '@console/internal/components/dashboard/dashboard-card/card-header';
import { DashboardCardTitle } from '@console/internal/components/dashboard/dashboard-card/card-title';
import {
  DashboardItemProps,
  withDashboardResources,
} from '@console/internal/components/dashboards-page/with-dashboard-resources';
import { HealthBody } from '@console/internal/components/dashboard/health-card/health-body';
import { HealthItem } from '@console/internal/components/dashboard/health-card/health-item';
import { HealthState } from '@console/internal/components/dashboard/health-card/states';
import { STORAGE_HEALTH_QUERIES, StorageDashboardQuery } from '../../../../constants/queries';
import { filterCephAlerts } from '../../../../selectors';
import { cephClusterResource } from '../../../../constants/resources';
import { getCephHealthState } from './utils';

const HealthCard: React.FC<DashboardItemProps> = ({
  watchPrometheus,
  stopWatchPrometheusQuery,
  prometheusResults,
  watchAlerts,
  stopWatchAlerts,
  alertsResults,
  resources,
  watchK8sResource,
  stopWatchK8sResource,
}) => {
  React.useEffect(() => {
    watchAlerts();
    watchK8sResource(cephClusterResource);
    watchPrometheus(STORAGE_HEALTH_QUERIES[StorageDashboardQuery.CEPH_STATUS_QUERY]);
    return () => {
      stopWatchAlerts();
      stopWatchK8sResource(cephClusterResource);
      stopWatchPrometheusQuery(STORAGE_HEALTH_QUERIES[StorageDashboardQuery.CEPH_STATUS_QUERY]);
    };
  }, [
    watchK8sResource,
    stopWatchK8sResource,
    watchPrometheus,
    stopWatchPrometheusQuery,
    watchAlerts,
    stopWatchAlerts,
  ]);

  const queryResult = prometheusResults.getIn([
    STORAGE_HEALTH_QUERIES[StorageDashboardQuery.CEPH_STATUS_QUERY],
    'result',
  ]);

  const cephCluster = _.get(resources, 'ceph');
  const cephHealthState = getCephHealthState(queryResult, cephCluster);

  const alerts = filterCephAlerts(getAlerts(alertsResults));

  return (
    <DashboardCard>
      <DashboardCardHeader>
        <DashboardCardTitle>Health</DashboardCardTitle>
      </DashboardCardHeader>
      <DashboardCardBody isLoading={cephHealthState.state === HealthState.LOADING}>
        <HealthBody>
          <HealthItem state={cephHealthState.state} message={cephHealthState.message} />
        </HealthBody>
      </DashboardCardBody>
      {alerts.length > 0 && (
        <React.Fragment>
          <DashboardCardHeader className="co-alerts-card__border">
            <DashboardCardTitle>Alerts</DashboardCardTitle>
          </DashboardCardHeader>
          <DashboardCardBody>
            <AlertsBody>
              {alerts.map((alert) => (
                <AlertItem key={alert.fingerprint} alert={alert} />
              ))}
            </AlertsBody>
          </DashboardCardBody>
        </React.Fragment>
      )}
    </DashboardCard>
  );
};

export default withDashboardResources(HealthCard);
